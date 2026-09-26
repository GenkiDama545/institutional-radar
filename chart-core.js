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
 const density=Object.freeze({preferredPitch:9,minPitch:4,minCount:5,bodyFraction:.68,maxBody:14});
 function viewport(vm,s,width=800){
  if(!vm.bars.length)return s;
  const iv=intervals[vm.timeframe],plot=Math.max(40,width-84),last=vm.bars.at(-1).t+iv*.5,first=vm.bars[0].t-iv*.5;
  const minSpan=iv*Math.min(density.minCount,vm.bars.length),maxSpan=Math.max(minSpan,Math.min(last-first,iv*Math.floor(plot/density.minPitch)));
  let span=s.to>s.from?s.to-s.from:iv*Math.max(density.minCount,Math.floor(plot/density.preferredPitch));span=Math.max(minSpan,Math.min(maxSpan,span));
  let to=s.follow||s.to==null?last:s.to;to=Math.min(last,Math.max(first+span,to));s.to=to;s.from=to-span;return s;
 }
 function zoom(vm,s,width,factor,anchor=.5){
  viewport(vm,s,width);const span=s.to-s.from,pivot=s.from+span*Math.max(0,Math.min(1,anchor)),next=span*factor;
  s.from=pivot-next*anchor;s.to=s.from+next;s.follow=false;return viewport(vm,s,width);
 }
 function pan(vm,s,width,fraction){viewport(vm,s,width);const shift=(s.to-s.from)*fraction;s.from+=shift;s.to+=shift;s.follow=false;return viewport(vm,s,width);}
 function visible(vm,s){return vm.bars.filter(c=>c.t>=s.from&&c.t<=s.to);}
 function nearest(vm,time){let lo=0,hi=vm.bars.length-1;if(hi<0)return null;while(lo<hi){const mid=(lo+hi)>>1;if(vm.bars[mid].t<time)lo=mid+1;else hi=mid;}const a=vm.bars[lo],b=vm.bars[lo-1];return b&&Math.abs(b.t-time)<=Math.abs(a.t-time)?b:a;}
 function activeOverlays(vm,s){return [...vm.overlays.filter(o=>!['tp2','tp3'].includes(o.key)||s.visibility[o.key]),...(s.visibility.structure?vm.structure:[])].filter(o=>valid(o.value)&&o.value>0);}
 function extent(vm,s){
  const cs=visible(vm,s);if(!cs.length)return {min:0,max:1,low:null,high:null};
  const low=Math.min(...cs.map(c=>c.l)),high=Math.max(...cs.map(c=>c.h)),levels=s.fitLevels?activeOverlays(vm,s).map(o=>o.value):[];
  const a=Math.min(low,...levels),b=Math.max(high,...levels),pad=Math.max(b-a,Math.abs(b)*.0001)*.08;
  return {min:Math.max(0,a-pad),max:b+pad,low,high};
 }
 const api={intervals,valid,immutable,bars,overlays,model,state,defaults,density,viewport,zoom,pan,visible,nearest,activeOverlays,extent};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;root.RadarChartCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
