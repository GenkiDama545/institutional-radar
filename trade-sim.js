/* Pure linear-position simulation, shared by the chart and scenario workspace. */
(function(root){
 'use strict';
 const number=v=>v===''||v==null?NaN:Number(v);
 function calculate(v){
  const entry=number(v.entry),stop=number(v.stop),capital=number(v.capital),leverage=number(v.leverage);
  const side=v.side==='short'?-1:1,fx=v.currency==='EUR'?number(v.fx):1;
  const fee=number(v.feePct??0)/100,slippage=number(v.slippagePct??0)/100,funding=number(v.fundingCost??0);
  const errors=[];
  if(!(entry>0&&stop>0&&capital>0&&leverage>=1))errors.push('Renseigne des prix, un capital et un levier valides (levier ≥ 1).');
  if(!(fx>0))errors.push('Renseigne le taux de conversion : unités de cotation pour 1 EUR.');
  if(!(fee>=0&&fee<1&&slippage>=0&&slippage<1&&Number.isFinite(funding)))errors.push('Vérifie les frais, le glissement et le financement.');
  if(side*(entry-stop)<=0)errors.push('Le stop doit être sous l’entrée en LONG, au-dessus en SHORT.');
  const targets=(v.targets||[]).map(t=>({price:number(t.price),pct:number(t.pct)}));
  if(targets.some(t=>!(t.pct>=0&&t.pct<=100)))errors.push('Chaque sortie doit représenter entre 0 et 100 % de la position initiale.');
  const allocation=targets.reduce((s,t)=>s+t.pct,0);
  if(Math.abs(allocation-100)>1e-7)errors.push('Répartis exactement 100 % de la position entre les objectifs.');
  const active=targets.filter(t=>t.pct>0);
  if(active.some(t=>!(t.price>0)||side*(t.price-entry)<=0))errors.push('Les objectifs utilisés doivent être bénéficiaires dans le sens choisi.');
  if(active.some((t,i)=>i>0&&side*(t.price-active[i-1].price)<0))errors.push('Les objectifs utilisés doivent être ordonnés dans le sens du trade.');
  if(errors.length)return {ok:false,errors,allocation};
  const riskPct=number(v.riskPct),distance=Math.abs(entry-stop);
  if(v.sizing==='risk'&&!(riskPct>0&&riskPct<=100))return {ok:false,errors:['Le risque doit être compris entre 0 et 100 %.']};
  const quantity=v.sizing==='risk'?capital*fx*riskPct/100/distance:capital*fx*leverage/entry;
  const notional=quantity*entry,margin=notional/leverage;
  const gross=p=>side*quantity*(p-entry);
  const costs=p=>quantity*(entry+p)*(fee+slippage);
  const risk=quantity*distance,stopNet=-risk-costs(stop)-funding;
  const rows=targets.map(t=>{
   const share=t.pct/100,fullGross=Number.isFinite(t.price)?gross(t.price):null;
   const gain=share?fullGross*share:0,cost=share?(costs(t.price)+funding)*share:0;
   return {...t,gross:gain,cost,net:gain-cost,fullGross,rr:fullGross==null?null:fullGross/risk};
  });
  return {ok:true,fx,quantity,notional,margin,risk,stopNet,allocation,rows,gross:rows.reduce((s,t)=>s+t.gross,0),cost:rows.reduce((s,t)=>s+t.cost,0),net:rows.reduce((s,t)=>s+t.net,0)};
 }
 function contracts(quantity,spec,base){
  if(!spec||spec.ctType!=='linear'||spec.ctValCcy!==base||!(Number(spec.ctVal)>0))return null;
  const multiplier=spec.ctMult===''||spec.ctMult==null?1:Number(spec.ctMult);
  if(!(multiplier>0))return null;
  const raw=quantity/(Number(spec.ctVal)*multiplier),lot=Number(spec.lotSz);
  const rounded=lot>0?Math.floor((raw+1e-10)/lot)*lot:raw;
  return {raw,rounded,min:Number(spec.minSz)||0,lot,belowMinimum:rounded<(Number(spec.minSz)||0)};
 }
 const api={calculate,contracts};root.RadarSim=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
