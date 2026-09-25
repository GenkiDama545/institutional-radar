/* Reuse historical bars; always refresh the mutable tail before returning data. */
(function(root){
 'use strict';
 const intervals={'1m':60000,'5m':300000,'15m':900000,'30m':1800000,'1H':3600000,'4H':14400000,'1D':86400000};
 function decode(rows){return rows.map(a=>({t:+a[0],o:+a[1],h:+a[2],l:+a[3],c:+a[4],v:+a[7],baseVol:+a[5],quoteVol:+a[7],confirm:+a[8]})).filter(c=>[c.t,c.o,c.h,c.l,c.c,c.v].every(Number.isFinite));}
 function merge(a,b){const m=new Map(a.map(c=>[c.t,c]));b.forEach(c=>m.set(c.t,c));return [...m.values()].sort((a,b)=>a.t-b.t);}
 function create(get,{now=()=>Date.now(),maxEntries=4000}={}){
  const cache=new Map(),pending=new Map();const stats={requests:0,rows:0,reused:0,shared:0};
  async function request(path){stats.requests++;const result=decode(await get(path));stats.rows+=result.length;return result;}
  async function read(id,bar,need,force=false){
   const key=id+'|'+bar,old=cache.get(key),ms=intervals[bar];
   const reusable=!force&&old&&old.bars.length>=need&&now()-old.fullAt<1800000&&ms;
   const last=old?.bars.at(-1)?.t;
   const tail=reusable?Math.min(300,Math.max(3,Math.ceil((now()-last)/ms)+3)):Math.min(300,need);
   const head=await request('/market/candles?instId='+encodeURIComponent(id)+'&bar='+encodeURIComponent(bar)+'&limit='+tail);
   if(!head.length)return [];
   const overlap=reusable&&head.some(c=>old.bars.some(o=>o.t===c.t));
   let data=overlap?merge(old.bars,head):merge([],head),cursor=data[0]?.t,guard=0;
   if(overlap)stats.reused+=Math.max(0,Math.min(need,data.length)-head.length);
   // OKX `after` requests older data; the response itself may be newest first.
   while(data.length<need&&cursor&&guard++<14){
    const page=await request('/market/history-candles?instId='+encodeURIComponent(id)+'&bar='+encodeURIComponent(bar)+'&limit='+Math.min(300,need-data.length)+'&after='+cursor);
    if(!page.length)break;
    const older=page.filter(c=>c.t<cursor);if(!older.length)break;
    data=merge(older,data);cursor=data[0].t;
   }
   const complete=data.slice(-Math.max(need,overlap?old.bars.length:need));
   cache.delete(key);cache.set(key,{bars:complete,fullAt:overlap?old.fullAt:now()});
   while(cache.size>maxEntries)cache.delete(cache.keys().next().value);
   return data.slice(-need).map(c=>({...c}));
  }
  async function load(id,bar='1H',limit=90,force=false){
   const need=Math.max(2,Math.min(3000,Number(limit)||90)),key=id+'|'+bar+'|'+need+'|'+force;
   if(pending.has(key)){stats.shared++;return (await pending.get(key)).map(c=>({...c}));}
   const task=read(id,bar,need,force);pending.set(key,task);
   try{return await task}finally{pending.delete(key)}
  }
  return {load,stats,clear:()=>cache.clear()};
 }
 const api={create,decode,merge};root.RadarCandles=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
