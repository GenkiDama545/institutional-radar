const API='https://www.okx.com/api/v5';
const APP_VERSION='V8.7.3';
const STORAGE={scan:'ir_scan_history_v866',learning:'ir_learning_journal_v866',locks:'ir_scenario_locks_v871'};
function safeJSON(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch(_){return fallback}}
function migrateStorage(){
  // One canonical key per subsystem. Legacy data is copied once, never written again.
  if(!localStorage.getItem(STORAGE.scan)){const legacy=localStorage.getItem('ir_hist_v63')||localStorage.getItem('ir_hist_v52');if(legacy)localStorage.setItem(STORAGE.scan,legacy)}
  if(!localStorage.getItem(STORAGE.learning)){const legacy=localStorage.getItem('ir_scenario_journal_v86')||localStorage.getItem('ir_scenario_journal_v82');if(legacy)localStorage.setItem(STORAGE.learning,legacy)}
}
migrateStorage();
let shortScanErrors=0, scanErrorReasons={}, scanRunning=false;let all=[],current=null,currentScenarioInstrument=null,filter='hot',marketMode='all',history=safeJSON(STORAGE.scan,{}),theme='beige';
const $=x=>document.getElementById(x); const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const nullableNumber=x=>x==null||x===''||!Number.isFinite(Number(x))?null:Number(x);
const n=x=>nullableNumber(x)??0;
const price=x=>{if(nullableNumber(x)==null)return 'N/D';x=n(x);if(!Number.isFinite(x))return 'N/D';const a=Math.abs(x);if(a===0)return '0';if(a<1e-9)return x.toLocaleString('fr-FR',{minimumFractionDigits:14,maximumFractionDigits:16,useGrouping:false});if(a<1e-6)return x.toLocaleString('fr-FR',{minimumFractionDigits:12,maximumFractionDigits:14,useGrouping:false});if(a<1e-4)return x.toLocaleString('fr-FR',{minimumFractionDigits:10,maximumFractionDigits:12,useGrouping:false});if(a<1e-2)return x.toLocaleString('fr-FR',{minimumFractionDigits:8,maximumFractionDigits:10,useGrouping:false});if(a<1)return x.toLocaleString('fr-FR',{minimumFractionDigits:6,maximumFractionDigits:8,useGrouping:false});if(a<1000)return x.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:4,useGrouping:true});return x.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:true})};
const money=x=>{if(nullableNumber(x)==null)return 'N/D';x=n(x);return x>=1e9?(x/1e9).toFixed(1)+' Md$':x>=1e6?(x/1e6).toFixed(1)+' M$':x>=1e3?(x/1e3).toFixed(0)+' k$':x.toFixed(0)+' $'};
const pct=x=>nullableNumber(x)==null?'N/D':(n(x)*100).toFixed(3)+'%'; const chg=x=>nullableNumber(x)==null?'N/D':n(x).toFixed(2)+'%';
async function chunkRequests(list,size,fn){for(let i=0;i<list.length;i+=size)await Promise.all(list.slice(i,i+size).map(fn))}
const apiWait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let apiQueue=Promise.resolve(),lastApiStart=0;
function apiTurn(){const turn=apiQueue.then(async()=>{const delay=Math.max(0,55-(Date.now()-lastApiStart));if(delay)await apiWait(delay);lastApiStart=Date.now()});apiQueue=turn.catch(()=>{});return turn}
async function get(path){
 for(let attempt=0;attempt<3;attempt++){
   await apiTurn();const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);
   try{
     const r=await fetch(API+path,{signal:ctl.signal});
     if(!r.ok){const err=Error('API '+r.status);err.retryable=r.status===429||r.status>=500;throw err}
     const j=await r.json();if(j.code&&j.code!=='0'){const err=Error(j.msg||'API '+j.code);err.retryable=j.code==='50011';throw err}
     return j.data||[];
   }catch(e){if(e?.name==='AbortError'){e=Error('Délai API dépassé');e.retryable=true}
     if(!e.retryable||attempt===2)throw e;
   }finally{clearTimeout(timer)}
   await apiWait(350*(attempt+1));
 }
}

function timeLabel(ts){return Number.isFinite(ts)?new Date(ts).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'N/D'}
function tier(v,a){let vs=a.map(x=>x.vol).sort((a,b)=>b-a),i=vs.indexOf(v)/Math.max(1,vs.length-1);if(i<.08)return['mega','Très grosse'];if(i<.25)return['large','Grosse'];if(i<.62)return['mid','Intermédiaire'];return['small','Plus petite']}
/* V8.4 — CENTRAL SIGNAL ENGINE
   One shared vocabulary for ranking, analysis and scenarios.
   The ranking layer can work with fast market data; deeper layers enrich the same families with candles.
*/
function clamp01(v){return Math.max(0,Math.min(1,Number.isFinite(v)?v:0))}
function classifyRegime(x,deep){
  const d=deep||{};
  const pa=d.priceAction||'neutral', ema=d.emaBias||'neutral', st=d.supertrendBias||'neutral';
  const adx=Number(d.adx||0), rsi=Number(d.rsi), sk=Number(d.stochK), z=Number(d.bb?.z), vol=Number(x?.vol||0), med=Number(x?.medVol||0), vr=med>0?vol/med:null;
  const comp=!!d.compression, exp=!!d.expansion;
  const paDir=pa==='bullish'?'bull':pa==='bearish'?'bear':'neutral';
  const aligned=(paDir!=='neutral'&&paDir===ema&&ema===st);
  const extreme=(Number.isFinite(rsi)&&(rsi>=68||rsi<=32))||(Number.isFinite(sk)&&(sk>=.86||sk<=.14));
  const breakout=(aligned && adx>=20 && exp && vr!=null && vr>=1.15 && (x?.rangePos==null || x.rangePos>.72 || x.rangePos<.28));
  const reversal=(extreme && pa!=='neutral' && ((pa==='bearish'&&ema==='bull')||(pa==='bullish'&&ema==='bear')));
  const squeeze=(comp && ((x?.oiDelta!=null&&Math.abs(x.oiDelta)>=1.5)||vr!=null&&vr>=1.05));
  const range=(adx<18 && (comp || !exp) && (!Number.isFinite(z)||Math.abs(z)<1.2) && !aligned);
  if(reversal) return {key:'reversal',label:'Retournement',reason:'momentum extrême + Price Action en opposition au contexte'};
  if(breakout) return {key:'breakout',label:'Cassure / continuation',reason:'structure alignée + expansion + participation'};
  if(squeeze) return {key:'squeeze',label:'Compression / squeeze',reason:'volatilité comprimée avec participation en évolution'};
  if(range) return {key:'range',label:'Range / mean reversion',reason:'tendance faible et volatilité contenue'};
  return {key:'continuation',label:'Tendance / continuation',reason:'lecture directionnelle sans déclencheur de cassure clair'};
}
const REGIME_WEIGHTS={
  breakout:{activity:1.35,trend:1.35,priceAction:1.45,range:1.0,derivatives:1.05,funding:.55,positioning:.85,volume:1.25,momentum:.85,volatility:1.0,adx:1.15},
  reversal:{activity:1.0,trend:1.05,priceAction:1.5,range:1.2,derivatives:.8,funding:.65,positioning:.75,momentum:1.25,rsi:1.25,stochRsi:.9,volatility:1.0,adx:.85},
  range:{activity:.9,trend:.65,priceAction:1.35,range:1.45,derivatives:.7,funding:.75,positioning:.7,momentum:1.0,rsi:1.15,stochRsi:.85,volatility:1.2,adx:.55,bollinger:1.2},
  squeeze:{activity:1.3,trend:.9,priceAction:1.05,range:.85,derivatives:1.35,funding:.9,positioning:1.2,momentum:.8,volatility:1.35,adx:.8,bollinger:1.15},
  continuation:{activity:1.15,trend:1.3,priceAction:1.3,range:.9,derivatives:1.0,funding:.65,positioning:.8,momentum:.95,volatility:.85,adx:1.1}
};
function centralSignalEngine(x,deep=null,opts={}){
  const volRatio=x?.medVol>0?x.vol/x.medVol:null;
  const rangePos=Number.isFinite(x?.rangePos)?x.rangePos:null;
  const oiDelta=Number.isFinite(x?.oiDelta)?x.oiDelta:null;
  const funding=Number.isFinite(x?.funding)?x.funding:null;
  const momentum=Number.isFinite(x?.chg)?x.chg:null;
  const dir=deep?.priceAction==='bullish'||deep?.emaBias==='bull'||deep?.supertrendBias==='bull'?'bull':deep?.priceAction==='bearish'||deep?.emaBias==='bear'||deep?.supertrendBias==='bear'?'bear':momentum!=null?(momentum>=1?'bull':momentum<=-1?'bear':null):null;
  const extInputs=[
    momentum!=null?Math.min(100,Math.abs(momentum)/20*100):0,
    Number.isFinite(deep?.rsi)?(deep.rsi>=70||deep.rsi<=30?100:deep.rsi>=65||deep.rsi<=35?60:0):0,
    Number.isFinite(deep?.bb?.z)?(Math.abs(deep.bb.z)>=2.5?100:Math.abs(deep.bb.z)>=2?75:Math.abs(deep.bb.z)>=1.5?45:0):0,
    funding!=null?Math.min(100,Math.abs(funding)/.001*100):0,
    oiDelta!=null?Math.min(100,Math.abs(oiDelta)/5*100):0,
    rangePos!=null?(rangePos>.97||rangePos<.03?80:rangePos>.92||rangePos<.08?45:0):0
  ].filter(Number.isFinite);
  const extensionRisk=Math.round(extInputs.length?extInputs.reduce((a,b)=>a+b,0)/extInputs.length:0);
  const families={
    activity:{value:volRatio,signal:volRatio==null?'neutral':volRatio>=1.35?'positive':volRatio>=.85?'warning':'negative',weight:1.15,role:'context'},
    extension:{value:extensionRisk,signal:extensionRisk>=72?'warning':extensionRisk>=45?'warning':'neutral',weight:1.0,role:'context'},
    momentum:{value:momentum,signal:momentum==null?'neutral':momentum>=3?'positive':momentum<=-3?'negative':Math.abs(momentum)>=1?'warning':'neutral',weight:.9,role:'directional'},
    range:{value:rangePos,signal:rangePos==null?'neutral':dir==='bull'&&rangePos>.70?'positive':dir==='bear'&&rangePos<.30?'positive':dir==='bull'&&rangePos<.20?'negative':dir==='bear'&&rangePos>.80?'negative':'neutral',weight:.75,role:'directional'},
    derivatives:{value:oiDelta,signal:oiDelta==null?'neutral':Math.abs(oiDelta)>=2?'warning':Math.abs(oiDelta)>=.5?'warning':'neutral',weight:.8,role:'context'},
    funding:{value:funding,signal:funding==null?'neutral':Math.abs(funding)>.0005?'warning':'neutral',weight:.65,role:'context'},
    positioning:{value:x?.oiRatio,signal:x?.oiRatio==null?'neutral':x.oiRatio>.15?'positive':'neutral',weight:.7,role:'context'}
  };
  if(deep){
    const d=deep;
    families.trend={value:d.trend?.strength,signal:d.trend?.bull?'positive':d.trend?.bear?'negative':'neutral',weight:1.25,role:'directional'};
    families.ema={value:d.emaBias,signal:d.emaBias==='bull'?'positive':d.emaBias==='bear'?'negative':'neutral',weight:.9,role:'directional'};
    families.supertrend={value:d.supertrendBias,signal:d.supertrendBias==='bull'?'positive':d.supertrendBias==='bear'?'negative':'neutral',weight:.9,role:'directional'};
    families.rsi={value:d.rsi,signal:Number.isFinite(d.rsi)?(d.rsi>=52&&d.rsi<70?'positive':d.rsi<=48&&d.rsi>30?'negative':(d.rsi>=70||d.rsi<=30)?'warning':'neutral'):'neutral',weight:.85,role:'directional'};
    families.stochRsi={value:d.stochK,signal:Number.isFinite(d.stochK)?(d.stochK>.8?'warning':d.stochK<.2?'warning':d.stochK>.55?'positive':d.stochK<.45?'negative':'neutral'):'neutral',weight:.55,role:'directional'};
    families.adx={value:d.adx,signal:d.adx==null?'neutral':d.adx>=25?'positive':d.adx>=18?'warning':'neutral',weight:1.0,role:'context'};
    families.bollinger={value:d.bb?.z,signal:d.bb?.z==null?'neutral':Math.abs(d.bb.z)>=2?'warning':Math.abs(d.bb.z)>=1?'positive':'neutral',weight:.7,role:'context'};
    families.volatility={value:d.atrPct,signal:d.compression?'warning':d.expansion?'positive':'neutral',weight:.65,role:'context'};
    families.priceAction={value:d.priceAction,signal:d.priceAction==='bullish'?'positive':d.priceAction==='bearish'?'negative':'neutral',weight:1.25,role:'directional'};
  }
  const regime=classifyRegime(x,deep);
  const regimeWeights=REGIME_WEIGHTS[regime.key]||{};
  Object.entries(regimeWeights).forEach(([k,v])=>{if(families[k]&&Number.isFinite(v))families[k].weight=Math.max(.05,Math.min(2.5,v))});
  const weightOverrides=opts?.weights||{}; Object.entries(weightOverrides).forEach(([k,v])=>{if(families[k]&&Number.isFinite(v))families[k].weight=Math.max(.05,Math.min(2.5,v))});
  const entries=Object.values(families); let signed=0,confidence=0,total=0,positiveW=0,negativeW=0,warningW=0;
  for(const f of entries){
    const w=f.weight||0;
    if(f.signal==='positive'){if(f.role==='directional')signed+=w;confidence+=w;if(f.role==='directional')positiveW+=w}
    else if(f.signal==='negative'){if(f.role==='directional')signed-=w;confidence+=w;if(f.role==='directional')negativeW+=w}
    else if(f.signal==='warning'){confidence+=w*.15;if(f.role==='directional')warningW+=w}
    total+=w;
  }
  const biasScore=Math.round(50+(signed/Math.max(total,1))*50);
  const confidenceScore=Math.round(50+(confidence/Math.max(total,1))*50);
  const directional=Math.max(positiveW,negativeW)/Math.max(total,1);
  const contradiction=Math.min(positiveW,negativeW)/Math.max(total,1);
  let quality=confidenceScore;
  // Confluence is not tradability: penalise mixed directional evidence and warnings.
  quality-=Math.round(contradiction*32);
  quality-=Math.round((warningW/Math.max(total,1))*18);
  if(dir && ((dir==='bull'&&biasScore<50)||(dir==='bear'&&biasScore>50))) quality-=10;
  if(!dir) quality-=6;
  if(deep && Number.isFinite(deep.adx) && deep.adx<15) quality-=5;
  if(deep && deep.compression) quality-=3;
  if(volRatio!=null && volRatio<.75) quality-=15;
  if(extensionRisk>=72) quality-=18;
  else if(extensionRisk>=55) quality-=10;
  else if(extensionRisk>=45) quality-=5;
  if(Math.abs(momentum||0)>12) quality-=4;
  const counts={positive:entries.filter(f=>f.signal==='positive').length,warning:entries.filter(f=>f.signal==='warning').length,negative:entries.filter(f=>f.signal==='negative').length,neutral:entries.filter(f=>f.signal==='neutral').length};
  return {families,counts,score:Math.max(0,Math.min(100,confidenceScore)),qualityScore:Math.max(0,Math.min(100,quality)),directionalAgreement:Math.round(directional*100),contradiction:Math.round(contradiction*100),biasScore:Math.max(0,Math.min(100,biasScore)),direction:dir,extensionRisk,complete:!!deep,regime};
}
function sharedMarketSignals(x){return centralSignalEngine(x,x?.deep||null)}
function calibratedScore(x,side='best'){
  // Comparable 0–100 scale for every asset and for both directional cards.
  // The number ranks observed setups; it is never a probability of success.
  const m=x.signalModel||sharedMarketSignals(x),d=x.directional||{};
  const direction=side==='long'?d.longScore:side==='short'?(x.perpScenarioModel?.directional?.shortScore??d.shortScore):Math.max(d.longScore||0,d.shortScore||0);
  const hasModel=!!x.scenarioModel;
  const ready=side==='long'?!!x.hasLongScenario:side==='short'?!!x.hasShortScenario:!!x.hasValidScenario;
  const forming=side==='short'?!!x.scenarioModel?.shortSetup:side==='long'?!!x.scenarioModel?.longSetup:!!(x.scenarioModel?.longSetup||x.scenarioModel?.shortSetup);
  const coverage=hasModel?1:0;
  const median=Math.max(1,x.marketMedianVol||x.medVol||1);
  const liquidity=Math.max(20,Math.min(90,55+18*Math.log10(Math.max(1,x.volUsd||x.vol||0)/median)));
  const safety=Math.max(10,100-(m.extensionRisk||0));
  const execution=ready?80:forming?45:hasModel?22:8;
  let result=.42*m.qualityScore+.26*(Number(direction)||0)+.12*liquidity+.10*safety+.10*execution;
  if(!coverage)result=Math.min(result,57); // Analysis missing: never rank as fully tradable.
  if(!ready)result=Math.min(result,forming?72:63); // Distinguish observation from actionable scenario.
  if(side==='short'&&!x.perpId)result=Math.min(result,47);
  return Math.max(0,Math.min(100,Math.round(result)));
}
function score(x){return calibratedScore(x,'best')}

function terrain(s){return s>=82?['Très intéressant','g']:s>=68?['Favorable à surveiller','g']:s>=52?['Mixte','y']:s>=38?['Faible','y']:['Défavorable','r']}
function bucket(s){return s>=78?'hot':s>=64?'trade':s>=48?'watch':'low'}
function bucketName(b){return b==='hot'?'🔥 Très tradables':b==='trade'?'🟢 Tradables':b==='watch'?'🟡 Surveillance':'⚪ Faible tradabilité'}
function fmtMetric(v,u){if(nullableNumber(v)==null)return 'N/D';v=n(v);if(!Number.isFinite(v))return 'N/D';if(u==='%')return (v*100).toFixed(3)+'%';if(u==='$')return Math.abs(v)<1?price(v)+' $':money(v);if(u==='score')return v.toFixed(0);return money(v)}
function makeSpark(vals,color='#65b8ff'){if(!vals||vals.length<2)return '';vals=vals.filter(Number.isFinite);if(vals.length<2)return '';let lo=Math.min(...vals),hi=Math.max(...vals),rg=hi-lo||1,w=240,h=42,p=2,pts=vals.map((v,i)=>`${p+i*(w-2*p)/(vals.length-1)},${h-p-(v-lo)/rg*(h-2*p)}`).join(' ');return `<div class="spark"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.4"/></svg></div>`}
let lastCompletedScanAt=null;
function clockStamp(ts){return ts?new Date(ts).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'}):'inconnue'}
function refreshScanFreshness(){const el=$('scanFreshness');if(!el)return;el.textContent=scanRunning?'Scan en cours : le classement précédent reste affiché.':lastCompletedScanAt?`Classement calculé le ${clockStamp(lastCompletedScanAt)} • ${Math.floor((Date.now()-lastCompletedScanAt)/60000)} min écoulée(s). Appuie sur Scanner pour recalculer.`:'Aucun scan terminé : résultats en attente.'}
async function scan(){
 if(scanRunning)return;scanRunning=true;$('scan').disabled=true;refreshScanFreshness();
 $('status').textContent='Construction de l’univers Spot…';
 try{
   const [spotTickers,swapTickers]=await Promise.all([get('/market/tickers?instType=SPOT'),get('/market/tickers?instType=SWAP')]);
   const swaps=new Map(swapTickers.filter(x=>x.instId.endsWith('-USDT-SWAP')).map(x=>[x.instId.replace('-USDT-SWAP',''),x]));
   let raw=spotTickers.filter(x=>x.instId.endsWith('-USDT')).map(x=>{const last=n(x.last),open=n(x.open24h),vol=n(x.volCcy24h),sym=x.instId.replace('-USDT','');return {id:x.instId,spotId:x.instId,perpId:swaps.get(sym)?.instId||null,perpPrice:nullableNumber(swaps.get(sym)?.last),sym,market:'spot',hasPerp:!!swaps.get(sym),price:last,vol,volUsd:vol,chg:open>0?((last-open)/open)*100:0,high:n(x.high24h),low:n(x.low24h),oi:null,funding:null,oiDelta:null,marketTs:nullableNumber(x.ts),oiTs:null,fundingTs:null,rangePos:last&&n(x.high24h)>n(x.low24h)?(last-n(x.low24h))/Math.max(1e-12,n(x.high24h)-n(x.low24h)):null}}).filter(x=>x.vol>0&&x.price>0).sort((a,b)=>b.vol-a.vol).slice(0,150);
   const med=raw.reduce((s,x)=>s+x.vol,0)/Math.max(1,raw.length);raw.forEach(x=>{x.medVol=med;x.marketMedianVol=raw[Math.floor(raw.length/2)]?.vol||med});
   $('universeInfo').textContent=`${raw.length} Spot actifs • dérivés associés quand disponibles`;
   await chunkRequests(raw.filter(x=>x.perpId),4,async x=>{try{const o=await get('/public/open-interest?instType=SWAP&instId='+encodeURIComponent(x.perpId));x.oi=nullableNumber(o[0]?.oiUsd);x.oiTs=x.oi==null?null:Date.now()}catch{x.oi=null}try{const f=await get('/public/funding-rate?instId='+encodeURIComponent(x.perpId));x.funding=nullableNumber(f[0]?.fundingRate);x.fundingTs=x.funding==null?null:Date.now()}catch{x.funding=null}const h=history[x.id]||{samples:[]},prev=h.samples?.at(-1);x.oiDelta=prev&&Number.isFinite(prev.oi)&&prev.oi>0&&Number.isFinite(x.oi)?((x.oi-prev.oi)/prev.oi)*100:null;h.samples=[...(h.samples||[]),{ts:Date.now(),oi:x.oi,price:x.price,vol:x.vol,funding:x.funding,score:0}].slice(-192);history[x.id]=h});
   const deepUniverse=raw;shortScanErrors=0;scanErrorReasons={};$('status').textContent=`Analyse technique de ${deepUniverse.length}/${raw.length} actifs…`;
   const chunk=chunkRequests;
   let processed=0;
   await chunk(deepUniverse,3,async x=>{
     try{
       const specs=[['1D',120],['4H',100],['1H',140],['30m',140],['15m',180],['5m',180]];
       const results=await Promise.allSettled(specs.map(([bar,limit])=>candles(x.id,bar,limit)));
       const frames=Object.fromEntries(specs.map(([bar],i)=>[bar,results[i].status==='fulfilled'?results[i].value:[]]));
       const failed=results.map((result,i)=>result.status==='rejected'?specs[i][0]+': '+String(result.reason?.message||result.reason):null).filter(Boolean);
       const full=specs.every(([bar])=>frames[bar].length>=40);
       const sufficient=frames['1H'].length>=40&&(frames['15m'].length>=40||frames['5m'].length>=40)&&(frames['4H'].length>=40||frames['1D'].length>=40);
       x.analysisCoverage=full?'complete':sufficient?'partial':'unavailable';x.scenarioFrames=frames;x.analysisIssues=failed;
       if(failed.length||!sufficient){shortScanErrors++;const reason=failed[0]||'Bougies insuffisantes';scanErrorReasons[reason]=(scanErrorReasons[reason]||0)+1}
       const cs1h=frames['1H'];const f=cs1h.length>=40?timeframeFeatures(cs1h):null;
       if(f){const st=supertrend(cs1h,10,3).filter(Number.isFinite).at(-1),last=lastCompleted(cs1h)?.c||x.price;x.deep={trend:f.t,emaBias:f.t.e20>f.t.e50?'bull':f.t.e20<f.t.e50?'bear':'neutral',supertrendBias:st==null?'neutral':last>st?'bull':last<st?'bear':'neutral',rsi:f.rsi,stochK:f.stochK,stochD:f.stochD,adx:f.t.adx,bb:f.bb,atrPct:f.atr&&f.priceNow?f.atr/f.priceNow*100:null,compression:f.compression,expansion:f.expansion,priceAction:f.t.bull?'bullish':f.t.bear?'bearish':'neutral'}}
       x.scenarioModel=sufficient?adaptiveEngine(frames,x):null;
       x.directional=x.scenarioModel?.directional||directionalAssessment(x.scenarioModel||{},x);
       x.perpScenarioModel=null;x.perpAnalysisCoverage='unavailable';
       // Spot identifies a bearish candidate; the Perp defines tradable SHORT levels.
       if(full&&x.perpId&&x.perpPrice>0&&x.scenarioModel?.shortPattern&&x.directional.shortScore>=55){
         const perpResults=await Promise.allSettled(specs.map(([bar,limit])=>candles(x.perpId,bar,limit)));
         const perpFrames=Object.fromEntries(specs.map(([bar],i)=>[bar,perpResults[i].status==='fulfilled'?perpResults[i].value:[]]));
         if(specs.every(([bar])=>perpFrames[bar].length>=40)){
           x.perpScenarioModel=adaptiveEngine(perpFrames,{...x,id:x.perpId,price:x.perpPrice});x.perpAnalysisCoverage='complete';
         }else{
           const bad=perpResults.find(r=>r.status==='rejected');const reason='Perp incomplet : '+String(bad?.reason?.message||'bougies insuffisantes');
           shortScanErrors++;scanErrorReasons[reason]=(scanErrorReasons[reason]||0)+1;
         }
       }
       // Partial data is useful for inspection but cannot certify a trade setup.
       x.hasLongScenario=!!(full&&x.scenarioModel?.longValid);
       x.hasShortScenario=!!(full&&x.perpScenarioModel?.shortSetup&&(x.perpScenarioModel.breakdownValid||x.perpScenarioModel.rejectionValid));
       x.scenarioKind=full&&x.scenarioModel?chooseFreshScenario(x.perpScenarioModel||x.scenarioModel,null):null;
       x.hasValidScenario=!!(x.hasLongScenario||x.hasShortScenario);
     }catch(err){shortScanErrors++;const reason=String(err?.message||err).slice(0,90);scanErrorReasons[reason]=(scanErrorReasons[reason]||0)+1;console.warn('Analyse '+x.id,err);x.analysisCoverage='unavailable';x.deep=null;x.scenarioFrames={};x.scenarioModel=null;x.directional={longScore:0,shortScore:0,longEligible:false,shortEligible:false,strongest:'neutral'};x.scenarioKind=null;x.hasLongScenario=false;x.hasShortScenario=false;x.hasValidScenario=false}
     finally{processed++;$('status').textContent=`Analyse technique : ${processed}/${deepUniverse.length} actifs • ${shortScanErrors} analyses incomplètes`}
   });
   raw.forEach(x=>{x.signalModel=sharedMarketSignals(x);const dir=x.directional||{};x.longScore=dir.longScore||0;x.shortScore=x.perpScenarioModel?.directional?.shortScore??dir.shortScore??0;x.side=x.hasShortScenario&&!x.hasLongScenario?'short':x.hasLongScenario&&!x.hasShortScenario?'long':x.longScore>x.shortScore?'long':x.shortScore>x.longScore?'short':'neutral';x.score=score(x);if(x.analysisCoverage==='partial')x.score=Math.min(x.score,63);x.tier=tier(x.vol,raw);let h=history[x.id];if(h?.samples?.length)h.samples[h.samples.length-1].score=x.score});
   raw.sort((a,b)=>b.score-a.score);raw.forEach(x=>x.bucket=bucket(x.score));localStorage.setItem(STORAGE.scan,JSON.stringify(history));all=raw;lastCompletedScanAt=Date.now();refreshScanFreshness();$('status').textContent=`${all.length} Spot actifs • ${all.filter(x=>x.analysisCoverage==='complete').length} analysés entièrement • ${shortScanErrors} incomplets`;render();
 }catch(e){$('status').textContent='Erreur API — réessaie : '+String(e.message||e);console.error(e)}finally{scanRunning=false;$('scan').disabled=false;refreshScanFreshness()}
}
function shortDiagnostics(){
 const a=all.filter(x=>x.perpId), modeled=a.filter(x=>x.analysisCoverage==='complete'&&x.scenarioModel), patterns=modeled.filter(x=>x.perpScenarioModel?.shortPattern), eligible=patterns.filter(x=>x.perpScenarioModel.shortSetup), valid=eligible.filter(x=>x.hasShortScenario), listed=scenarioCandidates().filter(c=>c.direction==='short');
 return `SHORT : ${a.length} perps • ${modeled.length} analysés • ${patterns.length} motifs • ${eligible.length} scores éligibles • ${valid.length} scénarios valides • ${listed.length} affichés • ${shortScanErrors} erreurs d'analyse${shortScanErrors?' ('+Object.entries(scanErrorReasons).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([reason,count])=>count+'× '+reason).join(' ; ')+')':''}`;
}
function render(){renderRank();drawTable();prepareInteractive()}
function prepareInteractive(){document.querySelectorAll('.rankcard,.radar,.click,.row').forEach(el=>{el.tabIndex=0;el.setAttribute('role','button')});bindAcc()}
function scenarioCandidates(){
 const out=[];
 all.forEach(x=>{
  if(x.analysisCoverage==='complete'&&x.hasLongScenario&&x.longScore>=66){
   const longKind=(scenarioValid('breakout',x.scenarioModel?.breakout,x.price)?'breakout':'pullback');
   const perpLongPreferred=!!(x.hasPerp&&x.oi!=null&&Number.isFinite(x.oiDelta)&&x.oiDelta>=0&&Math.abs(x.funding||0)<=.001);
   const market=perpLongPreferred?'perp':'spot';
   out.push({x,direction:'long',market,score:calibratedScore(x,'long'),kind:longKind,instruments:x.hasPerp?['spot','perp']:['spot']});
  }
  if(x.perpAnalysisCoverage==='complete'&&x.perpId&&x.perpScenarioModel?.shortSetup&&x.shortScore>=62)out.push({x,direction:'short',market:'perp',score:calibratedScore(x,'short'),ready:x.hasShortScenario,kind:x.perpScenarioModel.shortPattern==='reversal'?'rejection':(x.perpScenarioModel.shortPattern||'breakdown'),instruments:['perp']});
 });
 return out;
}
function modeLabel(){return marketMode==='spot'?'💰 SPOT':marketMode==='long'?'📈 LONG':marketMode==='short'?'📉 SHORT':'🌐 TOUT'}
function marketModeHint(){return marketMode==='spot'?'Spot uniquement : les configurations acheteuses disponibles.':marketMode==='long'?'Long uniquement : le Radar privilégie le Spot pour l’exposition acheteuse.':marketMode==='short'?'Short uniquement : perpétuels, car le Spot classique ne permet pas de vendre à découvert.':'Tout : Spot + Long et Short Perp lorsqu’une configuration existe.'}
function configCard(c,i,compact=false){const {x,direction,market,score}=c,tr=terrain(score),isShort=direction==='short';return `<div tabindex="0" role="button" class="rankcard compactRank ${compact?'topRankCard':''}" onclick="openDetail('${x.id}','${market}','${direction}')"><div class="rankTop"><span class="ranknum">${String(i+1).padStart(2,'0')}</span><b class="rankSym">${esc(x.sym)}</b><span class="tag ${market==='spot'?'b':'r'}">${market==='spot'?'💰 SPOT':'⚡ PERP'}</span><span class="tag ${isShort?'r':'g'}">${isShort?'🔴 SHORT':'🟢 LONG'}</span><span class="scoreBadge">${score}/100</span></div><div class="rankMetrics"><div class="metric"><small>Prix</small><b>${price(isShort?x.perpPrice:x.price)}</b></div><div class="metric"><small>24h</small><b class="${x.chg>=0?'good':'bad'}">${chg(x.chg)}</b></div><div class="metric"><small>Volume</small><b>${money(x.volUsd)}</b></div></div><div class="meter"><i style="width:${score}%"></i></div><div class="rankFoot"><span class="tag ${tr[1]}">${tr[0]}</span><span class="sub">${c.ready===false?'⏳ Déclencheur en attente':'🎯 Scénario conditionnel'}</span></div></div>`}
function renderRank(){
 const candidates=scenarioCandidates();
 const top=[...candidates].filter(c=>c.ready!==false).sort((a,b)=>b.score-a.score).slice(0,5);
 $('topConfigs').innerHTML=top.length?`<div class="topRankGrid">${top.map((c,i)=>configCard(c,i,true)).join('')}</div>`:'<div class="empty">Aucun scénario suffisamment construit pour constituer le Top.</div>';
 const filtered=candidates.filter(c=>marketMode==='all'||(marketMode==='spot'&&c.market==='spot')||(marketMode==='long'&&c.direction==='long')||(marketMode==='short'&&c.direction==='short')).filter(c=>bucket(c.score)===filter).sort((a,b)=>b.score-a.score);
 $('rankTitle').textContent=`${bucketName(filter)} • ${modeLabel()}`;
 $('modeHint').textContent=marketModeHint()+(marketMode==='short'?' • '+shortDiagnostics():'');
 $('rank').innerHTML=filtered.length?`<div class="rank">${filtered.map((c,i)=>configCard(c,i)).join('')}</div>`:`<div class="empty">Aucune configuration ${marketMode==='short'?'SHORT / PERP ':marketMode==='spot'?'SPOT ':marketMode==='long'?'LONG ':''}dans ${bucketName(filter)} actuellement.<br><span class="sub">Vérifie aussi les autres catégories : le classement LONG et SHORT dépend du score propre à chaque sens.</span></div>`;
}
function drawTable(){let q=$('search').value.toUpperCase().trim(),s=$('sort').value,t=$('tier').value,a=all.filter(x=>(!q||x.sym.includes(q))&&(t==='all'||x.tier[0]===t));a.sort((x,y)=>s==='score'?y.score-x.score:s==='volume'?y.vol-x.vol:s==='momentum'?y.chg-x.chg:s==='oi'?y.oi-x.oi:s==='ratio'?y.oiRatio-x.oiRatio:Math.abs(y.funding)-Math.abs(x.funding));$('market').innerHTML=a.map((x,i)=>{let tr=terrain(x.score);return `<tr class="row" onclick="openDetail('${x.id}')"><td>${i+1}</td><td><b>${esc(x.sym)}</b><br><span class="tag">${x.tier[1]}</span></td><td>${price(x.price)}</td><td class="${x.chg>=0?'good':'bad'}">${chg(x.chg)}</td><td>${money(x.volUsd)}</td><td>${money(x.oi)}<br><span class="tiny ${x.oiDelta>=0?'good':'bad'}">${x.oiDelta==null?'1er scan':(x.oiDelta>=0?'+':'')+x.oiDelta.toFixed(1)+'% scan'}</span><br><span class="tiny">${x.oiTs?'consulté '+timeLabel(x.oiTs):'N/D'}</span></td><td>${pct(x.funding)}<br><span class="tiny">${x.fundingTs?'consulté '+timeLabel(x.fundingTs):'N/D'}</span></td><td><b>${x.score}</b><div class="meter"><i style="width:${x.score}%"></i></div></td><td><span class="tag ${tr[1]}">${tr[0]}</span></td></tr>`}).join('')||'<tr><td colspan="9" class="empty">Aucun résultat.</td></tr>'}
async function candles(id,bar='1H',limit=90){
 let need=Math.max(2,Math.min(3000,Number(limit)||90)),out=[],before=null,guard=0;
 while(out.length<need && guard++<14){
  const endpoint=out.length===0?'/market/candles':'/market/history-candles';
  let q=endpoint+'?instId='+encodeURIComponent(id)+'&bar='+encodeURIComponent(bar)+'&limit='+Math.min(300,need-out.length)+(before?'&before='+encodeURIComponent(before):'');
  let d=await get(q); if(!Array.isArray(d)||!d.length) break;
  let page=d.map(a=>({t:+a[0],o:+a[1],h:+a[2],l:+a[3],c:+a[4],v:+a[7],baseVol:+a[5],quoteVol:+a[7],confirm:+a[8]})).filter(x=>[x.t,x.o,x.h,x.l,x.c,x.v].every(Number.isFinite));
  out=page.concat(out);
  let oldest=page[0]?.t;
  if(!oldest||oldest===before||page.length<2) break;
  before=oldest;
 }
 const seen=new Set(); out=out.sort((a,b)=>a.t-b.t).filter(x=>{if(seen.has(x.t))return false;seen.add(x.t);return true;});
 return out.slice(-need);
}
function struct(cs){if(cs.length<6)return'Manque de données';let a=cs.slice(-6),h=a.map(x=>x.h),l=a.map(x=>x.l),HH=h[5]>h[4],HL=l[5]>l[4],LH=h[5]<h[4],LL=l[5]<l[4];return HH&&HL?'HH + HL : haussier':LH&&LL?'LH + LL : baissier':'Transition / mixte'}
function pattern(c,p){let b=Math.abs(c.c-c.o),r=Math.max(1e-9,c.h-c.l),u=c.h-Math.max(c.o,c.c),d=Math.min(c.o,c.c)-c.l;if(b/r<.12)return'Doji — hésitation';if(d>b*2&&u<b)return'Rejet bas — acheteurs défendent';if(u>b*2&&d<b)return'Rejet haut — vendeurs défendent';if(p&&c.c>c.o&&p.c<p.o&&c.o<=p.c&&c.c>=p.o)return'Engulfing haussier';if(p&&c.c<c.o&&p.c>p.o&&c.o>=p.c&&c.c<=p.o)return'Engulfing baissier';return c.c>=c.o?'Bougie haussière':'Bougie baissière'}
function axisTime(ts,days=1){let d=new Date(ts);return days>1?d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
function axisPrice(x){x=n(x);if(!Number.isFinite(x))return 'N/D';const a=Math.abs(x);if(a===0)return '0 $';if(a<1e-6){const exp=Math.floor(Math.log10(a));const mant=x/Math.pow(10,exp);return mant.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:4})+'e'+exp+' $';}return price(x)+' $'}
function ema(cs,len){let out=[],k=2/(len+1),v=null;for(const c of cs){v=v==null?c.c:c.c*k+v*(1-k);out.push(v)}return out}
function rsi(cs,len=14){let out=Array(cs.length).fill(null),gain=0,loss=0;if(cs.length<=len)return out;for(let i=1;i<=len;i++){let d=cs[i].c-cs[i-1].c;gain+=Math.max(d,0);loss+=Math.max(-d,0)}gain/=len;loss/=len;out[len]=loss===0?100:100-100/(1+gain/loss);for(let i=len+1;i<cs.length;i++){let d=cs[i].c-cs[i-1].c;gain=(gain*(len-1)+Math.max(d,0))/len;loss=(loss*(len-1)+Math.max(-d,0))/len;out[i]=loss===0?100:100-100/(1+gain/loss)}return out}
function stochRsi(cs,len=14){let rs=rsi(cs,len),raw=Array(cs.length).fill(null),k=Array(cs.length).fill(null),d=Array(cs.length).fill(null);for(let i=0;i<rs.length;i++){if(i<len*2||rs[i]==null)continue;let a=rs.slice(i-len+1,i+1).filter(Number.isFinite);if(a.length<len)continue;let lo=Math.min(...a),hi=Math.max(...a);raw[i]=hi===lo?0.5:(rs[i]-lo)/(hi-lo)}for(let i=0;i<raw.length;i++){let a=raw.slice(Math.max(0,i-2),i+1).filter(Number.isFinite);if(a.length===3)k[i]=a.reduce((x,y)=>x+y,0)/a.length}for(let i=0;i<k.length;i++){let a=k.slice(Math.max(0,i-2),i+1).filter(Number.isFinite);if(a.length===3)d[i]=a.reduce((x,y)=>x+y,0)/a.length}return {raw,k,d}}
function obv(cs){let out=[],v=0;for(let i=0;i<cs.length;i++){if(i){if(cs[i].c>cs[i-1].c)v+=cs[i].v;else if(cs[i].c<cs[i-1].c)v-=cs[i].v}out.push(v)}return out}
function supertrend(cs,len=10,mult=3){if(cs.length<2)return Array(cs.length).fill(null);let atr=[],tr=[];for(let i=0;i<cs.length;i++){tr.push(i===0?cs[i].h-cs[i].l:Math.max(cs[i].h-cs[i].l,Math.abs(cs[i].h-cs[i-1].c),Math.abs(cs[i].l-cs[i-1].c)))}let a=tr.slice(0,len).reduce((x,y)=>x+y,0)/Math.min(len,tr.length);for(let i=0;i<cs.length;i++){if(i<len)atr.push(a);else{a=(a*(len-1)+tr[i])/len;atr.push(a)}}let upper=[],lower=[],trend=Array(cs.length).fill(1),st=Array(cs.length).fill(null);for(let i=0;i<cs.length;i++){let mid=(cs[i].h+cs[i].l)/2;upper[i]=mid+mult*atr[i];lower[i]=mid-mult*atr[i];if(i){if(cs[i].c>upper[i-1])trend[i]=1;else if(cs[i].c<lower[i-1])trend[i]=-1;else trend[i]=trend[i-1];if(trend[i]>0)lower[i]=Math.max(lower[i],lower[i-1]);else upper[i]=Math.min(upper[i],upper[i-1])}st[i]=trend[i]>0?lower[i]:upper[i]}return st}
function svgPath(vals,xs,top,bottom,min,max){let pts=[],started=false;for(let i=0;i<vals.length;i++){if(vals[i]==null||!Number.isFinite(vals[i]))continue;let y=bottom-(vals[i]-min)/Math.max(1e-12,max-min)*(bottom-top);pts.push(`${started?'L':'M'}${xs[i].toFixed(1)},${y.toFixed(1)}`);started=true}return pts.join(' ')}
function proChart(cs,calcCs=cs,overlays=[]){
 csForHover=cs||[];
 if(!cs?.length)return '<div class="empty">Données insuffisantes.</div>';
 const W=1000,H=720,L=165,R=70,top=24,priceH=350,volTop=392,volH=100,rsiTop=522,rsiH=78,stochTop=615,stochH=78;
 const plotW=W-L-R,xStep=plotW/Math.max(1,cs.length-1),xs=cs.map((_,i)=>L+i*xStep);
 const ov=(overlays||[]).map(x=>n(x?.value)).filter(Number.isFinite),lo0=Math.min(...cs.map(x=>x.l),...(ov.length?ov:[Infinity])),hi0=Math.max(...cs.map(x=>x.h),...(ov.length?ov:[-Infinity])),lo=Number.isFinite(lo0)?lo0:Math.min(...cs.map(x=>x.l)),hi=Number.isFinite(hi0)?hi0:Math.max(...cs.map(x=>x.h)),rawRange=hi-lo,pad=(rawRange||Math.max(Math.abs(hi),1e-12))*.06,minP=Math.max(0,lo-pad),maxP=hi+pad;
 const py=v=>top+(maxP-v)/Math.max(1e-18,maxP-minP)*priceH;
 const maxVol=Math.max(...cs.map(x=>Number.isFinite(x.v)?x.v:0),1);
 const e20=ema(calcCs,20).slice(-cs.length),e50=ema(calcCs,50).slice(-cs.length),st=supertrend(calcCs).slice(-cs.length),rv=rsi(calcCs).slice(-cs.length),sri=stochRsi(calcCs),sv=sri.k.slice(-cs.length),sd=sri.d.slice(-cs.length);
 const candleW=Math.max(2,Math.min(12,xStep*.68));
 const spanDays=(cs.at(-1).t-cs[0].t)/86400000;
 const last=cs.at(-1).c,ly=py(last);
 let svg=[];
 svg.push(`<rect x="0" y="0" width="${W}" height="${H}" rx="12" fill="#0b0d11"/>`);
 // horizontal grid + right price axis. Scientific notation is used only for tiny prices so zeros never disappear.
 for(let i=0;i<=6;i++){
  const v=maxP-(maxP-minP)*i/6,y=py(v);
  svg.push(`<line x1="${L}" y1="${y}" x2="${W-R}" y2="${y}" stroke="#20252c"/>`);
  svg.push(`<text x="${W-R+9}" y="${y+5}" fill="#c4cad3" font-size="16" font-weight="700">${axisPrice(v)}</text>`);
 }
 // time grid
 const idxs=[0,.2,.4,.6,.8,1].map(r=>Math.round(r*(cs.length-1)));
 idxs.forEach(i=>{const x=xs[i];svg.push(`<line x1="${x}" y1="${top}" x2="${x}" y2="${stochTop+stochH}" stroke="#171c22"/>`);svg.push(`<text x="${x}" y="${H-5}" text-anchor="middle" fill="#a1a7b0" font-size="13">${axisTime(cs[i].t,Math.max(1,Math.ceil(spanDays)))}</text>`)});
 svg.push(`<text x="${L}" y="15" fill="#aeb4bd" font-size="13" font-weight="800">PRIX ($)</text>`);
 // scenario overlays: fixed levels remain visible while the live market moves.
 const validOverlays=(overlays||[]).filter(o=>Number.isFinite(n(o?.value))).map(o=>({...o,value:n(o.value)}));
 const placed=[];validOverlays.forEach((o,idx)=>{const y=py(o.value);let ly=y;for(const q of placed){if(Math.abs(ly-q)<22)ly=q+(ly>=q?22:-22)}ly=Math.max(top+10,Math.min(top+priceH-10,ly));placed.push(ly);const col=o.color||'#65b8ff';const label=esc((o.label||'').replace('🎯 ','').replace('🛑 ','').replace('Prix live','Live'));svg.push(`<line x1="${L}" y1="${y}" x2="${W-R}" y2="${y}" stroke="${col}" stroke-width="1.8" stroke-dasharray="7 5" opacity=".92"/><rect x="${W-R-142}" y="${ly-9}" width="136" height="18" rx="5" fill="#111419" stroke="${col}" opacity=".96"/><text x="${W-R-136}" y="${ly+3}" fill="#eef1f4" font-size="10" font-weight="800">${label} ${axisPrice(o.value)}</text>`)});
 // candlesticks
 cs.forEach((c,i)=>{
  const x=xs[i],up=c.c>=c.o,bodyTop=py(Math.max(c.o,c.c)),bodyBot=py(Math.min(c.o,c.c)),bh=Math.max(1.6,bodyBot-bodyTop),col=up?'#45dc7a':'#ff6974';
  svg.push(`<line x1="${x}" y1="${py(c.h)}" x2="${x}" y2="${py(c.l)}" stroke="${col}" stroke-width="1.6"/>`);
  svg.push(`<rect x="${x-candleW/2}" y="${bodyTop}" width="${candleW}" height="${bh}" rx=".8" fill="${col}" stroke="${up?'#a5f4bd':'#ffadb3'}" stroke-width=".6"/>`);
 });
 // overlays
 svg.push(`<path d="${svgPath(e20,xs,top,top+priceH,minP,maxP)}" fill="none" stroke="#ffd166" stroke-width="2.2"/>`);
 svg.push(`<path d="${svgPath(e50,xs,top,top+priceH,minP,maxP)}" fill="none" stroke="#bd91ff" stroke-width="2.2"/>`);
 svg.push(`<path d="${svgPath(st,xs,top,top+priceH,minP,maxP)}" fill="none" stroke="#65b8ff" stroke-width="1.8" stroke-dasharray="6 4"/>`);
 // current price
 svg.push(`<line x1="${L}" y1="${ly}" x2="${W-R}" y2="${ly}" stroke="#45dc7a" stroke-width="1" stroke-dasharray="5 5"/>`);
 svg.push(`<rect x="5" y="${ly-12}" width="${L-12}" height="24" rx="5" fill="#45dc7a"/>`);
 svg.push(`<text x="13" y="${ly+5}" fill="#06130a" font-size="13" font-weight="900">Prix live ${axisPrice(last)}</text>`);
 // invisible interaction layer: one zone per candle
 cs.forEach((c,i)=>svg.push(`<rect class="candleHit" x="${Math.max(L,xs[i]-Math.max(candleW*1.8,5))}" y="${top}" width="${Math.min(plotW,Math.max(candleW*3.6,10))}" height="${priceH}" fill="transparent" data-i="${i}" onpointermove="chartHover(event,${i})" onpointerdown="chartHover(event,${i})"/>`));
 // volume
 svg.push(`<text x="${L}" y="${volTop-10}" fill="#c7ccd3" font-size="13" font-weight="800">VOLUME • USDT</text>`);
 cs.forEach((c,i)=>{const x=xs[i],vh=(c.v||0)/maxVol*volH,up=c.c>=c.o;svg.push(`<rect x="${x-candleW/2}" y="${volTop+volH-vh}" width="${candleW}" height="${Math.max(1,vh)}" fill="${up?'#45dc7a':'#ff6974'}" opacity=".62"/>`)});
 svg.push(`<line x1="${L}" y1="${volTop+volH}" x2="${W-R}" y2="${volTop+volH}" stroke="#303640"/>`);
 svg.push(`<text x="${W-R+9}" y="${volTop+15}" fill="#9ba2ac" font-size="12">${money(maxVol)}</text>`);
 // RSI
 svg.push(`<rect x="${L}" y="${rsiTop}" width="${plotW}" height="${rsiH}" fill="#0d1015" stroke="#20252c"/>`);
 svg.push(`<text x="${L+7}" y="${rsiTop+17}" fill="#c7ccd3" font-size="13" font-weight="800">RSI 14</text>`);
 for(const v of [70,50,30]){const y=rsiTop+rsiH-(v/100)*rsiH;svg.push(`<line x1="${L}" y1="${y}" x2="${W-R}" y2="${y}" stroke="${v===50?'#20252c':'#3b3030'}" stroke-dasharray="4 4"/>`);svg.push(`<text x="${W-R+9}" y="${y+4}" fill="#8f969f" font-size="11">${v}</text>`)}
 svg.push(`<path d="${svgPath(rv,xs,rsiTop+5,rsiTop+rsiH-5,0,100)}" fill="none" stroke="#65b8ff" stroke-width="2"/>`);
 // StochRSI
 svg.push(`<rect x="${L}" y="${stochTop}" width="${plotW}" height="${stochH}" fill="#0d1015" stroke="#20252c"/>`);
 svg.push(`<text x="${L+7}" y="${stochTop+17}" fill="#c7ccd3" font-size="13" font-weight="800">StochRSI</text>`);
 for(const v of [.8,.5,.2]){const y=stochTop+stochH-v*stochH;svg.push(`<line x1="${L}" y1="${y}" x2="${W-R}" y2="${y}" stroke="#252a31" stroke-dasharray="4 4"/>`)}
 svg.push(`<path d="${svgPath(sv,xs,stochTop+5,stochTop+stochH-5,0,1)}" fill="none" stroke="#bd91ff" stroke-width="2.2"/>`);svg.push(`<path d="${svgPath(sd,xs,stochTop+5,stochTop+stochH-5,0,1)}" fill="none" stroke="#65b8ff" stroke-width="1.8"/>`);
 return `<div class="chartShell"><div class="chartToolbar"><span class="chartBadge">🕯️ Bougies</span><span class="chartBadge">EMA 20/50</span><span class="chartBadge">Supertrend</span><span class="chartBadge">RSI</span><span class="chartBadge">StochRSI</span><span class="chartHint">Touchez une bougie pour ses valeurs</span></div><div class="proChart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${svg.join('')}</svg><div class="chartTooltip" id="chartTooltip"></div></div><div class="chartLegend"><span>🟩 Haussière</span><span>🟥 Baissière</span><span style="color:#ffd166">EMA 20</span><span style="color:#bd91ff">EMA 50</span><span style="color:#65b8ff">Supertrend</span><span style="color:#bd91ff">Stoch K</span><span style="color:#65b8ff">Stoch D</span></div><div class="chartStats"><div><small>MIN</small><b>${axisPrice(lo)}</b></div><div><small>ACTUEL</small><b>${axisPrice(last)}</b></div><div><small>MAX</small><b>${axisPrice(hi)}</b></div></div></div>`;
}
function chartHover(ev,i){const svg=ev.currentTarget?.closest('svg');const shell=ev.currentTarget?.closest('.chartShell');const tip=shell?.querySelector('.chartTooltip');if(!svg||!tip||!csForHover)return;const c=csForHover[i];if(!c)return;const d=new Date(c.t);const date=d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'});const time=d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});tip.innerHTML=`<b>${date} • ${time}</b><br>O ${price(c.o)} $ &nbsp; H ${price(c.h)} $<br>L ${price(c.l)} $ &nbsp; C ${price(c.c)} $<br>Volume ${money(c.v)} USDT`;tip.classList.add('show');const r=shell.getBoundingClientRect();let x=ev.clientX-r.left+12,y=ev.clientY-r.top+12;tip.style.left=Math.min(Math.max(8,x),r.width-190)+'px';tip.style.top=Math.min(Math.max(8,y),r.height-92)+'px'}
let csForHover=[];
function lineChart(cs,title='Graphique'){return proChart(cs)}
function radar(name,val,min,max,unit,desc,sparkVals){let pos=nullableNumber(val)==null?null:Math.max(0,Math.min(100,(val-min)/Math.max(1e-12,max-min)*100));return `<div tabindex="0" role="button" class="radar" onclick="openDeep(current.id,'metric','${name}')"><b>${name}</b><div class="sub">${desc}</div><div class="range">${pos==null?'':`<i class="dot" style="left:${pos}%"></i>`}</div><div class="minmax"><span><small>MIN</small><b>${fmtMetric(min,unit)}</b></span><span><small>ACTUEL</small><b>${fmtMetric(val,unit)}</b></span><span><small>MAX</small><b>${fmtMetric(max,unit)}</b></span></div>${makeSpark((sparkVals||[]).filter(Number.isFinite))}<div class="source">Touchez pour ouvrir le graphique détaillé →</div></div>`}
function activeInstrumentId(){return currentScenarioInstrument==='perp'&&current?.perpId?current.perpId:current?.id}
async function openDetail(id,market=null,direction=null){if(graphLiveTimer){clearInterval(graphLiveTimer);graphLiveTimer=null}if(detailLiveTimer){clearInterval(detailLiveTimer);detailLiveTimer=null}current=all.find(x=>x.id===id);if(!current)return;currentScenarioInstrument=market||null;$('home').classList.add('hidden');$('deep').classList.add('hidden');$('detail').classList.remove('hidden');$('detailBody').innerHTML='<div class="empty">Chargement des données…</div>';await detailAsync()}
async function detailAsync(){try{const instrument=activeInstrumentId(),displayPrice=instrument===current.perpId?(current.perpPrice??current.price):current.price;let d={};for(let b of ['5m','15m','1H','4H','1D'])d[b]=await candles(activeInstrumentId(),b,b==='1D'?120:180);let c=d['1H'],lo=Math.min(...c.map(x=>x.l)),hi=Math.max(...c.map(x=>x.h)),v=current.volUsd,oi=current.oi,hs=history[current.id]?.samples||[];let mtf=Object.fromEntries(Object.entries(d).map(([tf,cs])=>[tf,timeframeFeatures(cs)]));let mtfConsensus=multiTimeframeConsensus(mtf);let tr=terrain(current.score);$('detailBody').innerHTML=`<div class="analysisTabs"><button class="smallbtn" onclick="scrollToId('summary')">📊 Résumé</button><button class="smallbtn" onclick="scrollToId('graph1')">📈 Graphique</button><button class="smallbtn" onclick="scrollToId('tf')">🕯️ Price Action</button><button class="smallbtn" onclick="scrollToId('trader')">🧠 Trader</button><button class="smallbtn" onclick="openDeep(current.id,'engine')">🧠 Signaux</button><button class="smallbtn" onclick="openDeep(current.id,'context')">🌍 Contexte</button><button class="smallbtn" onclick="openDeep(current.id,'scenario')">🎯 Scénarios</button></div><div class="panel" id="summary"><div class="sub">${current.tier[1]} • ${instrument} • marché ${timeLabel(current.marketTs)} • OI ${timeLabel(current.oiTs)} • funding ${timeLabel(current.fundingTs)} • analyse ${current.analysisCoverage||'N/D'}</div><h2>${current.sym} — ${tr[0]}</h2><div class="grid"><div class="metric"><small>Prix</small><b>${price(displayPrice)}</b></div><div class="metric"><small>24h</small><b class="${current.chg>=0?'good':'bad'}">${chg(current.chg)}</b></div><div class="metric"><small>Confluence</small><b>${current.score}/100</b></div><div class="metric"><small>Funding</small><b>${pct(current.funding)}</b></div></div></div><div class="panel"><div class="sectionTitle"><h2>📡 Radars cliquables</h2><span class="sub">plusieurs jours → minute</span></div><div class="radars">${radar('Prix',displayPrice,lo,hi,'$','Position dans la plage 1H',c.map(x=>x.c))}${radar('OI',oi,oi==null?null:Math.max(0,oi*.65),oi==null?null:oi*1.35,'$','Niveau actuel + historique des scans',hs.map(x=>x.oi))}${radar('Volume',v,v*.35,v*1.8,'$','Volume 24h en dollars',c.map(x=>x.v))}${radar('Funding',current.funding==null?null:Math.abs(current.funding),0,current.funding==null?null:Math.max(Math.abs(current.funding)*2,.0001),'%','Intensité du financement',hs.map(x=>x.funding==null?null:Math.abs(x.funding)))}${radar('Momentum',Math.abs(current.chg)/100,0,Math.max(Math.abs(current.chg)/50,.01),'%','Amplitude 24h',c.slice(-24).map((x,i,a)=>i?Math.abs((x.c-a[i-1].c)/a[i-1].c):0))}${radar('Score',current.score,0,100,'score','Confluence actuelle',hs.map(x=>x.score).filter(x=>x>0))}</div></div><div class="panel" id="mtf"><h2>🧭 Confluence multi-timeframe</h2><div class="sub">Les timeframes ne pèsent pas tous le même poids : 1D/4H donnent le contexte, 1H/30m structurent la configuration, 15m/5m servent surtout au déclenchement.</div><div class="grid"><div class="metric"><small>Biais dominant</small><b>${mtfConsensus.bias==='bull'?'🟢 LONG':mtfConsensus.bias==='bear'?'🔴 SHORT':'🟡 MIXTE'}</b></div><div class="metric"><small>Alignement</small><b>${mtfConsensus.agreement}/100</b></div><div class="metric"><small>Contradiction</small><b>${mtfConsensus.contradiction}/100</b></div><div class="metric"><small>Lecture</small><b>${esc(mtfConsensus.detail)}</b></div></div><div class="signalList" style="margin-top:10px">${mtfConsensus.rows.map(r=>`<div class="signalRow"><div class="sigText"><b>${r.tf}</b><small>${r.bias==='bull'?'Haussier':r.bias==='bear'?'Baissier':'Neutre'} • ADX ${Number(r.adx||0).toFixed(1)}</small></div><span class="sigBadge ${r.bias==='bull'?'sigPos':r.bias==='bear'?'sigNeg':'sigNeu'}">${r.bias==='bull'?'LONG':r.bias==='bear'?'SHORT':'NEUTRE'}</span></div>`).join('')}</div></div><div class="panel" id="graph1"><div class="sectionTitle"><h2>📈 Graphique professionnel</h2><button class="smallbtn" onclick="openDeep(current.id,'graph')">Ouvrir en profondeur →</button></div><div class="sub">Bougies OHLC • volume • EMA 20/50 • Supertrend • RSI 14 • StochRSI</div>${proChart(c)}</div><div class="panel" id="tf"><h2>🕯️ Lecture multi-timeframe</h2><div class="candles">${Object.entries(d).map(([b,a])=>{let z=a.at(-1),p=a.at(-2);return `<div class="candle"><b>${b}</b><br>${struct(a)}<br><span class="sub">${pattern(z,p)}</span></div>`}).join('')}</div></div><div class="panel" id="trader"><h2>🧠 Lecture trader</h2><div class="scenario"><h3>${current.score>=70?'Configuration à approfondir':'Configuration en attente'}</h3><div class="sub">Prix ${current.chg>=0?'en hausse':'en baisse'} • OI ${current.oiDelta==null?'N/D':(current.oiDelta>=0?'+':'')+current.oiDelta.toFixed(1)+'%'} • funding ${pct(current.funding)}.</div><div class="scenarioInsight"><div class="insightBox"><b class="good">🟢 Ce que je vois</b><span>Le prix est ${current.chg>=0?'en hausse':'en baisse'} sur 24 h (${chg(current.chg)}). OI : ${current.oiDelta==null?'pas assez de recul':(current.oiDelta>=0?'+':'')+current.oiDelta.toFixed(1)+' % depuis le scan précédent'}. Funding : ${pct(current.funding)}.</span></div><div class="insightBox"><b class="bad">🔴 Ce qui me gêne</b><span>${current.analysisCoverage==='complete'?'Le score seul ne valide pas une entrée. Je dois vérifier structure, volume et niveau de prix.':'Analyse incomplète : je ne traite pas ce score comme une configuration validée.'}</span></div></div><div class="scenarioInsight"><div class="insightBox"><b class="blue">🎯 Ce que j’attends</b><span>Un niveau de déclenchement, une clôture confirmée et un stop défini avant d’envisager une entrée. Les niveaux exacts sont dans Scénarios.</span></div><div class="insightBox"><b class="warn">⛔ Quand je laisse tomber</b><span>Si le scénario est invalidé ou si les données sont trop anciennes, je repars d’un scan et d’une lecture du graphique.</span></div></div><div class="click" onclick="openDeep(current.id,'scenario')">🎯 Voir les scénarios et le déclencheur →</div></div></div><div class="panel"><h2>🌍 Contexte & acteurs</h2><div class="scenarioInsight"><div class="insightBox"><b>🌐 Marché</b><span>Le contexte global doit être confronté à BTC/ETH, à la structure et au momentum de l'actif.</span></div><div class="insightBox"><b>📊 Dérivés</b><span>OI et funding donnent le contexte de levier. Ils ne permettent pas à eux seuls d'identifier un acteur institutionnel.</span></div><div class="insightBox"><b>💧 Liquidité & flux</b><span>Les flux publics disponibles sont distingués des interprétations. Aucune banque ou aucun fonds n'est attribué sans donnée indépendante.</span></div><div class="insightBox"><b>🧭 Lecture</b><span>Donnée vérifiée → interprétation → hypothèse. Ces niveaux ne doivent pas être confondus.</span></div></div><div class="click" onclick="openDeep(current.id,'context')">🌍 Ouvrir le contexte détaillé →</div></div><div class="panel"><h2>🎯 Scénarios</h2><div class="scenario"><div class="scenarioActionGrid"><div class="scenarioLevelWide"><small>État</small><b>🔎 Recherche adaptative</b></div><div class="scenarioLevelWide"><small>Déclencheur</small><b>Choisi par le moteur</b></div><div class="scenarioLevelWide"><small>Invalidation</small><b>Verrouillée au scénario</b></div></div><div class="sub" style="margin-top:8px">Le scénario n'est pas une prédiction : il définit à l'avance ce qui doit se produire, ce qui invalide l'hypothèse et les objectifs associés.</div><div class="click" onclick="openDeep(current.id,'scenario')">🎯 Construire / suivre les scénarios chiffrés →</div></div></div>`;prepareInteractive();if(detailLiveTimer)clearInterval(detailLiveTimer);detailLiveTimer=setInterval(async()=>{try{const fresh=await candles(activeInstrumentId(),'1H',120);const g=$('graph1');if(g&&fresh.length){g.innerHTML=`<div class="sectionTitle"><h2>📈 Graphique professionnel</h2><button class="smallbtn" onclick="openDeep(current.id,'graph')">Ouvrir en profondeur →</button></div><div class="sub"><span class="liveDot"></span>Graphique consulté le ${clockStamp(Date.now())} • dernière bougie ${clockStamp(fresh.at(-1).t)} • actualisation toutes les 10 s tant que cette fiche est ouverte • OHLC • volume • EMA 20/50 • Supertrend • RSI 14 • StochRSI</div>${proChart(fresh)}`}}catch(_){}},10000)}catch(e){$('detailBody').innerHTML='<div class="panel">Erreur de chargement : '+esc(e.message)+'</div>'}}
function rangeControls(activeBar='1H',activeDays=1){let dayLabel=d=>d===1?'24H':d+'J';return `<div class="rangeBtns" id="bars">${['1m','5m','15m','1H','4H','1D'].map(x=>`<button class="smallbtn ${x===activeBar?'active':''}" data-bar="${x}">${x}</button>`).join('')}</div><div class="rangeBtns" id="ranges">${[1,3,7,14,30,90].map(d=>`<button class="smallbtn ${d===activeDays?'active':''}" data-days="${d}">${dayLabel(d)}</button>`).join('')}</div>`}
async function graphPage(){let bar='1H',days=7,drawSeq=0;async function draw(){const seq=++drawSeq;let mins=bar==='1m'?days*24*60:bar==='5m'?days*24*12:bar==='15m'?days*24*4:bar==='1H'?days*24:bar==='4H'?days*6:days;let limit=Math.min(1800,Math.max(2,mins));let warmup=Math.max(40,bar==='1m'?60:40);let raw=await candles(activeInstrumentId(),bar,Math.min(1800,limit+warmup));if(seq!==drawSeq)return;if(!raw.length){$('garea').innerHTML='<div class="empty">Aucune donnée disponible pour cette combinaison.</div>';return;}let rawDays=(raw.at(-1).t-raw[0].t)/86400000;let cs=raw.slice(-limit);let actualDays=(cs.at(-1).t-cs[0].t)/86400000;let coverage=actualDays+0.05>=days?'Couverture complète':'Couverture partielle';$('garea').innerHTML=`<div class="metricGrid"><div class="metric"><small>Plus haut</small><b class="good">${price(Math.max(...cs.map(x=>x.h)))}</b></div><div class="metric"><small>Plus bas</small><b class="bad">${price(Math.min(...cs.map(x=>x.l)))}</b></div><div class="metric"><small>Variation</small><b class="${cs.at(-1).c>=cs[0].o?'good':'bad'}">${chg((cs.at(-1).c/cs[0].o-1)*100)}</b></div></div><div class="callout ${coverage==='Couverture complète'?'goodbox':''}" style="margin:8px 0"><b>${coverage}</b> • ${actualDays.toFixed(1)} J réellement chargés • ${cs.length} bougies.</div>${proChart(cs,raw)}`;$('gmeta').textContent=`${bar} • ${days} jour${days>1?'s':''} demandés • ${cs.length} bougies • consulté le ${clockStamp(Date.now())} • dernière bougie ${clockStamp(cs.at(-1).t)} • actualisation automatique toutes les 10 s tant que ce graphique est ouvert`;}
$('deepBody').innerHTML=`<button class="btn secondary" onclick="backDetail()">← ${current.sym}</button><div class="panel"><h2>📈 Graphique approfondi — ${current.sym}</h2><div class="sub">Un vrai graphique de marché : bougies OHLC, volume, EMA 20/50, Supertrend, RSI et StochRSI. Les données sont celles des chandeliers OKX.</div>${rangeControls(bar,days)}<div id="gmeta" class="sub" style="margin:8px 0">Chargement…</div><button class="smallbtn" id="graphRefresh" type="button">↻ Actualiser ce graphique</button><div id="garea"></div><div class="panel" style="margin-top:10px;background:#15191f"><b>Comment lire ce graphique</b><div class="sub">1) Les bougies montrent qui contrôle chaque période. 2) Le volume mesure la participation. 3) EMA 20/50 donnent le contexte de tendance. 4) Supertrend aide à visualiser le régime. 5) RSI/StochRSI signalent l'accélération ou l'excès, mais ne constituent jamais une entrée à eux seuls.</div></div></div><div class="panel"><h2>🧠 Lecture de la période</h2><div class="callout goodbox">Le graphique sert à replacer le mouvement dans son contexte. Pour un scénario, on descend ensuite sur 15m/5m et on vérifie volume, OI, structure et invalidation.</div></div>`;$('graphRefresh').onclick=draw;document.querySelectorAll('#bars button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#bars button').forEach(x=>x.classList.remove('active'));b.classList.add('active');bar=b.dataset.bar;draw()});document.querySelectorAll('#ranges button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#ranges button').forEach(x=>x.classList.remove('active'));b.classList.add('active');days=+b.dataset.days;draw()});draw();if(graphLiveTimer)clearInterval(graphLiveTimer);graphLiveTimer=setInterval(draw,10000)}
async function openDeep(id,type,metric){if(detailLiveTimer){clearInterval(detailLiveTimer);detailLiveTimer=null}current=all.find(x=>x.id===id)||current;$('detail').classList.add('hidden');$('home').classList.add('hidden');$('deep').classList.remove('hidden');$('deepBody').innerHTML='<div class="empty">Chargement…</div>';if(type==='metric'){await metricPage(metric);return}if(type==='graph'){await graphPage();return}if(type==='engine'){let body=engineHtml();$('deepBody').innerHTML=`<button class="btn secondary" onclick="backDetail()">← ${current.sym}</button><div class="panel"><h2>🧠 Moteur de signaux</h2><div class="sub">Une seule lecture des signaux alimente le classement, l'analyse et les scénarios.</div></div>${body}`;return}if(type==='simScenario'){let body=simForm();$('deepBody').innerHTML=`<button class="btn secondary" onclick="backDetail()">← ${current.sym}</button><div class="panel"><h2>🧮 Simulation du scénario</h2><div class="sub">Les niveaux sont issus du scénario calculé. Ajuste le capital et le risque avant toute interprétation.</div>${body}</div>`;sim();return}if(type==='scenario'){const targetId=current.id;$('deepBody').innerHTML=`<button class="btn secondary" onclick="backDetail()">← ${current.sym}</button><div class="panel"><h2>🎯 Scénarios</h2><div class="empty">Construction des scénarios…<br><span class="sub">Les données OKX multi-timeframe sont chargées en arrière-plan.</span></div></div>`;scenarioHtml().then(body=>{if(current?.id!==targetId||$('deep').classList.contains('hidden'))return;$('deepBody').innerHTML=`<button class="btn secondary" onclick="backDetail()">← ${current.sym}</button><div class="panel"><h2>🎯 Scénarios</h2></div>${body}`;bindAcc()}).catch(e=>{if(current?.id===targetId&&!$('deep').classList.contains('hidden'))$('deepBody').innerHTML=`<button class="btn secondary" onclick="backDetail()">← ${current.sym}</button><div class="panel"><h2>🎯 Scénarios</h2><div class="empty">Erreur de chargement : ${esc(e.message)}</div></div>`});return}let title=type==='context'?'🌍 Contexte & acteurs':'🎯 Scénarios';let body=type==='context'?contextHtml():await scenarioHtml();$('deepBody').innerHTML=`<button class="btn secondary" onclick="backDetail()">← ${current.sym}</button><div class="panel"><h2>${title}</h2></div>${body}`;bindAcc()}
function contextHtml(){let btc=all.find(x=>x.sym==='BTC'),eth=all.find(x=>x.sym==='ETH');return `<div class="panel"><h2>🌍 Contexte marché</h2><div class="grid">${btc?`<div class="metric"><small>BTC 24h</small><b class="${btc.chg>=0?'good':'bad'}">${chg(btc.chg)}</b></div>`:''}${eth?`<div class="metric"><small>ETH 24h</small><b class="${eth.chg>=0?'good':'bad'}">${chg(eth.chg)}</b></div>`:''}<div class="metric"><small>Actifs analysés</small><b>${all.length}</b></div><div class="metric"><small>Score actuel</small><b>${current.score}/100</b></div></div><div class="callout"><b>Fait observable :</b> le radar dispose des prix, volumes, OI et funding OKX. <br><b>Non observable directement :</b> l'intention d'une banque ou d'un fonds. Une attribution institutionnelle exige une source publique indépendante.</div></div><div class="panel"><h2>🏦 Flux & acteurs</h2><div class="accordion open"><div class="accHead">Ce que les données permettent de dire <span>−</span></div><div class="accBody">Prix + volume + OI + funding permettent de décrire une configuration de marché et son positionnement sur les dérivés. Ils ne permettent pas, seuls, d'identifier l'acteur précis ni son horizon.</div></div><div class="accordion"><div class="accHead">Ce qu'un trader peut tester <span>＋</span></div><div class="accBody">Continuation, rejet, squeeze, retour sur support ou cassure. Chaque hypothèse doit avoir un déclencheur et une invalidation.</div></div></div>`}

function trValue(c,p){return p==null?c.h-c.l:Math.max(c.h-c.l,Math.abs(c.h-p.c),Math.abs(c.l-p.c))}
function avgVol(cs,len=20){let a=cs.slice(-len).map(x=>x.v).filter(Number.isFinite);return a.length?a.reduce((s,v)=>s+v,0)/a.length:null}
function nearestLevels(cs,priceNow){let p=pivots(cs,2,2),highs=p.highs.map(x=>x.v).filter(v=>v>priceNow).sort((a,b)=>a-b),lows=p.lows.map(x=>x.v).filter(v=>v<priceNow).sort((a,b)=>b-a);let recent=cs.slice(-48);let fallbackR=Math.max(...recent.map(x=>x.h)),fallbackS=Math.min(...recent.map(x=>x.l));return{resistance:highs[0]??fallbackR,support:lows[0]??fallbackS,nextResistance:highs[1]??null,nextSupport:lows[1]??null}}
function pctMove(a,b){return b?((a/b)-1)*100:0}
function clampPrice(x){return Math.max(0,n(x))}
function smaVals(cs,len,field='c'){
 let out=Array(cs.length).fill(null),q=[];
 for(let i=0;i<cs.length;i++){let v=n(cs[i]?.[field]);if(!Number.isFinite(v))continue;q.push(v);if(q.length>len)q.shift();if(q.length===len)out[i]=q.reduce((a,b)=>a+b,0)/len}
 return out;
}
function trSeries(cs){let out=[];for(let i=0;i<cs.length;i++){let p=cs[i-1],c=cs[i];out.push(i===0?Math.max(0,c.h-c.l):Math.max(c.h-c.l,Math.abs(c.h-p.c),Math.abs(c.l-p.c)))}return out}
function atrSeries(cs,len=14){let tr=trSeries(cs),out=Array(cs.length).fill(null);if(!tr.length)return out;let a=tr.slice(0,Math.min(len,tr.length)).reduce((x,y)=>x+y,0)/Math.min(len,tr.length);for(let i=0;i<tr.length;i++){if(i>=len)a=(a*(len-1)+tr[i])/len;out[i]=a}return out}
function atrValue(cs,len=14){let a=atrSeries(cs,len).filter(Number.isFinite);return a.at(-1)||null}
function adxValue(cs,len=14){if(cs.length<len*2+2)return null;let trs=trSeries(cs),plus=[],minus=[];for(let i=0;i<cs.length;i++){if(i===0){plus.push(0);minus.push(0);continue}let up=cs[i].h-cs[i-1].h,down=cs[i-1].l-cs[i].l;plus.push(up>down&&up>0?up:0);minus.push(down>up&&down>0?down:0)}let atr=atrSeries(cs,len),dx=[];for(let i=len;i<cs.length;i++){let tr=atr[i];if(!tr)continue;let ap=smaVals(cs.slice(0,i+1),len).at(-1);let p=plus.slice(i-len+1,i+1).reduce((a,b)=>a+b,0)/(len*tr),m=minus.slice(i-len+1,i+1).reduce((a,b)=>a+b,0)/(len*tr);let den=p+m;dx.push(den?100*Math.abs(p-m)/den:0)}return dx.length?dx.slice(-len).reduce((a,b)=>a+b,0)/Math.min(len,dx.length):null}
function bollinger(cs,len=20,mult=2){let vals=cs.map(x=>x.c),a=vals.slice(-len);if(a.length<len)return null;let mean=a.reduce((x,y)=>x+y,0)/len,sd=Math.sqrt(a.reduce((x,y)=>x+(y-mean)**2,0)/len);return {mid:mean,upper:mean+mult*sd,lower:mean-mult*sd,width:mean?((mult*2*sd)/mean):null,z:sd?(vals.at(-1)-mean)/sd:0}}
function rocValue(cs,len=10){if(cs.length<=len)return null;let a=cs.at(-1).c,b=cs.at(-1-len).c;return b?((a-b)/b)*100:null}
function volumeStats(cs,len=20){let vs=cs.slice(-len).map(x=>x.v).filter(Number.isFinite);if(!vs.length)return null;let mean=vs.reduce((a,b)=>a+b,0)/vs.length,sd=Math.sqrt(vs.reduce((a,b)=>a+(b-mean)**2,0)/vs.length);let last=cs.at(-1)?.v;return {mean,last,ratio:mean?last/mean:null,z:sd?(last-mean)/sd:0}}
function efficiencyValue(cs,len=20){if(cs.length<=len)return null;let net=Math.abs(cs.at(-1).c-cs.at(-1-len).c),path=0;for(let i=cs.length-len;i<cs.length;i++)path+=Math.abs(cs[i].c-cs[i-1].c);return path?net/path:null}
function lastCompleted(cs){let a=[...cs].reverse().find(x=>x.confirm===1||x.confirm==='1');return a||cs.at(-1)||null}
function pivots(cs,left=2,right=2){let hi=[],lo=[];for(let i=left;i<cs.length-right;i++){let h=cs[i].h,l=cs[i].l,okH=true,okL=true;for(let j=1;j<=left;j++){if(cs[i-j].h>=h)okH=false;if(cs[i-j].l<=l)okL=false}for(let j=1;j<=right;j++){if(cs[i+j].h>h)okH=false;if(cs[i+j].l<l)okL=false}if(okH)hi.push({i,t:cs[i].t,v:h});if(okL)lo.push({i,t:cs[i].t,v:l})}return {hi,lo}}
function clusterLevels(cs,priceNow){if(!cs?.length)return {support:priceNow*.99,resistance:priceNow*1.01,nextSupport:null,nextResistance:null};let p=pivots(cs,2,2),raw=[...p.hi.map(x=>({v:x.v,type:'r'})),...p.lo.map(x=>({v:x.v,type:'s'}))].sort((a,b)=>a.v-b.v);let atr=atrValue(cs,14)||priceNow*.01,tol=Math.max(atr*.28,priceNow*.0015),groups=[];for(const x of raw){let g=groups.find(z=>Math.abs(z.v-x.v)<=tol);if(g){g.v=(g.v*g.n+x.v)/(g.n+1);g.n++;g.types.add(x.type)}else groups.push({v:x.v,n:1,types:new Set([x.type])})}let below=groups.filter(x=>x.v<priceNow).sort((a,b)=>b.v-a.v),above=groups.filter(x=>x.v>priceNow).sort((a,b)=>a.v-b.v);let support=below[0]?.v, resistance=above[0]?.v;if(!support){let lows=cs.slice(-Math.min(80,cs.length)).map(x=>x.l);support=Math.min(...lows)}if(!resistance){let highs=cs.slice(-Math.min(80,cs.length)).map(x=>x.h);resistance=Math.max(...highs)}return {support,resistance,nextSupport:below[1]?.v||null,nextResistance:above[1]?.v||null,groups}}
function trendState(cs){if(!cs?.length)return {bull:false,bear:false,label:'N/D',strength:0};let e20=ema(cs,20),e50=ema(cs,50),p=lastCompleted(cs)?.c??cs.at(-1).c,a=e20.at(-1),b=e50.at(-1),adx=adxValue(cs,14),roc=rocValue(cs,10);let trendSep=Math.abs((a-b)/Math.max(Math.abs(p),1e-12))*10000,trendAdx=adx||0,trendRoc=roc||0,trendEff=efficiencyValue(cs,20)||0,trendConfirmed=(trendAdx>=18||trendEff>=.35||trendSep>=2.0);let bull=a>b&&p>a&&trendRoc>=0.25&&trendConfirmed,bear=a<b&&p<a&&trendRoc<=-0.25&&trendConfirmed,strength=Math.min(100,trendSep+trendAdx*.4+Math.min(20,Math.abs(trendRoc)*1.5)+trendEff*15);return {bull,bear,label:bull?'haussier':bear?'baissier':'mixte',strength,adx,roc,e20:a,e50:b}}
function timeframeFeatures(cs){let c=lastCompleted(cs);if(!c)return null;let priceNow=c.c,a=atrValue(cs,14),bb=bollinger(cs,20,2),vol=volumeStats(cs,20),t=trendState(cs),r=rsi(cs,14).filter(Number.isFinite).at(-1),sr=stochRsi(cs,14),levels=clusterLevels(cs,priceNow),roc=rocValue(cs,10),eff=efficiencyValue(cs,20);let range=(levels.resistance-levels.support)||a*4;let distR=Math.abs(levels.resistance-priceNow),distS=Math.abs(priceNow-levels.support);return {cs,c,priceNow,atr:a||priceNow*.01,bb,vol,t,rsi:r,stoch:sr?.k?.at(-1),stochK:sr?.k?.at(-1),stochD:sr?.d?.at(-1),levels,roc,eff,distR,distS,range,compression:bb?.width!=null&&bb.width<0.035,expansion:(vol?.ratio||0)>1.35&&Math.abs(roc||0)>(a/Math.max(priceNow,1e-12))*100*.35}}

function multiTimeframeConsensus(mtf){
  const order=['1D','4H','1H','30m','15m','5m','1m'];
  const rows=order.map(tf=>{const f=mtf?.[tf]; if(!f) return null; const t=f.t||{}; let bias=t.bull?'bull':t.bear?'bear':'neutral';
    const strength=Number.isFinite(t.strength)?t.strength:0;
    const adx=Number.isFinite(t.adx)?t.adx:0;
    const quality=Math.max(0,Math.min(100,50 + (bias==='bull'?1:bias==='bear'?-1:0)*Math.min(35,strength*.35) + Math.min(15,adx*.3)));
    return {tf,bias,strength,adx,quality};
  }).filter(Boolean);
  if(!rows.length) return {rows:[],bias:'neutral',score:50,agreement:0,contradiction:0,detail:'N/D'};
  const weights={ '1D':3.0,'4H':2.5,'1H':2.0,'30m':1.5,'15m':1.0,'5m':.7,'1m':.4 };
  let bull=0,bear=0,total=0; for(const r of rows){const w=weights[r.tf]||1;total+=w;if(r.bias==='bull')bull+=w;if(r.bias==='bear')bear+=w;}
  const major=rows.filter(r=>['1D','4H','1H'].includes(r.tf));
  const majorBull=major.filter(r=>r.bias==='bull').length, majorBear=major.filter(r=>r.bias==='bear').length;
  const dominant=bull>bear?'bull':bear>bull?'bear':'neutral';
  const agreement=Math.round(Math.max(bull,bear)/Math.max(total,1)*100);
  const contradiction=Math.round(Math.min(bull,bear)/Math.max(total,1)*100);
  const majorConflict=majorBull>0&&majorBear>0;
  let score=50 + (dominant==='bull'?1:dominant==='bear'?-1:0)*Math.min(35,agreement*.35);
  if(majorConflict) score-=12;
  if((majorBull===major.length&&major.length>=2)||(majorBear===major.length&&major.length>=2)) score+=8;
  return {rows,bias:dominant,score:Math.max(0,Math.min(100,Math.round(score))),agreement,contradiction,majorConflict,detail:majorConflict?'Conflit entre timeframes majeurs':agreement>=70?'Alignement multi-timeframe fort':'Alignement partiel'};
}

function regimeContextFromMTF(F,currentData){
  const mtf=multiTimeframeConsensus(F);
  const rows=mtf.rows||[];
  const get=k=>F[k]||null;
  const majorBull=['1D','4H','1H'].filter(k=>get(k)?.t?.bull).length;
  const majorBear=['1D','4H','1H'].filter(k=>get(k)?.t?.bear).length;
  const trigger=get('15m')||get('5m')||get('1m')||get('1H');
  const anchor=get('4H')||get('1H')||get('1D');
  const vr=trigger?.vol?.ratio??null, adx=trigger?.t?.adx??0, roc=trigger?.roc??0;
  const comp=!!trigger?.compression, exp=!!trigger?.expansion;
  const near=trigger?Math.min(trigger.distR,trigger.distS)<=Math.max(trigger.atr*1.2,trigger.priceNow*.004):false;
  const counter=(anchor?.t?.bull&&trigger?.t?.bear)||(anchor?.t?.bear&&trigger?.t?.bull);
  let key='continuation',reason='Contexte directionnel sans déclencheur spécifique';
  if(counter && trigger && ((Number.isFinite(trigger.rsi)&&(trigger.rsi>=68||trigger.rsi<=32))||Math.abs(roc)>=1.5)){
    key='reversal'; reason='désaccord contexte/déclenchement + momentum extrême';
  }else if(comp && ((currentData?.oiDelta!=null&&Math.abs(currentData.oiDelta)>=1.5)||(vr!=null&&vr>=1.05))){
    key='squeeze'; reason='compression multi-timeframe + participation en évolution';
  }else if(exp && vr!=null&&vr>=1.15 && near && (majorBull>=2||majorBear>=2) && adx>=18){
    key='breakout'; reason='niveau proche + expansion + volume + contexte majeur cohérent';
  }else if(adx<18 && !exp && !counter){
    key='range'; reason='absence de tendance forte et volatilité contenue';
  }
  const profile=REGIME_PROFILES[key]||REGIME_PROFILES.continuation;
  return {...mtf,key,label:profile.label,reason,profile,majorBull,majorBear,counter};
}
const REGIME_PROFILES={
  breakout:{label:'Cassure / continuation',priority:['structure','priceAction','volume','trend','derivatives','adx'],avoid:['fundingExtreme'],tf:{'1D':1.8,'4H':1.6,'1H':1.35,'30m':1.15,'15m':1.3,'5m':.85,'1m':.35}},
  reversal:{label:'Retournement',priority:['priceAction','structure','momentum','rsi','range','volatility'],avoid:['chasing'],tf:{'1D':1.4,'4H':1.5,'1H':1.35,'30m':1.1,'15m':1.3,'5m':.95,'1m':.4}},
  range:{label:'Range / mean reversion',priority:['range','priceAction','rsi','bollinger','volatility'],avoid:['trendChase'],tf:{'1D':1.0,'4H':1.15,'1H':1.25,'30m':1.25,'15m':1.2,'5m':.9,'1m':.35}},
  squeeze:{label:'Compression / squeeze',priority:['volatility','derivatives','volume','bollinger','priceAction'],avoid:['earlyDirection'],tf:{'1D':1.5,'4H':1.5,'1H':1.4,'30m':1.2,'15m':1.25,'5m':1.0,'1m':.35}},
  continuation:{label:'Tendance / continuation',priority:['structure','trend','priceAction','volume','adx'],avoid:['counterTrend'],tf:{'1D':1.8,'4H':1.6,'1H':1.4,'30m':1.15,'15m':1.05,'5m':.75,'1m':.3}}
};

function adaptiveEngine(frames,currentData){
 const order=['1m','5m','15m','30m','1H','4H','1D'],F={};for(const k of order)if(frames[k]?.length>=40)F[k]=timeframeFeatures(frames[k]);
 const keys=Object.keys(F);if(keys.length<2)return null;
 const live=currentData?.price||F[keys[0]].priceNow;
 const mtf=regimeContextFromMTF(F,currentData);
 // Anchor selection: prefer the highest timeframe with a readable structure and enough room to the nearest key level.
 let anchorKey=keys[keys.length-1];for(const k of ['1D','4H','1H','30m','15m'])if(F[k]&&F[k].t.label!=='mixte'&&F[k].levels.support&&F[k].levels.resistance){anchorKey=k;break}
 const anchor=F[anchorKey];
 // Trigger selection: choose the shortest timeframe whose volatility, volume and structure can define a precise trigger without being excessively noisy.
 let triggerKey=null,best=-Infinity;for(const k of keys.filter(k=>['5m','15m','30m','1H'].includes(k))){let f=F[k],score=0;score+=(f.vol?.ratio>1?1:0)+(f.t.label===anchor.t.label?2:0)+(f.adx&&f.adx>18?1:0)+(f.eff&&f.eff>.25?1:0);score-=k==='1m'&&keys.length>3?.25:0;if(score>best){best=score;triggerKey=k}}
 const trigger=F[triggerKey||keys[0]], nearR=trigger.distR<=Math.max(trigger.atr*1.2,live*.004),nearS=trigger.distS<=Math.max(trigger.atr*1.2,live*.004), shortNearR=trigger.distR<=Math.max(trigger.atr*1.5,live*.006), shortNearS=trigger.distS<=Math.max(trigger.atr*1.5,live*.006);
 const biasBull=anchor.t.bull && (F['1H']?.t.bull||F['15m']?.t.bull||trigger.t.bull),biasBear=anchor.t.bear && (F['1H']?.t.bear||F['15m']?.t.bear||trigger.t.bear);
 const r=trigger.levels.resistance,s=trigger.levels.support,buf=Math.max(trigger.atr*.10,live*.00035),micro=Math.max(trigger.atr*.18,live*.00025);
 const brEntry=r+buf,brStop=Math.max(0,r-Math.max(trigger.atr*.65,micro)),brRisk=Math.max(1e-12,brEntry-brStop);
 const brT1=trigger.levels.nextResistance&&trigger.levels.nextResistance>brEntry?Math.max(brEntry+brRisk,trigger.levels.nextResistance):brEntry+brRisk;
 const brT2=Math.max(brT1+brRisk*.7,brEntry+brRisk*2),brT3=Math.max(brT2+brRisk*.7,brEntry+brRisk*3);
 const puEntry=s+Math.max(trigger.atr*.06,live*.0002),puStop=Math.max(0,s-Math.max(trigger.atr*.60,micro)),puRisk=Math.max(1e-12,puEntry-puStop);
 const puT1=Math.max(puEntry+puRisk, r),puT2=Math.max(puT1+puRisk*.65,trigger.levels.nextResistance||0),puT3=Math.max(puT2+puRisk*.65,puEntry+puRisk*3);
 const bdEntry=Math.max(0,s-buf),bdStop=s+Math.max(trigger.atr*.65,micro),bdRisk=Math.max(1e-12,bdStop-bdEntry);
 const bdT1=trigger.levels.nextSupport&&trigger.levels.nextSupport<bdEntry?Math.min(bdEntry-bdRisk,trigger.levels.nextSupport):bdEntry-bdRisk,bdT2=bdT1-bdRisk*.9,bdT3=bdT2-bdRisk*.9;
 const confluences=[];
 if(anchor.t.label!=='mixte')confluences.push(`tendance ${anchorKey} ${anchor.t.label}`);if(trigger.t.label===anchor.t.label)confluences.push(`alignement ${triggerKey}`);if(trigger.vol?.ratio>=1.15)confluences.push(`volume ${trigger.vol.ratio.toFixed(2)}x`);if(trigger.adx&&trigger.adx>=18)confluences.push(`ADX ${trigger.adx.toFixed(0)}`);if(trigger.bb?.z!=null&&Math.abs(trigger.bb.z)>=1)confluences.push(`position Bollinger ${trigger.bb.z.toFixed(1)}σ`);if(trigger.eff!=null&&trigger.eff>.3)confluences.push(`efficacité ${trigger.eff.toFixed(2)}`);if(trigger.rsi!=null&&trigger.rsi>52&&biasBull)confluences.push(`RSI ${trigger.rsi.toFixed(0)} haussier`);if(trigger.rsi!=null&&trigger.rsi<48&&biasBear)confluences.push(`RSI ${trigger.rsi.toFixed(0)} baissier`);
 const signals=[];
 const addSig=(name,status,detail,family)=>signals.push({name,status,detail,family});
 addSig(`Tendance ${anchorKey}`,anchor.t.label==='mixte'?'neutral':((biasBull&&anchor.t.bull)||(biasBear&&anchor.t.bear))?'positive':'negative',anchor.t.label,'structure');
 addSig(`Alignement ${triggerKey}`,trigger.t.label===anchor.t.label?'positive':trigger.t.label==='mixte'?'neutral':'negative',trigger.t.label,'structure');
 addSig('Volume déclencheur',trigger.vol?.ratio==null?'neutral':trigger.vol.ratio>=1.15?'positive':trigger.vol.ratio>=.85?'warning':'negative',trigger.vol?.ratio==null?'N/D':trigger.vol.ratio.toFixed(2)+'x moyenne','volume');
 addSig('RSI',!Number.isFinite(trigger.rsi)?'neutral':((biasBull&&trigger.rsi>=52)||(biasBear&&trigger.rsi<=48))?'positive':(trigger.rsi>=70||trigger.rsi<=30)?'warning':'negative',Number.isFinite(trigger.rsi)?trigger.rsi.toFixed(1):'N/D','momentum');
 addSig('Bollinger',trigger.bb?.z==null?'neutral':Math.abs(trigger.bb.z)>=2?'warning':Math.abs(trigger.bb.z)>=1?'positive':'neutral',trigger.bb?.z==null?'N/D':trigger.bb.z.toFixed(2)+'σ','volatilité');
 addSig('ADX',trigger.adx==null?'neutral':trigger.adx>=25?'positive':trigger.adx>=18?'warning':'negative',trigger.adx==null?'N/D':trigger.adx.toFixed(1),'tendance');
 addSig('Efficacité',trigger.eff==null?'neutral':trigger.eff>=.4?'positive':trigger.eff>=.25?'warning':'negative',trigger.eff==null?'N/D':trigger.eff.toFixed(2),'price action');
 addSig('Volatilité',trigger.compression?'warning':trigger.expansion?'positive':'neutral',trigger.compression?'compression':trigger.expansion?'expansion':'normale','volatilité');
 addSig('Distance au niveau',nearR||nearS?'positive':'neutral',nearR?'résistance proche':nearS?'support proche':'hors zone','structure');
 if(currentData?.oiDelta!=null)addSig('Open Interest',Math.abs(currentData.oiDelta)>=2?'warning':'neutral',(currentData.oiDelta>=0?'+':'')+currentData.oiDelta.toFixed(2)+'% • participation, pas direction','dérivés');else addSig('Open Interest','neutral','historique insuffisant','dérivés');
 if(currentData?.funding!=null){let f=currentData.funding;let adverse=(biasBull&&f>.0008)||(biasBear&&f<-.0008);addSig('Funding',adverse?'warning':(biasBull&&f<0)||(biasBear&&f>0)?'positive':'neutral',(f*100).toFixed(4)+'%','dérivés')}else addSig('Funding','neutral','N/D','dérivés');
 let score=38+confluences.length*6+(anchor.t.label===trigger.t.label?8:0)+(trigger.vol?.ratio>1.5?6:0)+(trigger.adx>25?6:0)+(trigger.eff>.4?5:0);
 const majorCount=(mtf.rows||[]).filter(r=>['1D','4H','1H'].includes(r.tf)).length;
 score+=mtf.majorBull===majorCount&&majorCount>=2&&biasBull?8:0;
  score+=mtf.majorBear===majorCount&&majorCount>=2&&biasBear?8:0;
 score-=mtf.majorConflict?15:0;
 score-=mtf.counter?8:0;
 if(mtf.key==='breakout' && !(nearR||nearS)) score-=8;
 if(mtf.key==='range' && (biasBull||biasBear)) score-=6;
 if(mtf.key==='squeeze' && !(trigger.compression||trigger.expansion)) score-=5;
 if(mtf.key==='reversal' && !(mtf.counter||trigger.rsi>=68||trigger.rsi<=32)) score-=6;
 score=Math.max(0,Math.min(100,Math.round(score)));
 const directional=directionalAssessment({F,extensionRisk:0,biasBull,biasBear,nearR,nearS},currentData||{});
 // V8.6.5 — the SHORT engine is pattern-led, not simply trend-led.
 // A valid short may come from a bearish continuation, a resistance rejection,
 // a failed breakout or a confirmed reversal even when the 1D anchor is not yet bearish.
 const triggerBear = !!(trigger?.t?.bear || (Number.isFinite(trigger?.t?.e20) && live<trigger.t.e20) || (Number.isFinite(trigger?.roc) && trigger.roc<0));
 const triggerBull = !!(trigger?.t?.bull || (Number.isFinite(trigger?.t?.e20) && live>trigger.t.e20) || (Number.isFinite(trigger?.roc) && trigger.roc>0));
 const bearishMomentum = !!(triggerBear && ((Number.isFinite(trigger?.rsi)&&trigger.rsi<=49) || (Number.isFinite(trigger?.roc)&&trigger.roc<0)));
 const shortRejectionPattern = !!(shortNearR && (bearishMomentum || (mtf.counter&&triggerBear) || (Number.isFinite(trigger?.bb?.z)&&trigger.bb.z>=1.2)));
 const shortBreakdownPattern = !!(shortNearS && triggerBear && ((Number.isFinite(trigger?.roc)&&trigger.roc<0) || (trigger?.eff||0)>=.25 || (trigger?.vol?.ratio||0)>=1.05));
 const shortReversalPattern = !!(mtf.counter && triggerBear && ((Number.isFinite(trigger?.rsi)&&trigger.rsi<=48) || (Number.isFinite(trigger?.roc)&&trigger.roc<0)));
 const shortExtensionReversal = !!((Number.isFinite(trigger?.rsi)&&trigger.rsi<52) && (Number.isFinite(trigger?.bb?.z)&&trigger.bb.z>1.4) && shortNearR);
 const shortPattern = shortRejectionPattern?'rejection':shortBreakdownPattern?'breakdown':shortReversalPattern?'reversal':shortExtensionReversal?'reversal':null;
 const shortBoost = shortPattern ? (shortPattern==='reversal'?12:shortPattern==='rejection'?10:8) : 0;
 directional.shortScore=Math.max(0,Math.min(100,Math.round(directional.shortScore+shortBoost)));
 directional.shortPattern=shortPattern;
 directional.shortEligible=!!(currentData?.perpId && shortPattern && directional.shortScore>=62 && directional.shortScore>=directional.longScore-3);
 // V8.6.5 — LONG remains independent; its instrument is selected later by the scenario layer.
 const shortBuf=Math.max(trigger.atr*.08,live*.0002);
 const srEntry=Math.max(0,r-shortBuf);
 const srStop=r+Math.max(trigger.atr*.55,micro);
 const srRisk=Math.max(1e-12,srStop-srEntry);
 const srT1=trigger.levels.nextSupport&&trigger.levels.nextSupport<srEntry?Math.min(srEntry-srRisk,trigger.levels.nextSupport):srEntry-srRisk;
 const srT2=Math.min(srT1-srRisk*.75,srEntry-srRisk*2);
 const srT3=Math.min(srT2-srRisk*.75,srEntry-srRisk*3);
 const shortRejection={entry:srEntry,stop:srStop,tp1:srT1,tp2:srT2,tp3:srT3,risk:srRisk,rr:[Math.max(0,(srEntry-srT1)/srRisk),Math.max(0,(srEntry-srT2)/srRisk),Math.max(0,(srEntry-srT3)/srRisk)]};
 const bearishContext=directional.shortEligible;
 const bullishContext=directional.longEligible && !mtf.majorConflict;
 const longSetup=!!(bullishContext&&(nearR||nearS)&&!mtf.counter);
 const shortSetup=!!(bearishContext && shortPattern);
 const breakdownValid=shortSetup&&shortPattern==='breakdown'&&scenarioValid('breakdown',{entry:bdEntry,stop:bdStop,tp1:bdT1,tp2:bdT2,tp3:bdT3},live);
 const rejectionValid=shortSetup&&(shortPattern==='rejection'||shortPattern==='reversal')&&scenarioValid('rejection',shortRejection,live);
 const longValid=(longSetup&&(scenarioValid('breakout',{entry:brEntry,stop:brStop,tp1:brT1,tp2:brT2,tp3:brT3},live)||scenarioValid('pullback',{entry:puEntry,stop:puStop,tp1:puT1,tp2:puT2,tp3:puT3},live)));
 const decision=score>=78&&confluences.length>=5&&!mtf.majorConflict?'SETUP':score>=62?'WATCH':'NO_SETUP';
 const readiness=decision==='SETUP'?'CONFIGURATION À APPROFONDIR':decision==='WATCH'?'CONFIGURATION EN FORMATION':'ATTENTE';
 const shared={families:{},counts:{positive:0,warning:0,negative:0,neutral:0},score:score};
 signals.forEach(sig=>{const key=String(sig.family||'autre');if(!shared.families[key])shared.families[key]={positive:0,negative:0,warning:0,neutral:0};shared.families[key][sig.status]=(shared.families[key][sig.status]||0)+1;shared.counts[sig.status]=(shared.counts[sig.status]||0)+1;});
 return {F,anchorKey,triggerKey,anchor,trigger,live,mtf,regime:mtf,decision,shared,biasBull,biasBear,nearR,nearS,shortNearR,shortNearS,shortPattern,confluences,signals,directional,signalCounts:{positive:signals.filter(x=>x.status==='positive').length,negative:signals.filter(x=>x.status==='negative').length,warning:signals.filter(x=>x.status==='warning').length,neutral:signals.filter(x=>x.status==='neutral').length},score,readiness,levels:trigger.levels,breakout:{entry:brEntry,stop:brStop,tp1:brT1,tp2:brT2,tp3:brT3,risk:brRisk,rr:[(brT1-brEntry)/brRisk,(brT2-brEntry)/brRisk,(brT3-brEntry)/brRisk]},pullback:{entry:puEntry,stop:puStop,tp1:puT1,tp2:puT2,tp3:puT3,risk:puRisk,rr:[(puT1-puEntry)/puRisk,(puT2-puEntry)/puRisk,(puT3-puEntry)/puRisk]},breakdown:{entry:bdEntry,stop:bdStop,tp1:bdT1,tp2:bdT2,tp3:bdT3,risk:bdRisk,rr:[Math.max(0,(bdEntry-bdT1)/bdRisk),Math.max(0,(bdEntry-bdT2)/bdRisk),Math.max(0,(bdEntry-bdT3)/bdRisk)]},shortRejection,longSetup,shortSetup,longValid,rejectionValid,breakdownValid,buffer:buf};
}
function directionalAssessment(e,x={}){
  const F=e?.F||{}, order=['1D','4H','1H','30m','15m','5m'], weights={"1D":4,"4H":3.4,"1H":2.7,"30m":2.1,"15m":1.6,"5m":1.1};
  let bull=0,bear=0,total=0;
  for(const tf of order){const f=F[tf];if(!f)continue;const w=weights[tf]||1;total+=w;let b=0,r=0;
    if(f.t?.bull)b+=2.4;if(f.t?.bear)r+=2.4;
    if(f.t?.e20!=null&&f.t?.e50!=null){if(f.t.e20>f.t.e50)b+=1.6;if(f.t.e20<f.t.e50)r+=1.6}
    if(Number.isFinite(f.rsi)){if(f.rsi>=52&&f.rsi<72)b+=1.1;if(f.rsi<=48&&f.rsi>28)r+=1.1;if(f.rsi>=75)r-=.8;if(f.rsi<=25)b-=.8}
    if(Number.isFinite(f.stochK)){if(f.stochK>.55&&f.stochK<.9)b+=.45;if(f.stochK<.45&&f.stochK>.1)r+=.45}
    if(Number.isFinite(f.roc)){if(f.roc>0)b+=.8;if(f.roc<0)r+=.8}
    if(f.eff!=null&&f.eff>.25){if(f.t?.bull)b+=.5;if(f.t?.bear)r+=.5}
    if(f.vol?.ratio!=null&&f.vol.ratio>=1.15){if(f.t?.bull)b+=.35;if(f.t?.bear)r+=.35}
    bull+=b*w;bear+=r*w;
  }
  const denom=Math.max(1,total*7.0);
  let longScore=50+(bull-bear)/denom*50,shortScore=50+(bear-bull)/denom*50;
  const ext=e?.extensionRisk||0;
  if(ext>=72){if(e?.biasBull)longScore-=12;if(e?.biasBear)shortScore-=12}
  if(e?.nearS&&e?.biasBull)longScore+=5;if(e?.nearR&&e?.biasBear)shortScore+=5;
  if(e?.nearR&&e?.biasBull)longScore+=2;if(e?.nearS&&e?.biasBear)shortScore+=2;
  const funding=x?.funding;if(Number.isFinite(funding)){if(funding>.0008){longScore-=3;shortScore+=1}else if(funding<-.0008){shortScore-=3;longScore+=1}}
  const oi=x?.oiDelta;if(Number.isFinite(oi)&&Number.isFinite(x?.chg)){if(x.chg>0&&oi>0)longScore+=2;if(x.chg<0&&oi>0)shortScore+=2;if(x.chg>0&&oi<0)longScore-=1;if(x.chg<0&&oi<0)shortScore-=1}
  longScore=Math.max(0,Math.min(100,Math.round(longScore)));shortScore=Math.max(0,Math.min(100,Math.round(shortScore)));
  const spread=Math.abs(longScore-shortScore),strongest=longScore>shortScore?'long':shortScore>longScore?'short':'neutral';
  return {longScore,shortScore,spread,strongest,longEligible:longScore>=66&&longScore>=shortScore+7,shortEligible:shortScore>=66&&shortScore>=longScore+7};
}
function scenarioLevel(label,v,cls=''){return `<div class="levelBox"><small>${label}</small><b class="${cls}">${axisPrice(v)}</b></div>`}
function scenarioCard(title,icon,s,side,condition,next,why,kind){let dir=side==='long'?'LONG':side==='short'?'SHORT':'ATTENTE',risk=s.risk,rr1=s.rr[0],rr2=s.rr[1],rr3=s.rr[2],market=side==='short'?'PERP':(currentScenarioInstrument==='perp'?'PERP':'SPOT');return `<div class="scenarioCard ${side==='short'?'danger':''}"><div class="sectionTitle"><h3>${icon} ${title}</h3><span class="tag ${side==='short'?'r':'b'}">${market} • ${dir}</span></div><div class="scenarioMeta"><span class="tag">Entrée conditionnelle</span><span class="tag">R/R TP1 ${rr1.toFixed(1)}</span><span class="tag">R/R TP2 ${rr2.toFixed(1)}</span><span class="tag">R/R TP3 ${rr3.toFixed(1)}</span></div><div class="scenarioLevels">${scenarioLevel('Entrée',s.entry,'blue')}${scenarioLevel('Stop / invalidation',s.stop,'bad')}${scenarioLevel('TP1',s.tp1,'good')}${scenarioLevel('TP2',s.tp2,'good')}${scenarioLevel('TP3',s.tp3,'good')}${scenarioLevel('Risque / unité',risk,'warn')}</div><div class="scenarioWhy"><b>Déclencheur :</b> ${condition}<br><b>Pourquoi :</b> ${why}<br><b>Invalidation :</b> le stop est franchi avec une clôture confirmée. Dans ce cas, le scénario est abandonné, pas déplacé pour "laisser respirer".</div><div class="monitorOpen"><button class="btn secondary" onclick="openScenarioMonitor('${current.id}','${kind}')">📈 Ouvrir la projection en temps réel →</button></div><div class="nextCheck"><span>⏱️ <b>Prochaine action</b><br><span class="sub">${next}</span></span><span class="tag">À attendre</span></div></div>`}
async function scenarioHtml(){
 const sourceId=current.id,targetId=currentScenarioInstrument==='perp'&&current.perpId?current.perpId:current.id;
 const safeLoad=async(k,n,ms=7000)=>{try{return await Promise.race([candles(targetId,k,n),new Promise((_,rej)=>setTimeout(()=>rej(Error('timeout')),ms))])}catch(_){return []}};
 // Ne pas bloquer la page sur les 7 timeframes : le moteur peut démarrer avec 3 TF structurantes.
 const frames={};
 for(const [k,n] of [['1D',120],['4H',100],['1H',140],['30m',140],['15m',180],['5m',180]]){frames[k]=await safeLoad(k,n);if(current?.id!==sourceId)throw Error('Analyse interrompue : actif changé');}
 const source={...current,id:targetId,price:targetId===current.perpId?(current.perpPrice||current.price):current.price};try{const ticker=await get('/market/ticker?instId='+encodeURIComponent(targetId));source.price=nullableNumber(ticker[0]?.last)??source.price}catch(_){}let e=adaptiveEngine(frames,source); if(e)e.directional=directionalAssessment(e,source);
 
 if(!e)return `<div class="panel"><div class="empty">Pas assez de données pour construire des scénarios chiffrés fiables.<br><span class="sub">Les données disponibles n'ont pas permis de constituer au moins deux timeframes exploitables.</span></div></div>`;
 const c=e.signalCounts;
 const checklist=[
  ['Tendance d’ancrage',e.anchor.t.label!=='mixte',`${e.anchorKey} • ${e.anchor.t.label}`],
  ['Structure du déclencheur',e.trigger.t.label!=='mixte',`${e.triggerKey} • ${e.trigger.t.label}`],
  ['Volume',e.trigger.vol?.ratio>=1.15,e.trigger.vol?.ratio==null?'N/D':e.trigger.vol.ratio.toFixed(2)+'x moyenne'],
  ['RSI',Number.isFinite(e.trigger.rsi),Number.isFinite(e.trigger.rsi)?e.trigger.rsi.toFixed(1):'N/D'],
  ['Niveau clé proche',e.nearR||e.nearS,'support '+axisPrice(e.levels.support)+' / résistance '+axisPrice(e.levels.resistance)]
 ];
 const checklistHtml=checklist.map(x=>`<div><span>${x[0]}<br><span class="sub">${x[2]}</span></span><b class="${x[1]?'checkYes':'checkNo'}">${x[1]?'✓':'ATTENDRE'}</b></div>`).join('');
 const signalsHtml=e.signals.map(x=>{let cls=x.status==='positive'?'sigPos':x.status==='negative'?'sigNeg':x.status==='warning'?'sigWarn':'sigNeu';let lab=x.status==='positive'?'FAVORABLE':x.status==='negative'?'DÉFAVORABLE':x.status==='warning'?'À SURVEILLER':'NEUTRE';return `<div class="signalRow"><div class="sigText"><b>${esc(x.name)}</b><small>${esc(x.detail)} • ${esc(x.family)}</small></div><span class="sigBadge ${cls}">${lab}</span></div>`}).join('');
 const readiness=e.readiness==='CONFIGURATION À APPROFONDIR'?'CONFIGURATION À APPROFONDIR':e.readiness==='CONFIGURATION EN FORMATION'?'EN FORMATION':'ATTENTE';
 const readinessClass=readiness==='CONFIGURATION À APPROFONDIR'?'good':readiness==='EN FORMATION'?'warn':'bad';
 const primaryKind=chooseFreshScenario(e,null);
 const primaryLabel=primaryKind?scenarioActionLabel(primaryKind):'AUCUN SCÉNARIO ACTUEL';
 const instrumentAvailability=current.hasPerp?'Perp disponible en plus du Spot':'Aucun Perp associé • analyse Spot uniquement';
 const breakoutNext=`Prochaine clôture ${e.triggerKey} : vérifier cassure + volume, puis retest.`;
 const pullNext=`Prochaine clôture ${e.triggerKey} : vérifier défense du support et rejet.`;
 const shortNext=`Prochaine clôture ${e.triggerKey} : vérifier cassure sous support + volume.`;
 const breakoutWhy=`résistance ${axisPrice(e.levels.resistance)}; ancrage ${e.anchorKey} ${e.anchor.t.label}; le moteur croise ${e.signals.length} familles de signaux et n’utilise pas les seuls signaux favorables.`;
 const pullWhy=`support ${axisPrice(e.levels.support)}; le scénario attend une défense mesurable du niveau plutôt qu’une entrée au milieu de la plage.`;
 const shortWhy=`support ${axisPrice(e.levels.support)}; le scénario ne devient pertinent que si la structure baissière et la confirmation apparaissent.`;
 return `<div class="panel"><div class="scenarioHero"><div class="scenarioState"><div class="sub">${current.sym} • analyse adaptative</div><div class="scenarioMeta"><span class="tag ${primaryKind?'g':'y'}">🎯 SCÉNARIO ACTUEL : ${primaryLabel}</span><span class="tag">${instrumentAvailability}</span></div><div class="state ${readinessClass}">${readiness}</div><div class="sub" style="margin-top:5px">${axisPrice(e.live)} • ancrage ${e.anchorKey} • déclencheur ${e.triggerKey} • moteur partagé ${e.score}/100 • LONG ${e.directional.longScore} / SHORT ${e.directional.shortScore}</div></div><div class="scenarioState"><div class="sub">Lecture globale</div><div class="signalSummary"><div class="signalCount signalGood"><b>${c.positive}</b><span>favorables</span></div><div class="signalCount signalBad"><b>${c.negative}</b><span>défavorables</span></div><div class="signalCount signalWarn"><b>${c.warning}</b><span>à surveiller</span></div><div class="signalCount signalNeutral"><b>${c.neutral}</b><span>neutres</span></div></div></div></div><div class="nextCheck"><span>🧭 <b>Lecture simple</b><br><span class="sub">Le Radar ne te demande pas de mémoriser les indicateurs : il te montre ce qui est favorable, ce qui bloque et l’événement qui doit se produire.</span></span><span class="tag">${e.score}/100</span></div></div>
 <div class="panel"><h2>🧠 Tous les signaux</h2><div class="sub">Aucun signal défavorable n’est masqué. Les signaux sont regroupés par familles pour éviter de compter plusieurs fois la même information.</div><div class="signalList">${signalsHtml}</div></div>
 <div class="panel"><h2>🧭 Lecture directionnelle</h2><div class="grid"><div class="metric"><small>Score LONG</small><b class="good">${e.directional.longScore}/100</b><div class="foot">Force de la configuration acheteuse</div></div><div class="metric"><small>Score SHORT</small><b class="bad">${e.directional.shortScore}/100</b><div class="foot">Force de la configuration vendeuse${current.hasPerp?'':' • non tradée en spot'}</div></div><div class="metric"><small>Écart</small><b>${e.directional.spread}/100</b></div><div class="metric"><small>Produit</small><b>${current.hasPerp?'SPOT + PERP':'SPOT'}</b></div></div></div>
 <div class="panel"><h2>🎯 Ce que tu dois attendre</h2><div class="scenarioChecklist">${checklistHtml}</div><div class="foot">Les cases décrivent l’état des données. Le scénario devient activé uniquement lorsque son déclencheur et ses confirmations sont réellement remplis.</div></div>
 <div class="panel"><h2>🎯 Ce que tu fais si ce scénario se déclenche</h2><div class="scenarioActionGrid"><div class="scenarioLevelWide"><small>INSTRUMENT</small><b>${primaryKind?scenarioMarket(primaryKind).toUpperCase():'—'}</b></div><div class="scenarioLevelWide"><small>DIRECTION</small><b class="${primaryKind&&isShortScenarioKind(primaryKind)?'bad':'good'}">${primaryKind?(scenarioDirection(primaryKind)==='short'?'🔴 SHORT':'🟢 LONG'):'ATTENTE'}</b></div><div class="scenarioLevelWide"><small>ACTION</small><b>${primaryKind?(scenarioDirection(primaryKind)==='short'?'Attendre la confirmation vendeuse':'Attendre la confirmation acheteuse'):'Ne rien faire'}</b></div></div><div class="foot">Le type de marché et la direction ci-dessus décrivent le scénario réellement retenu. Le badge de disponibilité d’un Perp ne constitue pas une proposition de trade.</div></div>
 <div class="panel"><h2>🎯 Scénarios chiffrés</h2><div class="sub">Chaque scénario est une hypothèse conditionnelle. Clique dessus pour afficher la projection sur les bougies et suivre le déclencheur.</div>
 ${e.longSetup&&scenarioValid('breakout',e.breakout,e.live)?scenarioCard('Cassure + retest','🟢',e.breakout,'long',`clôture de ${e.triggerKey} au-dessus de ${axisPrice(e.breakout.entry)} puis maintien/retest.`,breakoutNext,breakoutWhy,'breakout'):''}
 ${e.longSetup&&scenarioValid('pullback',e.pullback,e.live)?scenarioCard('Rebond sur support','🟡',e.pullback,'long',`retour vers ${axisPrice(e.pullback.entry)} puis défense du support ${axisPrice(e.levels.support)}.`,pullNext,pullWhy,'pullback'):''}
 ${current.hasPerp&&e.shortSetup&&e.rejectionValid?scenarioCard('Rejet / retest de résistance','🟠',e.shortRejection,'short',`rejet de la résistance ${axisPrice(e.levels.resistance)} puis clôture de ${e.triggerKey} sous ${axisPrice(e.shortRejection.entry)}.`,`Prochaine clôture ${e.triggerKey} : vérifier rejet + reprise de pression vendeuse.`,shortWhy,'rejection'):''}
 ${current.hasPerp&&e.shortSetup&&e.breakdownValid?scenarioCard('Cassure baissière','🔴',e.breakdown,'short',`clôture de ${e.triggerKey} sous ${axisPrice(e.breakdown.entry)} avec confirmation.`,shortNext,shortWhy,'breakdown'):''}
 ${!e.longValid&&!e.shortSetup?`<div class="decision"><b>Pas de scénario directionnel suffisamment propre.</b><br>Le Radar préfère attendre plutôt que fabriquer une entrée.</div>`:''}
 </div>
 <div class="panel"><h2>🧮 Risque avant gain</h2><div class="callout">Quand un scénario est activé, passe d’abord par la simulation : capital, risque maximal, distance entrée→stop et taille de position. Les niveaux ne tiennent pas compte des frais, du slippage ou du funding futur.</div></div>`;
}

let scenarioMonitorTimer=null,scenarioMonitorSeq=0,scenarioMonitorFrames={},scenarioMonitorBar='15m',scenarioMonitorZoom=90,scenarioMonitorKind=null,graphLiveTimer=null,detailLiveTimer=null;
const scenarioLocks=safeJSON(STORAGE.locks,{});
function saveScenarioLocks(){try{localStorage.setItem(STORAGE.locks,JSON.stringify(scenarioLocks))}catch(e){console.warn('Verrous non enregistrés',e)}}
function scenarioLockKey(id,kind){return id+'::'+kind}
function loadScenarioJournal(){const j=safeJSON(STORAGE.learning,[]);return Array.isArray(j)?j:[]}
function saveScenarioJournal(a){localStorage.setItem(STORAGE.learning,JSON.stringify(a.slice(-1500)))}
function learningSnapshot(e,kind){
 const d=current?.deep||{}; const dir=scenarioDirection(kind),market=scenarioMarket(kind);
 return {direction:dir,market,hasPerp:!!current?.hasPerp,price:nullableNumber(e?.live)??nullableNumber(current?.price),chg24:Number(current?.chg)||null,vol:Number(current?.vol)||null,oi:nullableNumber(current?.oi),oiDelta:Number.isFinite(current?.oiDelta)?current.oiDelta:null,funding:nullableNumber(current?.funding),rangePos:Number.isFinite(current?.rangePos)?current.rangePos:null,deep:{rsi:Number.isFinite(d.rsi)?d.rsi:null,stochK:Number.isFinite(d.stochK)?d.stochK:null,adx:Number.isFinite(d.adx)?d.adx:null,atrPct:Number.isFinite(d.atrPct)?d.atrPct:null,emaBias:d.emaBias||'neutral',supertrendBias:d.supertrendBias||'neutral',priceAction:d.priceAction||'neutral',compression:!!d.compression,expansion:!!d.expansion},scores:{quality:e?.score??null,long:e?.directional?.longScore??null,short:e?.directional?.shortScore??null},mtf:e?.mtf?.rows||[],regime:e?.regime?.key||'unknown'}}
function scenarioFingerprint(e,kind){const m=e?.regime||{};const f=e?.F||{};const major=[f['1D'],f['4H'],f['1H']].map(x=>x?.t?.label||'mixte').join('/');return {regime:m.key||'unknown',kind,direction:scenarioDirection(kind),anchor:e?.anchorKey||'N/D',trigger:e?.triggerKey||'N/D',mtfBias:e?.mtf?.bias||'neutral',mtfAgreement:e?.mtf?.agreement??null,major,score:e?.score??null,longScore:e?.directional?.longScore??null,shortScore:e?.directional?.shortScore??null,contradiction:e?.mtf?.contradiction??null}}
function journalCreate(e,kind,lock){
 const j=loadScenarioJournal();
 const fp=scenarioFingerprint(e,kind);
 const now=Date.now();
 const rec={schema:'IR_LEARNING_V3',id:lock.id,createdAt:lock.createdAt||now,closedAt:null,sym:current?.sym||current?.id||'N/D',instId:lock.instrumentId||current?.id||'',kind,direction:scenarioDirection(kind),market:scenarioMarket(kind),status:'FORMING',entry:lock.entry,stop:lock.stop,tp1:lock.tp1,tp2:lock.tp2,tp3:lock.tp3,score:lock.score,signals:lock.signals?.map(x=>({name:x.name,status:x.status,family:x.family}))||[],confluences:lock.confluences||[],fingerprint:fp,snapshot:learningSnapshot(e,kind),outcome:null,governance:{phase:'OBSERVATION',source:'LIVE'}};
 // Idempotent: a refresh must not create a duplicate observation for the same lock.
 const existing=j.find(x=>x.id===rec.id);
 if(existing)return existing;
 j.push(rec);saveScenarioJournal(j);return rec
}
function journalUpdate(id,patch){const j=loadScenarioJournal(),i=j.findIndex(x=>x.id===id);if(i<0)return null;Object.assign(j[i],patch);saveScenarioJournal(j);return j[i]}
function timeframeMs(bar){return {'1m':60000,'5m':300000,'15m':900000,'30m':1800000,'1H':3600000,'4H':14400000,'1D':86400000}[bar]||900000}
function verifiedObservation(r){return r?.status==='CLOSED'&&r?.schema==='IR_LEARNING_V3'&&r?.activatedAt!=null&&r?.outcome?.source==='CONFIRMED_CANDLE'&&Number.isFinite(r.outcome.r)}
// Record only completed bars following a confirmed conditional entry. This is a
// model observation, not proof that the user placed or filled an exchange order.
function journalAdvance(lock,side,bars,activated,barMs,now=Date.now()){
 const j=loadScenarioJournal(),rec=j.find(x=>x.id===lock.id);
 if(!rec||rec.status==='CLOSED'||rec.status==='CANCELLED')return rec||null;
 const complete=(bars||[]).filter(b=>Number.isFinite(b.t)&&Number(b.confirm)===1).sort((a,b)=>a.t-b.t);
 const latest=complete.at(-1),latestClose=latest?latest.t+barMs:null;
 if(rec.status==='FORMING'){
   if(latestClose>rec.createdAt&&latestClose<=now){
     const touchedStop=side==='short'?latest.h>=lock.stop:latest.l<=lock.stop;
     if(touchedStop){rec.status='CANCELLED';rec.cancelledAt=latestClose;rec.cancelReason='INVALIDATED_BEFORE_ENTRY';saveScenarioJournal(j)}
     else if(activated){rec.status='ACTIVATED';rec.activatedAt=latestClose;rec.activatedBarTs=latest.t;rec.entryObservedAt=latestClose;rec.entryPrice=lock.entry;rec.entrySource='CONFIRMED_TRIGGER';rec.lastProcessedBarTs=latest.t;saveScenarioJournal(j)}
   }
   return rec;
 }
 if(rec.status!=='ACTIVATED'||!Number.isFinite(rec.activatedBarTs))return rec;
 if(complete.length&&complete[0].t>Math.max(rec.activatedBarTs,rec.lastProcessedBarTs||0)+barMs){rec.status='UNVERIFIED';rec.unverifiedReason='Bougies manquantes pendant le suivi';saveScenarioJournal(j);return rec}
 for(const bar of complete){
   if(bar.t<=Math.max(rec.activatedBarTs,rec.lastProcessedBarTs||0))continue;
   const stopHit=side==='short'?bar.h>=lock.stop:bar.l<=lock.stop;
   const tpHit=side==='short'?bar.l<=lock.tp1:bar.h>=lock.tp1;
   rec.lastProcessedBarTs=bar.t;
   if(!stopHit&&!tpHit)continue;
   // When both levels occur inside one bar, the order is unknowable: assume SL.
   const target=stopHit?lock.stop:lock.tp1,risk=Math.abs(lock.entry-lock.stop);
   rec.status='CLOSED';rec.closedAt=bar.t+barMs;
   rec.outcome={status:stopHit?'SL':'TP1',label:stopHit?'Stop atteint':'TP1 atteint',price:target,ts:rec.closedAt,r:risk?(side==='short'?lock.entry-target:target-lock.entry)/risk:null,source:'CONFIRMED_CANDLE',sameBarAmbiguous:stopHit&&tpHit};
   rec.durationMs=Math.max(0,rec.closedAt-rec.activatedAt);
   rec.governance={...(rec.governance||{}),phase:'OBSERVATION',closedBy:'CONFIRMED_CANDLE'};
   break;
 }
 saveScenarioJournal(j);return rec;
}

function learningStats(){
 const j=loadScenarioJournal();
 const closed=j.filter(verifiedObservation);
 const groups={};
 for(const r of closed){
  const k=[r.direction||'unknown',r.market||'unknown',r.fingerprint?.regime||'unknown',r.kind||'unknown'].join(' / ');
  groups[k]??={n:0,tp1:0,tp2:0,tp3:0,sl:0,avgScore:0,avgR:0,sumR2:0};
  const g=groups[k],R=Number(r.outcome.r)||0;g.n++;g.avgScore+=Number(r.score)||0;g.avgR+=R;g.sumR2+=R*R;
  if(r.outcome.status==='TP1')g.tp1++;if(r.outcome.status==='TP2')g.tp2++;if(r.outcome.status==='TP3')g.tp3++;if(r.outcome.status==='SL')g.sl++
 }
 Object.values(groups).forEach(g=>{g.avgScore/=Math.max(1,g.n);g.avgR/=Math.max(1,g.n);g.sdR=g.n>1?Math.sqrt(Math.max(0,(g.sumR2-g.n*g.avgR*g.avgR)/(g.n-1))):0;g.tpRate=(g.tp1+g.tp2+g.tp3)/Math.max(1,g.n);});
 return {total:j.length,closed:closed.length,legacy:j.filter(x=>x.status==='CLOSED'&&!verifiedObservation(x)).length,open:j.filter(x=>x.status==='FORMING'||x.status==='ACTIVATED').length,groups,journal:j}
}
function wilson(rate,n,z=1.96){if(!n)return [0,0];const d=1+z*z/n,c=(rate+z*z/(2*n))/d,m=z*Math.sqrt((rate*(1-rate)+z*z/(4*n))/n)/d;return [Math.max(0,c-m),Math.min(1,c+m)]}
function learningProposal(){
 const s=learningStats(),closed=s.journal.filter(x=>x.status==='CLOSED'&&x.outcome&&Number.isFinite(Number(x.outcome.r)));
 const byDir={long:[],short:[]};closed.forEach(r=>{if(byDir[r.direction])byDir[r.direction].push(r)});
 const summarize=a=>{const n=a.length,sl=a.filter(r=>r.outcome.status==='SL').length,tp=a.filter(r=>/^TP/.test(r.outcome.status)).length,avgR=n?a.reduce((z,r)=>z+(Number(r.outcome.r)||0),0)/n:0,rate=n?tp/n:0;return {n,hitRate:rate,slRate:n?sl/n:0,avgR,ci:wilson(rate,n),sampleReady:n>=30}};
 const configs=Object.entries(s.groups).map(([key,g])=>({key,n:g.n,tpRate:g.tpRate,avgR:g.avgR,ci:wilson(g.tpRate,g.n),sampleReady:g.n>=20})).sort((a,b)=>b.avgR-a.avgR);
 return {sample:closed.length,long:summarize(byDir.long),short:summarize(byDir.short),configs,ready:closed.length>=30};
}
function exportLearningJson(){const payload={schema:'IR_LEARNING_V3',exportedAt:new Date().toISOString(),app:APP_VERSION,storage:STORAGE.learning,journal:loadScenarioJournal()};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='institutional-radar-learning-'+APP_VERSION.toLowerCase().replace(/[^0-9a-z]+/g,'-')+'-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function importLearningJson(){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{const f=input.files?.[0];if(!f)return;try{const obj=JSON.parse(await f.text()),incoming=Array.isArray(obj)?obj:obj.journal;if(!Array.isArray(incoming))throw Error('Format inconnu');const existing=loadScenarioJournal(),map=new Map(existing.map(x=>[x.id,x]));incoming.forEach(x=>{if(x?.id)map.set(x.id,x)});saveScenarioJournal([...map.values()]);alert(`${incoming.length} observations importées.`);toolPage('memory')}catch(e){alert('Import impossible : '+e.message)}};input.click()}
function labLearningReport(){const s=learningStats(),groups=Object.entries(s.groups).sort((a,b)=>b[1].n-a[1].n),proposal=learningProposal();return {sample:s.closed,legacy:s.legacy,groups,ready:s.closed>=30,proposal}}
function learningHtml(){const r=labLearningReport();const rows=r.groups.map(([k,g])=>`<div class="metric"><small>${esc(k)}</small><b>${g.n} résultats</b><div class="foot">TP1 ${g.tp1} • TP2 ${g.tp2} • TP3 ${g.tp3} • SL ${g.sl} • R moyen ${g.avgR.toFixed(2)} • score ${g.avgScore.toFixed(0)}</div></div>`).join('');return `<div class="panel"><div class="sectionTitle"><div><h2>🧬 Mémoire des configurations</h2><div class="sub">Chaque scénario suivi conserve son contexte de marché et ses niveaux. Les résultats sont des observations de bougies après déclenchement, pas des trades exécutés. Ces données restent locales jusqu'à export.</div></div><span class="tag b">IR_LEARNING_V3</span></div><div class="toolbar"><button class="btn" onclick="exportLearningJson()">⬇️ Exporter les données d'apprentissage</button><button class="btn secondary" onclick="importLearningJson()">⬆️ Importer un historique</button></div><div class="grid"><div class="metric"><small>Résultats vérifiables</small><b>${r.sample}</b><small>${r.legacy} anciens résultats archivés, exclus des statistiques</small></div><div class="metric"><small>Échantillon nécessaire</small><b>${r.ready?'✓ suffisant':'⏳ '+Math.max(0,30-r.sample)+' à construire'}</b></div><div class="metric"><small>LONG</small><b class="good">${r.proposal.long.n} • ${(r.proposal.long.hitRate*100).toFixed(0)}% TP</b></div><div class="metric"><small>SHORT</small><b class="bad">${r.proposal.short.n} • ${(r.proposal.short.hitRate*100).toFixed(0)}% TP</b></div></div></div><div class="panel"><h2>📚 Résultats par configuration</h2>${rows||'<div class="empty">Aucun résultat réel enregistré pour le moment. Le journal se nourrit lorsque les scénarios sont suivis et que des bougies clôturées confirment une entrée puis un résultat. Les anciens résultats restent archivés mais exclus des statistiques.</div>'}</div><div class="panel"><h2>🧠 Proposition d'apprentissage</h2><div class="grid"><div class="metric"><small>LONG • R moyen</small><b>${r.proposal.long.avgR.toFixed(2)}R</b></div><div class="metric"><small>SHORT • R moyen</small><b>${r.proposal.short.avgR.toFixed(2)}R</b></div><div class="metric"><small>LONG • invalidations</small><b>${(r.proposal.long.slRate*100).toFixed(0)}%</b></div><div class="metric"><small>SHORT • invalidations</small><b>${(r.proposal.short.slRate*100).toFixed(0)}%</b></div></div><div class="callout ${r.ready?'goodbox':''}"><b>${r.ready?'✓ Échantillon exploitable pour proposer des tests':'⏳ Observation uniquement'}</b><br>Le moteur ne réécrit pas ses règles à partir de ces statistiques. À partir d'un échantillon suffisant, elles servent à construire des hypothèses DEV, puis validation et HOLDOUT.</div></div><div class="panel"><h2>🛡️ Gouvernance</h2><div class="callout goodbox"><b>Le Radar observe avant d'apprendre.</b><br>Les résultats réels ne modifient jamais directement le code. Une amélioration doit être formulée comme hypothèse, testée hors échantillon, puis validée avant adoption.</div></div>`}
function clearScenarioLock(id,kind){const key=scenarioLockKey(id,kind),old=scenarioLocks[key];if(old){const rec=loadScenarioJournal().find(x=>x.id===old.id);if(rec&&(rec.status==='FORMING'||rec.status==='ACTIVATED'))journalUpdate(old.id,{status:'CANCELLED',cancelledAt:Date.now(),cancelReason:'USER_RESET'})}delete scenarioLocks[key];saveScenarioLocks()}
function isShortScenarioKind(kind){return kind==='breakdown'||kind==='rejection'}
function scenarioValid(kind,sc,live){
 if(!sc||!Number.isFinite(live))return false;
 const short=isShortScenarioKind(kind);
 if(!Number.isFinite(sc.entry)||!Number.isFinite(sc.stop)||!Number.isFinite(sc.tp1))return false;
 if(short){if(!(sc.stop>sc.entry&&sc.entry>sc.tp1))return false;return live>sc.entry&&live<sc.stop}
 if(!(sc.stop<sc.entry&&sc.entry<sc.tp1))return false;
 return live<sc.entry&&live>sc.stop;
}
function scenarioMarket(kind){return isShortScenarioKind(kind)?'perp':(currentScenarioInstrument==='perp'?'perp':'spot')}
function scenarioDirection(kind){return isShortScenarioKind(kind)?'short':'long'}
function scenarioActionLabel(kind){const m=scenarioMarket(kind),d=scenarioDirection(kind);return `${m==='perp'?'⚡ PERP':'💰 SPOT'} • ${d==='short'?'🔴 SHORT':'🟢 LONG'}`}
function scenarioLockFromEngine(e,kind){
 const sc=e?.[kind];if(!sc||!scenarioValid(kind,sc,e.live))return null;
 return {id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),kind,market:scenarioMarket(kind),direction:scenarioDirection(kind),createdAt:Date.now(),anchorKey:e.anchorKey,triggerKey:e.triggerKey,entry:sc.entry,stop:sc.stop,tp1:sc.tp1,tp2:sc.tp2,tp3:sc.tp3,risk:sc.risk,rr:[...sc.rr],score:e.score,signals:e.signals.map(s=>({...s})),confluences:[...e.confluences]};
}
function chooseFreshScenario(e,preferred){
 const shortScore=e?.directional?.shortScore||0,longScore=e?.directional?.longScore||0;
 const shortFirst=shortScore>longScore;
 const base=shortFirst?['rejection','breakdown','breakout','pullback']:['breakout','pullback','rejection','breakdown'];
 const order=[preferred,...base].filter((x,i,a)=>x&&a.indexOf(x)===i);
 for(const k of order){
  const allowed=isShortScenarioKind(k)?e?.shortSetup:e?.longSetup;
  if(e?.[k]&&allowed&&scenarioValid(k,e[k],e.live))return k;
 }
 return null;
}

async function openScenarioMonitor(id,kind){
 current=all.find(x=>x.id===id)||current;if(!current)return;
 $('detail').classList.add('hidden');$('home').classList.add('hidden');$('deep').classList.remove('hidden');
 $('deepBody').innerHTML='<div class="panel"><div class="empty">Construction de la projection…<br><span class="sub">Chargement des données OKX multi-timeframe.</span></div></div>';
 if(scenarioMonitorTimer)clearInterval(scenarioMonitorTimer);
 scenarioMonitorFrames={};scenarioMonitorBar='15m';scenarioMonitorZoom=90;scenarioMonitorKind=kind;
 await renderScenarioMonitor(kind,true);
 scenarioMonitorTimer=setInterval(()=>renderScenarioMonitor(kind,false),10000)
}
function closeScenarioMonitor(){if(scenarioMonitorTimer){clearInterval(scenarioMonitorTimer);scenarioMonitorTimer=null}scenarioMonitorFrames={};scenarioMonitorKind=null;backDetail()}
async function resetScenarioMonitor(kind){clearScenarioLock(current.id,kind);scenarioMonitorKind=kind;scenarioMonitorFrames={};scenarioMonitorZoom=90;await renderScenarioMonitor(kind,true)}
async function setScenarioMonitorBar(kind,bar){scenarioMonitorBar=bar;await renderScenarioMonitor(kind,false)}
async function zoomScenarioMonitor(kind,delta){scenarioMonitorZoom=Math.max(30,Math.min(240,scenarioMonitorZoom+delta));await renderScenarioMonitor(kind,false)}
async function renderScenarioMonitor(kind,initial=false){kind=scenarioMonitorKind||kind;const seq=++scenarioMonitorSeq;try{
 if(initial){
  const sourceId=current.id,targetId=isShortScenarioKind(kind)?current.perpId:(currentScenarioInstrument==='perp'&&current.perpId?current.perpId:current.id);
  if(!targetId)throw Error('Perp indisponible pour ce scénario');
  const safeLoad=async(k,n,ms=7000)=>{try{return await Promise.race([candles(targetId,k,n),new Promise((_,rej)=>setTimeout(()=>rej(Error('timeout')),ms))])}catch(_){return []}};
  // MTF complet : 1D/4H = contexte, 1H/30m = structure, 15m/5m = déclenchement.
  // On ne charge pas 1m au démarrage : il reste disponible dans la projection comme micro-TF.
  const entries=await Promise.all([
   ['1D',90],['4H',90],['1H',120],['30m',120],['15m',180],['5m',180]
  ].map(async x=>[x[0],await safeLoad(x[0],x[1])]));
  if(current?.id!==sourceId)throw Error('Projection interrompue : actif changé');
  scenarioMonitorFrames=Object.fromEntries(entries);
  const usable=Object.values(scenarioMonitorFrames).filter(x=>x?.length>=40).length;
  if(usable<2)throw Error('Données OKX insuffisantes pour construire la projection');
 }
 const marketInstId=isShortScenarioKind(kind)?current.perpId:(currentScenarioInstrument==='perp'&&current.perpId?current.perpId:current.id);
 let live=marketInstId===current.perpId?(current.perpPrice||current.price):current.price;try{let t=await get('/market/ticker?instId='+encodeURIComponent(marketInstId));if(Array.isArray(t)&&t[0]?.last)live=n(t[0].last)}catch(_){ }
 // Refresh the trigger and the visible timeframe so the monitor is genuinely live.
 const refreshBars=new Set([scenarioMonitorBar]);if(scenarioLocks[scenarioLockKey(current.id,kind)]?.triggerKey)refreshBars.add(scenarioLocks[scenarioLockKey(current.id,kind)].triggerKey);
 for(const b of refreshBars)scenarioMonitorFrames[b]=await candles(marketInstId,b,b==='1m'?300:180);
 const e=adaptiveEngine(scenarioMonitorFrames,{...current,id:marketInstId,price:live});if(seq!==scenarioMonitorSeq||!e)return;
 let actualKind=kind;const lockKey=scenarioLockKey(current.id,actualKind);let lock=scenarioLocks[lockKey];
 if(!lock){actualKind=e[kind]&&(isShortScenarioKind(kind)?e.shortSetup:e.longSetup)&&scenarioValid(kind,e[kind],e.live)?kind:null;if(!actualKind){$('deepBody').innerHTML=`<button class="btn secondary" onclick="closeScenarioMonitor()">← Scénarios</button><div class="panel"><div class="monitorAction bad"><div class="actionTitle">🔴 AUCUNE CONFIGURATION VALIDE</div><div class="monitorSub">Le moteur refuse de verrouiller un scénario dont l'invalidation est déjà franchie.</div><button class="monitorBtn secondary" onclick="resetScenarioMonitor('${kind}')">🔎 Rechercher à nouveau</button></div></div>`;return}const nk=scenarioLockKey(current.id,actualKind);lock=scenarioLockFromEngine(e,actualKind);if(!lock)return;lock.instrumentId=marketInstId;scenarioLocks[nk]=lock;saveScenarioLocks();scenarioMonitorKind=actualKind;journalCreate(e,actualKind,lock)}
 const triggerKey=lock.triggerKey||e.triggerKey,anchorKey=lock.anchorKey||e.anchorKey;
 if(!scenarioMonitorFrames[triggerKey])scenarioMonitorFrames[triggerKey]=await candles(marketInstId,triggerKey,180);
 if(scenarioMonitorBar!==triggerKey&&!scenarioMonitorFrames[scenarioMonitorBar])scenarioMonitorFrames[scenarioMonitorBar]=await candles(marketInstId,scenarioMonitorBar,300);
 const triggerCs=scenarioMonitorFrames[triggerKey]||scenarioMonitorFrames['15m'];
 const tf=triggerCs?.length?timeframeFeatures(triggerCs):e.trigger;
 const chartAll=scenarioMonitorFrames[scenarioMonitorBar]||triggerCs||[];
 const chartCs=chartAll.slice(-Math.min(scenarioMonitorZoom,chartAll.length));
 const sc=lock,displayKind=lock.kind||actualKind,side=lock.direction||scenarioDirection(displayKind);
 const closeC=lastCompleted(triggerCs||[]);const volAvg=avgVol(triggerCs||[],20);const volRatio=volAvg&&closeC?closeC.v/volAvg:null;
 const crossed=side==='long'?live>=sc.entry:live<=sc.entry;const triggerClose=side==='long'?closeC?.c>=sc.entry:closeC?.c<=sc.entry;const volOk=volRatio==null?false:volRatio>=1.15;const trendOk=side==='long'?e.biasBull:e.biasBear;const invalid=side==='long'?live<=sc.stop:live>=sc.stop;const near=Math.abs(live-sc.entry)<=Math.max((tf?.atr||0)*.55,live*.0015);const activated=crossed&&triggerClose&&volOk&&trendOk&&!invalid;
 let state='orange',label='EN FORMATION',reason=`Le prix live est à ${axisPrice(Math.abs(live-sc.entry))} du déclencheur. Le niveau reste verrouillé.`;
 if(invalid){state='red';label='SCÉNARIO INVALIDÉ';reason=`Le prix live a franchi l’invalidation ${axisPrice(sc.stop)}. Ce scénario est terminé.`}
 else if(activated){state='green';label='SCÉNARIO ACTIVÉ';reason=`Déclencheur atteint, clôture confirmée, volume ${volRatio?.toFixed(2)}x et biais compatible. Le scénario est activé, sans garantie de résultat.`}
 else if(near){state='yellow';label='DÉCLENCHEUR PROCHE';reason=`Le prix approche ${axisPrice(sc.entry)}. Il manque encore ${triggerClose?'le volume/la confirmation du biais':'la clôture de confirmation'}.`}
 const jrec=journalAdvance(sc,side,triggerCs,activated,timeframeMs(triggerKey));
 if(jrec?.status==='CLOSED'){state=jrec.outcome?.status==='SL'?'red':'green';label=jrec.outcome?.status==='SL'?'OBSERVATION : STOP ATTEINT':'OBSERVATION : TP1 ATTEINT';reason='Résultat observé sur bougie clôturée après le déclenchement. Aucun ordre réel n’est confirmé.'}
 else if(jrec?.status==='CANCELLED'||jrec?.status==='UNVERIFIED'){state='red';label=jrec.status==='CANCELLED'?'SCÉNARIO ANNULÉ AVANT ENTRÉE':'SUIVI NON VÉRIFIABLE';reason=jrec.status==='CANCELLED'?'Invalidation observée avant un déclenchement confirmé.':'Des bougies manquent dans le suivi ; aucun résultat n’est compté.'}
 else if(jrec?.status==='ACTIVATED'&&state!=='red'){state='green';label='ENTRÉE OBSERVÉE';reason='Déclencheur confirmé sur bougie clôturée. Le Radar suit maintenant les niveaux de sortie, sans connaître les ordres réellement passés.'}
 const overlays=[{value:sc.entry,color:'#65b8ff',label:'🎯 Déclencheur'},{value:sc.stop,color:'#ff6974',label:'🛑 Invalidation'},{value:sc.tp1,color:'#45dc7a',label:'TP1'},{value:sc.tp2,color:'#45dc7a',label:'TP2'},{value:sc.tp3,color:'#45dc7a',label:'TP3'}];
 csForHover=chartCs;const chart=projectionChart(chartCs,sc,live,state,overlays);
 const action=jrec?.status==='CLOSED'||jrec?.status==='CANCELLED'||jrec?.status==='UNVERIFIED'?`<div class="monitorAction ${jrec.status==='CLOSED'&&jrec.outcome?.status==='TP1'?'ready':'bad'}"><div class="actionTitle">${esc(label)}</div><div class="monitorSub">${esc(reason)}</div><button class="monitorBtn secondary" onclick="resetScenarioMonitor('${displayKind}')">🔎 Rechercher une nouvelle configuration</button></div>`:state==='green'?`<div class="monitorAction ready"><div class="actionTitle">🎯 ÉTUDIER LE SCÉNARIO</div><div class="monitorSub">Le scénario verrouillé vient de satisfaire ses conditions. Les niveaux ci-dessous sont les paramètres hypothétiques calculés avant l'événement.</div><button class="monitorBtn" onclick="openScenarioSim('${current.id}',${sc.entry},${sc.stop},${sc.tp1},${sc.tp2},${sc.tp3},'${side}')">🧮 Préparer l'entrée dans le simulateur</button></div>`:state==='red'?`<div class="monitorAction bad"><div class="actionTitle">🔴 SCÉNARIO TERMINÉ</div><div class="monitorSub">Ne poursuis pas cette hypothèse. Le Radar peut rechercher une nouvelle configuration.</div><button class="monitorBtn secondary" onclick="resetScenarioMonitor('${displayKind}')">🔎 Rechercher une nouvelle configuration</button></div>`:`<div class="monitorAction ${state==='yellow'?'warn':''}"><div class="actionTitle">${state==='yellow'?'🟡 SURVEILLER LE DÉCLENCHEUR':'🟠 ATTENDRE LA CONFIRMATION'}</div><div class="monitorSub">${esc(reason)}</div></div>`;
 const levels=`<div class="monitorMini"><div><small>Déclencheur verrouillé</small><b>${axisPrice(sc.entry)}</b></div><div><small>Invalidation verrouillée</small><b class="bad">${axisPrice(sc.stop)}</b></div><div><small>TP1</small><b class="good">${axisPrice(sc.tp1)}</b></div></div>`;
 const tfBtns=['1m','5m','15m','30m','1H','4H','1D'].map(b=>`<button class="smallbtn ${scenarioMonitorBar===b?'active':''}" onclick="setScenarioMonitorBar('${displayKind}','${b}')">${b}</button>`).join('');
 const zoomBtns=`<button class="smallbtn" onclick="zoomScenarioMonitor('${displayKind}',-30)">−</button><button class="smallbtn" onclick="zoomScenarioMonitor('${displayKind}',30)">＋</button><button class="smallbtn" onclick="scenarioMonitorZoom=90;renderScenarioMonitor('${displayKind}',false)">90</button>`;
 $('deepBody').innerHTML=`<button class="btn secondary" onclick="closeScenarioMonitor()">← Scénarios</button><div class="panel"><div class="monitorHero"><div class="monitorState"><div><div class="monitorHeadline">${current.sym} • ${displayKind==='breakout'?'Cassure + retest':displayKind==='pullback'?'Rebond sur support':displayKind==='rejection'?'Rejet / retest de résistance':'Cassure baissière'}</div><div class="monitorSub">🔒 ${scenarioActionLabel(displayKind)} • ${esc(marketInstId)} • scénario verrouillé • ${anchorKey} = ancrage • ${triggerKey} = déclenchement • 🟢 LIVE • actualisation ~10s • bougie visible rechargée</div></div><span class="monitorLight light${state.charAt(0).toUpperCase()+state.slice(1)}"></span></div><div style="margin-top:12px"><div class="monitorHeadline">${label}</div><div class="monitorSub">Prix live : ${axisPrice(live)} • ${esc(reason)}</div></div>${action}</div>${levels}</div><div class="panel monitorChart"><h2>📈 Projection du scénario</h2><div class="sub">Les lignes pointillées sont les niveaux verrouillés. Les bougies et le prix se mettent à jour ; les niveaux du scénario ne bougent pas.</div><div class="rangeBtns scenarioTfBtns">${tfBtns}</div><div class="rangeBtns scenarioZoomBtns">${zoomBtns}<span class="sub" style="align-self:center">${chartCs.length} bougies affichées</span></div>${chart}</div>${scenarioSimPanel(sc,side)}<div class="panel"><h2>🔎 Pourquoi cet état ?</h2><div class="signalSummary"><div class="signalCount signalGood"><b>${e.signalCounts.positive}</b><span>favorables</span></div><div class="signalCount signalBad"><b>${e.signalCounts.negative}</b><span>défavorables</span></div><div class="signalCount signalWarn"><b>${e.signalCounts.warning}</b><span>à surveiller</span></div><div class="signalCount signalNeutral"><b>${e.signalCounts.neutral}</b><span>neutres</span></div></div><div class="signalList">${e.signals.map(x=>{let cls=x.status==='positive'?'sigPos':x.status==='negative'?'sigNeg':x.status==='warning'?'sigWarn':'sigNeu';let lab=x.status==='positive'?'FAVORABLE':x.status==='negative'?'DÉFAVORABLE':x.status==='warning'?'À SURVEILLER':'NEUTRE';return `<div class="signalRow"><div class="sigText"><b>${esc(x.name)}</b><small>${esc(x.detail)} • ${esc(x.family)}</small></div><span class="sigBadge ${cls}">${lab}</span></div>`}).join('')}</div></div>`;bindScenarioSim(sc,side);
 }catch(err){if(seq===scenarioMonitorSeq)$('deepBody').innerHTML=`<button class="btn secondary" onclick="closeScenarioMonitor()">← Scénarios</button><div class="panel">Erreur de projection : ${esc(err.message)}</div>`}}
function projectionChart(cs,sc,live,state,overlays=[]){let base=proChart(cs,cs,overlays);return `<div>${base}</div><div class="projectionLegend"><span class="projectionTag">🔒 Déclencheur</span><span class="projectionTag">🛑 Invalidation</span><span class="projectionTag">🟢 TP1/2/3</span><span class="projectionTag">LIVE ${axisPrice(live)}</span></div>`}

let scenarioSimSettings={cap:100,riskPct:1,lev:1};
const scenarioSimValues={};
function scenarioSimKey(sc,side){return `${current?.id||'na'}|${side}|${sc?.id||'scenario'}`}
function scenarioSimRead(sc,side){
 const k=scenarioSimKey(sc,side),v=scenarioSimValues[k];
 return v||{cap:100,lev:1,entry:sc.entry,stop:sc.stop,tp1:sc.tp1,tp2:sc.tp2,tp3:sc.tp3,p1:40,p2:30,p3:30};
}
function scenarioSimSave(sc,side){
 const k=scenarioSimKey(sc,side);
 scenarioSimValues[k]={cap:n($('scCap')?.value),lev:n($('scLev')?.value)||1,entry:n($('scEntry')?.value),stop:n($('scStop')?.value),tp1:n($('scTp1')?.value),tp2:n($('scTp2')?.value),tp3:n($('scTp3')?.value),p1:Math.max(0,n($('scPct1')?.value)),p2:Math.max(0,n($('scPct2')?.value)),p3:Math.max(0,n($('scPct3')?.value))};
 return scenarioSimValues[k];
}
function openScenarioSim(id,entry,stop,tp1,tp2,tp3,side='long'){current=all.find(x=>x.id===id)||current;openDeep(current.id,'simScenario',null);setTimeout(()=>{let s=$('entry'),st=$('stop'),a=$('tp1'),b=$('tp2'),c=$('tp3'),d=$('simSide');if(s)s.value=entry;if(st)st.value=stop;if(a)a.value=tp1;if(b)b.value=tp2;if(c)c.value=tp3;if(d)d.value=side;calc()},50)}
function simForm(){let e=current.price,sl=e*.985,tp1=e*1.02,tp2=e*1.04,tp3=e*1.06;let opts=all.map(x=>`<option value="${esc(x.id)}" ${x.id===current.id?'selected':''}>${esc(bucketName(x.bucket))} — ${esc(x.sym)} — ${x.score}/100</option>`).join('');return `<label>Crypto<select id="simCrypto" class="select" style="width:100%">${opts}</select></label><div class="simgrid" style="margin-top:8px"><label>Sens<select id="simSide" class="select"><option value="long">LONG</option><option value="short">SHORT</option></select></label><label>Capital (€)<input id="cap" class="input" type="number" value="100"></label><label>Risque max (%)<input id="riskPct" class="input" type="number" step="0.1" value="1"></label><label>Prix d'entrée<input id="entry" class="input" type="number" step="0.000000000001" value="${e}"></label><label>Levier x<input id="lev" class="input" type="number" step="0.1" value="1"></label><label>Stop / invalidation<input id="stop" class="input" type="number" step="0.000000000001" value="${sl.toPrecision(10)}"></label><label>Objectif 1<input id="tp1" class="input" type="number" step="0.000000000001" value="${tp1.toPrecision(10)}"></label><label>Objectif 2<input id="tp2" class="input" type="number" step="0.000000000001" value="${tp2.toPrecision(10)}"></label><label>Objectif 3<input id="tp3" class="input" type="number" step="0.000000000001" value="${tp3.toPrecision(10)}"></label></div><div id="simout" class="panel"></div>`}
function sim(){['cap','riskPct','entry','lev','stop','tp1','tp2','tp3','simSide'].forEach(id=>$(id)?.addEventListener('input',calc));$('simCrypto')?.addEventListener('change',e=>{current=all.find(x=>x.id===e.target.value)||current;let p=current.price;$('entry').value=p;$('stop').value=(p*.985).toPrecision(10);$('tp1').value=(p*1.02).toPrecision(10);$('tp2').value=(p*1.04).toPrecision(10);$('tp3').value=(p*1.06).toPrecision(10);calc()});calc()}
function calc(){let cap=n($('cap')?.value),riskPct=n($('riskPct')?.value)||1,e=n($('entry')?.value),l=n($('lev')?.value),sl=n($('stop')?.value),t1=n($('tp1')?.value),t2=n($('tp2')?.value),t3=n($('tp3')?.value),side=$('simSide')?.value||'long';if(!e||!cap||!sl)return;let riskBudget=cap*(riskPct/100),dist=Math.abs(e-sl),qty=dist?riskBudget/dist:0,notional=qty*e,margin=l>0?notional/l:notional,pnl=p=>side==='short'?qty*(e-p):qty*(p-e),risk=Math.abs(pnl(sl)),r1=risk?Math.abs(pnl(t1))/risk:0,r2=risk?Math.abs(pnl(t2))/risk:0,r3=risk?Math.abs(pnl(t3))/risk:0;let gain=v=>pnl(v);$('simout').innerHTML=`<div class="grid"><div class="metric"><small>Risque prévu / Stop</small><b class="bad">-${risk.toFixed(2)} €</b></div><div class="metric"><small>Taille théorique</small><b>${qty.toPrecision(6)}</b></div><div class="metric"><small>Notionnel</small><b>${notional.toFixed(2)} €</b></div><div class="metric"><small>Marge avec levier</small><b>${margin.toFixed(2)} €</b></div><div class="metric"><small>Gain TP1</small><b class="good">${gain(t1)>=0?'+':''}${gain(t1).toFixed(2)} €</b></div><div class="metric"><small>R/R TP1</small><b>${r1.toFixed(2)}</b></div><div class="metric"><small>Gain TP2</small><b class="good">${gain(t2)>=0?'+':''}${gain(t2).toFixed(2)} €</b></div><div class="metric"><small>R/R TP2</small><b>${r2.toFixed(2)}</b></div><div class="metric"><small>Gain TP3</small><b class="good">${gain(t3)>=0?'+':''}${gain(t3).toFixed(2)} €</b></div><div class="metric"><small>R/R TP3</small><b>${r3.toFixed(2)}</b></div></div><div class="foot">Simulation hypothétique. Le risque est calculé à partir de l'entrée et du stop. Frais, funding, slippage et fiscalité ne sont pas inclus. Le levier modifie la marge nécessaire, pas le risque théorique si la taille est recalculée à partir du stop.</div>`}
function scenarioSimPanel(sc,side){let dir=side==='short'?'SHORT':'LONG',v=scenarioSimRead(sc,side);return `<div class="panel scenarioSimulator"><div class="sectionTitle"><h2>🧮 Simulation du scénario</h2><span class="tag">${dir} • paramètres manuels</span></div><div class="sub">Modifie les niveaux et la taille de position. Tous les résultats sont recalculés automatiquement.</div><div class="simgrid" style="margin-top:8px"><label>Capital / marge (€)<input id="scCap" class="input" type="number" step="0.01" value="${v.cap}"></label><label>Levier x<input id="scLev" class="input" type="number" step="0.1" min="0.1" value="${v.lev}"></label><label>Prix d'entrée<input id="scEntry" class="input" type="number" step="0.000000000001" value="${v.entry}"></label><label>Stop / SL<input id="scStop" class="input" type="number" step="0.000000000001" value="${v.stop}"></label><label>TP1<input id="scTp1" class="input" type="number" step="0.000000000001" value="${v.tp1}"></label><label>TP1 % position<input id="scPct1" class="input" type="number" step="1" min="0" max="100" value="${v.p1}"></label><label>TP2<input id="scTp2" class="input" type="number" step="0.000000000001" value="${v.tp2}"></label><label>TP2 % position<input id="scPct2" class="input" type="number" step="1" min="0" max="100" value="${v.p2}"></label><label>TP3<input id="scTp3" class="input" type="number" step="0.000000000001" value="${v.tp3}"></label><label>TP3 % position<input id="scPct3" class="input" type="number" step="1" min="0" max="100" value="${v.p3}"></label></div><div id="scenarioSimOut" class="panel" style="margin-top:10px"></div></div>`}
function calcScenarioSim(sc,side){let cap=n($('scCap')?.value),lev=n($('scLev')?.value)||1,e=n($('scEntry')?.value),sl=n($('scStop')?.value),t1=n($('scTp1')?.value),t2=n($('scTp2')?.value),t3=n($('scTp3')?.value),p1=Math.max(0,n($('scPct1')?.value)),p2=Math.max(0,n($('scPct2')?.value)),p3=Math.max(0,n($('scPct3')?.value));scenarioSimSettings={cap,lev};scenarioSimSave(sc,side);let totalPct=p1+p2+p3,notional=Math.max(0,cap)*Math.max(0,lev),qty=e>0?notional/e:0,pnlPct=p=>e&&p?((side==='short'?(e-p):(p-e))/e):0,slPct=pnlPct(sl),loss=Math.abs(notional*slPct),g1=notional*pnlPct(t1),g2=notional*pnlPct(t2),g3=notional*pnlPct(t3),r=v=>loss?Math.abs(notional*pnlPct(v))/loss:0,c1=g1*p1/100,c2=g2*p2/100,c3=g3*p3/100,cum=c1+c2+c3;let allocClass=Math.abs(totalPct-100)<0.001?'good':'bad';$('scenarioSimOut').innerHTML=`<div class="grid"><div class="metric"><small>Taille de position</small><b>${qty.toPrecision(8)}</b></div><div class="metric"><small>Notionnel</small><b>${notional.toFixed(2)} €</b></div><div class="metric"><small>Perte au SL</small><b class="bad">-${loss.toFixed(2)} €</b><small>${(Math.abs(slPct)*100).toFixed(2)}% du notionnel</small></div><div class="metric"><small>Allocation TP</small><b class="${allocClass}">${totalPct.toFixed(0)}%</b></div><div class="metric"><small>TP1 • gain position</small><b class="good">${g1>=0?'+':''}${g1.toFixed(2)} €</b><small>réalisé à ${p1}% : ${c1>=0?'+':''}${c1.toFixed(2)} € • R/R ${r(t1).toFixed(2)}</small></div><div class="metric"><small>TP2 • gain position</small><b class="good">${g2>=0?'+':''}${g2.toFixed(2)} €</b><small>réalisé à ${p2}% : ${c2>=0?'+':''}${c2.toFixed(2)} € • R/R ${r(t2).toFixed(2)}</small></div><div class="metric"><small>TP3 • gain position</small><b class="good">${g3>=0?'+':''}${g3.toFixed(2)} €</b><small>réalisé à ${p3}% : ${c3>=0?'+':''}${c3.toFixed(2)} € • R/R ${r(t3).toFixed(2)}</small></div><div class="metric"><small>Gain cumulé si les 3 TP sont atteints</small><b class="good">${cum>=0?'+':''}${cum.toFixed(2)} €</b><small>hors frais, funding et slippage</small></div></div><div class="foot">Le capital/marge est la base de la position. Le levier augmente le notionnel. Les prix Entry/SL/TP et les allocations sont modifiables ; les autres valeurs sont recalculées automatiquement.${Math.abs(totalPct-100)>0.001?` <b style="color:#f85149">Les allocations doivent totaliser 100 %.</b>`:''}</div>`}
function bindScenarioSim(sc,side){['scCap','scLev','scEntry','scStop','scTp1','scTp2','scTp3','scPct1','scPct2','scPct3'].forEach(id=>$(id)?.addEventListener('input',()=>calcScenarioSim(sc,side)));calcScenarioSim(sc,side)}
async function metricPage(metric){
let bar='1H',days=1,loadSeq=0;
function calcLimit(){let mins=bar==='1m'?days*24*60:bar==='5m'?days*24*12:bar==='15m'?days*24*4:bar==='1H'?days*24:bar==='4H'?days*6:days;return Math.min(1800,Math.max(2,mins))}
async function load(){
 const seq=++loadSeq;
 let body='',desc='',vals=[],times=[],fmt=v=>String(v),cs=[];
 try{
  if(['Prix','Volume','Momentum'].includes(metric)){
   cs=await candles(activeInstrumentId(),bar,calcLimit());
   if(metric==='Prix'){vals=cs.map(x=>x.c);times=cs.map(x=>x.t);fmt=v=>price(v)+' $';desc=`Prix sur ${bar}, avec plage et tendance récente.`}
   else if(metric==='Volume'){vals=cs.map(x=>x.v*x.c);times=cs.map(x=>x.t);fmt=money;desc=`Volume notionnel par bougie ${bar}.`}
   else {vals=cs.map((x,i)=>i?((x.c-cs[i-1].c)/cs[i-1].c):0).slice(1);times=cs.map(x=>x.t).slice(1);fmt=v=>(v*100).toFixed(2)+'%';desc=`Variation d’une clôture ${bar} à la suivante.`}
  } else if(metric==='OI'){
   let hs=history[current.id]?.samples||[],cut=Date.now()-days*86400000,p=hs.filter(s=>s.ts>=cut);vals=p.map(s=>s.oi);times=p.map(s=>s.ts);fmt=money;desc=`Historique local de l’OI capturé par les scans sur ${days} jour${days>1?'s':''}.`;
  } else if(metric==='Funding'){
   if(!current.perpId)throw Error('Pas de contrat perpétuel associé : pas d’historique de funding.');let f=await get('/public/funding-rate-history?instId='+encodeURIComponent(current.perpId)+'&limit=100');f=f.reverse();let cut=Date.now()-days*86400000;f=f.filter(x=>Number(x.fundingTime||x.ts||0)>=cut);vals=f.map(x=>n(x.fundingRate));times=f.map(x=>Number(x.fundingTime||x.ts||Date.now()));fmt=v=>(v*100).toFixed(4)+'%';desc=`Historique du funding OKX sur ${days} jour${days>1?'s':''}.`;
  } else if(metric==='Score'){
   let hs=history[current.id]?.samples||[],cut=Date.now()-days*86400000,pairs=hs.filter(s=>s.ts>=cut&&s.score>0);vals=pairs.map(s=>s.score);times=pairs.map(s=>s.ts);fmt=v=>Math.round(v)+'/100';desc=`Évolution du score lors des scans sur ${days} jour${days>1?'s':''}.`;
  }
  let defs={Prix:'Le prix est le résultat de l’offre et de la demande à cet instant. On le lit avec la structure, les niveaux et le volume.',OI:'OI = Open Interest : valeur notionnelle des contrats encore ouverts. Une variation d’OI ne donne pas à elle seule le sens des positions.',Volume:'Le volume mesure l’activité échangée. Une accélération accompagnée de volume est plus significative qu’un mouvement sans participation.',Funding:'Le funding est le paiement périodique entre positions longues et courtes. Positif : les longs paient généralement les shorts ; négatif : l’inverse.',Momentum:'Le momentum mesure la vitesse du mouvement. Un momentum élevé peut accompagner une continuation ou signaler un mouvement déjà étendu.',Score:'Le score est une confluence interne pour prioriser les actifs. Il ne représente pas une probabilité de gain.'};
  let trend=vals.length>4?(vals.at(-1)>vals[Math.max(0,vals.length-5)]?'en hausse':vals.at(-1)<vals[Math.max(0,vals.length-5)]?'en baisse':'stable'):'à construire';
  let chartBlock=metric==='Prix'?proChart(cs):lineSvg(vals,fmt,times,metric==='Volume'?'Volume ($)':metric==='Funding'?'Funding (%)':metric==='Momentum'?'Variation (%)':metric==='OI'?'Open Interest ($)':metric==='Score'?'Score':'Valeur',days);body=`<button class="btn secondary" onclick="backDetail()">← ${current.sym}</button><div class="panel"><h2>📊 ${metric} — ${current.sym}</h2><div class="sub">${desc}</div>${rangeControls(bar,days)}<div id="metricMeta" class="sub" style="margin:8px 0">${bar} • ${days===1?'24H':days+'J'} • ${metric==='Prix'?cs.length:vals.length} ${metric==='Prix'?'bougies':'points'} • consulté le ${clockStamp(Date.now())}${cs.length?' • dernière bougie '+clockStamp(cs.at(-1).t):''}</div><button class="smallbtn" id="metricRefresh" type="button">↻ Actualiser ce graphique</button>${chartBlock}</div><div class="panel"><h2>🧠 Lecture simple</h2><div class="decision"><b>Tendance récente : ${trend}.</b><br>${defs[metric]}</div><div class="accordion open"><div class="accHead">Définition <span>−</span></div><div class="accBody">${defs[metric]}</div></div><div class="accordion"><div class="accHead">Comment un trader le combine ? <span>＋</span></div><div class="accBody">Prix + volume + OI + funding + structure. On évite de décider à partir d'un seul indicateur.</div></div></div>`;
 }catch(e){body=`<button class="btn secondary" onclick="backDetail()">← ${current.sym}</button><div class="panel">Erreur : ${esc(e.message)}</div>`}
 if(seq!==loadSeq)return; $('deepBody').innerHTML=body;bindAcc();if($('metricRefresh'))$('metricRefresh').onclick=load;
 document.querySelectorAll('#bars button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#bars button').forEach(x=>x.classList.remove('active'));b.classList.add('active');bar=b.dataset.bar;load()});
 document.querySelectorAll('#ranges button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#ranges button').forEach(x=>x.classList.remove('active'));b.classList.add('active');days=+b.dataset.days;load()});
}
await load();
}
function lineSvg(vals,formatter,times,axisLabel='Valeur',days=1){let clean=vals.map((v,i)=>({v,t:times?.[i]||null})).filter(o=>Number.isFinite(o.v));vals=clean.map(o=>o.v);times=clean.map(o=>o.t);if(vals.length<2)return '<div class="empty">Pas encore assez d’historique. Relance le radar plus tard pour accumuler des points.</div>';let w=900,h=330,pl=78,pr=18,pt=20,pb=48,lo=Math.min(...vals),hi=Math.max(...vals),rg=hi-lo||Math.max(Math.abs(hi),1e-8),pts=vals.map((v,i)=>`${pl+i*(w-pl-pr)/(vals.length-1)},${pt+(hi-v)/rg*(h-pt-pb)}`).join(' '),ticks=[0,1,2,3,4].map(i=>hi-(rg*i/4)),grid=ticks.map(v=>{let y=pt+(hi-v)/rg*(h-pt-pb);return `<line x1="${pl}" y1="${y}" x2="${w-pr}" y2="${y}" stroke="#252a31"/><text x="${pl-8}" y="${y+4}" text-anchor="end" fill="#b9bec7" font-size="14">${formatter(v)}</text>`}).join('');let idxs=[0,.25,.5,.75,1].map(r=>Math.round(r*(vals.length-1)));let xl=idxs.map(i=>{let x=pl+i*(w-pl-pr)/(vals.length-1);let lab=times[i]?axisTime(times[i],days):String(i+1);return `<text x="${x}" y="${h-15}" text-anchor="middle" fill="#b9bec7" font-size="14">${lab}</text>`}).join('');return `<div class="chartAxisLabel"><span>${esc(axisLabel)}</span></div><div class="deepChart"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${grid}${xl}<text x="${w/2}" y="${h-2}" text-anchor="middle" fill="#9da3ad" class="axis-title" font-size="13">Temps</text><polyline points="${pts}" fill="none" stroke="#65b8ff" stroke-width="4"/></svg></div><div class="minmax"><span>MIN ${formatter(lo)}</span><span>ACTUEL ${formatter(vals.at(-1))}</span><span>MAX ${formatter(hi)}</span></div>`}
function bindAcc(){document.querySelectorAll('.accordion').forEach(a=>{const h=a.querySelector('.accHead');h.setAttribute('role','button');h.tabIndex=0;h.setAttribute('aria-expanded',String(a.classList.contains('open')));h.onclick=()=>{a.classList.toggle('open');h.setAttribute('aria-expanded',String(a.classList.contains('open')))}})}
function backDetail(){if(graphLiveTimer){clearInterval(graphLiveTimer);graphLiveTimer=null}if(scenarioMonitorTimer){clearInterval(scenarioMonitorTimer);scenarioMonitorTimer=null}$('deep').classList.add('hidden');$('detail').classList.remove('hidden')}
function scrollToId(id){document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'})}
function glossaryHtml(){let terms=[['OI','Open Interest','Valeur notionnelle des contrats encore ouverts.'],['Funding','Funding','Paiement périodique entre longs et shorts.'],['TP','Take Profit','Niveau où l’on prévoit de prendre tout ou partie des gains.'],['SL','Stop Loss','Niveau d’invalidation qui limite la perte prévue.'],['R/R','Risk/Reward','Rapport entre gain potentiel et risque potentiel.'],['TF','Timeframe','Unité de temps d’une bougie : 1m, 5m, 1H, etc.'],['HH/HL','Higher High / Higher Low','Structure de sommets et creux ascendants.'],['LH/LL','Lower High / Lower Low','Structure de sommets et creux descendants.'],['ATR','Average True Range','Mesure de l’amplitude moyenne du marché.'],['CVD','Cumulative Volume Delta','Mesure basée sur l’agression acheteuse/vendeuse lorsqu’elle est disponible.']];return `<div class="panel"><h2>📚 Glossaire approfondi</h2><div class="sub">Chaque notion est expliquée avec des mots simples et reliée aux scénarios du radar.</div>${terms.map(t=>`<div class="accordion"><div class="accHead"><span><b>${t[0]}</b> — ${t[1]}</span><span>＋</span></div><div class="accBody"><b>Définition :</b> ${t[2]}<br><br><b>Lecture :</b> on ne l'utilise jamais isolément ; on le croise avec le prix, le volume, l'OI et la structure.</div></div>`).join('')}</div>`}
function learnHtml(){return `<div class="panel"><h2>🎓 Apprendre à lire le radar</h2><div class="sub">Parcours progressif, du plus simple au plus profond.</div>${[['1','Le prix','Commence par la tendance et les niveaux.'],['2','Volume + OI','Cherche à savoir si l’activité accompagne le mouvement.'],['3','Funding + liquidations','Observe le positionnement et les excès.'],['4','Price Action','Lis HH/HL/LH/LL, cassures, retests et rejets.'],['5','Confluence','Mets plusieurs signaux ensemble.'],['6','Scénario','Définis entrée conditionnelle, objectifs et invalidation.'],['7','Risque','Calcule la perte avant de penser au gain.']].map(x=>`<div class="click"><b>${x[0]}. ${x[1]}</b><div class="sub">${x[2]}</div></div>`).join('')}</div><div class="panel"><h2>🧠 Règle simple</h2><div class="callout">Une bonne analyse ne cherche pas à deviner. Elle définit ce qui doit se produire pour que le scénario devienne intéressant, et ce qui l'annule.</div></div>`}
function compareHtml(){let opts=all.map(x=>`<option value="${x.id}">${bucketName(x.bucket)} — ${x.sym} — ${x.score}/100</option>`).join('');return `<div class="panel"><h2>📊 Comparateur</h2><div class="sub">Compare jusqu'à 4 cryptos du scan, avec leur tradabilité et leurs données.</div><div class="simgrid"><select id="c1" class="select">${opts}</select><select id="c2" class="select">${opts}</select><select id="c3" class="select">${opts}</select><select id="c4" class="select">${opts}</select></div><button class="btn" style="margin-top:8px" onclick="doCompare()">Comparer</button><div id="cmpout" style="margin-top:10px"></div></div>`}
function doCompare(){let ids=['c1','c2','c3','c4'].map(id=>$(id)?.value).filter(Boolean),xs=ids.map(id=>all.find(x=>x.id===id)).filter(Boolean);$('cmpout').innerHTML=`<div class="tablewrap"><table><thead><tr><th class="th">Crypto</th><th class="th">Score</th><th class="th">24h</th><th class="th">Volume</th><th class="th">OI</th><th class="th">Funding</th><th class="th">Terrain</th></tr></thead><tbody>${xs.map(x=>`<tr class="row"><td>${x.sym}</td><td>${x.score}</td><td class="${x.chg>=0?'good':'bad'}">${chg(x.chg)}</td><td>${money(x.volUsd)}</td><td>${money(x.oi)}</td><td>${pct(x.funding)}<br><span class="tiny">${x.fundingTs?'consulté '+timeLabel(x.fundingTs):'N/D'}</span></td><td>${terrain(x.score)[0]}</td></tr>`).join('')}</tbody></table></div>`}
function settingsHtml(){return `<div class="panel"><h2>⚙️ Paramètres</h2><div class="click" onclick="toggleCompact()">📱 Mode compact / détaillé</div><div class="click" onclick="localStorage.removeItem(STORAGE.scan);localStorage.removeItem('ir_hist_v63');localStorage.removeItem('ir_hist_v52');alert('Historique local des scans effacé. Relance le scan.')">🧹 Effacer l'historique local des scans</div><div class="sub">L'application utilise des données publiques OKX. Les fonctions macro/institutionnelles nécessitent des sources externes vérifiables et seront ajoutées lorsque l'architecture le permettra.</div></div>`}
function toggleCompact(){document.body.classList.toggle('compact');alert('Affichage basculé.')}
function familyLabel(k){return ({activity:'Activité / volume',momentum:'Momentum',range:'Position dans la range',derivatives:'Open Interest',funding:'Funding',positioning:'Positionnement',trend:'Tendance / force',ema:'EMA20/50',supertrend:'Supertrend',rsi:'RSI',stochRsi:'StochRSI',adx:'ADX',bollinger:'Bollinger',volatility:'Volatilité / ATR',priceAction:'Price Action'})[k]||k}
function formatFamilyValue(v,k){if(v==null)return'N/D';if(typeof v==='string')return v==='bull'?'haussier':v==='bear'?'baissier':v==='neutral'?'neutre':v==='bullish'?'haussier':v==='bearish'?'baissier':v;if(k==='funding')return pct(v);if(k==='rsi'||k==='adx')return Number(v).toFixed(1);if(k==='range'||k==='positioning')return Number(v).toFixed(2);if(k==='activity')return Number(v).toFixed(2)+'x';if(k==='momentum')return Number(v).toFixed(2)+'%';if(k==='volatility')return Number(v).toFixed(2)+'%';return Number.isFinite(Number(v))?Number(v).toFixed(3):String(v)}
function labCases(){
 const mk=(name,expected,x)=>({name,expected,x});
 return [
  mk('DEV — Cassure confirmée','bullStrong',{price:105,chg:5,medVol:100,vol:180,rangePos:.92,oi:200,oiRatio:.2,oiDelta:2,funding:.0001,deep:{priceAction:'bullish',emaBias:'bull',supertrendBias:'bull',rsi:62,stochK:.64,adx:31,bb:{z:1.1},atrPct:3,expansion:true,trend:{bull:true,bear:false,strength:70}}}),
  mk('DEV — Fausse cassure','notStrong',{price:102,chg:4,medVol:100,vol:70,rangePos:.95,oi:200,oiRatio:.2,oiDelta:3,funding:.0008,deep:{priceAction:'bearish',emaBias:'bull',supertrendBias:'bear',rsi:74,stochK:.94,adx:16,bb:{z:2.4},atrPct:5,compression:false,trend:{bull:false,bear:false,strength:22}}}),
  mk('DEV — Continuation baissière','bearStrong',{price:95,chg:-5,medVol:100,vol:170,rangePos:.08,oi:180,oiRatio:.2,oiDelta:1.8,funding:-.0001,deep:{priceAction:'bearish',emaBias:'bear',supertrendBias:'bear',rsi:38,stochK:.25,adx:29,bb:{z:-1.1},atrPct:3,expansion:true,trend:{bull:false,bear:true,strength:68}}}),
  mk('DEV — Range','neutral',{price:100,chg:.2,medVol:100,vol:95,rangePos:.5,oi:180,oiRatio:.1,oiDelta:.1,funding:0,deep:{priceAction:'neutral',emaBias:'neutral',supertrendBias:'neutral',rsi:50,stochK:.5,adx:14,bb:{z:.1},atrPct:1.2,compression:true,trend:{bull:false,bear:false,strength:12}}}),
  mk('DEV — Hausse sans participation','notStrong',{price:110,chg:10,medVol:100,vol:40,rangePos:.98,oi:180,oiRatio:.05,oiDelta:0,funding:.0001,deep:{priceAction:'bullish',emaBias:'bull',supertrendBias:'bull',rsi:68,stochK:.7,adx:27,bb:{z:1.8},atrPct:4,expansion:true,trend:{bull:true,bear:false,strength:60}}}),
  mk('VAL — Multi-TF contradictoire','notStrong',{price:101,chg:2.5,medVol:100,vol:120,rangePos:.65,oi:180,oiRatio:.16,oiDelta:1.2,funding:.0002,deep:{priceAction:'bearish',emaBias:'bull',supertrendBias:'bear',rsi:54,stochK:.42,adx:24,bb:{z:.7},atrPct:2.2,expansion:false,trend:{bull:false,bear:false,strength:38}}}),
  mk('VAL — Momentum épuisé','notStrong',{price:118,chg:16,medVol:100,vol:155,rangePos:.99,oi:210,oiRatio:.22,oiDelta:4.2,funding:.0012,deep:{priceAction:'bullish',emaBias:'bull',supertrendBias:'bull',rsi:79,stochK:.96,adx:34,bb:{z:2.8},atrPct:5.5,expansion:true,trend:{bull:true,bear:false,strength:76}}}),
  mk('VAL — Baisse propre','bearStrong',{price:91,chg:-4,medVol:100,vol:145,rangePos:.08,oiRatio:.17,oiDelta:1.1,funding:-.0002,deep:{priceAction:'bearish',emaBias:'bear',supertrendBias:'bear',rsi:41,stochK:.34,adx:27,bb:{z:-1.2},atrPct:2.8,expansion:true,trend:{bull:false,bear:true,strength:62}}}),
  mk('HOLDOUT — Cassure faible volume','notStrong',{price:106,chg:5,medVol:100,vol:62,rangePos:.91,oiRatio:.12,oiDelta:.4,funding:.0003,deep:{priceAction:'bullish',emaBias:'bull',supertrendBias:'bull',rsi:59,stochK:.62,adx:22,bb:{z:1.3},atrPct:2.6,expansion:false,trend:{bull:true,bear:false,strength:52}}}),
  mk('HOLDOUT — Range volatil','neutral',{price:100,chg:-.3,medVol:100,vol:115,rangePos:.5,oiRatio:.11,oiDelta:.2,funding:0,deep:{priceAction:'neutral',emaBias:'neutral',supertrendBias:'neutral',rsi:51,stochK:.51,adx:16,bb:{z:0.2},atrPct:3.8,compression:false,trend:{bull:false,bear:false,strength:18}}}),
  mk('HOLDOUT — Retournement baissier','bearStrong',{price:94,chg:-3.2,medVol:100,vol:160,rangePos:.12,oiRatio:.19,oiDelta:2.1,funding:-.0009,deep:{priceAction:'bearish',emaBias:'bear',supertrendBias:'bear',rsi:43,stochK:.28,adx:28,bb:{z:-1.5},atrPct:3.1,expansion:true,trend:{bull:false,bear:true,strength:65}}})
 ];
}
function labJudge(m,expected){
 if(expected==='bullStrong')return m.biasScore>62&&m.qualityScore>=75&&m.contradiction<18;
 if(expected==='bearStrong')return m.biasScore<38&&m.qualityScore>=75&&m.contradiction<18;
 if(expected==='neutral')return m.biasScore>=42&&m.biasScore<=58&&m.qualityScore<70;
 return m.qualityScore<80||m.contradiction>=18;
}
function labPartitionReport(cases,weights){let ok=0,rows=[];for(const c of cases){const m=centralSignalEngine(c.x,c.x.deep,{weights});const pass=labJudge(m,c.expected);if(pass)ok++;rows.push({name:c.name,pass,score:m.qualityScore,bias:m.biasScore,contradiction:m.contradiction});}return {ok,total:cases.length,rate:cases.length?ok/cases.length:0,rows};}
function optimizeDevWeights(){
 const cases=labCases().filter(c=>c.name.startsWith('DEV'));
 const keys=['activity','momentum','range','derivatives','funding','positioning','trend','ema','supertrend','rsi','stochRsi','adx','bollinger','volatility','priceAction'];
 const base={}; keys.forEach(k=>base[k]=1);
 let best={weights:{...base},report:labPartitionReport(cases,base)};
 const candidates=[
  {activity:1.25,volume:1.25,trend:1.35,priceAction:1.45,ema:1.0,supertrend:.95,rsi:.75,stochRsi:.45,adx:1.0,bollinger:.65,volatility:.7,momentum:.85,range:.8,derivatives:.7,funding:.5,positioning:.55},
  {activity:1.1,trend:1.45,priceAction:1.5,ema:1.05,supertrend:1.0,rsi:.8,stochRsi:.4,adx:1.0,bollinger:.65,volatility:.7,momentum:.8,range:.8,derivatives:.7,funding:.45,positioning:.55},
  {activity:1.3,trend:1.35,priceAction:1.35,ema:.95,supertrend:.9,rsi:.7,stochRsi:.35,adx:1.05,bollinger:.6,volatility:.7,momentum:.9,range:.8,derivatives:.65,funding:.45,positioning:.55}
 ];
 for(const w of candidates){const report=labPartitionReport(cases,w);if(report.rate>best.report.rate)best={weights:w,report};}
 return best;
}
function runGovernedLab(){
 const allCases=labCases(),dev=allCases.filter(c=>c.name.startsWith('DEV')),val=allCases.filter(c=>c.name.startsWith('VAL')),hold=allCases.filter(c=>c.name.startsWith('HOLDOUT'));
 const currentWeights={};
 const baseDev=labPartitionReport(dev,currentWeights),proposal=optimizeDevWeights();
 const baseVal=labPartitionReport(val,currentWeights),proposalVal=labPartitionReport(val,proposal.weights),baseHold=labPartitionReport(hold,currentWeights),proposalHold=labPartitionReport(hold,proposal.weights);
 const changed=JSON.stringify(proposal.weights)!==JSON.stringify(currentWeights); const accepted=changed&&proposalVal.rate>=baseVal.rate&&proposalHold.rate>=baseHold.rate;
 return {baseDev,proposal,baseVal,proposalVal,baseHold,proposalHold,accepted,changed};
}
function runStressSuite(){
 const cases=[
  {name:'Cassure confirmée',expected:'bullStrong',x:{price:105,chg:5,medVol:100,vol:180,rangePos:.92,oi:200,oiRatio:.2,oiDelta:2,funding:.0001,deep:{priceAction:'bullish',emaBias:'bull',supertrendBias:'bull',rsi:62,stochK:.64,adx:31,bb:{z:1.1},atrPct:3,expansion:true,trend:{bull:true,bear:false,strength:70}}}},
  {name:'Fausse cassure / rejet',expected:'notStrong',x:{price:102,chg:4,medVol:100,vol:70,rangePos:.95,oi:200,oiRatio:.2,oiDelta:3,funding:.0008,deep:{priceAction:'bearish',emaBias:'bull',supertrendBias:'bear',rsi:74,stochK:.94,adx:16,bb:{z:2.4},atrPct:5,compression:false,trend:{bull:false,bear:false,strength:22}}}},
  {name:'Continuation baissière',expected:'bearStrong',x:{price:95,chg:-5,medVol:100,vol:170,rangePos:.08,oi:180,oiRatio:.2,oiDelta:1.8,funding:-.0001,deep:{priceAction:'bearish',emaBias:'bear',supertrendBias:'bear',rsi:38,stochK:.25,adx:29,bb:{z:-1.1},atrPct:3,expansion:true,trend:{bull:false,bear:true,strength:68}}}},
  {name:'Range',expected:'neutral',x:{price:100,chg:.2,medVol:100,vol:95,rangePos:.5,oi:180,oiRatio:.1,oiDelta:.1,funding:0,deep:{priceAction:'neutral',emaBias:'neutral',supertrendBias:'neutral',rsi:50,stochK:.5,adx:14,bb:{z:.1},atrPct:1.2,compression:true,trend:{bull:false,bear:false,strength:12}}}},
  {name:'Hausse sans participation',expected:'notStrong',x:{price:110,chg:10,medVol:100,vol:40,rangePos:.98,oi:180,oiRatio:.05,oiDelta:.0,funding:.0001,deep:{priceAction:'bullish',emaBias:'bull',supertrendBias:'bull',rsi:68,stochK:.7,adx:27,bb:{z:1.8},atrPct:4,expansion:true,trend:{bull:true,bear:false,strength:60}}}},
  {name:'Contexte haussier mais Price Action baissier',expected:'notStrong',x:{price:99,chg:2,medVol:100,vol:150,rangePos:.55,oi:180,oiRatio:.18,oiDelta:1,funding:.0001,deep:{priceAction:'bearish',emaBias:'bull',supertrendBias:'bull',rsi:55,stochK:.4,adx:26,bb:{z:.2},atrPct:2,expansion:false,trend:{bull:true,bear:false,strength:55}}}}
 ];
 const out={};
 for(const c of cases){
  const m=centralSignalEngine(c.x,c.x.deep);
  let ok=false;
  if(c.expected==='bullStrong') ok=m.biasScore>65&&m.qualityScore>=80&&m.contradiction<15;
  if(c.expected==='bearStrong') ok=m.biasScore<35&&m.qualityScore>=80&&m.contradiction<15;
  if(c.expected==='neutral') ok=m.biasScore>=42&&m.biasScore<=58&&m.qualityScore<65;
  if(c.expected==='notStrong') ok=m.qualityScore<80 || m.contradiction>=15;
  out[c.name]={ok,score:m.qualityScore,confluence:m.score,bias:m.biasScore,contradiction:m.contradiction,note:`tradabilité ${m.qualityScore}/100 • confluence ${m.score}/100 • biais ${m.biasScore}/100`};
 }
 const bull=centralSignalEngine(cases[0].x,cases[0].x.deep), weak=centralSignalEngine(cases[4].x,cases[4].x.deep), conflict=centralSignalEngine(cases[5].x,cases[5].x.deep);
 out['Régression — la qualité baisse si participation ou cohérence baisse']={ok:bull.qualityScore>weak.qualityScore&&bull.qualityScore>conflict.qualityScore,score:bull.qualityScore,note:`fort ${bull.qualityScore} > faible participation ${weak.qualityScore} / conflit ${conflict.qualityScore}`};
 const regimeCases=[
  {name:'Régime cassure',x:cases[0].x,want:'breakout'},
  {name:'Régime retournement',x:cases[1].x,want:'reversal'},
  {name:'Régime range',x:cases[3].x,want:'range'}
 ];
 regimeCases.forEach(c=>{const m=centralSignalEngine(c.x,c.x.deep);out[c.name]={ok:m.regime.key===c.want,score:m.qualityScore,note:`détecté ${m.regime.label}`}});
 return out
}
function directionalScenarioLab(){
 const mk=(name,expected,x,gate=null)=>({name,expected,x,gate});
 const cases=[
  mk('Tendance forte haussière','LONG',{price:105,chg:5,medVol:100,vol:180,rangePos:.92,oiRatio:.2,oiDelta:2,funding:.0001,deep:{priceAction:'bullish',emaBias:'bull',supertrendBias:'bull',rsi:62,stochK:.64,adx:31,bb:{z:1.1},atrPct:3,expansion:true,trend:{bull:true,bear:false,strength:70}}}),
  mk('Tendance forte baissière','SHORT',{price:95,chg:-5,medVol:100,vol:170,rangePos:.08,oiRatio:.2,oiDelta:1.8,funding:-.0001,deep:{priceAction:'bearish',emaBias:'bear',supertrendBias:'bear',rsi:38,stochK:.25,adx:29,bb:{z:-1.1},atrPct:3,expansion:true,trend:{bull:false,bear:true,strength:68}}}),
  mk('Range propre','NONE',{price:100,chg:.2,medVol:100,vol:95,rangePos:.5,oiRatio:.1,oiDelta:.1,funding:0,deep:{priceAction:'neutral',emaBias:'neutral',supertrendBias:'neutral',rsi:50,stochK:.5,adx:14,bb:{z:.1},atrPct:1.2,compression:true,trend:{bull:false,bear:false,strength:12}}}),
  mk('Cassure haussière confirmée','LONG',{price:105,chg:5,medVol:100,vol:180,rangePos:.92,oiRatio:.2,oiDelta:2,funding:.0001,deep:{priceAction:'bullish',emaBias:'bull',supertrendBias:'bull',rsi:62,stochK:.64,adx:31,bb:{z:1.1},atrPct:3,expansion:true,trend:{bull:true,bear:false,strength:70}}}),
  mk('Fausse cassure / rejet','NONE',{price:102,chg:4,medVol:100,vol:70,rangePos:.95,oiRatio:.2,oiDelta:3,funding:.0008,deep:{priceAction:'bearish',emaBias:'bull',supertrendBias:'bear',rsi:74,stochK:.94,adx:16,bb:{z:2.4},atrPct:5,compression:false,trend:{bull:false,bear:false,strength:22}}}),
  mk('Retournement baissier confirmé','SHORT',{price:91,chg:-4,medVol:100,vol:145,rangePos:.08,oiRatio:.17,oiDelta:1.1,funding:-.0002,deep:{priceAction:'bearish',emaBias:'bear',supertrendBias:'bear',rsi:41,stochK:.34,adx:27,bb:{z:-1.2},atrPct:2.8,expansion:true,trend:{bull:false,bear:true,strength:62}}}),
  mk('Aucun setup','NONE',{price:101,chg:.1,medVol:100,vol:80,rangePos:.5,oiRatio:.05,oiDelta:0,funding:0,deep:{priceAction:'neutral',emaBias:'neutral',supertrendBias:'neutral',rsi:50,stochK:.5,adx:12,bb:{z:.1},atrPct:1,compression:true,trend:{bull:false,bear:false,strength:8}}}),
  mk('Marché surétendu haussier','NONE',{price:118,chg:16,medVol:100,vol:155,rangePos:.99,oiRatio:.22,oiDelta:4.2,funding:.0012,deep:{priceAction:'bullish',emaBias:'bull',supertrendBias:'bull',rsi:79,stochK:.96,adx:34,bb:{z:2.8},atrPct:5.5,expansion:true,trend:{bull:true,bear:false,strength:76}}}),
  mk('Contexte haussier / PA baissière','NONE',{price:99,chg:2,medVol:100,vol:150,rangePos:.55,oiRatio:.18,oiDelta:1,funding:.0001,deep:{priceAction:'bearish',emaBias:'bull',supertrendBias:'bull',rsi:55,stochK:.4,adx:26,bb:{z:.2},atrPct:2,expansion:false,trend:{bull:true,bear:false,strength:55}}})
 ];
 const rows=cases.map(c=>{
   const m=centralSignalEngine(c.x,c.x.deep);
   let result='NONE';
   if(m.biasScore>62)result='LONG';
   else if(m.biasScore<38)result='SHORT';
   // A directional bias alone is not enough: reject weak, conflicted or overextended cases.
   if(m.qualityScore<70 || m.contradiction>=18 || m.extensionRisk>=72)result='NONE';
   const ok=result===c.expected;
   return {name:c.name,expected:c.expected,result,ok,score:m.qualityScore,bias:m.biasScore,note:`qualité ${m.qualityScore}/100 • biais ${m.biasScore}/100 • contradiction ${m.contradiction}`};
 });
 // Separate gate tests ensure the price-level validator remains symmetric.
 const gates=[
  {name:'Gate LONG — prix sous entrée',kind:'breakout',sc:{entry:102,stop:99,tp1:105},live:101,expected:true},
  {name:'Gate SHORT — prix au-dessus entrée et sous stop',kind:'breakdown',sc:{entry:98,stop:101,tp1:94},live:99,expected:true},
  {name:'Gate SHORT — prix déjà sous entrée',kind:'breakdown',sc:{entry:98,stop:101,tp1:94},live:93,expected:false},
  {name:'Gate LONG — prix déjà au-dessus entrée',kind:'breakout',sc:{entry:102,stop:99,tp1:105},live:106,expected:false}
 ];
 for(const g of gates){const got=scenarioValid(g.kind,g.sc,g.live);rows.push({name:g.name,expected:g.expected?'VALIDE':'REFUSÉ',result:got?'VALIDE':'REFUSÉ',ok:got===g.expected,score:null,bias:null,note:'validation des niveaux et de la direction'});}
 return {rows,ok:rows.filter(x=>x.ok).length,total:rows.length};
}
function shortEngineLab(){
 const cases=[
   {name:'Moteur réel — baisse avec Perp',slope:-.10,perp:true,expected:true},
   {name:'Moteur réel — baisse sans Perp',slope:-.10,perp:false,expected:false},
   {name:'Moteur réel — range',slope:0,perp:true,expected:false},
   {name:'Moteur réel — hausse',slope:.10,perp:true,expected:false}
 ];
 const rows=cases.map(c=>{
   const frame=count=>Array.from({length:count},(_,i)=>{const p=100+c.slope*i;return {t:i*60000,o:p,h:p+1,l:p-1,c:p+.15,v:10000+i*30,confirm:1}});
   const frames=Object.fromEntries([['1D',120],['4H',100],['1H',140],['30m',140],['15m',180],['5m',180]].map(([key,count])=>[key,frame(count)]));
   const e=adaptiveEngine(frames,{price:frames['5m'].at(-1).c,perpId:c.perp?'TEST-USDT-SWAP':null,chg:c.slope*10,vol:1e6,medVol:1e6});
   const result=!!e?.shortSetup;return {name:c.name,expected:c.expected,result,ok:result===c.expected,score:e?.directional?.shortScore??0};
 });
 return {ok:rows.filter(r=>r.ok).length,total:rows.length,rows};
}

function rankingCalibrationLab(){
 const cases=[
  {name:'Ranking — tendance LONG cohérente',x:{price:105,chg:5,medVol:100,vol:180,rangePos:.92,oiDelta:2,funding:.0001,deep:{priceAction:'bullish',emaBias:'bull',supertrendBias:'bull',rsi:62,stochK:.64,adx:31,bb:{z:1.1},atrPct:3,expansion:true,trend:{bull:true,bear:false,strength:70}}}},
  {name:'Ranking — tendance SHORT cohérente',x:{price:95,chg:-5,medVol:100,vol:170,rangePos:.08,oiDelta:1.8,funding:-.0001,deep:{priceAction:'bearish',emaBias:'bear',supertrendBias:'bear',rsi:38,stochK:.25,adx:29,bb:{z:-1.1},atrPct:3,expansion:true,trend:{bull:false,bear:true,strength:68}}}},
  {name:'Ranking — range',x:{price:100,chg:.2,medVol:100,vol:95,rangePos:.5,oiDelta:.1,funding:0,deep:{priceAction:'neutral',emaBias:'neutral',supertrendBias:'neutral',rsi:50,stochK:.5,adx:14,bb:{z:.1},atrPct:1.2,compression:true,trend:{bull:false,bear:false,strength:12}}}},
  {name:'Ranking — surétendu',x:{price:118,chg:16,medVol:100,vol:155,rangePos:.99,oiDelta:4.2,funding:.0012,deep:{priceAction:'bullish',emaBias:'bull',supertrendBias:'bull',rsi:79,stochK:.96,adx:34,bb:{z:2.8},atrPct:5.5,expansion:true,trend:{bull:true,bear:false,strength:76}}}}
 ];
 const scored=cases.map(c=>{const m=centralSignalEngine(c.x,c.x.deep);const d={longScore:m.biasScore,shortScore:100-m.biasScore,longEligible:m.biasScore>=66,shortEligible:m.biasScore<=34};const clean=m.qualityScore>=75&&m.extensionRisk<55&&(d.longEligible||d.shortEligible);const test={...c.x,signalModel:m,directional:d,marketMedianVol:100,volUsd:c.x.vol,scenarioModel:{longSetup:d.longEligible,shortSetup:d.shortEligible},hasValidScenario:clean,hasLongScenario:clean&&d.longEligible,hasShortScenario:clean&&d.shortEligible};const v=score(test);return {name:c.name,score:v};});
 const by=Object.fromEntries(scored.map(x=>[x.name,x.score]));
 const ok=by['Ranking — tendance LONG cohérente']>by['Ranking — range']&&by['Ranking — tendance SHORT cohérente']>by['Ranking — range']&&by['Ranking — tendance LONG cohérente']>by['Ranking — surétendu'];
 return {ok,rows:scored};
}
function validationLabHtml(){const r=directionalScenarioLab(),k=rankingCalibrationLab(),sh=shortEngineLab();return `<div class="panel"><h2>🧪 Validation directionnelle V8.7.2</h2><div class="sub">Batterie : tendance forte haussière, tendance forte baissière, range, breakout, false breakout, reversal, no setup, extension, conflit et symétrie des gates LONG/SHORT.</div><div class="grid">${r.rows.map(x=>`<div class="metric"><small>${esc(x.name)}</small><b class="${x.ok?'good':'bad'}">${x.ok?'✓':'✕'} ${x.result}</b><div class="foot">Attendu : ${x.expected}${x.score!=null?` • ${x.note}`:''}</div></div>`).join('')}</div><div class="callout ${r.ok===r.total?'goodbox':'badbox'}"><b>${r.ok}/${r.total} tests cohérents</b><br>${r.ok===r.total?'Le moteur distingue LONG, SHORT et absence de setup et les gates de prix sont symétriques.':'La batterie signale encore une condition à corriger avant adoption.'}</div></div><div class="panel"><h2>📊 Calibration du classement</h2><div class="sub">Le score final tient compte de la direction réellement exploitable. Les tests vérifient qu’une tendance cohérente reste classée au-dessus d’un range ou d’un marché surétendu.</div><div class="grid">${k.rows.map(x=>`<div class="metric"><small>${esc(x.name)}</small><b class="${x.score>=78?'good':x.score<78?'warn':'neutral'}">${x.score}/100</b></div>`).join('')}</div><div class="callout ${k.ok?'goodbox':'badbox'}"><b>${k.ok?'✓ Le classement réagit aux tests de direction et de qualité.':'⚠️ Le classement nécessite encore une calibration.'}</b></div></div><div class="panel"><h2>🔴 Validation du moteur SHORT</h2><div class="sub">Tests synthétiques qui exécutent le vrai moteur sur baisse, hausse et range, avec et sans Perp. Ils vérifient les règles, pas la performance de trading.</div><div class="grid">${sh.rows.map(x=>`<div class="metric"><small>${esc(x.name)}</small><b class="${x.ok?'good':'bad'}">${x.ok?'✓':'✕'} ${x.result?'SHORT':'AUCUN'}</b><div class="foot">Attendu : ${x.expected?'SHORT':'AUCUN'} • score ${x.score}</div></div>`).join('')}</div><div class="callout ${sh.ok===sh.total?'goodbox':'badbox'}"><b>${sh.ok}/${sh.total} tests SHORT cohérents</b></div></div>`}
function engineHtml(){const m=current.signalModel||centralSignalEngine(current,current.deep||null);const fam=Object.entries(m.families||{});const lab=runStressSuite();const governed=runGovernedLab();return `<div class="panel"><div class="grid"><div class="metric"><small>Confluence</small><b>${m.score}/100</b></div><div class="metric"><small>Tradabilité</small><b>${m.qualityScore}/100</b></div><div class="metric"><small>Biais</small><b>${m.biasScore}/100</b></div><div class="metric"><small>Direction</small><b>${m.direction==='bull'?'🟢 LONG':m.direction==='bear'?'🔴 SHORT':'🟡 MIXTE'}</b></div><div class="metric"><small>Risque d'extension</small><b class="${m.extensionRisk>=72?'bad':m.extensionRisk>=45?'warn':'good'}">${m.extensionRisk}/100</b><div class="foot">Ne prédit pas une baisse : mesure le risque de mouvement déjà étendu.</div></div><div class="metric"><small>Régime détecté</small><b>${esc(m.regime?.label||'N/D')}</b><div class="foot">${esc(m.regime?.reason||'')}</div></div><div class="metric"><small>Familles</small><b>${fam.length}</b></div></div></div><div class="panel"><h2>🧩 Lecture par famille</h2><div class="sub">Les indicateurs sont regroupés pour éviter de compter plusieurs fois la même information.</div><div class="indicatorGrid">${fam.map(([k,f])=>{const lab=f.signal==='positive'?'FAVORABLE':f.signal==='negative'?'DÉFAVORABLE':f.signal==='warning'?'À SURVEILLER':'NEUTRE';const cls=f.signal==='positive'?'sigPos':f.signal==='negative'?'sigNeg':f.signal==='warning'?'sigWarn':'sigNeu';return `<div class="indicatorCard"><b>${familyLabel(k)}</b><div class="sub">${formatFamilyValue(f.value,k)}</div><span class="sigBadge ${cls}">${lab}</span><div class="foot">Poids actuel : ${Number(f.weight||0).toFixed(2)}</div></div>`}).join('')}</div></div><div class="panel"><h2>🧪 Laboratoire de résistance</h2><div class="sub">Tests synthétiques intégrés pour vérifier que le moteur sait distinguer confirmation, contradiction et absence de configuration.</div><div class="grid">${Object.entries(lab).map(([k,v])=>`<div class="metric"><small>${k}</small><b class="${v.ok?'good':'bad'}">${v.ok?'✓':'✕'} ${v.score}/100</b><div class="foot">${v.note}</div></div>`).join('')}</div></div>${validationLabHtml()}<div class="panel"><h2>🧪 Laboratoire gouverné — anti-surapprentissage</h2><div class="sub">Le moteur peut proposer des pondérations à partir du jeu DEV, mais la validation et le HOLDOUT restent séparés. Une proposition n'est retenue que si elle ne dégrade ni la validation ni le test final.</div><div class="grid"><div class="metric"><small>DEV actuel</small><b>${Math.round(governed.baseDev.rate*100)}%</b></div><div class="metric"><small>DEV proposition</small><b>${Math.round(governed.proposal.report.rate*100)}%</b></div><div class="metric"><small>VALIDATION actuel → proposé</small><b>${Math.round(governed.baseVal.rate*100)}% → ${Math.round(governed.proposalVal.rate*100)}%</b></div><div class="metric"><small>HOLDOUT actuel → proposé</small><b>${Math.round(governed.baseHold.rate*100)}% → ${Math.round(governed.proposalHold.rate*100)}%</b></div></div><div class="callout ${governed.accepted?'goodbox':''}"><b>${governed.accepted?'✓ Proposition compatible avec la règle de validation':governed.changed?'⚠️ Proposition rejetée':'ℹ️ Aucun changement de poids retenu'}</b><br>Le HOLDOUT n'est pas utilisé pour optimiser les poids. Il sert uniquement à vérifier la proposition finale.</div></div><div class="panel"><h2>🧬 Mémoire & apprentissage</h2><div class="sub">Le moteur commence à enregistrer les configurations réellement suivies. Ces résultats alimenteront plus tard les tests walk-forward, sans modifier automatiquement les poids.</div><div class="click" onclick="toolPage('memory')">Ouvrir la mémoire des configurations →</div></div><div class="panel"><h2>🔬 Règle d'architecture</h2><div class="callout goodbox"><b>Une seule source de vérité.</b><br>Le classement utilise les familles du moteur central. L'analyse détaille ces mêmes familles. Le scénario ajoute les contraintes de déclenchement, d'invalidation et de contexte. Aucun module ne doit recréer silencieusement une autre réalité.</div></div>`}

function backtestFmt(x){return Number.isFinite(x)?x.toFixed(1):'N/D'}
function btTs(c){return Number(c?.[0]||0)}
function btClose(c){return Number(c?.[4]||NaN)}
async function historyCandles(instId,bar,limit=300,before=null){
  const q=`/market/history-candles?instId=${encodeURIComponent(instId)}&bar=${encodeURIComponent(bar)}&limit=${Math.min(300,Math.max(20,limit))}`+(before?`&before=${encodeURIComponent(before)}`:'');
  return await get(q);
}
function btSlice(arr,ts,max=140){return arr.filter(c=>btTs(c)<=ts&&Number(c?.[8])===1).slice(-max)}
function btOutcome(cs,idx,kind,sc,horizon=18){
 const end=Math.min(cs.length-1,idx+horizon),short=isShortScenarioKind(kind);
 const {entry,stop,tp1}=sc;let entered=false,entryIdx=null,mfe=0,mae=0;
 if(![entry,stop,tp1].every(Number.isFinite))return {hit:'NO_ENTRY',entered:false,mfe,mae};
 for(let j=idx+1;j<=end;j++){
   const h=Number(cs[j][2]),l=Number(cs[j][3]);if(!Number.isFinite(h)||!Number.isFinite(l))continue;
   if(!entered){if(!(l<=entry&&entry<=h))continue;entered=true;entryIdx=j}
   mfe=Math.max(mfe,short?Math.max(0,entry-l):Math.max(0,h-entry));
   mae=Math.max(mae,short?Math.max(0,h-entry):Math.max(0,entry-l));
   const slHit=short?h>=stop:l<=stop,tpHit=short?l<=tp1:h>=tp1;
   // The candle does not reveal which level was touched first. Prefer SL.
   if(slHit)return {hit:'SL',entered,entryIdx,mfe,mae,ambiguous:tpHit};
   if(tpHit&&j>entryIdx)return {hit:'TP1',entered,entryIdx,mfe,mae,ambiguous:false};
 }
 return {hit:entered?'TIMEOUT':'NO_ENTRY',entered,entryIdx,mfe,mae};
}

function btScoreResult(rows){
  const wins=rows.filter(x=>x.outcome==='TP1').length, sl=rows.filter(x=>x.outcome==='SL').length, noEntry=rows.filter(x=>x.outcome==='NO_ENTRY').length;
  const decided=wins+sl; return {n:rows.length,decided,wins,sl,timeout:rows.length-decided-noEntry,noEntry,rate:decided?wins/decided*100:0,avgScore:rows.length?rows.reduce((a,x)=>a+x.score,0)/rows.length:0};
}
async function runWalkForwardLab(){
  const btn=$('btRun');const out=$('btOut');if(!btn||!out)return;btn.disabled=true;btn.textContent='⏳ Téléchargement…';
  try{
    const inst=(currentScenarioInstrument==='perp'&&current?.perpId?current.perpId:current?.id)||'BTC-USDT-SWAP';
    const specs=[['1D',90],['4H',180],['1H',220],['30m',260],['15m',300],['5m',300]];
    const got=await Promise.all(specs.map(async ([bar,lim])=>[bar,await historyCandles(inst,bar,lim)]));
    const raw=Object.fromEntries(got.map(([k,v])=>[k,v.slice().reverse()]));
    const base=raw['1H']; if(!base||base.length<100)throw Error('Historique 1H insuffisant');
    const cut1=Math.floor(base.length*.70),cut2=Math.floor(base.length*.90);
    const phases=[['DEV',0,cut1],['VALIDATION',cut1,cut2],['HOLDOUT',cut2,base.length]];
    const rows=[];
    for(const [phase,a,b] of phases){
      for(let i=Math.max(80,a);i<b;i+=Math.max(1,Math.floor((b-a)/18))){
        const ts=btTs(base[i]);
        const frames={};for(const [k] of specs)frames[k]=btSlice(raw[k],ts,k==='1D'?90:120);
        const px=btClose(base[i]);const prev=base[Math.max(0,i-24)],dayMove=btClose(prev)>0?(px/btClose(prev)-1)*100:null,historyWindow=base.slice(Math.max(0,i-24),i+1),low24=Math.min(...historyWindow.map(c=>Number(c[3]))),high24=Math.max(...historyWindow.map(c=>Number(c[2])));const historical={id:inst,perpId:inst.endsWith('-SWAP')?inst:(current?.perpId||null),price:px,chg:dayMove,rangePos:high24>low24?(px-low24)/(high24-low24):null,vol:Number(base[i][7])||null,oi:null,oiDelta:null,funding:null};const e=adaptiveEngine(frames,historical);
        if(!e)continue;
        let kind=chooseFreshScenario(e,null);let outcome='NO_SETUP',mfe=0,mae=0;
        if(kind&&e[kind]&&e[kind].entry){const futureIdx=i;const o=btOutcome(base,futureIdx,kind,e[kind],18);outcome=o.hit;mfe=o.mfe;mae=o.mae}
        rows.push({phase,ts,regime:e.regime?.key||'unknown',kind:kind||'none',decision:e.decision,score:e.score,outcome,mfe,mae});
      }
    }
    const report={};for(const phase of ['DEV','VALIDATION','HOLDOUT'])report[phase]=btScoreResult(rows.filter(x=>x.phase===phase&&x.kind!=='none'));
    const regime={};for(const r of rows.filter(x=>x.kind!=='none')){const k=r.regime+' / '+r.kind;regime[k]??=[];regime[k].push(r)}
    const cards=Object.entries(regime).sort((a,b)=>b[1].length-a[1].length).slice(0,12).map(([k,v])=>{const z=btScoreResult(v);return `<div class="metric"><small>${esc(k)}</small><b>${z.n} setups • ${z.rate.toFixed(0)}% TP1*</b><div class="foot">TP1 ${z.wins} • SL ${z.sl} • jamais entrés ${z.noEntry} • timeout ${z.timeout} • score ${z.avgScore.toFixed(0)}</div></div>`}).join('');
    const phaseCards=['DEV','VALIDATION','HOLDOUT'].map(p=>{const z=report[p];return `<div class="metric"><small>${p}</small><b>${z.n} setups</b><div class="foot">Décidés ${z.decided} • TP1 ${z.wins} • SL ${z.sl} • jamais entrés ${z.noEntry} • taux ${z.rate.toFixed(0)}% • score ${z.avgScore.toFixed(0)}</div></div>`}).join('');
    out.innerHTML=`<div class="panel"><h2>🧪 Résultat walk-forward</h2><div class="sub">${esc(inst)} • historique 1H comme horloge d'évaluation. Les scénarios utilisent les bougies connues au signal et leur entrée doit être touchée avant qu'un TP/SL compte. Une bougie touchant TP et SL est comptée SL.</div><div class="grid">${phaseCards}</div></div><div class="panel"><h2>🧬 Par régime / configuration</h2><div class="grid">${cards||'<div class="empty">Aucun setup retenu sur cette fenêtre.</div>'}</div><div class="foot">* Taux TP1 calculé uniquement parmi les résultats décidés (TP1/SL), hors scénarios non entrés et timeouts. Ce laboratoire n'est pas une promesse de performance et n'intègre pas ici frais, slippage, funding historique ni OI historique.</div></div><div class="panel"><h2>🛡️ Décision du laboratoire</h2><div class="callout goodbox"><b>Holdout intact.</b><br>Les résultats HOLDOUT sont affichés pour évaluation, mais cette exécution ne modifie aucune pondération du moteur. Toute nouvelle formule devra d'abord être proposée sur DEV, validée sur VALIDATION, puis testée sur un HOLDOUT jamais utilisé pour optimiser.</div></div>`;
  }catch(e){out.innerHTML=`<div class="panel danger"><b>Laboratoire interrompu</b><div class="sub">${esc(e.message)}</div></div>`}finally{btn.disabled=false;btn.textContent='▶ Lancer le walk-forward'}
}
function backtestHtml(){return `<button class="btn secondary" onclick="backHome()">← Radar</button><div class="panel"><h2>🧪 Laboratoire walk-forward</h2><div class="sub">Cette couche rejoue le moteur sur un historique séparé en DEV 70 %, VALIDATION 20 % et HOLDOUT 10 %. Le HOLDOUT n'est jamais utilisé pour modifier les règles.</div><div class="toolbar"><button id="btRun" class="btn" onclick="runWalkForwardLab()">▶ Lancer le walk-forward</button></div><div class="callout">Le laboratoire utilise ici les chandeliers historiques. Les dérivés historiques (OI/funding) ne sont pas injectés tant qu'une série historique dédiée n'est pas disponible : ils ne sont donc pas inventés.</div></div><div id="btOut"><div class="panel"><div class="empty">Aucun test lancé.</div></div></div>`}
function toolPage(type){$('drawer').classList.remove('open');$('home').classList.add('hidden');$('detail').classList.add('hidden');$('deep').classList.remove('hidden');if(type==='memory'){$('deepBody').innerHTML=`<button class="btn secondary" onclick="backHome()">← Radar</button>${learningHtml()}`}else if(type==='backtest'){$('deepBody').innerHTML=backtestHtml()}else if(type==='brain'){current=current||all[0];$('deepBody').innerHTML=`<button class="btn secondary" onclick="backHome()">← Radar</button><div class="panel"><h2>🧠 Cerveau & laboratoire</h2><div class="sub">Architecture du moteur, familles de signaux et tests de résistance. Les adaptations restent proposées tant qu'elles ne sont pas validées hors échantillon.</div></div>${current?engineHtml():`<div class="panel"><div class="empty">Lance d'abord un scan pour alimenter le moteur.</div></div>`}`}else if(type==='sim'){$('deepBody').innerHTML=`<button class="btn secondary" onclick="backHome()">← Radar</button><div class="panel"><h2>🧮 Simulateur indépendant</h2><div class="sub">Choisis une crypto directement par catégorie de tradabilité.</div>${simForm()}</div>`;sim()}else if(type==='gloss'){$('deepBody').innerHTML=`<button class="btn secondary" onclick="backHome()">← Radar</button>${glossaryHtml()}`;bindAcc()}else if(type==='learn'){$('deepBody').innerHTML=`<button class="btn secondary" onclick="backHome()">← Radar</button>${learnHtml()}`}else if(type==='compare'){$('deepBody').innerHTML=`<button class="btn secondary" onclick="backHome()">← Radar</button>${compareHtml()}`}else{$('deepBody').innerHTML=`<button class="btn secondary" onclick="backHome()">← Radar</button>${settingsHtml()}`}}
function backHome(){$('deep').classList.add('hidden');$('detail').classList.add('hidden');$('home').classList.remove('hidden')}
document.querySelectorAll('#marketMode .modeBtn').forEach(b=>b.onclick=()=>{marketMode=b.dataset.mode;document.querySelectorAll('#marketMode .modeBtn').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderRank()});$('scan').onclick=scan;$('back1').onclick=backHome;$('back2').onclick=backDetail;$('sort').onchange=drawTable;$('tier').onchange=drawTable;$('search').oninput=drawTable;document.querySelectorAll('#tradeTabs button').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('#tradeTabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderRank()});$('toolsBtn').onclick=()=>$('drawer').classList.add('open');$('closeDrawer').onclick=()=>$('drawer').classList.remove('open');$('drawer').onclick=e=>{if(e.target===$('drawer'))$('drawer').classList.remove('open')};document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[role=button]')){e.preventDefault();e.target.click()}});bindAcc();setInterval(refreshScanFreshness,60000);setInterval(()=>{$('clock').textContent=new Date().toLocaleTimeString('fr-FR')},1000);$('clock').textContent=new Date().toLocaleTimeString('fr-FR');scan();

if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn));
