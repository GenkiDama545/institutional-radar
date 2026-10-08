/* Descriptive movement comparison. No signals, trade decisions or engine weights. */
(function(root){
 'use strict';
 const hour=3600000,day=24*hour;
 const policy=Object.freeze({version:1,pageSize:300,maxPages:8,batchSize:5,quoteAgeMs:120000,checkGapMs:day,checkExpiryMs:7*day,closeSwingPct:1,nearScore:80,windowFloor:70});
 const windows=Object.freeze([{key:'15m-1d',tf:'15m',days:1,label:'15 min · 24 h',ms:900000},{key:'15m-7d',tf:'15m',days:7,label:'15 min · 7 jours',ms:900000},{key:'1H-7d',tf:'1H',days:7,label:'1 h · 7 jours',ms:hour},{key:'1H-30d',tf:'1H',days:30,label:'1 h · 30 jours',ms:hour}].map(Object.freeze));
 const anchor=now=>Math.floor(now/hour)*hour;
 const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
 const median=a=>{if(!a.length)return null;const s=[...a].sort((a,b)=>a-b),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2};
 const clamp=x=>Math.max(0,Math.min(1,x));
 function swings(bars,threshold=policy.closeSwingPct){
  if(!bars.length)return [];
  let pivot=bars[0],extreme=pivot,direction=0,confirmedStart=false;const legs=[];
  for(const b of bars.slice(1)){
   if(!direction){if((b.c/pivot.c-1)*100>=threshold){direction=1;extreme=b}else if((1-b.c/pivot.c)*100>=threshold){direction=-1;extreme=b}continue}
   if(direction===1?b.c>extreme.c:b.c<extreme.c)extreme=b;
   const reversal=direction===1?(1-b.c/extreme.c)*100:(b.c/extreme.c-1)*100;
   if(reversal+1e-10>=threshold){
    if(confirmedStart)legs.push({pct:Math.abs(extreme.c/pivot.c-1)*100,hours:(extreme.t-pivot.t)/hour,direction});
    pivot=extreme;extreme=b;direction=-direction;confirmedStart=true;
   }
  }
  return legs; // Boundary legs and the unfinished leg are deliberately censored.
 }
 function measure(input,w,end){
  const count=w.days*day/w.ms,start=end-w.days*day,needed=count+1;
  const rows=(input||[]).filter(b=>b.t>=start-w.ms&&b.t<end).slice().sort((a,b)=>a.t-b.t),unique=new Set(rows.map(b=>b.t));
  const valid=b=>[b.t,b.o,b.h,b.l,b.c,b.v].every(Number.isFinite)&&Math.min(b.o,b.h,b.l,b.c)>0&&b.v>=0&&b.h>=Math.max(b.o,b.c,b.l)&&b.l<=Math.min(b.o,b.c,b.h)&&Number(b.confirm)===1;
  const usable=rows.filter(valid),coverage=Math.min(100,new Set(usable.filter(b=>(b.t-start)%w.ms===0).map(b=>b.t)).size/needed*100);
  const base={key:w.key,label:w.label,tf:w.tf,days:w.days,start,end,expected:needed,received:rows.length,coverage};
  if(rows.length!==needed||unique.size!==needed||usable.length!==needed||rows.some((b,i)=>b.t!==start-w.ms+i*w.ms))return {...base,ok:false,reason:'Historique incomplet, non confirmé ou discontinu ; fenêtre non comparée.'};
  const bars=rows.slice(1),tr=[],wicks=[],changes=[];
  for(let i=0;i<bars.length;i++){const b=bars[i],prev=rows[i],range=b.h-b.l;tr.push(Math.max(range,Math.abs(b.h-prev.c),Math.abs(b.l-prev.c))/prev.c*100);if(range>0)wicks.push(clamp((range-Math.abs(b.c-b.o))/range));changes.push(Math.abs(b.c-prev.c))}
  const legs=swings(rows),sizes=legs.map(x=>x.pct),swingPct=median(sizes),path=changes.reduce((s,v)=>s+v,0),net=bars.at(-1).c-rows[0].c;
  const efficiency=path>0?clamp(Math.abs(net)/path):0,regularity=legs.length>=4&&swingPct>0?clamp(1-median(sizes.map(v=>Math.abs(v-swingPct)))/swingPct):null;
  return {...base,ok:true,trPct:median(tr),wickShare:mean(wicks),efficiency,returnPct:net/rows[0].c*100,regime:path===0?'Immobile':efficiency>=.35?(net>=0?'Direction haussière':'Direction baissière'):'Allers-retours',swingCount:legs.length,swingsPerDay:legs.length/w.days,swingPct,swingHours:median(legs.map(x=>x.hours)),regularity,volumePerDay:bars.reduce((s,b)=>s+b.v,0)/w.days};
 }
 function profile(series,end){return {asOf:end,windows:Object.fromEntries(windows.map(w=>[w.key,measure(series[w.tf],w,end)]))}}
 function compare(candidate,reference){
  const scores=[],details=[];
  for(const w of windows){const a=candidate?.windows[w.key],b=reference?.windows[w.key];
   if(!a?.ok||!b?.ok||candidate.asOf!==reference.asOf||!(a.trPct>0&&b.trPct>0)||a.wickShare===null||b.wickShare===null){details.push({key:w.key,label:w.label,score:null,reason:'Données comparables insuffisantes.'});continue}
   const amplitude=Math.min(a.trPct,b.trPct)/Math.max(a.trPct,b.trPct),rhythm=1-Math.abs(a.swingsPerDay-b.swingsPerDay)/Math.max(a.swingsPerDay,b.swingsPerDay,1),wicks=1-Math.abs(a.wickShare-b.wickShare),directionality=1-Math.abs(a.efficiency-b.efficiency);
   const score=25*(amplitude+rhythm+wicks+directionality);scores.push(score);details.push({key:w.key,label:w.label,score,amplitudeRatio:a.trPct/b.trPct,swingDelta:a.swingsPerDay-b.swingsPerDay,wickDelta:(a.wickShare-b.wickShare)*100,efficiencyDelta:(a.efficiency-b.efficiency)*100});
  }
  const complete=scores.length===windows.length,score=complete?mean(scores):null,close=complete&&score>=policy.nearScore&&Math.min(...scores)>=policy.windowFloor;
  return {complete,score,close,details,label:!complete?'Comparaison partielle':close?'Proximité sur les 4 fenêtres':'Profil différent ou variable'};
 }
 function execution(asset,now=Date.now()){
  const fresh=Number.isFinite(asset?.marketTs)&&asset.marketTs<=now&&now-asset.marketTs<=policy.quoteAgeMs,bid=asset?.bidPx,ask=asset?.askPx;
  return {quoteAt:asset?.marketTs??null,fresh,spreadPct:fresh&&Number.isFinite(bid)&&Number.isFinite(ask)&&bid>0&&ask>=bid?(ask-bid)/((ask+bid)/2)*100:null};
 }
 function candidates(assets,selected,seen=[],now=Date.now()){
  const counts=new Map();for(const a of assets)counts.set(a.sym,(counts.get(a.sym)||0)+1);
  return assets.filter(a=>a.market==='xperp'&&counts.get(a.sym)===1&&!selected.includes(a.sym)&&!seen.includes(a.id)&&a.volUsd>0&&execution(a,now).fresh).sort((a,b)=>b.volUsd-a.volUsd||a.id.localeCompare(b.id));
 }
 function observe(previous,{asOf,candidateId,referenceId,comparison}){
  const pass=!!comparison?.complete&&!!comparison.close;
  const same=previous?.version===policy.version&&previous.candidateId===candidateId&&previous.referenceId===referenceId&&previous.pass&&Number.isFinite(previous.firstAt)&&previous.firstAt>=0&&previous.lastAt<=asOf&&previous.firstAt<=previous.lastAt&&asOf-previous.lastAt<=policy.checkExpiryMs;
  const firstAt=pass?(same?previous.firstAt:asOf):null;
  return {version:policy.version,candidateId,referenceId,firstAt,lastAt:asOf,pass,confirmed:pass&&asOf-firstAt>=policy.checkGapMs};
 }
 const cancelled=()=>Object.assign(Error('Recherche interrompue.'),{cancelled:true});
 async function collect({get,decode,resolve,selected,mode='selected',seen=[],job={cancelled:false},cache=new Map(),now=()=>Date.now(),onProgress=()=>{}}){
  if(!['selected','discover'].includes(mode)||!Array.isArray(selected)||!selected.includes('NEAR')||selected.length>15||new Set(selected).size!==selected.length||selected.some(s=>!/^([A-Z0-9]{1,20})$/.test(s)))throw Error('Sélection de comparaison invalide.');
  const asOf=anchor(now()),startedAt=now(),report={mode,asOf,startedAt,rows:[],requests:0,cacheHits:0,maxRequests:3+(mode==='discover'?policy.batchSize+1:selected.length)*2*policy.maxPages};
  const check=()=>{if(job.cancelled)throw cancelled()};
  async function request(path){check();if(report.requests>=report.maxRequests)throw Error('Budget de lectures atteint.');report.requests++;onProgress({...report});const data=await get(path);check();return data}
  const instruments=await request('/public/instruments?instType=FUTURES'),tickers=await request('/market/tickers?instType=FUTURES');
  const assets=resolve(instruments,tickers),members=selected.map(sym=>{const matches=assets.filter(a=>a.sym===sym&&a.market==='xperp');return {sym,asset:matches.length===1?matches[0]:null,reason:matches.length>1?'Plusieurs contrats actifs : aucun choix automatique.':'X-Perp ou cotation indisponible.'}});
  let targets=members;
  if(mode==='discover'){
   const near=members.find(x=>x.sym==='NEAR');if(!near?.asset)throw Error('NEAR indisponible ou ambigu : exploration suspendue.');
   const pool=candidates(assets,selected,seen,now());report.remaining=pool.length;targets=[near,...pool.slice(0,policy.batchSize).map(asset=>({sym:asset.sym,asset}))];
   if(targets.length===1)throw Error('Aucun nouveau contrat admissible dans ce catalogue. Tu peux recommencer l’exploration.');
  }
  report.catalogueCount=assets.length;report.targetCount=targets.length;
  async function read(asset,tf,ms,days){
   const key=asset.id+'|'+tf+'|'+asOf;
   if(cache.has(key)){report.cacheHits++;return cache.get(key)}
   const from=asOf-days*day-ms,data=[];let cursor=asOf;
   for(let page=0;page<policy.maxPages;page++){
    const raw=await request('/market/history-candles?instId='+encodeURIComponent(asset.id)+'&bar='+tf+'&limit='+policy.pageSize+'&after='+cursor);
    const parsed=decode(raw),older=parsed.filter(b=>b.t<cursor).sort((a,b)=>a.t-b.t);
    if(!older.length)break;data.push(...older);const next=older[0].t;if(next>=cursor)break;cursor=next;if(cursor<=from)break;
   }
   const bars=data.sort((a,b)=>a.t-b.t);if(measure(bars,{key:'cache',tf,ms,days},asOf).ok)cache.set(key,bars);while(cache.size>64)cache.delete(cache.keys().next().value);return bars;
  }
  for(const member of targets){
   check();onProgress({...report,current:member.sym});
   const row={sym:member.sym,asset:member.asset||null,reason:member.reason||'',seriesErrors:[]};
   if(member.asset){const series={};for(const [tf,ms,days] of [['15m',900000,7],['1H',hour,30]]){try{series[tf]=await read(member.asset,tf,ms,days)}catch(e){if(e.cancelled)throw e;series[tf]=[];row.seriesErrors.push(tf+' : '+e.message)}}row.profile=profile(series,asOf);row.execution=execution(member.asset,now())}
   report.rows.push(row);onProgress({...report,current:member.sym});
  }
  check();const reference=report.rows.find(x=>x.sym==='NEAR');
  for(const row of report.rows)if(row.sym!=='NEAR')row.comparison=compare(row.profile,reference?.profile);
  // Refresh executable quotes after history loading; old quotes are never displayed as current spreads.
  try{const fresh=resolve(instruments,await request('/market/tickers?instType=FUTURES')),quotes=new Map(fresh.map(a=>[a.id,a]));for(const row of report.rows)if(row.asset)row.execution=execution(quotes.get(row.asset.id),now())}
  catch(e){if(e.cancelled)throw e;report.executionError=e.message;for(const row of report.rows)if(row.asset)row.execution={fresh:false,quoteAt:null,spreadPct:null}}
  report.finishedAt=now();return report;
 }
 const api={policy,windows,anchor,median,swings,measure,profile,compare,execution,candidates,observe,collect};root.RadarMovement=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
