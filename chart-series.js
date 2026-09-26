/* Indicator presentation only. Math is injected from the existing application helpers. */
(function(root){
 'use strict';
 const core=typeof module!=='undefined'&&module.exports?require('./chart-core.js'):root.RadarChartCore;
 function calculate(bars,math){
  if(!bars.length)return {};
  const s=math.stochRsi(bars);
  const arrays={ema20:math.ema(bars,20),ema50:math.ema(bars,50),supertrend:math.supertrend(bars),rsi:math.rsi(bars),stochK:s.k,stochD:s.d};
  return Object.fromEntries(Object.entries(arrays).map(([k,values])=>[k,Object.fromEntries(bars.map((c,i)=>[c.t,Number.isFinite(values[i])?values[i]:null]))]));
 }
 function create(math,{reference='historical',maxBars=6000}={}){
  let data=[],series={},seed=null,version=0,signature='',referenceStamp=null,error=null;
  function update(input,{referenceBars=null,asOf=null}={}){
   const incoming=core.bars(input),merged=new Map(data.map(c=>[c.t,c]));for(const c of incoming)merged.set(c.t,c);
   data=[...merged.values()].sort((a,b)=>a.t-b.t);
   if(data.length>maxBars){data=data.slice(-maxBars);error='Limite de session atteinte : renouveler explicitement la référence historique.';}
   if(seed==null&&data.length)seed=data[0].t;
   const calculation=reference==='engine'?core.bars(referenceBars||[]).filter(c=>c.confirm===1):data.filter(c=>c.t>=seed);
   // Prepending history must not move the EMA/RSI seed or recompute existing values.
   const next=JSON.stringify(calculation);
   if(!error&&next!==signature){series=calculate(calculation,math);signature=next;version++;}
   referenceStamp=asOf;
   return snapshot();
  }
  function snapshot(){return core.immutable({bars:data,series,reference,seed,version,asOf:referenceStamp,error});}
  function rebase(){seed=data[0]?.t??null;signature='';error=null;return update(data,{asOf:referenceStamp});}
  function aligned(visible){return Object.fromEntries(Object.entries(series).map(([k,values])=>[k,visible.map(c=>values[c.t]??null)]));}
  return {update,snapshot,rebase,aligned};
 }
 const api={create,calculate};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.RadarChartSeries=api;
})(typeof globalThis!=='undefined'?globalThis:this);
