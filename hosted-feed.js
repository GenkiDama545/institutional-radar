(function(root){
 function normalize(payload,now=Date.now()){
  if(!payload||!Array.isArray(payload.events))throw Error('Réponse du service invalide');
  return {fresh:payload.fresh===true&&Number.isFinite(Number(payload.lastTradeAt))&&now-Number(payload.lastTradeAt)<120000,
   coverage:Number(payload.coverage)||0,
   events:payload.events.filter(e=>/^[A-Z0-9]+-USDT$/.test(e.instId)&&Number.isFinite(Number(e.minute))&&Number.isFinite(Number(e.ratio))&&Number.isFinite(Number(e.movePct))&&Number.isFinite(Number(e.usd)))
    .map(e=>({...e,live:e.live===true&&now-Number(e.updatedAt)<120000,
      markouts:Object.fromEntries([5,15,60].filter(min=>Number.isFinite(Number(e.markouts?.[min]?.movePct))&&Number.isFinite(Number(e.markouts?.[min]?.observedAt))).map(min=>[min,{movePct:Number(e.markouts[min].movePct),observedAt:Number(e.markouts[min].observedAt),delayMs:Number(e.markouts[min].delayMs)||0}]))
    })).sort((a,b)=>b.detectedAt-a.detectedAt).slice(0,60)};
 }
 root.RadarHosted={normalize};
})(globalThis);
