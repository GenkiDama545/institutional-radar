// Pure market screening rules. No network calls, DOM access, or stored state.
(function(root){
 function spotAnalysisQueue(assets,favorites={}){
  const eligible=assets.filter(x=>x.market==='spot'&&x.price>0&&x.volUsd>0);
  // This score orders the queue; it never excludes an asset or contributes to
  // the final scenario score, which is calculated from the multi-horizon model.
  const movement=x=>Math.min(35,Math.abs(x.chg||0))*Math.min(1,Math.log10(1+x.volUsd)/6)+Math.min(20,Math.max(0,(x.high-x.low)/x.price*100));
  return eligible.sort((a,b)=>Number(!!favorites[b.id])-Number(!!favorites[a.id])||movement(b)-movement(a)||b.volUsd-a.volUsd);
 }
 function bookDepthUsd(book,mid){
  if(!book||!(mid>0))return null;
  const ts=Number(book.ts);
  if(!Number.isFinite(ts)||Date.now()-ts>120000)return null;
  const sum=(levels,side)=>Array.isArray(levels)?levels.reduce((total,row)=>{const px=Number(row[0]),qty=Number(row[1]);return px>0&&qty>0&&Math.abs(px/mid-1)<=.01&&(side==='bid'?px<=mid:px>=mid)?total+px*qty:total},0):0;
  const levels=side=>Array.isArray(side)?side.map(row=>({price:Number(row[0]),base:Number(row[1])})).filter(row=>row.price>0&&row.base>0):[];
  return {bidUsd:sum(book.bids,'bid'),askUsd:sum(book.asks,'ask'),bids:levels(book.bids),asks:levels(book.asks),ts};
 }
 // Indicative round trip for a small order: consume asks to buy, bids to sell.
 // This is a snapshot estimate; fees, future depth and execution are not guaranteed.
 function spotImpact(depth,quoteUsd=100){
  if(!depth||!(quoteUsd>0)||!Array.isArray(depth.asks)||!Array.isArray(depth.bids))return null;
  let remaining=quoteUsd,baseBought=0;
  for(const level of [...depth.asks].sort((a,b)=>a.price-b.price)){
   const used=Math.min(remaining,level.price*level.base);
   baseBought+=used/level.price;remaining-=used;
   if(remaining<1e-8)break;
  }
  if(remaining>1e-8||!(baseBought>0))return null;
  let baseLeft=baseBought,quoteSold=0;
  for(const level of [...depth.bids].sort((a,b)=>b.price-a.price)){
   const used=Math.min(baseLeft,level.base);
   quoteSold+=used*level.price;baseLeft-=used;
   if(baseLeft<1e-10)break;
  }
  if(baseLeft>1e-10)return null;
  return {roundTripPct:Math.max(0,(1-quoteSold/quoteUsd)*100),quoteUsd};
 }
 // A narrow spread is necessary, but this alone cannot establish order-book depth.
 function executionCheck(x){
  if(!x?.marketFresh||!Number.isFinite(x.marketTs)||Date.now()-x.marketTs>120000)return {ok:false,reason:'Prix non actualisé après le scan'};
  if(!Number.isFinite(x.spreadPct))return {ok:false,reason:'Écart achat/vente indisponible'};
  if(x.spreadPct>1)return {ok:false,reason:'Écart achat/vente trop large'};
  if(x.market==='spot'){
   if(!x.bookDepth||Date.now()-x.bookDepth.ts>120000)return {ok:false,reason:'Profondeur Spot non vérifiée'};
   if(Math.min(x.bookDepth.bidUsd,x.bookDepth.askUsd)<500)return {ok:false,reason:'Carnet Spot trop mince près du prix'};
   const impact=spotImpact(x.bookDepth);
   if(!impact)return {ok:false,reason:'Carnet insuffisant pour simuler un aller-retour Spot de 100 USDT'};
   if(impact.roundTripPct>1)return {ok:false,reason:`Coût immédiat Spot estimé ${impact.roundTripPct.toFixed(2)} % hors frais : trop élevé`};
   return {ok:true,reason:`Carnet Spot : coût immédiat estimé ${impact.roundTripPct.toFixed(2)} % pour 100 USDT, hors frais`};
  }
  if(x.volUsd<100000)return {ok:false,reason:'Volume X-Perp 24 h insuffisant sans profondeur de carnet vérifiée'};
  return {ok:true,reason:'Écart et activité X-Perp vérifiés • profondeur à confirmer'};
 }
 root.RadarMarket={spotAnalysisQueue,bookDepthUsd,spotImpact,executionCheck};
})(globalThis);
