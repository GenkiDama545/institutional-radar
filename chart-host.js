/* Adapts existing analysis outputs to a shared chart. Never invokes the analysis engine. */
(function(root){
 'use strict';
 const C=root.RadarChartCore,S=root.RadarChartSeries,P=root.RadarChartPanel;
 const policy=Object.freeze({minimumHistory:300,warmup:100,maxLoad:3000,historyStep:600,maxSession:6000});
 const preferenceKey='ir_chart_visibility_v1';
 function preferences(){try{return C.state(JSON.parse(root.localStorage?.getItem(preferenceKey)||'{}')).visibility}catch(_){return {...C.defaults}}}
 function structure(frame,tf){
  if(!frame?.levels||!frame.c)return [];
  return [['support','Support'],['resistance','Résistance'],['nextSupport','Support suivant'],['nextResistance','Résistance suivante']].flatMap(([key,label])=>C.valid(frame.levels[key])&&frame.levels[key]>0?[{key:'structure-'+key,value:frame.levels[key],label,timeframe:tf,origin:'structure actuelle du moteur',asOf:frame.c.t+C.intervals[tf],color:'#b6c4cd'}]:[]);
 }
 function create(host,{math,loadHistory,onError}={}){
  const providers=new Map(),states=new Map(),modes=new Map();let panel=null,input=null,disposed=false,renderKey=null,loadSeq=0;
  function provider(tf,mode){const key=tf+'|'+mode;if(!providers.has(key))providers.set(key,S.create(math,{reference:mode,maxBars:policy.maxSession}));return providers.get(key);}
  function paint(next){
   if(disposed)return;input=next;const tf=next.timeframe,available=next.engineBars?.length>0;
   if(!modes.has(tf))modes.set(tf,next.preferEngine&&available?'engine':'historical');
   const mode=modes.get(tf),source=provider(tf,mode),referenceTime=mode==='engine'?(next.engineBars?.at(-1)?.t!=null?next.engineBars.at(-1).t+C.intervals[tf]:null):next.asOf;
   const snapshot=source.update(next.bars,{referenceBars:mode==='engine'?next.engineBars:null,asOf:referenceTime});
   const seedLabel=mode==='historical'&&snapshot.seed?'Indicateurs disponibles depuis '+P.stamp(snapshot.seed)+'. Les bougies antérieures restent consultables.':'';
   const vm=C.model({...next,asOf:referenceTime,reference:mode,bars:snapshot.bars,series:snapshot.series,version:snapshot.version,error:next.error||snapshot.error||(mode==='engine'&&!available?'Référence moteur indisponible pour cet horizon.':null),coverage:{notice:[next.notice,seedLabel,mode==='engine'?'Référence de l’analyse actuelle, pas une reconstitution de la création du verrou.':'Cette série historique ne prouve pas une ancienne décision.'].filter(Boolean).join(' ')}});
   if(panel&&renderKey!==tf){panel.dispose();panel=null;}renderKey=tf;
   if(!states.has(tf))states.set(tf,C.state(preferences()));
   const options={state:states.get(tf),hasEngine:available,onPreferences:v=>{try{root.localStorage?.setItem(preferenceKey,JSON.stringify(v))}catch(_){}},
    onReferenceChange:ref=>{if(ref==='engine'&&!input.engineBars?.length)return;modes.set(tf,ref);paint(input);},
    onRebase:()=>{if(modes.get(tf)==='historical'){source.rebase();paint(input);}},
    onLoadMore:loadHistory?async()=>{
     const startInput=input,seq=++loadSeq;if(snapshot.bars.length>=policy.maxLoad){paint({...input,notice:'Limite de chargement atteinte ('+policy.maxLoad+' bougies). Couverture indiquée ci-dessous.'});return;}
     const loaded=await loadHistory(tf,Math.min(policy.maxLoad,snapshot.bars.length+policy.historyStep));
     if(disposed||seq!==loadSeq||input.instrument!==startInput.instrument||input.timeframe!==tf)return;
     // Merge with the latest display input so a slower history response cannot replace a live tail.
     const merged=new Map(loaded.map(c=>[c.t,c]));for(const c of input.bars)merged.set(c.t,c);
     paint({...input,bars:[...merged.values()].sort((a,b)=>a.t-b.t)});
    }:null};
   if(!panel)panel=P.mount(host,vm,options);else{panel.setOptions(options);panel.update(vm);}
   return vm;
  }
  return {paint,dispose(){disposed=true;loadSeq++;panel?.dispose();providers.clear();states.clear();},get panel(){return panel;},get input(){return input;},error(message){if(input){paint({...input,error:message,ticker:input.ticker?{...input.ticker,fresh:false}:null});onError?.(message)}}};
 }
 root.RadarChartHost={create,policy,preferenceKey,structure};
})(typeof globalThis!=='undefined'?globalThis:this);
