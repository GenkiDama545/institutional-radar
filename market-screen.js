// Pure market screening rules. No network calls, DOM access, or stored state.
(function(root){
 function minuteVolumePulse(rows){
  if(!Array.isArray(rows))return null;
  const bars=rows.map(r=>({ts:Number(r[0]),close:Number(r[4]),quote:Number(r[7]),confirm:Number(r[8])})).filter(b=>Number.isFinite(b.ts)&&Number.isFinite(b.quote)&&b.quote>=0&&Number.isFinite(b.close)).sort((a,b)=>a.ts-b.ts);
  const completed=bars.filter(b=>b.confirm===1),baseline=completed.slice(-21,-1).map(b=>b.quote).sort((a,b)=>a-b);
  if(baseline.length<8)return null;
  const typical=(baseline[Math.floor((baseline.length-1)/2)]+baseline[Math.ceil((baseline.length-1)/2)])/2;
  const latest=bars.at(-1),lastCompleted=completed.at(-1),observed=latest?.confirm===0&&latest.quote>(lastCompleted?.quote||0)?latest:lastCompleted;
  const recent=observed?.quote||0,previous=bars[bars.indexOf(observed)-1];
  return {ratio:typical>0?recent/typical:recent>0?Infinity:0,recentUsd:recent,baselineUsd:typical,priceMovePct:previous?.close>0?(observed.close/previous.close-1)*100:null,ts:observed?.ts};
 }
 function isDiscovery(x){const p=x?.minutePulse;return !!(p&&p.recentUsd>=200&&p.ratio>=3&&Number.isFinite(p.priceMovePct)&&Math.abs(p.priceMovePct)>=.5)}
 function selectSpotForAnalysis(assets,favorites={},limit=150){
  const eligible=assets.filter(x=>x.market==='spot'&&x.price>0&&x.volUsd>0);
  const byVolume=[...eligible].sort((a,b)=>b.volUsd-a.volUsd).slice(0,Math.min(30,limit));
  const burst=x=>x.minutePulse?.recentUsd>=200&&x.minutePulse?.ratio>=3;
  const pulseScore=x=>Math.log10(1+x.minutePulse.recentUsd)*Math.min(30,x.minutePulse.ratio);
  const byPulse=eligible.filter(burst).sort((a,b)=>pulseScore(b)-pulseScore(a));
  const movement=x=>Math.min(35,Math.abs(x.chg||0))*Math.min(1,Math.log10(1+x.volUsd)/6)+Math.min(20,Math.max(0,(x.high-x.low)/x.price*100));
  const byOpportunity=[...eligible].sort((a,b)=>movement(b)-movement(a)||b.volUsd-a.volUsd);
  const picked=new Map(byVolume.map(x=>[x.id,x]));
  for(const x of byPulse){if(picked.size>=Math.min(limit,120))break;picked.set(x.id,x)}
  for(const x of byOpportunity){if(picked.size>=limit)break;picked.set(x.id,x)}
  for(const x of eligible)if(favorites[x.id])picked.set(x.id,x);
  return [...picked.values()];
 }
 function bookDepthUsd(book,mid){
  if(!book||!(mid>0))return null;
  const ts=Number(book.ts);
  if(!Number.isFinite(ts)||Date.now()-ts>120000)return null;
  const sum=(levels,side)=>Array.isArray(levels)?levels.reduce((total,row)=>{const px=Number(row[0]),qty=Number(row[1]);return px>0&&qty>0&&Math.abs(px/mid-1)<=.01&&(side==='bid'?px<=mid:px>=mid)?total+px*qty:total},0):0;
  return {bidUsd:sum(book.bids,'bid'),askUsd:sum(book.asks,'ask'),ts};
 }
 // A narrow spread is necessary, but this alone cannot establish order-book depth.
 function executionCheck(x){
  if(!x?.marketFresh||!Number.isFinite(x.marketTs)||Date.now()-x.marketTs>120000)return {ok:false,reason:'Prix non actualisé après le scan'};
  if(!Number.isFinite(x.spreadPct))return {ok:false,reason:'Écart achat/vente indisponible'};
  if(x.spreadPct>1)return {ok:false,reason:'Écart achat/vente trop large'};
  if(x.volUsd<100000&&(x.minutePulse?.recentUsd||0)<5000)return {ok:false,reason:'Liquidité insuffisante pour classer un scénario'};
  if(x.market==='spot'){
   if(!x.bookDepth||Date.now()-x.bookDepth.ts>120000)return {ok:false,reason:'Profondeur Spot non vérifiée'};
   if(Math.min(x.bookDepth.bidUsd,x.bookDepth.askUsd)<500)return {ok:false,reason:'Carnet Spot trop mince près du prix'};
   return {ok:true,reason:'Écart, activité et carnet Spot vérifiés • glissement à confirmer'};
  }
  return {ok:true,reason:'Écart et activité X-Perp vérifiés • profondeur à confirmer'};
 }
 root.RadarMarket={minuteVolumePulse,isDiscovery,selectSpotForAnalysis,bookDepthUsd,executionCheck};
})(globalThis);
