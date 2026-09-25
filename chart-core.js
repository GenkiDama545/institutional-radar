/* Read-only chart contracts. No network, storage, scoring or scenario lifecycle. */
(function(root){
 'use strict';
 const intervals=Object.freeze({'1m':60000,'5m':300000,'15m':900000,'30m':1800000,'1H':3600000,'4H':14400000,'1D':86400000});
 const valid=v=>typeof v==='number'&&Number.isFinite(v);
 function immutable(value){
  if(Array.isArray(value))return Object.freeze(value.map(immutable));
  if(value&&typeof value==='object')return Object.freeze(Object.fromEntries(Object.entries(value).map(([k,v])=>[k,immutable(v)])));
  return value;
 }
 function bars(input){
  const byTime=new Map();
  for(const c of input||[])if(c&&['t','o','h','l','c','v'].every(k=>valid(c[k]))&&c.t>=0&&c.l>0&&c.h>=Math.max(c.o,c.c,c.l)&&c.l<=Math.min(c.o,c.c)&&c.v>=0&&[0,1].includes(Number(c.confirm)))byTime.set(c.t,{...c,confirm:Number(c.confirm)});
  return [...byTime.values()].sort((a,b)=>a.t-b.t);
 }
 function overlays(input){return (input||[]).filter(o=>o&&valid(o.value)&&o.value>0).map(o=>({...o}));}
 function model(input){
  return immutable({instrument:input.instrument||'',timeframe:input.timeframe||'1H',quote:input.quote||'USD',reference:input.reference||'historical',asOf:input.asOf??null,version:input.version??0,bars:bars(input.bars),series:input.series||{},overlays:overlays(input.overlays),events:input.events||[],ticker:input.ticker||null,structure:input.structure||[],coverage:input.coverage||null,error:input.error||null});
 }
 const defaults=Object.freeze({ema20:true,ema50:true,supertrend:false,rsi:false,stoch:false,tp2:false,tp3:false,structure:false,closedPrice:false,formingPrice:false});
 function state(visibility={}){return {from:null,to:null,selectedTs:null,pinned:false,hoverTs:null,follow:true,fitLevels:false,visibility:{...defaults,...Object.fromEntries(Object.keys(defaults).filter(k=>typeof visibility[k]==='boolean').map(k=>[k,visibility[k]]))}};}
 const api={intervals,valid,immutable,bars,overlays,model,state,defaults};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;root.RadarChartCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
