// Selection policy only. These candidates are not a measured similarity ranking.
(function(root){
 const key='ir_focus_universe_v1';
 const defaults=Object.freeze(['NEAR','SUI','HYPE','AVAX','SOL']);
 const maxAssets=15,refreshMs=60000;
 function symbols(input){
  const values=Array.isArray(input)?input:String(input||'').split(/[\s,;]+/);
  const selected=['NEAR'];
  for(const value of values){const symbol=String(value).trim().toUpperCase();if(!symbol)continue;
   if(!/^[A-Z0-9]{1,20}$/.test(symbol))throw Error('Utilise les symboles seuls, séparés par des virgules (ex. SUI, SOL).');
   if(!selected.includes(symbol))selected.push(symbol);
  }
  if(selected.length>maxAssets)throw Error('La sélection est limitée à 15 actifs, NEAR compris.');
  return selected;
 }
 function config(value){
  try{return {scope:value?.scope==='wide'?'wide':'focus',symbols:symbols(value?.symbols??defaults),auto:value?.auto!==false}}catch{return {scope:'focus',symbols:[...defaults],auto:true}}
 }
 function resolve(selected,assets){
  return symbols(selected).map(sym=>{const matches=assets.filter(x=>x.market==='xperp'&&x.sym===sym);
   return {sym,asset:matches.length===1?matches[0]:null,reason:matches.length>1?'Plusieurs contrats actifs : sélection exacte à préciser.':'Aucun X-Perp actif avec cotation utilisable dans la réponse OKX.'};
  });
 }
 const api={key,defaults,maxAssets,refreshMs,symbols,config,resolve};
 root.RadarFocus=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
