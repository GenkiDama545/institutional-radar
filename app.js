const API='https://www.okx.com/api/v5';
const APP_VERSION='V8.9.15';
// Public listings identify X-Perps but do not verify account eligibility.
function xperpBase(id){return String(id||'').match(/^([A-Z0-9]+)-USD_UM_XPERP-/)?.[1]||null}
function isListedXperp(id){return !!xperpBase(id)}
function xperpUniverse(instruments,tickers){
 const ticks=new Map(tickers.map(t=>[t.instId,t]));
 return instruments.filter(i=>i.ruleType==='xperp'&&i.state==='live'&&xperpBase(i.instId)&&ticks.has(i.instId))
  .map(i=>{const t=ticks.get(i.instId),last=nullableNumber(t.last),open=nullableNumber(t.open24h),sym=xperpBase(i.instId),vol=n(t.volCcy24h)*n(last);return {id:i.instId,spotId:null,perpId:i.instId,perpPrice:last,sym,market:'xperp',contract:{ctType:i.ctType,ctVal:i.ctVal,ctMult:i.ctMult,ctValCcy:i.ctValCcy,lotSz:i.lotSz,minSz:i.minSz},hasPerp:true,price:last,vol,volUsd:vol,chg:open>0?(last/open-1)*100:0,high:n(t.high24h),low:n(t.low24h),oi:null,funding:null,oiDelta:null,marketTs:nullableNumber(t.ts),bidPx:nullableNumber(t.bidPx),askPx:nullableNumber(t.askPx),oiTs:null,fundingTs:null,rangePos:last&&n(t.high24h)>n(t.low24h)?(last-n(t.low24h))/(n(t.high24h)-n(t.low24h)):null}})
  .filter(x=>x.price>0&&isListedXperp(x.id));
}
const STORAGE={scan:'ir_scan_history_v866',learning:'ir_learning_journal_v866',locks:'ir_scenario_locks_v871',favorites:'ir_favorites_v1'};
function safeJSON(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch(_){return fallback}}
let storageWarningShown=false;
function storageFailure(){const message='Stockage local indisponible : modification non enregistrée. Exporte tes données avant de quitter.';if(typeof document!=='undefined'){const el=document.getElementById('status');if(el)el.textContent=message}if(!storageWarningShown&&typeof alert==='function'){storageWarningShown=true;alert(message)}return false}
function persistJSON(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch(_){return storageFailure()}}
function recordMap(key){const value=safeJSON(key,{});if(!value||typeof value!=='object'||Array.isArray(value))return {};return Object.fromEntries(Object.entries(value).filter(([k,v])=>!['__proto__','constructor','prototype'].includes(k)&&v&&typeof v==='object'&&!Array.isArray(v)))}
function scanHistory(){const value=recordMap(STORAGE.scan);for(const entry of Object.values(value))entry.samples=Array.isArray(entry.samples)?entry.samples.filter(x=>x&&typeof x==='object'):[];return value}
function migrateStorage(){try{
  // One canonical key per subsystem. Legacy data is copied once, never written again.
  if(!localStorage.getItem(STORAGE.scan)){const legacy=localStorage.getItem('ir_hist_v63')||localStorage.getItem('ir_hist_v52');if(legacy)localStorage.setItem(STORAGE.scan,legacy)}
  if(!localStorage.getItem(STORAGE.learning)){const legacy=localStorage.getItem('ir_scenario_journal_v86')||localStorage.getItem('ir_scenario_journal_v82');if(legacy)localStorage.setItem(STORAGE.learning,legacy)}
}catch(_){storageFailure()}}
migrateStorage();
let shortScanErrors=0, scanErrorReasons={}, scanRunning=false;let all=[],current=null,currentScenarioInstrument=null,filter='hot',marketMode='all',history=scanHistory(),theme='beige';
const $=x=>document.getElementById(x); const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const nullableNumber=x=>x==null||x===''||!Number.isFinite(Number(x))?null:Number(x);
const n=x=>nullableNumber(x)??0;
const price=x=>{if(nullableNumber(x)==null)return 'N/D';x=n(x);if(!Number.isFinite(x))return 'N/D';const a=Math.abs(x);if(a===0)return '0';if(a<1e-9)return x.toLocaleString('fr-FR',{minimumFractionDigits:14,maximumFractionDigits:16,useGrouping:false});if(a<1e-6)return x.toLocaleString('fr-FR',{minimumFractionDigits:12,maximumFractionDigits:14,useGrouping:false});if(a<1e-4)return x.toLocaleString('fr-FR',{minimumFractionDigits:10,maximumFractionDigits:12,useGrouping:false});if(a<1e-2)return x.toLocaleString('fr-FR',{minimumFractionDigits:8,maximumFractionDigits:10,useGrouping:false});if(a<1)return x.toLocaleString('fr-FR',{minimumFractionDigits:6,maximumFractionDigits:8,useGrouping:false});if(a<1000)return x.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:4,useGrouping:true});return x.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:true})};
const money=x=>{if(nullableNumber(x)==null)return 'N/D';x=n(x);return x>=1e9?(x/1e9).toFixed(1)+' Md$':x>=1e6?(x/1e6).toFixed(1)+' M$':x>=1e3?(x/1e3).toFixed(0)+' k$':x.toFixed(0)+' $'};
const pct=x=>nullableNumber(x)==null?'N/D':(n(x)*100).toFixed(3)+'%'; const chg=x=>nullableNumber(x)==null?'N/D':n(x).toFixed(2)+'%';
async function chunkRequests(list,size,fn,afterBatch){
 let next=0,completed=0,updates=Promise.resolve();
 await Promise.all(Array.from({length:Math.min(size,list.length)},async()=>{
  while(next<list.length){const i=next++;await fn(list[i]);const count=++completed;
   if(afterBatch)updates=updates.then(()=>afterBatch(count));
  }
 }));await updates;
}
const apiWait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let apiQueue=Promise.resolve(),lastApiStart=0,lastHistoryStart=0;
function apiTurn(path=""){const turn=apiQueue.then(async()=>{const delay=Math.max(0,55-(Date.now()-lastApiStart),path.startsWith("/market/history-candles")?110-(Date.now()-lastHistoryStart):0);if(delay)await apiWait(delay);lastApiStart=Date.now();if(path.startsWith("/market/history-candles"))lastHistoryStart=lastApiStart});apiQueue=turn.catch(()=>{});return turn}
const pendingApiReads=new Map();
function get(path){
 if(pendingApiReads.has(path))return pendingApiReads.get(path);
 const task=getRequest(path).finally(()=>pendingApiReads.delete(path));pendingApiReads.set(path,task);return task;
}
async function getRequest(path){
 for(let attempt=0;attempt<3;attempt++){
   await apiTurn(path);const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);
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
function evidenceForCard(x,direction){
 const m=x.signalModel||sharedMarketSignals(x),parts=[];
 if(m.complete&&m.regime?.label)parts.push(m.regime.label);
 const volRatio=x.medVol>0?x.vol/x.medVol:null;
 if(volRatio!=null&&volRatio>=1.35)parts.push('activité 24 h au-dessus de sa référence');
 if(x.oiDelta!=null&&x.perpId)parts.push(`OI ${x.oiDelta>=0?'+':''}${x.oiDelta.toFixed(1)} % depuis le dernier scan`);
 if(m.directionalAgreement>=35&&m.direction===(direction==='short'?'bear':'bull'))parts.push('direction technique '+(direction==='short'?'baissière':'haussière'));
 if(!parts.length)parts.push('structure du scénario et prix à revérifier');
 const cautions=[];
 if(m.contradiction>=15)cautions.push('signaux contradictoires');
 if(m.extensionRisk>=55)cautions.push('mouvement déjà étendu');
 if(x.oiDelta==null)cautions.push('évolution OI inconnue');
 return {reasons:parts.slice(0,2).join(' · '),caution:cautions.slice(0,2).join(' · ')||'prix et carnet à revérifier'};
}

function terrain(s){return s>=82?['Très intéressant','g']:s>=68?['Favorable à surveiller','g']:s>=52?['Mixte','y']:s>=38?['Faible','y']:['Défavorable','r']}
function bucket(s){return s>=78?'hot':s>=64?'trade':s>=48?'watch':'low'}
function bucketName(b){return b==='hot'?'🔥 Très tradables':b==='trade'?'🟢 Tradables':b==='watch'?'🟡 Surveillance':'⚪ Faible tradabilité'}
function fmtMetric(v,u){if(nullableNumber(v)==null)return 'N/D';v=n(v);if(!Number.isFinite(v))return 'N/D';if(u==='%')return (v*100).toFixed(3)+'%';if(u==='$')return Math.abs(v)<1?price(v)+' $':money(v);if(u==='score')return v.toFixed(0);return money(v)}
function makeSpark(vals,color='#65b8ff'){if(!vals||vals.length<2)return '';vals=vals.filter(Number.isFinite);if(vals.length<2)return '';let lo=Math.min(...vals),hi=Math.max(...vals),rg=hi-lo||1,w=240,h=42,p=2,pts=vals.map((v,i)=>`${p+i*(w-2*p)/(vals.length-1)},${h-p-(v-lo)/rg*(h-2*p)}`).join(' ');return `<div class="spark"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.4"/></svg></div>`}
let lastScanPerformance=null;
let lastCompletedScanAt=null,lastReadyScenarios=[],marketRefreshRunning=false,lastMarketRefreshAt=0;
function clockStamp(ts){return ts?new Date(ts).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'}):'inconnue'}
function refreshScanFreshness(){const el=$('scanFreshness');if(!el)return;el.textContent=scanRunning?'Scan en cours : les scénarios vérifiés apparaissent progressivement. Les autres marchés restent marqués « En analyse ».':lastCompletedScanAt?`Classement calculé le ${clockStamp(lastCompletedScanAt)} • ${Math.floor((Date.now()-lastCompletedScanAt)/60000)} min écoulée(s). Appuie sur Scanner pour recalculer.`:'Aucun scan terminé : résultats en attente.'}
// Screening rules live in market-screen.js and are shared with the test runner.
const executionCheck=RadarMarket.executionCheck;
const bookDepthUsd=RadarMarket.bookDepthUsd;
let discoveryExpanded=false;
async function scan(){
 if(scanRunning)return;const scanStart=Date.now(),beforeStats={...candleStore.stats};scanRunning=true;$('scan').disabled=true;refreshScanFreshness();
 $('status').textContent='Construction de l’univers Spot…';
 try{
   const [spotResult,futureInstruments,futureTickers]=await Promise.allSettled([get('/market/tickers?instType=SPOT'),get('/public/instruments?instType=FUTURES'),get('/market/tickers?instType=FUTURES')]);
   if(spotResult.status!=='fulfilled')throw spotResult.reason;
   const spotTickers=spotResult.value;
   const perpDataUnavailable=futureInstruments.status!=='fulfilled'||futureTickers.status!=='fulfilled';
   const xperps=futureInstruments.status==='fulfilled'&&futureTickers.status==='fulfilled'?xperpUniverse(futureInstruments.value,futureTickers.value):[];
   const spotAssets=spotTickers.filter(x=>x.instId.endsWith('-USDT')).map(x=>{const last=n(x.last),open=n(x.open24h),vol=n(x.volCcy24h),sym=x.instId.replace('-USDT','');return {id:x.instId,spotId:x.instId,perpId:null,perpPrice:null,sym,market:'spot',hasPerp:false,price:last,vol,volUsd:vol,chg:open>0?((last-open)/open)*100:0,high:n(x.high24h),low:n(x.low24h),oi:null,funding:null,oiDelta:null,marketTs:nullableNumber(x.ts),bidPx:nullableNumber(x.bidPx),askPx:nullableNumber(x.askPx),oiTs:null,fundingTs:null,rangePos:last&&n(x.high24h)>n(x.low24h)?(last-n(x.low24h))/Math.max(1e-12,n(x.high24h)-n(x.low24h)):null}});
   // Each market is analyzed over the same six horizons, regardless of size.
   // Priority sets the order only: every Spot with usable data gets the same analysis.
   const spotUniverse=RadarMarket.spotAnalysisQueue(spotAssets,favorites);
   let raw=xperps.concat(spotUniverse);
   const referenceFor=assets=>{const values=assets.map(x=>x.vol).filter(v=>Number.isFinite(v)&&v>0).sort((a,b)=>a-b);return {mean:values.reduce((s,v)=>s+v,0)/Math.max(1,values.length),median:values[Math.floor(values.length/2)]||0}};
   const spotReference=referenceFor(raw.filter(x=>x.market==='spot')),perpReference=referenceFor(raw.filter(x=>x.market==='xperp'));
   raw.forEach(x=>{const reference=x.market==='xperp'?perpReference:spotReference;x.medVol=reference.mean;x.marketMedianVol=reference.median});
   $('universeInfo').textContent=`${spotUniverse.length} Spot et ${perpDataUnavailable?'X-Perps indisponibles (API)':xperps.length+' X-Perps'} • analyse 5 min à 1 jour`;
   let derivativesDone=0;$('status').textContent='Chargement OI et financement…';
   await chunkRequests(xperps,4,async x=>{try{const o=await get('/public/open-interest?instType=FUTURES&instId='+encodeURIComponent(x.perpId));x.oi=nullableNumber(o[0]?.oiUsd);x.oiTs=x.oi==null?null:Date.now()}catch{x.oi=null}try{const f=await get('/public/funding-rate?instId='+encodeURIComponent(x.perpId));x.funding=nullableNumber(f[0]?.fundingRate);x.fundingTs=x.funding==null?null:Date.now()}catch{x.funding=null}derivativesDone++;$('status').textContent=`OI et financement : ${derivativesDone}/${xperps.length} contrats`});
   raw.forEach(x=>{const h=history[x.id]||{samples:[]},prev=h.samples?.at(-1);x.oiDelta=prev&&Number.isFinite(prev.oi)&&prev.oi>0&&Number.isFinite(x.oi)?((x.oi-prev.oi)/prev.oi)*100:null;h.samples=[...(h.samples||[]),{ts:Date.now(),oi:x.oi,price:x.price,vol:x.vol,funding:x.funding,score:0}].slice(-192);history[x.id]=h});
   const deepUniverse=raw;shortScanErrors=0;scanErrorReasons={};$('status').textContent=`Analyse technique : 0/${deepUniverse.length} actifs…`;
   raw.forEach(x=>{x.analysisCoverage='pending';x.marketFresh=false;x.score=0;x.tier=tier(x.vol,x.market==='spot'?spotUniverse:xperps)});
   all=raw;render();
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
       x.perpScenarioModel=x.market==='xperp'?x.scenarioModel:null;x.perpAnalysisCoverage=x.market==='xperp'?x.analysisCoverage:'unavailable';
       // Partial data is useful for inspection but cannot certify a trade setup.
       x.hasLongScenario=!!(full&&x.scenarioModel?.longValid);
       x.hasShortScenario=!!(isListedXperp(x.perpId)&&full&&x.perpScenarioModel?.shortSetup&&(x.perpScenarioModel.breakdownValid||x.perpScenarioModel.rejectionValid));
       x.scenarioKind=full&&x.scenarioModel?chooseFreshScenario(x.scenarioModel,null):null;
       x.hasValidScenario=!!(x.hasLongScenario||x.hasShortScenario);
     }catch(err){shortScanErrors++;const reason=String(err?.message||err).slice(0,90);scanErrorReasons[reason]=(scanErrorReasons[reason]||0)+1;console.warn('Analyse '+x.id,err);x.analysisCoverage='unavailable';x.deep=null;x.scenarioFrames={};x.scenarioModel=null;x.directional={longScore:0,shortScore:0,longEligible:false,shortEligible:false,strongest:'neutral'};x.scenarioKind=null;x.hasLongScenario=false;x.hasShortScenario=false;x.hasValidScenario=false}
     finally{processed++;x.signalModel=sharedMarketSignals(x);const dir=x.directional||{};x.longScore=dir.longScore||0;x.shortScore=x.perpScenarioModel?.directional?.shortScore??dir.shortScore??0;x.side=x.hasShortScenario&&!x.hasLongScenario?'short':x.hasLongScenario&&!x.hasShortScenario?'long':x.longScore>x.shortScore?'long':x.shortScore>x.longScore?'short':'neutral';x.score=score(x);if(x.analysisCoverage==='partial')x.score=Math.min(x.score,63);$('status').textContent=`Analyse technique : ${processed}/${deepUniverse.length} actifs • ${shortScanErrors} analyses incomplètes`}
   },async completed=>{if(completed%12===0||completed>=deepUniverse.length){$('universeInfo').textContent=`${spotUniverse.length} Spot et ${xperps.length} X-Perps suivis • ${processed}/${deepUniverse.length} analysés • horizons 5 min à 1 jour${perpDataUnavailable?' • X-Perps API indisponibles':''}`;await refreshScenarioMarket(true);const visible=scenarioCandidates();if(visible.length&&filter==='hot'&&!visible.some(c=>bucket(c.score)==='hot'))setFilter(preferredFilter(visible));renderRank();drawTable()}});
   // Refresh all selected instruments once at the end. Old snapshots cannot enter the scenario ranking.
   const [spotRefresh,futureRefresh]=await Promise.allSettled([get('/market/tickers?instType=SPOT'),get('/market/tickers?instType=FUTURES')]);
   const refreshed=new Map([...(spotRefresh.status==='fulfilled'?spotRefresh.value:[]),...(futureRefresh.status==='fulfilled'?futureRefresh.value:[])].map(t=>[t.instId,t]));
   for(const x of raw){const t=refreshed.get(x.id),last=nullableNumber(t?.last),ts=nullableNumber(t?.ts),bid=nullableNumber(t?.bidPx),ask=nullableNumber(t?.askPx),old=x.price;
    x.marketFresh=!!(last>0&&ts&&Date.now()-ts<120000&&bid>0&&ask>=bid&&Math.abs(last/old-1)<=.01);
    if(x.marketFresh){x.price=last;x.marketTs=ts;x.bidPx=bid;x.askPx=ask;x.spreadPct=(ask-bid)/((ask+bid)/2)*100;if(x.market==='xperp')x.perpPrice=last}
   }
   const spotSetups=raw.filter(x=>x.market==='spot'&&x.analysisCoverage==='complete'&&x.hasLongScenario&&x.marketFresh);
   await chunkRequests(spotSetups,4,async x=>{try{const book=(await get('/market/books?instId='+encodeURIComponent(x.id)+'&sz=20'))[0];x.bookDepth=bookDepthUsd(book,(x.bidPx+x.askPx)/2)}catch(_){x.bookDepth=null}});
   const spotPeers=raw.filter(x=>x.market==='spot'),perpPeers=raw.filter(x=>x.market==='xperp');
   raw.forEach(x=>{x.signalModel=sharedMarketSignals(x);const dir=x.directional||{};x.longScore=dir.longScore||0;x.shortScore=x.perpScenarioModel?.directional?.shortScore??dir.shortScore??0;x.side=x.hasShortScenario&&!x.hasLongScenario?'short':x.hasLongScenario&&!x.hasShortScenario?'long':x.longScore>x.shortScore?'long':x.shortScore>x.longScore?'short':'neutral';x.score=score(x);if(x.analysisCoverage==='partial')x.score=Math.min(x.score,63);x.tier=tier(x.vol,x.market==='xperp'?perpPeers:spotPeers);let h=history[x.id];if(h?.samples?.length)h.samples[h.samples.length-1].score=x.score});
   raw.sort((a,b)=>b.score-a.score);raw.forEach(x=>{x.bucket=bucket(x.score);x.scenarioScanPrice=x.price});persistJSON(STORAGE.scan,history);all=raw;lastCompletedScanAt=Date.now();lastScanPerformance={durationMs:Date.now()-scanStart,requests:candleStore.stats.requests-beforeStats.requests,rows:candleStore.stats.rows-beforeStats.rows,reused:candleStore.stats.reused-beforeStats.reused};lastReadyScenarios=scenarioCandidates().map(c=>({id:c.x.id,direction:c.direction,score:c.score}));const nextFilter=preferredFilter(lastReadyScenarios);if(nextFilter&&filter==='hot'&&!lastReadyScenarios.some(c=>bucket(c.score)==='hot'))setFilter(nextFilter);refreshScanFreshness();$('status').textContent=`${spotUniverse.length} Spot suivis • ${all.filter(x=>x.analysisCoverage==='complete').length} analyses complètes • ${shortScanErrors} incomplètes • ${Math.round((Date.now()-scanStart)/1000)} s${perpDataUnavailable?' • données X-Perps indisponibles':''}`;render();
 }catch(e){$('status').textContent='Erreur API — scan interrompu : '+String(e.message||e);all.filter(x=>x.analysisCoverage==='pending').forEach(x=>{x.analysisCoverage='unavailable';x.analysisIssues=['Scan interrompu avant analyse']});console.error(e)}finally{scanRunning=false;$('scan').disabled=false;refreshScanFreshness();renderRank();drawTable()}
}
function render(){renderRank();drawTable();prepareInteractive()}
function preferredFilter(candidates){return candidates.length?bucket(Math.max(...candidates.map(c=>c.score))):null}
function setFilter(next){filter=next;document.querySelectorAll('#tradeTabs button').forEach(b=>b.classList.toggle('active',b.dataset.filter===next))}
async function refreshScenarioMarket(force=false){
 if(marketRefreshRunning||(scanRunning&&!force)||!all.length||(!force&&Date.now()-lastMarketRefreshAt<30000))return;
 marketRefreshRunning=true;lastMarketRefreshAt=Date.now();
 try{
  const assets=all.filter(x=>x.analysisCoverage==='complete'&&(x.hasLongScenario||x.hasShortScenario)&&(!force||!x.marketFresh||Date.now()-x.marketTs>45000||(x.market==='spot'&&(!x.bookDepth||Date.now()-x.bookDepth.ts>45000))));
  if(!assets.length)return;
  const [spots,perps]=await Promise.allSettled([get('/market/tickers?instType=SPOT'),get('/market/tickers?instType=FUTURES')]);
  const tickers=new Map([...(spots.status==='fulfilled'?spots.value:[]),...(perps.status==='fulfilled'?perps.value:[])].map(t=>[t.instId,t]));
  for(const x of assets){
   const t=tickers.get(x.id),last=nullableNumber(t?.last),bid=nullableNumber(t?.bidPx),ask=nullableNumber(t?.askPx),ts=nullableNumber(t?.ts),origin=x.scenarioScanPrice||x.price;
   x.marketFresh=!!(last>0&&bid>0&&ask>=bid&&ts&&Date.now()-ts<120000&&Math.abs(last/origin-1)<=.01);
   if(!x.marketFresh)continue;
   x.price=last;x.marketTs=ts;x.bidPx=bid;x.askPx=ask;x.spreadPct=(ask-bid)/((ask+bid)/2)*100;
   if(x.market==='xperp')x.perpPrice=last;
  }
  await chunkRequests(assets.filter(x=>x.market==='spot'&&x.marketFresh&&x.hasLongScenario),4,async x=>{
   try{x.bookDepth=bookDepthUsd((await get('/market/books?instId='+encodeURIComponent(x.id)+'&sz=20'))[0],(x.bidPx+x.askPx)/2)}catch(_){x.bookDepth=null}
  });
 }catch(e){console.warn('Actualisation des scénarios',e)}finally{marketRefreshRunning=false;renderRank()}
}
function prepareInteractive(){document.querySelectorAll('.rankcard,.radar,.click,.row').forEach(el=>{el.tabIndex=0;el.setAttribute('role','button')});bindAcc()}
function scenarioCandidates(){
 const out=[];
 all.forEach(x=>{
  if(!executionCheck(x).ok)return;
  if(x.analysisCoverage==='complete'&&x.hasLongScenario&&x.longScore>=66){
   const longKind=(scenarioValid('breakout',x.scenarioModel?.breakout,x.price)?'breakout':'pullback');
   if(scenarioValid(longKind,x.scenarioModel?.[longKind],x.price))out.push({x,direction:'long',market:x.market==='xperp'?'perp':'spot',score:calibratedScore(x,'long'),ready:true,kind:longKind,instruments:[x.market==='xperp'?'perp':'spot']});
  }
  if(isListedXperp(x.perpId)&&x.perpAnalysisCoverage==='complete'&&x.hasShortScenario&&x.shortScore>=62){const kind=x.perpScenarioModel.shortPattern==='reversal'?'rejection':(x.perpScenarioModel.shortPattern||'breakdown'),levels=x.perpScenarioModel[kind==='rejection'?'shortRejection':kind];if(scenarioValid(kind,levels,x.perpPrice))out.push({x,direction:'short',market:'perp',score:calibratedScore(x,'short'),ready:true,kind,instruments:['perp']})}
 });
 return out;
}
function shortBlockReason(x){
 if(x.market!=='xperp'||!isListedXperp(x.perpId))return 'Marché Spot : aucun SHORT sur cet instrument.';
 if(x.perpAnalysisCoverage!=='complete')return 'Analyse des six horizons incomplète.';
 const m=x.perpScenarioModel;
 if(!m?.shortPattern)return 'Biais vendeur présent, mais aucun rejet ou cassure confirmé.';
 if(!m.shortSetup)return 'Motif baissier présent, mais score directionnel ou conflit LONG à confirmer.';
 if(!x.hasShortScenario)return 'Motif présent, mais entrée, stop, objectifs ou prix hors des niveaux valides.';
 if(x.shortScore<62)return 'Score directionnel sous le seuil du scénario.';
 const check=executionCheck(x);
 if(!check.ok)return check.reason;
 const kind=m.shortPattern==='reversal'?'rejection':m.shortPattern;
 if(!scenarioValid(kind,m[kind==='rejection'?'shortRejection':kind],x.perpPrice))return 'Prix actuel hors de la zone de validité du scénario.';
 return 'Scénario disponible dans une autre catégorie du classement.';
}
function modeLabel(){return marketMode==='spot'?'💰 SPOT':marketMode==='long'?'📈 LONG':marketMode==='short'?'📉 SHORT':'🌐 TOUT'}
function marketModeHint(){return 'Spot et tous les X-Perps actifs publiés par OKX. La liste publique ne prouve pas leur disponibilité dans ton compte : vérifie le contrat exact dans OKX avant de trader. Les USDT-SWAP restent exclus.'}
function configCard(c,i,compact=false){const {x,direction,market,score}=c,tr=terrain(score),isShort=direction==='short',evidence=evidenceForCard(x,direction);return `<div tabindex="0" role="button" class="rankcard compactRank ${compact?'topRankCard':''}" onclick="openDetail('${x.id}','${market}','${direction}')"><div class="rankTop"><span class="ranknum">${String(i+1).padStart(2,'0')}</span><b class="rankSym">${esc(x.sym)}</b><span class="tag ${market==='spot'?'b':'r'}">${market==='spot'?'💰 SPOT':'⚡ X-PERP'}</span><span class="tag ${isShort?'r':'g'}">${isShort?'🔴 SHORT':'🟢 LONG'}</span><span class="scoreBadge">${score}/100</span></div><div class="evidence"><span>✓ ${esc(evidence.reasons)}</span><span>À vérifier : ${esc(evidence.caution)}</span></div>${x.market==='xperp'?`<div class="sub" style="overflow-wrap:anywhere">${esc(x.id)}</div>`:''}<div class="rankMetrics"><div class="metric"><small>Prix</small><b>${price(isShort?x.perpPrice:x.price)}</b></div><div class="metric"><small>24h</small><b class="${x.chg>=0?'good':'bad'}">${chg(x.chg)}</b></div><div class="metric"><small>Volume</small><b>${money(x.volUsd)}</b></div></div><div class="meter"><i style="width:${score}%"></i></div><div class="rankFoot"><span class="tag ${tr[1]}">${tr[0]}</span><span class="sub">${c.ready===false?'⏳ Attendre le déclencheur':'🎯 Étudier les conditions'}</span></div></div>`}
function renderRank(){
 const candidates=scenarioCandidates();
 const readyIds=new Set(candidates.map(c=>c.x.id));
 const watchlist=all.filter(x=>x.analysisCoverage==='complete'&&!readyIds.has(x.id)&&(x.scenarioModel?.longSetup||(x.market==='xperp'&&x.scenarioModel?.shortSetup)||Math.max(x.longScore||0,x.shortScore||0)>=65)).filter(x=>marketMode==='all'||(marketMode==='spot'&&x.market==='spot')||(marketMode==='long'&&(x.longScore||0)>=(x.shortScore||0))||(marketMode==='short'&&(x.shortScore||0)>(x.longScore||0))).sort((a,b)=>b.score-a.score);
 $('discovery').innerHTML=watchlist.length?`<div class="sub">${watchlist.length} configuration(s) multi-horizons à surveiller, sans scénario confirmé. Même analyse pour toutes les tailles.</div><div class="rank">${watchlist.slice(0,discoveryExpanded?watchlist.length:12).map(x=>`<div tabindex="0" role="button" class="rankcard" onclick="openDetail('${x.id}')"><b>${esc(x.sym)}</b> <span class="tag y">${x.market==='xperp'?'X-Perp':'Spot'} • ${x.shortScore>x.longScore?'biais baissier':'biais haussier'}</span><div class="sub">Confluence ${x.score}/100 • LONG ${x.longScore||0}/100 • SHORT ${x.shortScore||0}/100${x.market==='spot'&&x.shortScore>x.longScore?' • baisse Spot : aucun SHORT exécutable':''}</div><div class="sub">${esc(x.shortScore>x.longScore?shortBlockReason(x):x.hasValidScenario?(executionCheck(x).ok?'Score directionnel ou niveaux à confirmer':executionCheck(x).reason):'Structure et niveaux de scénario à confirmer')}</div></div>`).join('')}</div>${watchlist.length>12?`<button class="btn secondary" onclick="discoveryExpanded=!discoveryExpanded;renderRank()">${discoveryExpanded?'Réduire la liste':'Voir les '+watchlist.length+' configurations à surveiller'}</button>`:''}`:'<div class="empty">Aucune configuration multi-horizons en attente de confirmation pour ce filtre.</div>';
 const top=[...candidates].filter(c=>c.ready!==false).sort((a,b)=>b.score-a.score).slice(0,5);
 $('topConfigs').innerHTML=top.length?`<div class="topRankGrid">${top.map((c,i)=>configCard(c,i,true)).join('')}</div>`:'<div class="empty">Aucun scénario suffisamment construit pour constituer le Top.</div>';
 const filtered=candidates.filter(c=>marketMode==='all'||(marketMode==='spot'&&c.market==='spot')||(marketMode==='long'&&c.direction==='long')||(marketMode==='short'&&c.direction==='short')).filter(c=>bucket(c.score)===filter).sort((a,b)=>b.score-a.score);
 $('rankTitle').textContent=`Scénarios chiffrés • ${bucketName(filter)} • ${modeLabel()}`;
 $('modeHint').textContent=marketModeHint();
 const inMode=candidates.filter(c=>marketMode==='all'||(marketMode==='spot'&&c.market==='spot')||(marketMode==='long'&&c.direction==='long')||(marketMode==='short'&&c.direction==='short'));
 const expired=!scanRunning&&lastReadyScenarios.length&&lastCompletedScanAt&&Date.now()-lastCompletedScanAt>120000&&!candidates.length;
 const bearish=marketMode==='short'?watchlist.filter(x=>x.shortScore>x.longScore).slice(0,5):[];
 const emptyReason=expired?'Les scénarios du dernier scan attendent une nouvelle validation du prix et du carnet. Relance le scan pour recalculer.':inMode.length?`${inMode.length} scénario(s) confirmé(s) dans ce sens, mais dans ${[...new Set(inMode.map(c=>bucketName(bucket(c.score))))].join(', ')}. Choisis cette catégorie pour les voir.`:scanRunning?'Analyse progressive en cours : les configurations vérifiées apparaissent ici dès qu’elles remplissent les conditions.':marketMode==='short'?`Aucun SHORT confirmé sur les ${all.filter(x=>x.perpId&&x.perpAnalysisCoverage==='complete').length} X-Perps analysés complètement (${all.filter(x=>x.perpId).length} repérés). Une baisse Spot reste une observation, pas une position SHORT exécutable.`:'Aucun scénario confirmé dans ce sens au dernier scan.';
 $('rank').innerHTML=filtered.length?`<div class="rank">${filtered.map((c,i)=>configCard(c,i)).join('')}</div>`:`<div class="empty">Aucune configuration ${marketMode==='short'?'SHORT / PERP ':marketMode==='spot'?'SPOT ':marketMode==='long'?'LONG ':''}dans ${bucketName(filter)} actuellement.<br><span class="sub">${esc(emptyReason)}</span>${bearish.length?`<div class="sub" style="margin-top:12px">Configurations baissières multi-horizons à surveiller :</div><div class="rank">${bearish.map(x=>`<div tabindex="0" role="button" class="rankcard" onclick="openDetail('${x.id}')"><b>${esc(x.sym)}</b> <span class="tag y">${x.market==='spot'?'Spot • baisse non négociable à découvert':'X-Perp • SHORT à confirmer'}</span><div class="sub">Confluence ${x.score}/100 • biais vendeur ${x.shortScore}/100</div><div class="blockReason">${esc(shortBlockReason(x))}</div></div>`).join('')}</div>`:''}</div>`;
}
function drawTable(){let q=$('search').value.toUpperCase().trim(),s=$('sort').value,t=$('tier').value,a=all.filter(x=>(!q||x.sym.includes(q))&&(t==='all'||x.tier[0]===t));a.sort((x,y)=>s==='score'?y.score-x.score:s==='volume'?y.vol-x.vol:s==='momentum'?y.chg-x.chg:s==='oi'?y.oi-x.oi:Math.abs(y.funding)-Math.abs(x.funding));$('market').innerHTML=a.map((x,i)=>{let tr=terrain(x.score),pending=x.analysisCoverage==='pending';return `<tr class="row" onclick="openDetail('${x.id}')"><td>${i+1}</td><td><b>${esc(x.sym)}</b><br><span class="tag">${x.market==='xperp'?'⚡ X-PERP':'💰 SPOT'}</span><br><span class="tiny">${esc(x.id)}</span><br><span class="tag">${x.tier[1]}</span></td><td>${price(x.price)}</td><td class="${x.chg>=0?'good':'bad'}">${chg(x.chg)}</td><td>${money(x.volUsd)}</td><td>${money(x.oi)}<br><span class="tiny ${x.oiDelta>=0?'good':'bad'}">${x.oiDelta==null?'1er scan':(x.oiDelta>=0?'+':'')+x.oiDelta.toFixed(1)+'% scan'}</span><br><span class="tiny">${x.oiTs?'consulté '+timeLabel(x.oiTs):'N/D'}</span></td><td>${pct(x.funding)}<br><span class="tiny">${x.fundingTs?'consulté '+timeLabel(x.fundingTs):'N/D'}</span></td><td>${pending?'En cours':`<b>${x.score}</b><div class="meter"><i style="width:${x.score}%"></i></div>`}</td><td><span class="tag ${pending?'y':tr[1]}">${pending?'En analyse':tr[0]}</span></td></tr>`}).join('')||'<tr><td colspan="9" class="empty">Aucun résultat.</td></tr>'}
const candleStore=RadarCandles.create(get);
async function candles(id,bar='1H',limit=90){return candleStore.load(id,bar,limit)}
function struct(cs){if(cs.length<6)return'Manque de données';let a=cs.slice(-6),h=a.map(x=>x.h),l=a.map(x=>x.l),HH=h[5]>h[4],HL=l[5]>l[4],LH=h[5]<h[4],LL=l[5]<l[4];return HH&&HL?'HH + HL : haussier':LH&&LL?'LH + LL : baissier':'Transition / mixte'}
function pattern(c,p){let b=Math.abs(c.c-c.o),r=Math.max(1e-9,c.h-c.l),u=c.h-Math.max(c.o,c.c),d=Math.min(c.o,c.c)-c.l;if(b/r<.12)return'Doji — hésitation';if(d>b*2&&u<b)return'Rejet bas — acheteurs défendent';if(u>b*2&&d<b)return'Rejet haut — vendeurs défendent';if(p&&c.c>c.o&&p.c<p.o&&c.o<=p.c&&c.c>=p.o)return'Engulfing haussier';if(p&&c.c<c.o&&p.c>p.o&&c.o>=p.c&&c.c<=p.o)return'Engulfing baissier';return c.c>=c.o?'Bougie haussière':'Bougie baissière'}
function axisTime(ts,days=1){let d=new Date(ts);return days>1?d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
function axisPrice(x){x=n(x);if(!Number.isFinite(x))return 'N/D';const a=Math.abs(x);if(a===0)return '0 $';if(a<1e-6){const exp=Math.floor(Math.log10(a));const mant=x/Math.pow(10,exp);return mant.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:4})+'e'+exp+' $';}return price(x)+' $'}
function ema(cs,len){let out=[],k=2/(len+1),v=null;for(const c of cs){v=v==null?c.c:c.c*k+v*(1-k);out.push(v)}return out}
function rsi(cs,len=14){let out=Array(cs.length).fill(null),gain=0,loss=0;if(cs.length<=len)return out;for(let i=1;i<=len;i++){let d=cs[i].c-cs[i-1].c;gain+=Math.max(d,0);loss+=Math.max(-d,0)}gain/=len;loss/=len;out[len]=loss===0?100:100-100/(1+gain/loss);for(let i=len+1;i<cs.length;i++){let d=cs[i].c-cs[i-1].c;gain=(gain*(len-1)+Math.max(d,0))/len;loss=(loss*(len-1)+Math.max(-d,0))/len;out[i]=loss===0?100:100-100/(1+gain/loss)}return out}
function stochRsi(cs,len=14){let rs=rsi(cs,len),raw=Array(cs.length).fill(null),k=Array(cs.length).fill(null),d=Array(cs.length).fill(null);for(let i=0;i<rs.length;i++){if(i<len*2||rs[i]==null)continue;let a=rs.slice(i-len+1,i+1).filter(Number.isFinite);if(a.length<len)continue;let lo=Math.min(...a),hi=Math.max(...a);raw[i]=hi===lo?0.5:(rs[i]-lo)/(hi-lo)}for(let i=0;i<raw.length;i++){let a=raw.slice(Math.max(0,i-2),i+1).filter(Number.isFinite);if(a.length===3)k[i]=a.reduce((x,y)=>x+y,0)/a.length}for(let i=0;i<k.length;i++){let a=k.slice(Math.max(0,i-2),i+1).filter(Number.isFinite);if(a.length===3)d[i]=a.reduce((x,y)=>x+y,0)/a.length}return {raw,k,d}}
function supertrend(cs,len=10,mult=3){if(cs.length<2)return Array(cs.length).fill(null);let atr=[],tr=[];for(let i=0;i<cs.length;i++){tr.push(i===0?cs[i].h-cs[i].l:Math.max(cs[i].h-cs[i].l,Math.abs(cs[i].h-cs[i-1].c),Math.abs(cs[i].l-cs[i-1].c)))}let a=tr.slice(0,len).reduce((x,y)=>x+y,0)/Math.min(len,tr.length);for(let i=0;i<cs.length;i++){if(i<len)atr.push(a);else{a=(a*(len-1)+tr[i])/len;atr.push(a)}}let upper=[],lower=[],trend=Array(cs.length).fill(1),st=Array(cs.length).fill(null);for(let i=0;i<cs.length;i++){let mid=(cs[i].h+cs[i].l)/2;upper[i]=mid+mult*atr[i];lower[i]=mid-mult*atr[i];if(i){if(cs[i].c>upper[i-1])trend[i]=1;else if(cs[i].c<lower[i-1])trend[i]=-1;else trend[i]=trend[i-1];if(trend[i]>0)lower[i]=Math.max(lower[i],lower[i-1]);else upper[i]=Math.min(upper[i],upper[i-1])}st[i]=trend[i]>0?lower[i]:upper[i]}return st}
function svgPath(vals,xs,top,bottom,min,max){let pts=[],started=false;for(let i=0;i<vals.length;i++){if(vals[i]==null||!Number.isFinite(vals[i]))continue;let y=bottom-(vals[i]-min)/Math.max(1e-12,max-min)*(bottom-top);pts.push(`${started?'L':'M'}${xs[i].toFixed(1)},${y.toFixed(1)}`);started=true}return pts.join(' ')}
function proChart(cs,calcCs=cs,overlays=[]){
 if(!cs?.length)return '<div class="empty">Données insuffisantes.</div>';
 const W=typeof window==='undefined'?900:Math.max(300,Math.min(900,window.innerWidth-72)),H=720,L=14,R=82,top=30,priceH=350,volTop=412,volH=80,rsiTop=522,rsiH=78,stochTop=615,stochH=78;
 const plotW=W-L-R,xStep=plotW/Math.max(1,cs.length-1),xs=cs.map((_,i)=>L+i*xStep);
 const ov=(overlays||[]).map(x=>n(x?.value)).filter(Number.isFinite),lo0=Math.min(...cs.map(x=>x.l),...(ov.length?ov:[Infinity])),hi0=Math.max(...cs.map(x=>x.h),...(ov.length?ov:[-Infinity])),lo=Number.isFinite(lo0)?lo0:Math.min(...cs.map(x=>x.l)),hi=Number.isFinite(hi0)?hi0:Math.max(...cs.map(x=>x.h)),rawRange=hi-lo,pad=(rawRange||Math.max(Math.abs(hi),1e-12))*.06,minP=Math.max(0,lo-pad),maxP=hi+pad;
 const py=v=>top+(maxP-v)/Math.max(1e-18,maxP-minP)*priceH;
 const maxVol=Math.max(...cs.map(x=>Number.isFinite(x.v)?x.v:0),1);
 const e20=ema(calcCs,20).slice(-cs.length),e50=ema(calcCs,50).slice(-cs.length),st=supertrend(calcCs).slice(-cs.length),rv=rsi(calcCs).slice(-cs.length),sri=stochRsi(calcCs),sv=sri.k.slice(-cs.length),sd=sri.d.slice(-cs.length);
 const candleW=Math.max(.6,Math.min(12,xStep*.68));
 const spanDays=(cs.at(-1).t-cs[0].t)/86400000;
 const last=cs.at(-1).c,ly=py(last);
 let svg=[];
 svg.push(`<rect x="0" y="0" width="${W}" height="${H}" rx="12" fill="#0b0d11"/>`);
 // horizontal grid + right price axis. Scientific notation is used only for tiny prices so zeros never disappear.
 for(let i=0;i<=6;i++){
  const v=maxP-(maxP-minP)*i/6,y=py(v);
  svg.push(`<line x1="${L}" y1="${y}" x2="${W-R}" y2="${y}" stroke="#20252c"/>`);
  svg.push(`<text x="${W-R+9}" y="${y+5}" fill="#c4cad3" font-size="10" font-weight="700">${price(v)}</text>`);
 }
 // time grid
 const idxs=(W<500?[.12,.5,.88]:[.05,.25,.5,.75,.95]).map(r=>Math.round(r*(cs.length-1)));
 idxs.forEach(i=>{const x=xs[i];svg.push(`<line x1="${x}" y1="${top}" x2="${x}" y2="${stochTop+stochH}" stroke="#171c22"/>`);svg.push(`<text x="${x}" y="${H-5}" text-anchor="middle" fill="#a1a7b0" font-size="10">${axisTime(cs[i].t,Math.max(1,Math.ceil(spanDays)))}</text>`)});
 svg.push(`<text x="${L}" y="15" fill="#aeb4bd" font-size="13" font-weight="800">PRIX ($)</text>`);
 // scenario overlays: fixed levels remain visible while the live market moves.
 const validOverlays=(overlays||[]).filter(o=>Number.isFinite(n(o?.value))).map(o=>({...o,value:n(o.value)}));
 const placed=[];validOverlays.forEach((o,idx)=>{const y=py(o.value);let ly=y;for(const q of placed){if(Math.abs(ly-q)<27)ly=q+(ly>=q?27:-27)}ly=Math.max(top+10,Math.min(top+priceH-10,ly));placed.push(ly);const col=o.color||'#65b8ff';const label=esc((o.label||'').replace('🎯 ','').replace('🛑 ','').replace('Prix live','Live'));svg.push(`<line x1="${L}" y1="${y}" x2="${W-R}" y2="${y}" stroke="${col}" stroke-width="1.8" stroke-dasharray="7 5" opacity=".92"/><rect x="${W-R-184}" y="${ly-12}" width="178" height="23" rx="5" fill="#111419" stroke="${col}" opacity=".96"/><text x="${W-R-178}" y="${ly+5}" fill="#eef1f4" font-size="14" font-weight="800">${label} ${axisPrice(o.value)}</text>`)});
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
 svg.push(`<rect x="${L}" y="${Math.max(top,ly-22)}" width="120" height="20" rx="5" fill="#45dc7a"/>`);
 svg.push(`<text x="${L+5}" y="${Math.max(top,ly-22)+14}" fill="#06130a" font-size="10" font-weight="900">Prix live ${axisPrice(last)}</text>`);
 // invisible interaction layer: one zone per candle
 cs.forEach((c,i)=>svg.push(`<rect class="candleHit" x="${Math.max(L,xs[i]-xStep/2)}" y="${top}" width="${i===0||i===cs.length-1?xStep/2:xStep}" height="${priceH}" fill="transparent" data-i="${i}" onpointermove="chartHover(event,${i})" onpointerdown="chartHover(event,${i})"/>`));
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
 const geometry={W,L,R,top,priceH,minP,maxP,bottom:stochTop+stochH};
 const chartKey=(current?.id||'manual')+'|'+(cs.length>1?cs[1].t-cs[0].t:0);
 const selectedIndex=cs.findIndex(c=>c.t===chartSelections.get(chartKey));
 const selected=selectedIndex>=0?cs[selectedIndex]:null;
 svg.push(`<g class="chartSelection" pointer-events="none">${selected?chartSelectionMarkup(selected,xs[selectedIndex],geometry):''}</g>`);
 return `<div class="chartShell"><div class="chartToolbar"><span class="chartBadge">Indicateurs affichés : bougies</span><span class="chartBadge">EMA 20/50</span><span class="chartBadge">Supertrend</span><span class="chartBadge">RSI</span><span class="chartBadge">StochRSI</span><span class="chartHint">Touchez une bougie pour ses valeurs</span></div><div class="chartTooltip ${selected?'show':''}" role="status">${selected?chartReadout(selected):'Touchez une bougie : sa date et ses valeurs apparaîtront ici.'}</div><div class="proChart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" data-chart-key="${esc(chartKey)}" data-candles="${esc(JSON.stringify(cs))}" data-geometry="${esc(JSON.stringify(geometry))}">${svg.join('')}</svg></div><div class="chartLegend"><span>🟩 Haussière</span><span>🟥 Baissière</span><span style="color:#ffd166">EMA 20</span><span style="color:#bd91ff">EMA 50</span><span style="color:#65b8ff">Supertrend</span><span style="color:#bd91ff">Stoch K</span><span style="color:#65b8ff">Stoch D</span></div><div class="chartStats"><div><small>MIN</small><b>${axisPrice(lo)}</b></div><div><small>ACTUEL</small><b>${axisPrice(last)}</b></div><div><small>MAX</small><b>${axisPrice(hi)}</b></div></div></div>`;
}
const chartSelections=new Map();
function chartReadout(c){return `<b>${clockStamp(c.t)}</b><br>Ouverture ${axisPrice(c.o)} · Clôture ${axisPrice(c.c)}<br><span class="good">High ${axisPrice(c.h)}</span> · <span class="bad">Low ${axisPrice(c.l)}</span> · Volume ${money(c.v)}`}
function chartSelectionMarkup(c,x,g){
 const py=v=>g.top+(g.maxP-v)/Math.max(1e-18,g.maxP-g.minP)*g.priceH;
 const high=py(c.h),low=py(c.l),labelHigh=Math.max(g.top,high-13),labelLow=Math.min(g.top+g.priceH+4,Math.max(low+2,labelHigh+23));
 return `<rect x="${x-3}" y="${g.top}" width="6" height="${g.bottom-g.top}" fill="#eaf7ff" opacity=".12"/><line x1="${x}" x2="${x}" y1="${g.top}" y2="${g.bottom}" stroke="#f8fafb" stroke-dasharray="4 3"/>`+[[high,labelHigh,'H',c.h,'#8be2b1'],[low,labelLow,'L',c.l,'#ffadb3']].map(([y,labelY,label,value,color])=>`<circle cx="${x}" cy="${y}" r="3" fill="${color}"/><line x1="${x}" x2="${g.W-g.R}" y1="${y}" y2="${y}" stroke="${color}" stroke-dasharray="3 3"/><rect x="${g.W-g.R}" y="${labelY}" width="${g.R}" height="19" fill="#17232b"/><text x="${g.W-g.R+3}" y="${labelY+13}" font-size="10" fill="${color}">${label} ${price(value)}</text>`).join('');
}
function chartHover(ev,i){
 const svg=ev.currentTarget?.closest('svg'),shell=svg?.closest('.chartShell'),tip=shell?.querySelector('.chartTooltip');
 if(!svg||!tip)return;
 const bars=svg._candles||(svg._candles=JSON.parse(svg.dataset.candles)),c=bars[i];if(!c)return;
 const g=JSON.parse(svg.dataset.geometry),x=g.L+i*(g.W-g.L-g.R)/Math.max(1,bars.length-1);
 chartSelections.set(svg.dataset.chartKey,c.t);
 tip.innerHTML=chartReadout(c);tip.classList.add('show');
 svg.querySelector('.chartSelection').innerHTML=chartSelectionMarkup(c,x,g);
}
function radar(name,val,min,max,unit,desc,sparkVals){const indicative=['OI','Volume','Funding','Momentum'].includes(name);let pos=nullableNumber(val)==null?null:Math.max(0,Math.min(100,(val-min)/Math.max(1e-12,max-min)*100));return `<div tabindex="0" role="button" class="radar" onclick="openDeep(current.id,'metric','${name}')"><b>${name}</b><div class="sub">${desc}</div><div class="range">${pos==null?'':`<i class="dot" style="left:${pos}%"></i>`}</div><div class="minmax"><span><small>${indicative?'BORNE BASSE':'MIN'}</small><b>${fmtMetric(min,unit)}</b></span><span><small>ACTUEL</small><b>${fmtMetric(val,unit)}</b></span><span><small>${indicative?'BORNE HAUTE':'MAX'}</small><b>${fmtMetric(max,unit)}</b></span></div>${makeSpark((sparkVals||[]).filter(Number.isFinite))}${indicative?'<div class="sub">Échelle indicative calculée à partir de la valeur actuelle ; pas des extrema historiques.</div>':''}<div class="source">Touchez pour ouvrir le graphique détaillé →</div></div>`}
function activeInstrumentId(){return currentScenarioInstrument==='perp'&&isListedXperp(current?.perpId)?current.perpId:current?.id}
async function openDetail(id,market=null,direction=null){leavePage();stopCandleStream();if(graphLiveTimer){clearInterval(graphLiveTimer);graphLiveTimer=null}if(detailLiveTimer){clearInterval(detailLiveTimer);detailLiveTimer=null}current=all.find(x=>x.id===id);if(!current)return;if(current.analysisCoverage==='pending'){alert('Analyse de '+current.sym+' en cours. Son scénario apparaîtra automatiquement dans le classement une fois vérifié.');return}currentScenarioInstrument=market||null;$('home').classList.add('hidden');$('deep').classList.add('hidden');$('detail').classList.remove('hidden');$('detailBody').innerHTML='<div class="empty">Chargement des données…</div>';await detailAsync();refreshFavoriteButtons()}
async function detailAsync(){const page=pageRevision;try{const instrument=activeInstrumentId(),displayPrice=instrument===current.perpId?(current.perpPrice??current.price):current.price;let d={};for(let b of ['5m','15m','1H','4H','1D']){d[b]=await candles(instrument,b,b==='1D'?120:180);if(page!==pageRevision)return;}let c=d['1H'],lo=Math.min(...c.map(x=>x.l)),hi=Math.max(...c.map(x=>x.h)),v=current.volUsd,oi=current.oi,hs=history[current.id]?.samples||[];let mtf=Object.fromEntries(Object.entries(d).map(([tf,cs])=>[tf,timeframeFeatures(cs)]));let mtfConsensus=multiTimeframeConsensus(mtf);let tr=terrain(current.score);$('detailBody').innerHTML=`<div class="favoriteActions"><button class="btn secondary" data-favorite-asset="${esc(current.id)}" onclick="toggleFavoriteAsset('${esc(current.id)}')">${favorites[current.id]?'★ Crypto en favoris':'☆ Garder cette crypto'}</button><button class="smallbtn" onclick="toolPage('favorites')">★ Mes favoris</button></div><nav class="detailJourney" aria-label="Parcours de la fiche"><button class="smallbtn" onclick="scrollToId('summary')">1 · Résumé</button><button class="smallbtn" onclick="openDeep(current.id,'graph')">2 · Graphique direct</button><button class="smallbtn" onclick="scrollToId('trader')">3 · Lecture trader</button><button class="smallbtn" onclick="openDeep(current.id,'scenario')">4 · Scénarios</button></nav><details class="detailExtras"><summary>Analyses supplémentaires</summary><div><button class="smallbtn" onclick="scrollToId('tf')">🕯️ Price Action</button><button class="smallbtn" onclick="openDeep(current.id,'engine')">🧠 Signaux</button><button class="smallbtn" onclick="openDeep(current.id,'context')">🌍 Contexte</button></div></details><div class="panel" id="summary"><div class="sub">${current.tier[1]} • ${instrument} • marché ${timeLabel(current.marketTs)} • OI ${timeLabel(current.oiTs)} • funding ${timeLabel(current.fundingTs)} • analyse ${current.analysisCoverage||'N/D'}</div><h2>${current.sym} — ${tr[0]}</h2><div class="grid"><div class="metric"><small>Prix</small><b>${price(displayPrice)}</b></div><div class="metric"><small>24h</small><b class="${current.chg>=0?'good':'bad'}">${chg(current.chg)}</b></div><div class="metric"><small>Score du classement</small><b>${current.score}/100</b></div><div class="metric"><small>Funding</small><b>${pct(current.funding)}</b></div></div></div><div class="panel" id="trader"><h2>🧠 Lecture trader</h2><div class="scenario"><h3>${current.score>=70?'Configuration à approfondir':'Configuration en attente'}</h3><div class="sub">Prix ${current.chg>=0?'en hausse':'en baisse'} • OI ${current.oiDelta==null?'N/D':(current.oiDelta>=0?'+':'')+current.oiDelta.toFixed(1)+'%'} • funding ${pct(current.funding)}.</div><div class="scenarioInsight"><div class="insightBox"><b class="good">🟢 Ce que je vois</b><span>Le prix est ${current.chg>=0?'en hausse':'en baisse'} sur 24 h (${chg(current.chg)}). OI : ${current.oiDelta==null?'pas assez de recul':(current.oiDelta>=0?'+':'')+current.oiDelta.toFixed(1)+' % depuis le scan précédent'}. Funding : ${pct(current.funding)}.</span></div><div class="insightBox"><b class="bad">🔴 Ce qui me gêne</b><span>${current.analysisCoverage==='complete'?'Le score seul ne valide pas une entrée. Je dois vérifier structure, volume et niveau de prix.':'Analyse incomplète : je ne traite pas ce score comme une configuration validée.'}</span></div></div><div class="scenarioInsight"><div class="insightBox"><b class="blue">🎯 Ce que j’attends</b><span>Un niveau de déclenchement, une clôture confirmée et un stop défini avant d’envisager une entrée. Les niveaux exacts sont dans Scénarios.</span></div><div class="insightBox"><b class="warn">⛔ Quand je laisse tomber</b><span>Si le scénario est invalidé ou si les données sont trop anciennes, je repars d’un scan et d’une lecture du graphique.</span></div></div><div class="click" onclick="openDeep(current.id,'scenario')">🎯 Voir les scénarios et le déclencheur →</div></div></div><details class="panel homeFold detailFold"><summary>📊 Signaux et horizons <small>Radars, confluence et structure multi-horizon</small></summary><div class="foldBody"><div class="panel"><div class="sectionTitle"><h2>📡 Lecture des indicateurs</h2><span class="sub">plusieurs jours → minute</span></div><div class="radars">${radar('Prix',displayPrice,lo,hi,'$','Position dans la plage 1H',c.map(x=>x.c))}${radar('OI',oi,oi==null?null:Math.max(0,oi*.65),oi==null?null:oi*1.35,'$','Niveau actuel + historique des scans',hs.map(x=>x.oi))}${radar('Volume',v,v*.35,v*1.8,'$','Volume 24h en dollars',c.map(x=>x.v))}${radar('Funding',current.funding==null?null:Math.abs(current.funding),0,current.funding==null?null:Math.max(Math.abs(current.funding)*2,.0001),'%','Intensité du financement',hs.map(x=>x.funding==null?null:Math.abs(x.funding)))}${radar('Momentum',Math.abs(current.chg)/100,0,Math.max(Math.abs(current.chg)/50,.01),'%','Amplitude 24h',c.slice(-24).map((x,i,a)=>i?Math.abs((x.c-a[i-1].c)/a[i-1].c):0))}${radar('Score',current.score,0,100,'score','Confluence actuelle',hs.map(x=>x.score).filter(x=>x>0))}</div></div><div class="panel" id="mtf"><h2>🧭 Confluence multi-timeframe</h2><div class="sub">Les timeframes ne pèsent pas tous le même poids : 1D/4H donnent le contexte, 1H/30m structurent la configuration, 15m/5m servent surtout au déclenchement.</div><div class="grid"><div class="metric"><small>Biais dominant</small><b>${mtfConsensus.bias==='bull'?'🟢 LONG':mtfConsensus.bias==='bear'?'🔴 SHORT':'🟡 MIXTE'}</b></div><div class="metric"><small>Alignement</small><b>${mtfConsensus.agreement}/100</b></div><div class="metric"><small>Contradiction</small><b>${mtfConsensus.contradiction}/100</b></div><div class="metric"><small>Lecture</small><b>${esc(mtfConsensus.detail)}</b></div></div><div class="signalList" style="margin-top:10px">${mtfConsensus.rows.map(r=>`<div class="signalRow"><div class="sigText"><b>${r.tf}</b><small>${r.bias==='bull'?'Haussier':r.bias==='bear'?'Baissier':'Neutre'} • ADX ${Number(r.adx||0).toFixed(1)}</small></div><span class="sigBadge ${r.bias==='bull'?'sigPos':r.bias==='bear'?'sigNeg':'sigNeu'}">${r.bias==='bull'?'LONG':r.bias==='bear'?'SHORT':'NEUTRE'}</span></div>`).join('')}</div></div></div></details><div class="panel" id="graph1"><div class="sectionTitle"><h2>📈 Graphique professionnel</h2><button class="smallbtn" onclick="openDeep(current.id,'graph')">Ouvrir en profondeur →</button></div><div class="sub">Bougies OHLC • volume • EMA 20/50 • Supertrend • RSI 14 • StochRSI</div>${proChart(c)}</div><details class="panel homeFold detailFold"><summary>🕯️ Bougies par horizon <small>Structure et Price Action</small></summary><div class="foldBody"><div class="panel" id="tf"><h2>🕯️ Lecture multi-timeframe</h2><div class="candles">${Object.entries(d).map(([b,a])=>{let z=a.at(-1),p=a.at(-2);return `<div class="candle"><b>${b}</b><br>${struct(a)}<br><span class="sub">${pattern(z,p)}</span></div>`}).join('')}</div></div></div></details><details class="panel homeFold detailFold"><summary>🌍 Contexte & acteurs <small>Marché global, dérivés et limites des données</small></summary><div class="foldBody"><div class="panel"><h2>🌍 Contexte & acteurs</h2><div class="scenarioInsight"><div class="insightBox"><b>🌐 Marché</b><span>Le contexte global doit être confronté à BTC/ETH, à la structure et au momentum de l'actif.</span></div><div class="insightBox"><b>📊 Dérivés</b><span>OI et funding donnent le contexte de levier. Ils ne permettent pas à eux seuls d'identifier un acteur institutionnel.</span></div><div class="insightBox"><b>💧 Liquidité & flux</b><span>Les flux publics disponibles sont distingués des interprétations. Aucune banque ou aucun fonds n'est attribué sans donnée indépendante.</span></div><div class="insightBox"><b>🧭 Lecture</b><span>Donnée vérifiée → interprétation → hypothèse. Ces niveaux ne doivent pas être confondus.</span></div></div><div class="click" onclick="openDeep(current.id,'context')">🌍 Ouvrir le contexte détaillé →</div></div></div></details>`;prepareInteractive();if(detailLiveTimer)clearInterval(detailLiveTimer);detailLiveTimer=setInterval(async()=>{try{const fresh=await candles(instrument,'1H',120);if(page!==pageRevision)return;const g=$('graph1');if(g&&fresh.length){g.innerHTML=`<div class="sectionTitle"><h2>📈 Graphique professionnel</h2><button class="smallbtn" onclick="openDeep(current.id,'graph')">Ouvrir en profondeur →</button></div><div class="sub"><span class="liveDot"></span>Graphique consulté le ${clockStamp(Date.now())} • dernière bougie ${clockStamp(fresh.at(-1).t)} • actualisation toutes les 10 s tant que cette fiche est ouverte • OHLC • volume • EMA 20/50 • Supertrend • RSI 14 • StochRSI</div>${proChart(fresh)}`}}catch(_){}},10000)}catch(e){if(page!==pageRevision)return;$('detailBody').innerHTML='<div class="panel">Erreur de chargement : '+esc(e.message)+'</div>'}}
function rangeControls(activeBar='1H',activeDays=1){let dayLabel=d=>d===1?'24H':d+'J';return `<div class="rangeBtns" id="bars">${['1m','5m','15m','1H','4H','1D'].map(x=>`<button class="smallbtn ${x===activeBar?'active':''}" data-bar="${x}">${x}</button>`).join('')}</div><div class="rangeBtns" id="ranges">${[1,3,7,14,30,90].map(d=>`<button class="smallbtn ${d===activeDays?'active':''}" data-days="${d}">${dayLabel(d)}</button>`).join('')}</div>`}
let activeCandleStream=null;
let pageRevision=0;
function leavePage(){pageRevision++;stopScenarioUpdates();stopGraphUpdates();if(detailLiveTimer){clearInterval(detailLiveTimer);detailLiveTimer=null}return pageRevision}
function stopCandleStream(){if(activeCandleStream){activeCandleStream.stop();activeCandleStream=null}}
function stopScenarioUpdates(){if(scenarioMonitorTimer){clearInterval(scenarioMonitorTimer);scenarioMonitorTimer=null}scenarioMonitorSeq++}
function stopGraphUpdates(){stopCandleStream();if(graphLiveTimer){clearInterval(graphLiveTimer);graphLiveTimer=null}}
function subscribeCandleStream(instId,bar,onBar,onState){
 let socket=null,heartbeat=null,retry=null,stopped=false,lastMessageAt=0;
 const setState=message=>{if(!stopped)onState(message)};
 function cleanup(){if(heartbeat)clearInterval(heartbeat);heartbeat=null;if(socket){socket.onclose=null;socket.close();socket=null}}
 function connect(){
  if(stopped)return;
  if(typeof WebSocket==='undefined'){setState('Flux indisponible sur ce navigateur · bougies rafraîchies toutes les 10 s');return}
  setState('Connexion au flux de bougies OKX…');
  try{socket=new WebSocket('wss://ws.okx.com:8443/ws/v5/business')}
  catch(_){setState('Flux indisponible · bougies rafraîchies toutes les 10 s');retry=setTimeout(connect,10000);return}
  socket.onopen=()=>{socket.send(JSON.stringify({op:'subscribe',args:[{channel:'candle'+bar,instId}]}));setState('Flux connecté · en attente de la prochaine bougie');heartbeat=setInterval(()=>{if(socket?.readyState===1){if(lastMessageAt&&Date.now()-lastMessageAt>45000){socket.close();return}socket.send('ping')}},20000)};
  socket.onmessage=e=>{if(e.data==='pong')return;let msg;try{msg=JSON.parse(e.data)}catch(_){return}if(msg.event==='error'){setState('Flux refusé par OKX · rafraîchissement toutes les 10 s');socket.close();return}if(msg.arg?.instId!==instId||msg.arg?.channel!=='candle'+bar)return;for(const a of msg.data||[]){const c={t:+a[0],o:+a[1],h:+a[2],l:+a[3],c:+a[4],v:+a[7],baseVol:+a[5],quoteVol:+a[7],confirm:+a[8]};if([c.t,c.o,c.h,c.l,c.c,c.v].every(Number.isFinite)){lastMessageAt=Date.now();onBar(c)}}setState('● Bougies en direct · dernière réception '+clockStamp(lastMessageAt))};
  socket.onerror=()=>setState('Connexion interrompue · rafraîchissement toutes les 10 s');
  socket.onclose=()=>{if(stopped)return;cleanup();setState('Flux interrompu · rafraîchissement toutes les 10 s');retry=setTimeout(connect,10000)};
 }
 connect();return{stop(){stopped=true;clearTimeout(retry);cleanup()}};
}
async function graphPage(){
 const page=pageRevision;
 let bar='1H',days=7,drawSeq=0,raw=[],lastRender=0,streamRevision=0;const streamUpdates=new Map();
 const instrument=activeInstrumentId();
 function limitForView(){let mins=bar==='1m'?days*24*60:bar==='5m'?days*24*12:bar==='15m'?days*24*4:bar==='1H'?days*24:bar==='4H'?days*6:days;return Math.min(1800,Math.max(2,mins))}
 function show(){if(page!==pageRevision||raw.length<2||!$('garea'))return;const limit=limitForView(),cs=raw.slice(-limit),actualDays=(cs.at(-1).t-cs[0].t)/86400000,coverage=actualDays+0.05>=days?'Couverture complète':'Couverture partielle';$('garea').innerHTML=`<div class="metricGrid"><div class="metric"><small>Plus haut</small><b class="good">${price(Math.max(...cs.map(x=>x.h)))}</b></div><div class="metric"><small>Plus bas</small><b class="bad">${price(Math.min(...cs.map(x=>x.l)))}</b></div><div class="metric"><small>Variation</small><b class="${cs.at(-1).c>=cs[0].o?'good':'bad'}">${chg((cs.at(-1).c/cs[0].o-1)*100)}</b></div></div><div class="callout ${coverage==='Couverture complète'?'goodbox':''}" style="margin:8px 0"><b>${coverage}</b> · ${actualDays.toFixed(1)} J réellement chargés · ${cs.length} bougies.</div>${proChart(cs,raw)}`;$('gmeta').textContent=`${bar} · ${days} jour${days>1?'s':''} demandés · dernière bougie ${clockStamp(cs.at(-1).t)} · consultation ${clockStamp(Date.now())}`;}
 function receive(c){if(page!==pageRevision)return;streamUpdates.set(c.t,++streamRevision);if(streamUpdates.size>1900)streamUpdates.delete(streamUpdates.keys().next().value);const i=raw.findIndex(x=>x.t===c.t);if(i>=0)raw[i]=c;else raw.push(c);raw.sort((a,b)=>a.t-b.t);raw=raw.slice(-1900);if(Date.now()-lastRender>700){lastRender=Date.now();show()}}
 function connect(){stopCandleStream();activeCandleStream=subscribeCandleStream(instrument,bar,receive,text=>{const el=$('liveState');if(el)el.textContent=text})}
 async function draw(){const seq=++drawSeq,startedRevision=streamRevision,limit=limitForView(),warmup=Math.max(40,bar==='1m'?60:40);try{const data=await candles(instrument,bar,Math.min(1800,limit+warmup));if(page!==pageRevision||seq!==drawSeq||!$('garea')||$('deep').classList.contains('hidden'))return;if(data.length){const merged=new Map(data.map(c=>[c.t,c]));for(const c of raw)if(c.t>data.at(-1).t||(streamUpdates.get(c.t)||0)>startedRevision)merged.set(c.t,c);raw=[...merged.values()].sort((a,b)=>a.t-b.t).slice(-1900);show()}else if(!raw.length)$('garea').innerHTML='<div class="empty">Aucune bougie disponible pour cette période.</div>'}catch(err){if(page===pageRevision&&seq===drawSeq&&$('liveState'))$('liveState').textContent='Actualisation impossible · '+String(err.message||err)}}
 $('deepBody').innerHTML=`<button class="btn secondary" onclick="backDetail()">← ${current.sym}</button><div class="panel"><h2>📈 Graphique approfondi — ${current.sym}</h2><div class="sub">Les bougies évoluent via le flux OKX quand la connexion est active. Sinon elles sont redemandées toutes les 10 secondes. Le classement et le score restent ceux du dernier scan.</div>${rangeControls(bar,days)}<div id="gmeta" class="sub" style="margin:8px 0">Chargement…</div><div id="liveState" class="liveStatus" role="status">Connexion…</div><button class="smallbtn" id="graphRefresh" type="button">↻ Recharger les bougies</button><div id="garea"></div><div id="graphSimulator">${scenarioSimPanel({id:"graph-free",free:true,entry:current.price},"long")}</div><div class="panel" style="margin-top:10px;background:#15191f"><b>Comment lire ce graphique</b><div class="sub">Bougies : mouvement du prix. Volume : participation. EMA 20/50 et Supertrend : contexte. RSI et StochRSI : accélération ou excès. Une bougie en cours ne valide pas un scénario avant sa clôture.</div></div></div>`;
 bindScenarioSim();
 $('graphRefresh').onclick=draw;
 document.querySelectorAll('#bars button').forEach(b=>b.onclick=()=>{bar=b.dataset.bar;document.querySelectorAll('#bars button').forEach(x=>x.classList.toggle('active',x===b));raw=[];streamUpdates.clear();$('garea').innerHTML='<div class="empty">Changement de période…</div>';connect();draw()});
 document.querySelectorAll('#ranges button').forEach(b=>b.onclick=()=>{days=+b.dataset.days;document.querySelectorAll('#ranges button').forEach(x=>x.classList.toggle('active',x===b));draw()});
 connect();await draw();if(page!==pageRevision||$('deep').classList.contains('hidden')||!$('garea')||activeInstrumentId()!==instrument)return;if(graphLiveTimer)clearInterval(graphLiveTimer);graphLiveTimer=setInterval(()=>{if(document.visibilityState!=='hidden')draw()},10000)
}
async function openDeep(id,type,metric){const page=leavePage();stopScenarioUpdates();stopGraphUpdates();$('back2').onclick=backDetail;if(detailLiveTimer){clearInterval(detailLiveTimer);detailLiveTimer=null}current=all.find(x=>x.id===id)||current;$('back2').textContent='← '+current.sym;$('detail').classList.add('hidden');$('home').classList.add('hidden');$('deep').classList.remove('hidden');$('deepBody').innerHTML='<div class="empty">Chargement…</div>';if(type==='metric'){await metricPage(metric);return}if(type==='graph'){await graphPage();return}if(type==='engine'){let body=engineHtml();$('deepBody').innerHTML=`<button class="btn secondary" onclick="backDetail()">← ${current.sym}</button><div class="panel"><h2>🧠 Moteur de signaux</h2><div class="sub">Le classement combine le modèle de familles et le moteur multi-horizon. Leurs scores ont des rôles différents.</div></div>${body}`;return}if(type==='scenario'){const targetId=current.id;$('deepBody').innerHTML=`<button class="btn secondary" onclick="backDetail()">← ${current.sym}</button><div class="panel"><h2>🎯 Scénarios</h2><div class="empty">Construction des scénarios…<br><span class="sub">Les données OKX multi-timeframe sont chargées en arrière-plan.</span></div></div>`;scenarioHtml().then(body=>{if(page!==pageRevision||current?.id!==targetId||$('deep').classList.contains('hidden'))return;$('deepBody').innerHTML=`<button class="btn secondary" onclick="backDetail()">← ${current.sym}</button><div class="panel"><h2>🎯 Scénarios</h2></div>${body}`;bindAcc()}).catch(e=>{if(page===pageRevision&&current?.id===targetId&&!$('deep').classList.contains('hidden'))$('deepBody').innerHTML=`<button class="btn secondary" onclick="backDetail()">← ${current.sym}</button><div class="panel"><h2>🎯 Scénarios</h2><div class="empty">Erreur de chargement : ${esc(e.message)}</div></div>`});return}let title=type==='context'?'🌍 Contexte & acteurs':'🎯 Scénarios';let body=type==='context'?contextHtml():await scenarioHtml();if(page!==pageRevision)return;$('deepBody').innerHTML=`<button class="btn secondary" onclick="backDetail()">← ${current.sym}</button><div class="panel"><h2>${title}</h2></div>${body}`;bindAcc()}
function contextHtml(){let btc=all.find(x=>x.sym==='BTC'),eth=all.find(x=>x.sym==='ETH');return `<div class="panel"><h2>🌍 Contexte marché</h2><div class="grid">${btc?`<div class="metric"><small>BTC 24h</small><b class="${btc.chg>=0?'good':'bad'}">${chg(btc.chg)}</b></div>`:''}${eth?`<div class="metric"><small>ETH 24h</small><b class="${eth.chg>=0?'good':'bad'}">${chg(eth.chg)}</b></div>`:''}<div class="metric"><small>Actifs analysés</small><b>${all.length}</b></div><div class="metric"><small>Score actuel</small><b>${current.score}/100</b></div></div><div class="callout"><b>Fait observable :</b> le radar dispose des prix, volumes, OI et funding OKX. <br><b>Non observable directement :</b> l'intention d'une banque ou d'un fonds. Une attribution institutionnelle exige une source publique indépendante.</div></div><div class="panel"><h2>🏦 Flux & acteurs</h2><div class="accordion open"><div class="accHead">Ce que les données permettent de dire <span>−</span></div><div class="accBody">Prix + volume + OI + funding permettent de décrire une configuration de marché et son positionnement sur les dérivés. Ils ne permettent pas, seuls, d'identifier l'acteur précis ni son horizon.</div></div><div class="accordion"><div class="accHead">Ce qu'un trader peut tester <span>＋</span></div><div class="accBody">Continuation, rejet, squeeze, retour sur support ou cassure. Chaque hypothèse doit avoir un déclencheur et une invalidation.</div></div></div>`}

// Technical calculations and scenario engine are loaded from engine-core.js.
function scenarioLevel(label,v,cls=''){return `<div class="levelBox"><small>${label}</small><b class="${cls}">${axisPrice(v)}</b></div>`}
function scenarioCard(title,icon,s,side,condition,next,why,kind){let dir=side==='long'?'LONG':side==='short'?'SHORT':'ATTENTE',risk=s.risk,rr1=s.rr[0],rr2=s.rr[1],rr3=s.rr[2],market=side==='short'||current?.market==='xperp'?'X-PERP':'SPOT';return `<div class="scenarioCard ${side==='short'?'danger':''}"><div class="sectionTitle"><h3>${icon} ${title}</h3><span class="tag ${side==='short'?'r':'b'}">${market} • ${dir}</span></div><div class="scenarioMeta"><span class="tag">Entrée conditionnelle</span><span class="tag">R/R TP1 ${rr1.toFixed(1)}</span><span class="tag">R/R TP2 ${rr2.toFixed(1)}</span><span class="tag">R/R TP3 ${rr3.toFixed(1)}</span></div><div class="scenarioLevels">${scenarioLevel('Entrée',s.entry,'blue')}${scenarioLevel('Stop / invalidation',s.stop,'bad')}${scenarioLevel('TP1',s.tp1,'good')}${scenarioLevel('TP2',s.tp2,'good')}${scenarioLevel('TP3',s.tp3,'good')}${scenarioLevel('Risque / unité',risk,'warn')}</div><div class="scenarioWhy"><b>Déclencheur :</b> ${condition}<br><b>Pourquoi :</b> ${why}<br><b>Invalidation :</b> le stop est franchi avec une clôture confirmée. Dans ce cas, le scénario est abandonné, pas déplacé pour "laisser respirer".</div><div class="monitorOpen"><button class="btn secondary" onclick="scenarioMonitorReturn='detail';openScenarioMonitor('${current.id}','${kind}')">📈 Ouvrir la projection en temps réel →</button></div><div class="nextCheck"><span>⏱️ <b>Prochaine action</b><br><span class="sub">${next}</span></span><span class="tag">À attendre</span></div></div>`}
async function scenarioHtml(){
 const page=pageRevision;
 const sourceId=current.id,targetId=currentScenarioInstrument==='perp'&&isListedXperp(current.perpId)?current.perpId:current.id;
 const safeLoad=async(k,n,ms=7000)=>{try{return await Promise.race([candles(targetId,k,n),new Promise((_,rej)=>setTimeout(()=>rej(Error('timeout')),ms))])}catch(_){return []}};
 // Ne pas bloquer la page sur les 7 timeframes : le moteur peut démarrer avec 3 TF structurantes.
 const frames={};
 for(const [k,n] of [['1D',120],['4H',100],['1H',140],['30m',140],['15m',180],['5m',180]]){frames[k]=await safeLoad(k,n);if(page!==pageRevision||current?.id!==sourceId)throw Error('Analyse interrompue : actif changé');}
 const source={...current,id:targetId,price:targetId===current.perpId?(current.perpPrice||current.price):current.price,marketFresh:false};try{const ticker=(await get('/market/ticker?instId='+encodeURIComponent(targetId)))[0];const bid=nullableNumber(ticker?.bidPx),ask=nullableNumber(ticker?.askPx),ts=nullableNumber(ticker?.ts),last=nullableNumber(ticker?.last);source.marketFresh=!!(last>0&&bid>0&&ask>=bid&&ts&&Date.now()-ts<120000);if(source.marketFresh){source.price=last;source.marketTs=ts;source.spreadPct=(ask-bid)/((ask+bid)/2)*100;if(source.market==='spot'){const book=(await get('/market/books?instId='+encodeURIComponent(targetId)+'&sz=20'))[0];source.bookDepth=bookDepthUsd(book,(bid+ask)/2)}}}catch(_){source.bookDepth=null}if(page!==pageRevision)return '';let e=adaptiveEngine(frames,source); if(e)e.directional=directionalAssessment(e,source);
 
 if(!e){if(scenarioCandidates().some(candidate=>candidate.x.id===current.id)){current.marketFresh=false;renderRank()}return `<div class="panel"><div class="empty">Le scénario du classement n’est plus confirmé : bougies insuffisantes après actualisation. Cette crypto a été retirée du Top. Relance le scan pour recalculer.<br><span class="sub"><br><span class="sub">Les données disponibles n'ont pas permis de constituer au moins deux timeframes exploitables.</span></div></div>`}
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
 const proposedKind=chooseFreshScenario(e,null);
 const execution=executionCheck(source);
 const primaryKind=execution.ok&&proposedKind&&(!isShortScenarioKind(proposedKind)||isListedXperp(current.perpId))?proposedKind:null;
 // Rechecking the market can invalidate a candidate from the completed scan.
 const changedSinceScan=!primaryKind&&scenarioCandidates().some(candidate=>candidate.x.id===current.id);
 if(changedSinceScan){current.marketFresh=false;renderRank()}
 const changedNotice=changedSinceScan?'<div class="panel"><div class="callout"><b>Le scénario du classement n’est plus confirmé.</b><br>Le prix, les bougies ou la liquidité ont changé depuis le scan. Cette crypto vient d’être retirée du Top ; relance le scan pour recalculer le classement.</div></div>':'';
 const primaryLabel=primaryKind?scenarioActionLabel(primaryKind):'AUCUN SCÉNARIO ACTUEL';
 const instrumentAvailability=current.market==='xperp'?'X-Perp • '+current.id:isListedXperp(current.perpId)?'Perp identifié':'Spot uniquement';
 const breakoutNext=`Prochaine clôture ${e.triggerKey} : vérifier cassure + volume, puis retest.`;
 const pullNext=`Prochaine clôture ${e.triggerKey} : vérifier défense du support et rejet.`;
 const shortNext=`Prochaine clôture ${e.triggerKey} : vérifier cassure sous support + volume.`;
 const breakoutWhy=`résistance ${axisPrice(e.levels.resistance)}; ancrage ${e.anchorKey} ${e.anchor.t.label}; le moteur croise ${e.signals.length} signaux et n’utilise pas les seuls signaux favorables.`;
 const pullWhy=`support ${axisPrice(e.levels.support)}; le scénario attend une défense mesurable du niveau plutôt qu’une entrée au milieu de la plage.`;
 const shortWhy=`support ${axisPrice(e.levels.support)}; le scénario ne devient pertinent que si la structure baissière et la confirmation apparaissent.`;
 return `${changedNotice}<div class="panel"><div class="scenarioHero"><div class="scenarioState"><div class="sub">${current.sym} • analyse adaptative</div><div class="scenarioMeta"><span class="tag ${primaryKind?'g':'y'}">🎯 SCÉNARIO ACTUEL : ${primaryLabel}</span><span class="tag">${instrumentAvailability}</span></div><div class="state ${readinessClass}">${readiness}</div><div class="sub" style="margin-top:5px">${axisPrice(e.live)} • ancrage ${e.anchorKey} • déclencheur ${e.triggerKey} • moteur partagé ${e.score}/100 • LONG ${e.directional.longScore} / SHORT ${e.directional.shortScore}</div></div><div class="scenarioState"><div class="sub">Lecture globale</div><div class="signalSummary"><div class="signalCount signalGood"><b>${c.positive}</b><span>favorables</span></div><div class="signalCount signalBad"><b>${c.negative}</b><span>défavorables</span></div><div class="signalCount signalWarn"><b>${c.warning}</b><span>à surveiller</span></div><div class="signalCount signalNeutral"><b>${c.neutral}</b><span>neutres</span></div></div></div></div><div class="nextCheck"><span>🧭 <b>Exécution :</b> ${esc(execution.reason)}${source.spreadPct!=null?' • écart '+source.spreadPct.toFixed(2)+' %':''}<br><span class="sub">La profondeur du carnet et le glissement réel restent à vérifier sur OKX avant tout ordre.</span></span><span class="tag">${execution.ok?'À vérifier':'À attendre'}</span></div></div>
 <div class="panel"><h2>🧠 Tous les signaux</h2><div class="sub">Aucun signal défavorable n’est masqué. Les signaux sont regroupés par familles pour la lecture. Certains restent corrélés dans le calcul actuel.</div><div class="signalList">${signalsHtml}</div></div>
 <div class="panel"><h2>🧭 Lecture directionnelle</h2><div class="grid"><div class="metric"><small>Score LONG</small><b class="good">${e.directional.longScore}/100</b><div class="foot">Force de la configuration acheteuse</div></div><div class="metric"><small>Score SHORT</small><b class="bad">${e.directional.shortScore}/100</b><div class="foot">Force de la configuration vendeuse${current.hasPerp?'':' • non tradée en spot'}</div></div><div class="metric"><small>Écart</small><b>${e.directional.spread}/100</b></div><div class="metric"><small>Produit</small><b>${current.market==='xperp'?'X-PERP':isListedXperp(current.perpId)?'SPOT + PERP':'SPOT seulement'}</b></div></div></div>
 <div class="panel"><h2>🎯 Ce que tu dois attendre</h2><div class="scenarioChecklist">${checklistHtml}</div><div class="foot">Les cases décrivent l’état des données. Le scénario devient activé uniquement lorsque son déclencheur et ses confirmations sont réellement remplis.</div></div>
 <div class="panel"><h2>🎯 Ce que tu fais si ce scénario se déclenche</h2><div class="scenarioActionGrid"><div class="scenarioLevelWide"><small>INSTRUMENT</small><b>${primaryKind?scenarioMarket(primaryKind).toUpperCase():'—'}</b></div><div class="scenarioLevelWide"><small>DIRECTION</small><b class="${primaryKind&&isShortScenarioKind(primaryKind)?'bad':'good'}">${primaryKind?(scenarioDirection(primaryKind)==='short'?'🔴 SHORT':'🟢 LONG'):'ATTENTE'}</b></div><div class="scenarioLevelWide"><small>ACTION</small><b>${primaryKind?(scenarioDirection(primaryKind)==='short'?'Attendre la confirmation vendeuse':'Attendre la confirmation acheteuse'):'Ne rien faire'}</b></div></div><div class="foot">Le type de marché et la direction ci-dessus décrivent le scénario réellement retenu. Le badge de disponibilité d’un Perp ne constitue pas une proposition de trade.</div></div>
 <div class="panel"><h2>🎯 Scénarios chiffrés</h2><div class="sub">Chaque scénario est une hypothèse conditionnelle. Clique dessus pour afficher la projection sur les bougies et suivre le déclencheur.</div>
 ${e.longSetup&&scenarioValid('breakout',e.breakout,e.live)?scenarioCard('Cassure + retest','🟢',e.breakout,'long',`clôture de ${e.triggerKey} au-dessus de ${axisPrice(e.breakout.entry)} puis maintien/retest.`,breakoutNext,breakoutWhy,'breakout'):''}
 ${e.longSetup&&scenarioValid('pullback',e.pullback,e.live)?scenarioCard('Rebond sur support','🟡',e.pullback,'long',`retour vers ${axisPrice(e.pullback.entry)} puis défense du support ${axisPrice(e.levels.support)}.`,pullNext,pullWhy,'pullback'):''}
 ${isListedXperp(current.perpId)&&e.shortSetup&&e.rejectionValid?scenarioCard('Rejet / retest de résistance','🟠',e.shortRejection,'short',`rejet de la résistance ${axisPrice(e.levels.resistance)} puis clôture de ${e.triggerKey} sous ${axisPrice(e.shortRejection.entry)}.`,`Prochaine clôture ${e.triggerKey} : vérifier rejet + reprise de pression vendeuse.`,shortWhy,'rejection'):''}
 ${isListedXperp(current.perpId)&&e.shortSetup&&e.breakdownValid?scenarioCard('Cassure baissière','🔴',e.breakdown,'short',`clôture de ${e.triggerKey} sous ${axisPrice(e.breakdown.entry)} avec confirmation.`,shortNext,shortWhy,'breakdown'):''}
 ${!e.longValid&&!isListedXperp(current.perpId)?`<div class="decision"><b>Pas de scénario directionnel suffisamment propre.</b><br>Le Radar préfère attendre plutôt que fabriquer une entrée.</div>`:''}
 </div>
 <div class="panel"><h2>🧮 Risque avant gain</h2><div class="callout">Quand un scénario est activé, passe d’abord par la simulation : capital, risque maximal, distance entrée→stop et taille de position. Les niveaux ne tiennent pas compte des frais, du slippage ou du funding futur.</div></div>`;
}

let scenarioMonitorTimer=null,scenarioMonitorSeq=0,scenarioMonitorFrames={},scenarioMonitorBar='15m',scenarioMonitorZoom=90,scenarioMonitorKind=null,scenarioMonitorReturn='detail',graphLiveTimer=null,detailLiveTimer=null;
const scenarioLocks=recordMap(STORAGE.locks);
let favorites=recordMap(STORAGE.favorites);
for(const [id,f] of Object.entries(favorites)){if(!f.asset||typeof f.asset.id!=='string'){delete favorites[id];continue}if(!f.scenarios||typeof f.scenarios!=='object'||Array.isArray(f.scenarios))f.scenarios={};}
if(!favorites||typeof favorites!=='object'||Array.isArray(favorites))favorites={};
function saveFavorites(){return persistJSON(STORAGE.favorites,favorites)}
function favoriteAsset(x){return {id:x.id,sym:x.sym,perpId:x.perpId||null,price:x.price,perpPrice:x.perpPrice,vol:x.vol,volUsd:x.volUsd,chg:x.chg,oi:x.oi,funding:x.funding,score:x.score,tier:x.tier,hasPerp:!!x.perpId,market:x.market||'spot'}}
function toggleFavoriteAsset(id){const previous=JSON.stringify(favorites);const x=all.find(a=>a.id===id)||current;if(!x||x.id!==id)return;if(favorites[id])delete favorites[id];else favorites[id]={asset:favoriteAsset(x),scenarios:{}};if(!saveFavorites()){favorites=JSON.parse(previous);return}refreshFavoriteButtons();if($('favoritesBody'))renderFavorites()}
function toggleFavoriteScenario(id,kind){const previous=JSON.stringify(favorites);const x=all.find(a=>a.id===id)||current,lock=scenarioLocks[scenarioLockKey(id,kind)];if(!x||x.id!==id||!lock)return;const f=favorites[id]||{asset:favoriteAsset(x),scenarios:{}};f.scenarios||={};if(f.scenarios[kind]===lock.id)delete f.scenarios[kind];else f.scenarios[kind]=lock.id;favorites[id]=f;if(!saveFavorites()){favorites=JSON.parse(previous);return}refreshFavoriteButtons();if($('favoritesBody'))renderFavorites()}
function refreshFavoriteButtons(){document.querySelectorAll('[data-favorite-asset]').forEach(b=>{const yes=!!favorites[b.dataset.favoriteAsset];b.textContent=yes?'★ Crypto en favoris':'☆ Garder cette crypto';b.setAttribute('aria-pressed',String(yes))});document.querySelectorAll('[data-favorite-scenario]').forEach(b=>{const [id,kind]=b.dataset.favoriteScenario.split('::'),yes=favorites[id]?.scenarios?.[kind]===scenarioLocks[scenarioLockKey(id,kind)]?.id;b.textContent=yes?'★ Scénario enregistré':'☆ Garder ce scénario';b.setAttribute('aria-pressed',String(!!yes))})}
async function openFavorite(id,kind=null){const page=leavePage();const f=favorites[id];if(!f)return;const contractId=f.asset.market==='xperp'?f.asset.id:(kind&&isShortScenarioKind(kind)?f.asset.perpId:null);if(contractId){let listed=false;try{const instruments=await get('/public/instruments?instType=FUTURES');listed=instruments.some(i=>i.instId===contractId&&i.ruleType==='xperp'&&i.state==='live'&&isListedXperp(i.instId))}catch(_){}if(page!==pageRevision)return;if(!listed){toolPage('favorites');$('deepBody').insertAdjacentHTML('afterbegin','<div class="panel">Contrat indisponible ou listing non vérifié. Les niveaux enregistrés restent conservés.</div>');return}}let x=all.find(a=>a.id===id);if(!x){x={...f.asset};try{const spot=await get('/market/ticker?instId='+encodeURIComponent(id));if(spot?.[0]?.last)x.price=n(spot[0].last);if(x.perpId){const perp=await get('/market/ticker?instId='+encodeURIComponent(x.perpId));if(perp?.[0]?.last)x.perpPrice=n(perp[0].last)}}catch(_){ }if(page!==pageRevision)return;all.push(x)}if(page!==pageRevision)return;current=x;if(kind){const lock=scenarioLocks[scenarioLockKey(id,kind)];if(!lock||f.scenarios?.[kind]!==lock.id)return;currentScenarioInstrument=lock.market;scenarioMonitorReturn='favorites';await openScenarioMonitor(id,kind)}else await openDetail(id)}
function renderFavorites(){const root=$('favoritesBody');if(!root)return;const journal=loadScenarioJournal(),items=Object.values(favorites);root.innerHTML=items.length?items.map(f=>{const x=f.asset,scenarios=Object.entries(f.scenarios||{}).map(([kind,lockId])=>{const lock=scenarioLocks[scenarioLockKey(x.id,kind)],rec=journal.find(r=>r.id===lockId),active=lock?.id===lockId&&(!isShortScenarioKind(kind)||isListedXperp(x.perpId))&&(!rec||rec.status==='FORMING'||rec.status==='ACTIVATED');return `<div class="favoriteScenario"><b>${kind==='rejection'?'Rejet de résistance':kind==='breakdown'?'Cassure baissière':kind==='breakout'?'Cassure haussière':'Rebond sur support'} • ${rec?.status==='CLOSED'?'Terminé':rec?.status==='CANCELLED'?'Annulé':rec?.status==='UNVERIFIED'?'Suivi incomplet':active?rec?.status==='ACTIVATED'?'Activé':'En formation':isShortScenarioKind(kind)?'Contrat absent du marché X-Perp public':'Ancien scénario'}</b><div class="sub">Entrée ${price((lock?.id===lockId?lock.entry:rec?.entry))} • Stop ${price((lock?.id===lockId?lock.stop:rec?.stop))} • TP1 ${price((lock?.id===lockId?lock.tp1:rec?.tp1))}</div>${active?`<button class="btn secondary" onclick="openFavorite('${esc(x.id)}','${esc(kind)}')">📈 Reprendre ce scénario</button>`:''}<button class="smallbtn" onclick="deleteFavoriteScenario('${esc(x.id)}','${esc(kind)}')">Retirer ce scénario des favoris</button></div>`}).join('');return `<div class="panel"><h3>★ ${esc(x.sym)}</h3><div class="sub">${esc(x.id)} • Favori enregistré sur cet appareil</div><div class="favoriteActions"><button class="btn" onclick="openFavorite('${esc(x.id)}')">Voir la crypto</button><button class="smallbtn" onclick="toggleFavoriteAsset('${esc(x.id)}')">Retirer la crypto</button></div>${scenarios}</div>`}).join(''):'<div class="panel"><div class="empty">Aucun favori pour le moment. Ajoute une crypto depuis son analyse ou un scénario depuis sa projection.</div></div>'}
function deleteFavoriteScenario(id,kind){if(!favorites[id])return;const previous=JSON.stringify(favorites);delete favorites[id].scenarios?.[kind];if(!saveFavorites())favorites=JSON.parse(previous);renderFavorites()}
function favoritesPage(){return `<button class="btn secondary" onclick="backHome()">← Radar</button><div class="panel"><h2>★ Mes favoris</h2><div class="sub">Cryptos et scénarios enregistrés sur cet appareil. Un scénario en cours garde ses niveaux verrouillés ; son état est revérifié à l’ouverture.</div></div><div id="favoritesBody"></div>`}
function saveScenarioLocks(){return persistJSON(STORAGE.locks,scenarioLocks)}
function scenarioLockKey(id,kind){return id+'::'+kind}
function loadScenarioJournal(){const j=safeJSON(STORAGE.learning,[]);return Array.isArray(j)?j.filter(x=>x&&typeof x==='object'&&typeof x.id==='string'&&typeof x.status==='string'):[]}
function saveScenarioJournal(a){return persistJSON(STORAGE.learning,a.slice(-1500))}
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
 j.push(rec);return saveScenarioJournal(j)?rec:null
}
function journalUpdate(id,patch){const j=loadScenarioJournal(),i=j.findIndex(x=>x.id===id);if(i<0)return null;Object.assign(j[i],patch);saveScenarioJournal(j);return j[i]}
function timeframeMs(bar){return {'1m':60000,'5m':300000,'15m':900000,'30m':1800000,'1H':3600000,'4H':14400000,'1D':86400000}[bar]||900000}
function verifiedObservation(r){return r?.status==='CLOSED'&&r?.schema==='IR_LEARNING_V3'&&r?.activatedAt!=null&&r?.outcome?.source==='CONFIRMED_CANDLE'&&Number.isFinite(r.outcome.r)}
// Record only completed bars following a confirmed conditional entry. This is a
// model observation, not proof that the user placed or filled an exchange order.
function journalAdvance(lock,side,bars,activated,barMs,now=Date.now()){
 const j=loadScenarioJournal(),rec=j.find(x=>x.id===lock.id);
 if(!rec||rec.status==='CLOSED'||rec.status==='CANCELLED')return rec||null;
 const complete=(bars||[]).filter(b=>Number.isFinite(b.t)&&Number(b.confirm)===1&&b.t+barMs<=now).sort((a,b)=>a.t-b.t);
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
   const previous=Math.max(rec.activatedBarTs,rec.lastProcessedBarTs||0);
   if(bar.t>previous+barMs){rec.status='UNVERIFIED';rec.unverifiedReason='Bougies manquantes pendant le suivi';break}
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
 const s=learningStats(),closed=s.journal.filter(verifiedObservation);
 const byDir={long:[],short:[]};closed.forEach(r=>{if(byDir[r.direction])byDir[r.direction].push(r)});
 const summarize=a=>{const n=a.length,sl=a.filter(r=>r.outcome.status==='SL').length,tp=a.filter(r=>/^TP/.test(r.outcome.status)).length,avgR=n?a.reduce((z,r)=>z+(Number(r.outcome.r)||0),0)/n:0,rate=n?tp/n:0;return {n,hitRate:rate,slRate:n?sl/n:0,avgR,ci:wilson(rate,n),sampleReady:n>=30}};
 const configs=Object.entries(s.groups).map(([key,g])=>({key,n:g.n,tpRate:g.tpRate,avgR:g.avgR,ci:wilson(g.tpRate,g.n),sampleReady:g.n>=20})).sort((a,b)=>b.avgR-a.avgR);
 return {sample:closed.length,long:summarize(byDir.long),short:summarize(byDir.short),configs,ready:closed.length>=30};
}
function exportLearningJson(){const payload={schema:'IR_LEARNING_V3',exportedAt:new Date().toISOString(),app:APP_VERSION,storage:STORAGE.learning,journal:loadScenarioJournal()};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='institutional-radar-learning-'+APP_VERSION.toLowerCase().replace(/[^0-9a-z]+/g,'-')+'-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function validateLearningImport(obj){
 const incoming=Array.isArray(obj)?obj:obj?.journal;
 if(!Array.isArray(incoming))throw Error('Format invalide : journal attendu');
 const seen=new Set(),states=['FORMING','ACTIVATED','CLOSED','CANCELLED','UNVERIFIED'];
 for(const r of incoming){
  if(!r||typeof r!=='object'||Array.isArray(r)||typeof r.id!=='string'||!r.id.trim()||!states.includes(r.status)||seen.has(r.id))throw Error('Observation invalide ou identifiant dupliqué');
  if(r.direction!=null&&!['long','short'].includes(r.direction))throw Error('Direction invalide');
  for(const k of ['entry','stop','tp1','tp2','tp3'])if(r[k]!=null&&(!Number.isFinite(r[k])||r[k]<=0))throw Error('Niveau invalide : '+k);
  if(r.outcome!=null&&(typeof r.outcome!=='object'||Array.isArray(r.outcome)||(r.outcome.r!=null&&!Number.isFinite(r.outcome.r))))throw Error('Résultat invalide');
  seen.add(r.id);
 }
 return incoming;
}
function importLearningJson(){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{const f=input.files?.[0];if(!f)return;try{const obj=JSON.parse(await f.text()),incoming=validateLearningImport(obj);const existing=loadScenarioJournal(),map=new Map(existing.map(x=>[x.id,x]));incoming.forEach(x=>{if(x?.id)map.set(x.id,x)});if(!saveScenarioJournal([...map.values()]))throw Error('Stockage indisponible');alert(`${incoming.length} observations importées.`);toolPage('memory')}catch(e){alert('Import impossible : '+e.message)}};input.click()}
function labLearningReport(){const s=learningStats(),groups=Object.entries(s.groups).sort((a,b)=>b[1].n-a[1].n),proposal=learningProposal();return {sample:s.closed,legacy:s.legacy,groups,ready:s.closed>=30,proposal}}
function learningHtml(){const r=labLearningReport();const rows=r.groups.map(([k,g])=>`<div class="metric"><small>${esc(k)}</small><b>${g.n} résultats</b><div class="foot">TP1 ${g.tp1} • TP2 ${g.tp2} • TP3 ${g.tp3} • SL ${g.sl} • R moyen ${g.avgR.toFixed(2)} • score ${g.avgScore.toFixed(0)}</div></div>`).join('');return `<div class="panel"><div class="sectionTitle"><div><h2>🧬 Mémoire des configurations</h2><div class="sub">Chaque scénario suivi conserve son contexte de marché et ses niveaux. Les résultats sont des observations de bougies après déclenchement, pas des trades exécutés. Ces données restent locales jusqu'à export. Le suivi fonctionne uniquement avec la projection ouverte et se termine au premier TP1 ou SL. TP2/TP3, sorties partielles et expiration ne sont pas suivis automatiquement.</div></div><span class="tag b">IR_LEARNING_V3</span></div><div class="toolbar"><button class="btn" onclick="exportLearningJson()">⬇️ Exporter les données d'apprentissage</button><button class="btn secondary" onclick="importLearningJson()">⬆️ Importer un historique</button></div><div class="grid"><div class="metric"><small>Résultats vérifiables</small><b>${r.sample}</b><small>${r.legacy} anciens résultats archivés, exclus des statistiques</small></div><div class="metric"><small>Repère descriptif : 30 observations</small><b>${r.ready?'Repère atteint':'⏳ '+Math.max(0,30-r.sample)+' à construire'}</b></div><div class="metric"><small>LONG</small><b class="good">${r.proposal.long.n} • ${(r.proposal.long.hitRate*100).toFixed(0)}% TP</b></div><div class="metric"><small>SHORT</small><b class="bad">${r.proposal.short.n} • ${(r.proposal.short.hitRate*100).toFixed(0)}% TP</b></div></div></div><div class="panel"><h2>📚 Résultats par configuration</h2>${rows||'<div class="empty">Aucun résultat réel enregistré pour le moment. Le journal se nourrit lorsque les scénarios sont suivis et que des bougies clôturées confirment une entrée puis un résultat. Les anciens résultats restent archivés mais exclus des statistiques.</div>'}</div><div class="panel"><h2>🧠 Proposition d'apprentissage</h2><div class="grid"><div class="metric"><small>LONG • R moyen</small><b>${r.proposal.long.avgR.toFixed(2)}R</b></div><div class="metric"><small>SHORT • R moyen</small><b>${r.proposal.short.avgR.toFixed(2)}R</b></div><div class="metric"><small>LONG • invalidations</small><b>${(r.proposal.long.slRate*100).toFixed(0)}%</b></div><div class="metric"><small>SHORT • invalidations</small><b>${(r.proposal.short.slRate*100).toFixed(0)}%</b></div></div><div class="callout ${r.ready?'goodbox':''}"><b>${r.ready?'Lecture descriptive disponible':'⏳ Observation uniquement'}</b><br>Le moteur ne réécrit pas ses règles à partir de ces statistiques. Le repère de 30 observations ne prouve ni indépendance ni rentabilité. Ces statistiques pourront servir à formuler des hypothèses à tester après validation du protocole.</div></div><div class="panel"><h2>🛡️ Gouvernance</h2><div class="callout goodbox"><b>Le Radar observe avant d'apprendre.</b><br>Les résultats réels ne modifient jamais directement le code. Une amélioration doit être formulée comme hypothèse, testée hors échantillon, puis validée avant adoption.</div></div>`}
function clearScenarioLock(id,kind){const key=scenarioLockKey(id,kind),old=scenarioLocks[key];if(old){const rec=loadScenarioJournal().find(x=>x.id===old.id);if(rec&&(rec.status==='FORMING'||rec.status==='ACTIVATED'))journalUpdate(old.id,{status:'CANCELLED',cancelledAt:Date.now(),cancelReason:'USER_RESET'})}delete scenarioLocks[key];saveScenarioLocks()}
function isShortScenarioKind(kind){return kind==='breakdown'||kind==='rejection'}
function scenarioValid(kind,sc,live){
 if(!sc||!Number.isFinite(live)||live<=0)return false;
 const short=isShortScenarioKind(kind);
 const targets=[sc.tp1,sc.tp2,sc.tp3].filter(x=>x!==undefined);
 if(![sc.entry,sc.stop,...targets].every(x=>Number.isFinite(x)&&x>0)||sc.tp1===undefined)return false;
 if(sc.tp3!==undefined&&sc.tp2===undefined)return false;
 if(targets.some((x,i)=>i>0&&(short?x>targets[i-1]:x<targets[i-1])))return false;
 if(short){if(!(sc.stop>sc.entry&&sc.entry>sc.tp1))return false;return live>sc.entry&&live<sc.stop}
 if(!(sc.stop<sc.entry&&sc.entry<sc.tp1))return false;
 return live<sc.entry&&live>sc.stop;
}
function scenarioMarket(kind){return isShortScenarioKind(kind)||current?.market==='xperp'?'perp':'spot'}
function scenarioDirection(kind){return isShortScenarioKind(kind)?'short':'long'}
function scenarioLevelsFromEngine(e,kind){return e?.[kind==='rejection'?'shortRejection':kind]}
function scenarioActionLabel(kind){const m=scenarioMarket(kind),d=scenarioDirection(kind);return `${m==='perp'?'⚡ PERP':'💰 SPOT'} • ${d==='short'?'🔴 SHORT':'🟢 LONG'}`}
function scenarioLockFromEngine(e,kind){
 const sc=scenarioLevelsFromEngine(e,kind);if(!sc||!scenarioValid(kind,sc,e.live))return null;
 return {id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),kind,market:scenarioMarket(kind),direction:scenarioDirection(kind),createdAt:Date.now(),anchorKey:e.anchorKey,triggerKey:e.triggerKey,entry:sc.entry,stop:sc.stop,tp1:sc.tp1,tp2:sc.tp2,tp3:sc.tp3,risk:sc.risk,rr:[...sc.rr],score:e.score,signals:e.signals.map(s=>({...s})),confluences:[...e.confluences]};
}
function chooseFreshScenario(e,preferred){
 const shortScore=e?.directional?.shortScore||0,longScore=e?.directional?.longScore||0;
 const shortFirst=shortScore>longScore;
 const base=shortFirst?['rejection','breakdown','breakout','pullback']:['breakout','pullback','rejection','breakdown'];
 const order=[preferred,...base].filter((x,i,a)=>x&&a.indexOf(x)===i);
 for(const k of order){
  const allowed=isShortScenarioKind(k)?e?.shortSetup:e?.longSetup;
  const sc=scenarioLevelsFromEngine(e,k);
  if(sc&&allowed&&scenarioValid(k,sc,e.live))return k;
 }
 return null;
}

async function openScenarioMonitor(id,kind){
 const page=leavePage();
 current=all.find(x=>x.id===id)||current;if(!current)return;
 if(isShortScenarioKind(kind)&&!isListedXperp(current.perpId)){toolPage('favorites');$('deepBody').insertAdjacentHTML('afterbegin','<div class="panel"><b>Projection Perp non disponible</b><div class="sub">Ce contrat ne figure pas parmi les X-Perps publics pris en charge. Les anciens niveaux restent enregistrés comme historique, sans proposition de trade.</div></div>');return}
 $('back2').onclick=closeScenarioMonitor;
 $('detail').classList.add('hidden');$('home').classList.add('hidden');$('deep').classList.remove('hidden');
 $('deepBody').innerHTML='<div class="panel"><div class="empty">Construction de la projection…<br><span class="sub">Chargement des données OKX multi-timeframe.</span></div></div>';
 if(scenarioMonitorTimer)clearInterval(scenarioMonitorTimer);
 scenarioMonitorFrames={};scenarioMonitorBar='15m';scenarioMonitorZoom=90;scenarioMonitorKind=kind;
 await renderScenarioMonitor(kind,true);
 if(page!==pageRevision)return;
 scenarioMonitorTimer=setInterval(()=>renderScenarioMonitor(kind,false),10000)
}
function closeScenarioMonitor(){leavePage();if(scenarioMonitorTimer){clearInterval(scenarioMonitorTimer);scenarioMonitorTimer=null}scenarioMonitorSeq++;scenarioMonitorFrames={};scenarioMonitorKind=null;if(scenarioMonitorReturn==='favorites'){scenarioMonitorReturn='detail';toolPage('favorites')}else backDetail()}
async function resetScenarioMonitor(kind){clearScenarioLock(current.id,kind);scenarioMonitorKind=kind;scenarioMonitorFrames={};scenarioMonitorZoom=90;await renderScenarioMonitor(kind,true)}
async function setScenarioMonitorBar(kind,bar){scenarioMonitorBar=bar;await renderScenarioMonitor(kind,false)}
async function zoomScenarioMonitor(kind,delta){scenarioMonitorZoom=Math.max(30,Math.min(240,scenarioMonitorZoom+delta));await renderScenarioMonitor(kind,false)}
function monitorTriggerStatus(v){
 const missing=[];
 if(!v.triggerClose)missing.push(`une clôture ${v.triggerKey} au-delà du seuil`);
 if(!v.volOk)missing.push(v.volRatio==null?'le volume (indisponible)':`le volume (${v.volRatio.toFixed(2)}× / 1,15× requis)`);
 if(!v.trendOk)missing.push('un biais compatible');
 if(v.invalid)return {state:'red',label:'SCÉNARIO INVALIDÉ',reason:`Le prix a franchi l’invalidation ${axisPrice(v.stop)}.`};
 if(v.crossed&&!missing.length)return {state:'green',label:'SCÉNARIO ACTIVÉ',reason:'Seuil franchi, clôture, volume et biais confirmés.'};
 if(v.crossed)return {state:'yellow',label:'SEUIL FRANCHI · CONFIRMATION ATTENDUE',reason:`Le prix a franchi ${axisPrice(v.entry)}. Il manque ${missing.join(' ; ')}.`};
 return {state:v.near?'yellow':'orange',label:v.near?'DÉCLENCHEUR PROCHE':'EN FORMATION',reason:`Le prix n’est pas au-delà du déclencheur ${axisPrice(v.entry)}.${missing.length?' Ensuite, il faudra confirmer : '+missing.join(' ; ')+'.':''}`};
}
async function renderScenarioMonitor(kind,initial=false){kind=scenarioMonitorKind||kind;const page=pageRevision,seq=++scenarioMonitorSeq;const abandoned=()=>page!==pageRevision||seq!==scenarioMonitorSeq;try{
 if(initial){
  const sourceId=current.id,targetId=isShortScenarioKind(kind)?current.perpId:(currentScenarioInstrument==='perp'&&isListedXperp(current.perpId)?current.perpId:current.id);
  if(!targetId)throw Error('Perp indisponible pour ce scénario');
  const safeLoad=async(k,n,ms=7000)=>{try{return await Promise.race([candles(targetId,k,n),new Promise((_,rej)=>setTimeout(()=>rej(Error('timeout')),ms))])}catch(_){return []}};
  // MTF complet : 1D/4H = contexte, 1H/30m = structure, 15m/5m = déclenchement.
  // On ne charge pas 1m au démarrage : il reste disponible dans la projection comme micro-TF.
  const entries=await Promise.all([
   ['1D',90],['4H',90],['1H',120],['30m',120],['15m',180],['5m',180]
  ].map(async x=>[x[0],await safeLoad(x[0],x[1])]));
  if(page!==pageRevision||current?.id!==sourceId)throw Error('Projection interrompue : actif changé');
  if(abandoned())return;scenarioMonitorFrames=Object.fromEntries(entries);
  const usable=Object.values(scenarioMonitorFrames).filter(x=>x?.length>=40).length;
  if(usable<2)throw Error('Données OKX insuffisantes pour construire la projection');
 }
 const marketInstId=isShortScenarioKind(kind)?current.perpId:(currentScenarioInstrument==='perp'&&isListedXperp(current.perpId)?current.perpId:current.id);
 let tickerFresh=false,tickerTs=null,live=marketInstId===current.perpId?(current.perpPrice||current.price):current.price;try{const t=(await get('/market/ticker?instId='+encodeURIComponent(marketInstId)))[0],p=nullableNumber(t?.last);if(p>0){live=p;tickerTs=nullableNumber(t.ts);tickerFresh=tickerTs!=null&&Date.now()-tickerTs>=0&&Date.now()-tickerTs<120000}}catch(_){ }
 if(abandoned())return;
 // Refresh the trigger and the visible timeframe so the monitor is genuinely live.
 const refreshBars=new Set([scenarioMonitorBar]);if(scenarioLocks[scenarioLockKey(current.id,kind)]?.triggerKey)refreshBars.add(scenarioLocks[scenarioLockKey(current.id,kind)].triggerKey);
 for(const b of refreshBars){const loaded=await candles(marketInstId,b,b==='1m'?300:180);if(abandoned())return;scenarioMonitorFrames[b]=loaded;}
 const e=adaptiveEngine(scenarioMonitorFrames,{...current,id:marketInstId,price:live});if(abandoned()||!e)return;
 let actualKind=kind;const lockKey=scenarioLockKey(current.id,actualKind);let lock=scenarioLocks[lockKey];
 if(!lock){const candidate=scenarioLevelsFromEngine(e,kind);actualKind=candidate&&(isShortScenarioKind(kind)?e.shortSetup:e.longSetup)&&scenarioValid(kind,candidate,e.live)?kind:null;if(!actualKind){$('deepBody').innerHTML=`<button class="btn secondary" onclick="closeScenarioMonitor()">← Scénarios</button><div class="panel"><div class="monitorAction bad"><div class="actionTitle">🔴 AUCUNE CONFIGURATION VALIDE</div><div class="monitorSub">Le moteur refuse de verrouiller un scénario dont l'invalidation est déjà franchie.</div><button class="monitorBtn secondary" onclick="resetScenarioMonitor('${kind}')">🔎 Rechercher à nouveau</button></div></div>`;return}const nk=scenarioLockKey(current.id,actualKind);lock=scenarioLockFromEngine(e,actualKind);if(!lock)return;lock.instrumentId=marketInstId;scenarioLocks[nk]=lock;if(!saveScenarioLocks()){delete scenarioLocks[nk];throw Error('Verrou non enregistré : stockage indisponible')}scenarioMonitorKind=actualKind;if(!journalCreate(e,actualKind,lock))throw Error('Journal non enregistré : stockage indisponible')}
 const triggerKey=lock.triggerKey||e.triggerKey,anchorKey=lock.anchorKey||e.anchorKey;
 if(!scenarioMonitorFrames[triggerKey]){const loaded=await candles(marketInstId,triggerKey,180);if(abandoned())return;scenarioMonitorFrames[triggerKey]=loaded;}
 if(scenarioMonitorBar!==triggerKey&&!scenarioMonitorFrames[scenarioMonitorBar]){const loaded=await candles(marketInstId,scenarioMonitorBar,300);if(abandoned())return;scenarioMonitorFrames[scenarioMonitorBar]=loaded;}
 const triggerCs=scenarioMonitorFrames[triggerKey]||scenarioMonitorFrames['15m'];
 const tf=triggerCs?.length?timeframeFeatures(triggerCs):e.trigger;
 const chartAll=scenarioMonitorFrames[scenarioMonitorBar]||triggerCs||[];
 const chartCs=chartAll.slice(-Math.min(scenarioMonitorZoom,chartAll.length));
 const sc=lock,displayKind=lock.kind||actualKind,side=lock.direction||scenarioDirection(displayKind);
 const closeC=(triggerCs||[]).filter(c=>Number(c.confirm)===1).at(-1);const volAvg=avgVol(triggerCs||[],20);const volRatio=volAvg&&closeC?closeC.v/volAvg:null;
 const crossed=side==='long'?live>=sc.entry:live<=sc.entry;const triggerClose=side==='long'?closeC?.c>=sc.entry:closeC?.c<=sc.entry;const volOk=volRatio==null?false:volRatio>=1.15;const trendOk=side==='long'?e.biasBull:e.biasBear;const invalid=side==='long'?live<=sc.stop:live>=sc.stop;const near=Math.abs(live-sc.entry)<=Math.max((tf?.atr||0)*.55,live*.0015);const activated=crossed&&triggerClose&&volOk&&trendOk&&!invalid;
 const monitor=monitorTriggerStatus({crossed,triggerClose,volOk,trendOk,invalid,near,entry:sc.entry,stop:sc.stop,live,triggerKey,volRatio});
 let {state,label,reason}=monitor;
 const jrec=journalAdvance(sc,side,triggerCs,activated,timeframeMs(triggerKey));
 if(jrec?.status==='CLOSED'){state=jrec.outcome?.status==='SL'?'red':'green';label=jrec.outcome?.status==='SL'?'OBSERVATION : STOP ATTEINT':'OBSERVATION : TP1 ATTEINT';reason='Résultat observé sur bougie clôturée après le déclenchement. Aucun ordre réel n’est confirmé.'}
 else if(jrec?.status==='CANCELLED'||jrec?.status==='UNVERIFIED'){state='red';label=jrec.status==='CANCELLED'?'SCÉNARIO ANNULÉ AVANT ENTRÉE':'SUIVI NON VÉRIFIABLE';reason=jrec.status==='CANCELLED'?'Invalidation observée avant un déclenchement confirmé.':'Des bougies manquent dans le suivi ; aucun résultat n’est compté.'}
 else if(jrec?.status==='ACTIVATED'&&state!=='red'){state='green';label='ENTRÉE OBSERVÉE';reason='Déclencheur confirmé sur bougie clôturée. Le Radar suit maintenant les niveaux de sortie, sans connaître les ordres réellement passés.'}
 const overlays=[{value:sc.entry,color:'#65b8ff',label:'🎯 Déclencheur'},{value:sc.stop,color:'#ff6974',label:'🛑 Invalidation'},{value:sc.tp1,color:'#45dc7a',label:'TP1'},{value:sc.tp2,color:'#45dc7a',label:'TP2'},{value:sc.tp3,color:'#45dc7a',label:'TP3'}];
 const chart=projectionChart(chartCs,sc,live,state,overlays);
 const action=jrec?.status==='CLOSED'||jrec?.status==='CANCELLED'||jrec?.status==='UNVERIFIED'?`<div class="monitorAction ${jrec.status==='CLOSED'&&jrec.outcome?.status==='TP1'?'ready':'bad'}"><div class="actionTitle">${esc(label)}</div><div class="monitorSub">${esc(reason)}</div><button class="monitorBtn secondary" onclick="resetScenarioMonitor('${displayKind}')">🔎 Rechercher une nouvelle configuration</button></div>`:state==='green'?`<div class="monitorAction ready"><div class="actionTitle">🎯 ÉTUDIER LE SCÉNARIO</div><div class="monitorSub">Le scénario verrouillé vient de satisfaire ses conditions. Les niveaux ci-dessous sont les paramètres hypothétiques calculés avant l'événement.</div><button class="monitorBtn" onclick="openScenarioSim('${current.id}',${sc.entry},${sc.stop},${sc.tp1},${sc.tp2},${sc.tp3},'${side}')">🧮 Préparer l'entrée dans le simulateur</button></div>`:state==='red'?`<div class="monitorAction bad"><div class="actionTitle">🔴 SCÉNARIO TERMINÉ</div><div class="monitorSub">Ne poursuis pas cette hypothèse. Le Radar peut rechercher une nouvelle configuration.</div><button class="monitorBtn secondary" onclick="resetScenarioMonitor('${displayKind}')">🔎 Rechercher une nouvelle configuration</button></div>`:`<div class="monitorAction ${state==='yellow'?'warn':''}"><div class="actionTitle">${crossed?'🟡 ATTENDRE LES CONFIRMATIONS':state==='yellow'?'🟡 SURVEILLER LE DÉCLENCHEUR':'🟠 ATTENDRE LA CONFIRMATION'}</div><div class="monitorSub">${esc(reason)}</div></div>`;
 const favoriteActions=`<div class="favoriteActions"><button class="btn secondary" data-favorite-scenario="${esc(current.id)}::${displayKind}" onclick="toggleFavoriteScenario('${esc(current.id)}','${displayKind}')">${favorites[current.id]?.scenarios?.[displayKind]===sc.id?'★ Scénario enregistré':'☆ Garder ce scénario'}</button><button class="smallbtn" onclick="toolPage('favorites')">★ Mes favoris</button></div>`;
 const levels=`<div class="monitorMini"><div><small>Déclencheur verrouillé</small><b>${axisPrice(sc.entry)}</b></div><div><small>Invalidation verrouillée</small><b class="bad">${axisPrice(sc.stop)}</b></div><div><small>TP1</small><b class="good">${axisPrice(sc.tp1)}</b></div></div>`;
 const tfBtns=['1m','5m','15m','30m','1H','4H','1D'].map(b=>`<button class="smallbtn ${scenarioMonitorBar===b?'active':''}" onclick="setScenarioMonitorBar('${displayKind}','${b}')">${b}</button>`).join('');
 const zoomBtns=`<button class="smallbtn" aria-label="Afficher 30 bougies de moins" onclick="zoomScenarioMonitor('${displayKind}',-30)">−</button><button class="smallbtn" aria-label="Afficher 30 bougies de plus" onclick="zoomScenarioMonitor('${displayKind}',30)">＋</button><button class="smallbtn" onclick="scenarioMonitorZoom=90;renderScenarioMonitor('${displayKind}',false)">90 souhaitées</button>`;
 const editingSimulator=document.activeElement?.closest('.scenarioSimulator'),focusedSimInput=editingSimulator?document.activeElement.id:null;
 const preservedSimulator=editingSimulator?editingSimulator:null;
 $('deepBody').innerHTML=`<button class="btn secondary" onclick="closeScenarioMonitor()">← Scénarios</button><div class="panel"><div class="monitorHero"><div class="monitorState"><div><div class="monitorHeadline">${current.sym} • ${displayKind==='breakout'?'Cassure + retest':displayKind==='pullback'?'Rebond sur support':displayKind==='rejection'?'Rejet / retest de résistance':'Cassure baissière'}</div><div class="monitorSub">🔒 ${scenarioActionLabel(displayKind)} • ${esc(marketInstId)} • scénario verrouillé • ${anchorKey} = ancrage • ${triggerKey} = déclenchement • ${tickerFresh?'🟢 Prix actualisé':'🟠 Prix non actualisé'}${tickerTs?' · ticker '+clockStamp(tickerTs):''} • actualisation ~10s • bougie visible rechargée</div></div><span class="monitorLight light${state.charAt(0).toUpperCase()+state.slice(1)}"></span></div><div style="margin-top:12px"><div class="monitorHeadline">${label}</div><div class="monitorSub">${tickerFresh?'Prix actualisé':'Dernier prix connu'} : ${axisPrice(live)} • ${esc(reason)}</div></div>${action}${favoriteActions}</div>${levels}</div><div class="panel monitorChart"><h2>📈 Projection du scénario</h2><div class="sub">Les lignes pointillées sont les niveaux verrouillés. Les bougies et le prix se mettent à jour ; les niveaux du scénario ne bougent pas.</div><div class="rangeBtns scenarioTfBtns">${tfBtns}</div><div class="rangeBtns scenarioZoomBtns">${zoomBtns}<span class="sub" style="align-self:center">${chartCs.length} bougies affichées</span></div>${chart}</div>${scenarioSimPanel(sc,side)}<div class="panel"><h2>🔎 Pourquoi cet état ?</h2><div class="signalSummary"><div class="signalCount signalGood"><b>${e.signalCounts.positive}</b><span>favorables</span></div><div class="signalCount signalBad"><b>${e.signalCounts.negative}</b><span>défavorables</span></div><div class="signalCount signalWarn"><b>${e.signalCounts.warning}</b><span>à surveiller</span></div><div class="signalCount signalNeutral"><b>${e.signalCounts.neutral}</b><span>neutres</span></div></div><div class="signalList">${e.signals.map(x=>{let cls=x.status==='positive'?'sigPos':x.status==='negative'?'sigNeg':x.status==='warning'?'sigWarn':'sigNeu';let lab=x.status==='positive'?'FAVORABLE':x.status==='negative'?'DÉFAVORABLE':x.status==='warning'?'À SURVEILLER':'NEUTRE';return `<div class="signalRow"><div class="sigText"><b>${esc(x.name)}</b><small>${esc(x.detail)} • ${esc(x.family)}</small></div><span class="sigBadge ${cls}">${lab}</span></div>`}).join('')}</div></div>`;if(preservedSimulator){document.querySelector('.scenarioSimulator').replaceWith(preservedSimulator);$(focusedSimInput)?.focus({preventScroll:true})}else bindScenarioSim(sc,side);
 }catch(err){if(!abandoned())$('deepBody').innerHTML=`<button class="btn secondary" onclick="closeScenarioMonitor()">← Scénarios</button><div class="panel">Erreur de projection : ${esc(err.message)}</div>`}}
function projectionChart(cs,sc,live,state,overlays=[]){let base=proChart(cs,cs,overlays);return `<div>${base}</div><div class="projectionLegend"><span class="projectionTag">🔒 Déclencheur</span><span class="projectionTag">🛑 Invalidation</span><span class="projectionTag">🟢 TP1/2/3</span><span class="projectionTag">LIVE ${axisPrice(live)}</span></div>`}

const scenarioSimValues={};
let activeSimulator=null;
function simulationQuote(){return activeInstrumentId()?.endsWith('-USDT')?'USDT':'USD'}
function scenarioSimKey(sc,side){return `${current?.id||'manual'}|${side}|${sc?.id||'scenario'}`}
function scenarioSimRead(sc,side){return scenarioSimValues[scenarioSimKey(sc,side)]||{capital:100,leverage:1,side,currency:simulationQuote(),fx:'',sizing:sc.sizing||'margin',riskPct:1,entry:sc.entry??'',stop:sc.stop??'',tp1:sc.tp1??'',tp2:sc.tp2??'',tp3:sc.tp3??'',p1:sc.free?100:40,p2:sc.free?0:30,p3:sc.free?0:30,feePct:0,slippagePct:0,fundingCost:0}}
function scenarioSimPanel(sc,side='long'){
 const v=scenarioSimRead(sc,side),quote=simulationQuote(),free=!!sc.free;
 activeSimulator={sc,side,quote,key:scenarioSimKey(sc,side),asset:current};
 const input=(key,label,step='any')=>`<label>${label}<input id="sim_${key}" class="input" type="number" step="${step}" inputmode="decimal" value="${esc(v[key])}"></label>`;
 return `<section class="panel scenarioSimulator" aria-label="Simulateur"><div class="sectionTitle"><h2>${free?'🧮 Tester ma position':'🧮 Simulation du scénario'}</h2><span class="tag">${free?'Simulation libre':side.toUpperCase()}</span></div><p class="sub">${free?'Saisis tes niveaux à partir du graphique.':'Les niveaux du scénario sont préremplis et restent modifiables ici.'} Les pourcentages de sortie portent sur la position initiale.</p><div class="simgrid"><label>Sens<select id="sim_side" class="select" ${free?'':'disabled'}><option value="long" ${v.side==='long'?'selected':''}>LONG</option><option value="short" ${v.side==='short'?'selected':''}>SHORT</option></select></label><label>Devise du capital et des résultats<select id="sim_currency" class="select"><option value="${quote}" ${v.currency===quote?'selected':''}>${quote}</option><option value="EUR" ${v.currency==='EUR'?'selected':''}>EUR</option></select></label><label>Dimensionnement<select id="sim_sizing" class="select"><option value="margin" ${v.sizing==='margin'?'selected':''}>Marge × levier</option><option value="risk" ${v.sizing==='risk'?'selected':''}>Risque maximal au stop</option></select></label>${input('capital','Capital / marge')}${input('leverage','Levier ×')}${input('riskPct','Risque du capital (%) — mode risque')}<label id="sim_fx_label" ${v.currency==='EUR'?'':'hidden'}>1 EUR = combien de ${quote} ?<input id="sim_fx" class="input" type="number" step="any" inputmode="decimal" value="${esc(v.fx)}" placeholder="Taux à renseigner"></label>${input('entry',`Prix d’entrée (${quote})`)}${input('stop',`Stop / SL (${quote})`)}${[1,2,3].map(i=>input('tp'+i,`TP${i} (${quote})`)+input('p'+i,`TP${i} • part de la position (%)`)).join('')}</div><details class="simCosts"><summary>Frais et conversion</summary><p class="sub">Renseigne tes hypothèses. À zéro, ces coûts sont exclus. Le taux de change saisi est supposé constant jusqu’à la sortie.</p><div class="simgrid">${input('feePct','Frais par transaction (%)')}${input('slippagePct','Glissement par transaction (%)')}${input('fundingCost','Coût total du financement (devise de cotation ; négatif si reçu)')}</div></details><div id="scenarioSimOut" aria-live="polite"></div></section>`;
}
function scenarioSimSave(){
 if(!activeSimulator)return null;
 const keys=['capital','leverage','side','currency','fx','sizing','riskPct','entry','stop','tp1','tp2','tp3','p1','p2','p3','feePct','slippagePct','fundingCost'];
 const value=Object.fromEntries(keys.map(k=>[k,$('sim_'+k)?.value??'']));
 scenarioSimValues[activeSimulator.key]=value;return value;
}
function calcScenarioSim(){
 const v=scenarioSimSave(),out=$('scenarioSimOut');if(!v||!out)return;
 $('sim_fx_label').hidden=v.currency!=='EUR';$('sim_riskPct').disabled=v.sizing!=='risk';
 const result=RadarSim.calculate({...v,targets:[1,2,3].map(i=>({price:v['tp'+i],pct:v['p'+i]}))});
 if(!result.ok){out.innerHTML=`<div class="callout" role="status">${result.errors.map(esc).join('<br>')}</div>`;return;}
 const {quote,asset}=activeSimulator,fmt=x=>`${(x/result.fx).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})} ${v.currency}`,signed=x=>(x>0?'+':'')+fmt(x),color=x=>x>0?'good':x<0?'bad':'neutral';
 const contract=RadarSim.contracts(result.quantity,asset?.contract,asset?.sym);
 out.innerHTML=`<div class="grid simResults"><div class="metric"><small>Exposition totale (notionnel)</small><b>${fmt(result.notional)}</b></div><div class="metric"><small>Marge mobilisée</small><b>${fmt(result.margin)}</b></div><div class="metric"><small>Quantité théorique de sous-jacent</small><b>${result.quantity.toLocaleString('fr-FR',{maximumSignificantDigits:8})} ${esc(asset?.sym||'unités')}</b></div><div class="metric"><small>Contrats OKX estimés</small><b>${asset?.market==='xperp'?(contract?contract.rounded.toLocaleString('fr-FR',{maximumSignificantDigits:10}):'Non calculables'):'Sans objet — Spot'}</b><small>${contract?(contract.belowMinimum?'Sous le minimum de contrat.':'Arrondi au lot autorisé ; gains ci-dessous calculés sur la quantité théorique.'):'Les spécifications du contrat sont nécessaires pour convertir la quantité.'}</small></div><div class="metric"><small>Résultat au stop, sortie totale</small><b class="bad">${signed(result.stopNet)}</b><small>Perte de prix seule : ${fmt(result.risk)}</small></div><div class="metric"><small>Position répartie</small><b>100 %</b><small>${v.sizing==='risk'?'Budget de risque calculé avant frais.':'Le levier est déjà inclus dans le notionnel.'}</small></div>${result.rows.map((row,i)=>`<div class="metric"><small>TP${i+1} • sortie de ${row.pct} %</small><b class="${color(row.net)}">${signed(row.net)}</b><small>${row.pct===0?'Aucune sortie à cet objectif.':`Gain brut : ${signed(row.gross)}<br>Coûts saisis : ${fmt(row.cost)}`}</small>${row.fullGross!=null?`<details><summary>Hypothèse 100 % à ce niveau</summary><small>${signed(row.fullGross)} brut • R/R ${row.rr.toFixed(2)}</small></details>`:''}</div>`).join('')}<div class="metric simTotal"><small>Total si toutes les sorties prévues sont exécutées</small><b class="${color(result.net)}">${signed(result.net)}</b><small>Brut : ${signed(result.gross)}<br>Coûts saisis : ${fmt(result.cost)}</small></div></div><p class="foot">Simulation linéaire en ${quote}. ${v.currency==='EUR'?`Conversion manuelle : 1 EUR = ${esc(v.fx)} ${quote}. `:''}Résultats selon les frais, le glissement et le financement saisis ; liquidation et exécution réelle non simulées.${v.sizing==='risk'&&result.margin>Number(v.capital)*result.fx?' La marge nécessaire dépasse le capital renseigné.':''}</p>`;
}
function bindScenarioSim(){document.querySelectorAll('.scenarioSimulator input,.scenarioSimulator select').forEach(el=>el.addEventListener('input',calcScenarioSim));calcScenarioSim()}
function simForm(){
 const seed={id:'independent',free:true,sizing:'risk',entry:current?.price||all[0]?.price||''};
 const options=all.map(x=>`<option value="${esc(x.id)}" ${x.id===current?.id?'selected':''}>${esc(x.sym)} · ${x.market==='xperp'?'X-Perp':'Spot'}</option>`).join('');
 return `<label>Instrument<select id="simCrypto" class="select"><option value="">Saisie manuelle • prix modifiables</option>${options}</select></label><div id="independentSim">${scenarioSimPanel(seed,'long')}</div>`;
}
function sim(){bindScenarioSim();$('simCrypto')?.addEventListener('change',event=>{current=all.find(x=>x.id===event.target.value)||null;currentScenarioInstrument=null;$('independentSim').innerHTML=scenarioSimPanel({id:'independent',free:true,sizing:'risk',entry:current?.price||''},'long');bindScenarioSim()})}
function calc(){calcScenarioSim()}
function openScenarioSim(id,entry,stop,tp1,tp2,tp3,side='long'){
 leavePage();
 current=all.find(x=>x.id===id)||current;stopGraphUpdates();if(scenarioMonitorTimer){clearInterval(scenarioMonitorTimer);scenarioMonitorTimer=null}scenarioMonitorSeq++;
 const seed={id:'prepared-'+[entry,stop,tp1,tp2,tp3].join('|'),entry,stop,tp1,tp2,tp3};
 $('detail').classList.add('hidden');$('home').classList.add('hidden');$('deep').classList.remove('hidden');
 $('deepBody').innerHTML=scenarioSimPanel(seed,side);bindScenarioSim();
}
async function metricPage(metric){
const page=pageRevision,instrument=activeInstrumentId();
let bar='1H',days=1,loadSeq=0;
function calcLimit(){let mins=bar==='1m'?days*24*60:bar==='5m'?days*24*12:bar==='15m'?days*24*4:bar==='1H'?days*24:bar==='4H'?days*6:days;return Math.min(1800,Math.max(2,mins))}
async function load(){
 const seq=++loadSeq;
 let body='',desc='',vals=[],times=[],fmt=v=>String(v),cs=[];
 try{
  if(['Prix','Volume','Momentum'].includes(metric)){
   cs=await candles(instrument,bar,calcLimit());if(page!==pageRevision)return;
   if(metric==='Prix'){vals=cs.map(x=>x.c);times=cs.map(x=>x.t);fmt=v=>price(v)+' $';desc=`Prix sur ${bar}, avec plage et tendance récente.`}
   else if(metric==='Volume'){vals=cs.map(x=>x.v);times=cs.map(x=>x.t);fmt=money;desc=`Volume de cotation par bougie ${bar}.`}
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
 if(page!==pageRevision||seq!==loadSeq)return; $('deepBody').innerHTML=body;bindAcc();if($('metricRefresh'))$('metricRefresh').onclick=load;
 document.querySelectorAll('#bars button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#bars button').forEach(x=>x.classList.remove('active'));b.classList.add('active');bar=b.dataset.bar;load()});
 document.querySelectorAll('#ranges button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#ranges button').forEach(x=>x.classList.remove('active'));b.classList.add('active');days=+b.dataset.days;load()});
}
await load();
}
function lineSvg(vals,formatter,times,axisLabel='Valeur',days=1){let clean=vals.map((v,i)=>({v,t:times?.[i]||null})).filter(o=>Number.isFinite(o.v));vals=clean.map(o=>o.v);times=clean.map(o=>o.t);if(vals.length<2)return '<div class="empty">Pas encore assez d’historique. Relance le radar plus tard pour accumuler des points.</div>';let w=900,h=330,pl=78,pr=18,pt=20,pb=48,lo=Math.min(...vals),hi=Math.max(...vals),rg=hi-lo||Math.max(Math.abs(hi),1e-8),pts=vals.map((v,i)=>`${pl+i*(w-pl-pr)/(vals.length-1)},${pt+(hi-v)/rg*(h-pt-pb)}`).join(' '),ticks=[0,1,2,3,4].map(i=>hi-(rg*i/4)),grid=ticks.map(v=>{let y=pt+(hi-v)/rg*(h-pt-pb);return `<line x1="${pl}" y1="${y}" x2="${w-pr}" y2="${y}" stroke="#252a31"/><text x="${pl-8}" y="${y+4}" text-anchor="end" fill="#b9bec7" font-size="14">${formatter(v)}</text>`}).join('');let idxs=[0,.25,.5,.75,1].map(r=>Math.round(r*(vals.length-1)));let xl=idxs.map(i=>{let x=pl+i*(w-pl-pr)/(vals.length-1);let lab=times[i]?axisTime(times[i],days):String(i+1);return `<text x="${x}" y="${h-15}" text-anchor="middle" fill="#b9bec7" font-size="14">${lab}</text>`}).join('');return `<div class="chartAxisLabel"><span>${esc(axisLabel)}</span></div><div class="deepChart"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${grid}${xl}<text x="${w/2}" y="${h-2}" text-anchor="middle" fill="#9da3ad" class="axis-title" font-size="13">Temps</text><polyline points="${pts}" fill="none" stroke="#65b8ff" stroke-width="4"/></svg></div><div class="minmax"><span>MIN ${formatter(lo)}</span><span>ACTUEL ${formatter(vals.at(-1))}</span><span>MAX ${formatter(hi)}</span></div>`}
function bindAcc(){document.querySelectorAll('.accordion').forEach(a=>{const h=a.querySelector('.accHead');h.setAttribute('role','button');h.tabIndex=0;h.setAttribute('aria-expanded',String(a.classList.contains('open')));h.onclick=()=>{a.classList.toggle('open');h.setAttribute('aria-expanded',String(a.classList.contains('open')))}})}
function backDetail(){leavePage();stopScenarioUpdates();stopCandleStream();if(graphLiveTimer){clearInterval(graphLiveTimer);graphLiveTimer=null}if(scenarioMonitorTimer){clearInterval(scenarioMonitorTimer);scenarioMonitorTimer=null}$('deep').classList.add('hidden');$('detail').classList.remove('hidden')}
function scrollToId(id){document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'})}
function glossaryHtml(){let terms=[['OI','Open Interest','Valeur notionnelle des contrats encore ouverts.'],['Funding','Funding','Paiement périodique entre longs et shorts.'],['TP','Take Profit','Niveau où l’on prévoit de prendre tout ou partie des gains.'],['SL','Stop Loss','Niveau d’invalidation qui limite la perte prévue.'],['R/R','Risk/Reward','Rapport entre gain potentiel et risque potentiel.'],['TF','Timeframe','Unité de temps d’une bougie : 1m, 5m, 1H, etc.'],['HH/HL','Higher High / Higher Low','Structure de sommets et creux ascendants.'],['LH/LL','Lower High / Lower Low','Structure de sommets et creux descendants.'],['ATR','Average True Range','Mesure de l’amplitude moyenne du marché.'],['CVD','Cumulative Volume Delta','Mesure basée sur l’agression acheteuse/vendeuse. Le CVD n’est pas collecté ni utilisé par cette version.']];return `<div class="panel"><h2>📚 Glossaire approfondi</h2><div class="sub">Chaque notion est expliquée avec des mots simples et reliée aux scénarios du radar.</div>${terms.map(t=>`<div class="accordion"><div class="accHead"><span><b>${t[0]}</b> — ${t[1]}</span><span>＋</span></div><div class="accBody"><b>Définition :</b> ${t[2]}<br><br><b>Lecture :</b> on ne l'utilise jamais isolément ; on le croise avec le prix, le volume, l'OI et la structure.</div></div>`).join('')}</div>`}
function learnHtml(){return `<div class="panel"><h2>🎓 Apprendre à lire le radar</h2><div class="sub">Parcours progressif, du plus simple au plus profond.</div>${[['1','Le prix','Commence par la tendance et les niveaux.'],['2','Volume + OI','Cherche à savoir si l’activité accompagne le mouvement.'],['3','Funding et notions de liquidations','Observe le positionnement et les excès. Les liquidations ne sont pas collectées ici.'],['4','Price Action','Lis HH/HL/LH/LL, cassures, retests et rejets.'],['5','Confluence','Mets plusieurs signaux ensemble.'],['6','Scénario','Définis entrée conditionnelle, objectifs et invalidation.'],['7','Risque','Calcule la perte avant de penser au gain.']].map(x=>`<div class="metric"><b>${x[0]}. ${x[1]}</b><div class="sub">${x[2]}</div></div>`).join('')}</div><div class="panel"><h2>🧠 Règle simple</h2><div class="callout">Une bonne analyse ne cherche pas à deviner. Elle définit ce qui doit se produire pour que le scénario devienne intéressant, et ce qui l'annule.</div></div>`}
function compareHtml(){let opts=all.map(x=>`<option value="${esc(x.id)}">${bucketName(x.bucket)} — ${esc(x.sym)} — ${x.market==='xperp'?'X-Perp':'Spot'} — ${esc(x.id)} — ${x.score}/100</option>`).join('');return `<div class="panel"><h2>📊 Comparateur</h2><div class="sub">Compare jusqu'à 4 cryptos du scan, avec leur tradabilité et leurs données.</div><div class="simgrid"><select id="c1" class="select">${opts}</select><select id="c2" class="select">${opts}</select><select id="c3" class="select">${opts}</select><select id="c4" class="select">${opts}</select></div><button class="btn" style="margin-top:8px" onclick="doCompare()">Comparer</button><div id="cmpout" style="margin-top:10px"></div></div>`}
function doCompare(){let ids=['c1','c2','c3','c4'].map(id=>$(id)?.value).filter(Boolean),xs=[...new Set(ids)].map(id=>all.find(x=>x.id===id)).filter(Boolean);$('cmpout').innerHTML=`<div class="tablewrap"><table><thead><tr><th class="th">Instrument / marché</th><th class="th">Score</th><th class="th">24h</th><th class="th">Volume</th><th class="th">OI</th><th class="th">Funding</th><th class="th">Terrain</th></tr></thead><tbody>${xs.map(x=>`<tr class="row"><td>${esc(x.sym)} · ${x.market==='xperp'?'X-Perp':'Spot'}<br><span class="tiny">${esc(x.id)} • marché ${timeLabel(x.marketTs)}</span></td><td>${x.score}</td><td class="${x.chg>=0?'good':'bad'}">${chg(x.chg)}</td><td>${money(x.volUsd)}</td><td>${money(x.oi)}</td><td>${pct(x.funding)}<br><span class="tiny">${x.fundingTs?'consulté '+timeLabel(x.fundingTs):'N/D'}</span></td><td>${terrain(x.score)[0]}</td></tr>`).join('')}</tbody></table></div>`}
function clearScanHistory(){try{for(const key of [STORAGE.scan,'ir_hist_v63','ir_hist_v52'])localStorage.removeItem(key)}catch(_){storageFailure();return}history={};alert('Historique local des scans effacé. Relance le scan.')}
function settingsHtml(){return `<div class="panel"><h2>⚙️ Paramètres</h2><div class="click" onclick="clearScanHistory()">🧹 Effacer l'historique local des scans</div><div class="sub">L'application utilise des données publiques OKX. Les fonctions macro/institutionnelles nécessitent des sources externes vérifiables et seront ajoutées lorsque l'architecture le permettra.</div></div>`}
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
function engineHtml(){const m=current.signalModel||centralSignalEngine(current,current.deep||null);const fam=Object.entries(m.families||{});const lab=runStressSuite();const governed=runGovernedLab();return `<div class="panel"><div class="grid"><div class="metric"><small>Confluence</small><b>${m.score}/100</b></div><div class="metric"><small>Tradabilité</small><b>${m.qualityScore}/100</b></div><div class="metric"><small>Biais</small><b>${m.biasScore}/100</b></div><div class="metric"><small>Direction</small><b>${m.direction==='bull'?'🟢 LONG':m.direction==='bear'?'🔴 SHORT':'🟡 MIXTE'}</b></div><div class="metric"><small>Risque d'extension</small><b class="${m.extensionRisk>=72?'bad':m.extensionRisk>=45?'warn':'good'}">${m.extensionRisk}/100</b><div class="foot">Ne prédit pas une baisse : mesure le risque de mouvement déjà étendu.</div></div><div class="metric"><small>Régime détecté</small><b>${esc(m.regime?.label||'N/D')}</b><div class="foot">${esc(m.regime?.reason||'')}</div></div><div class="metric"><small>Familles</small><b>${fam.length}</b></div></div></div><div class="panel"><h2>🧩 Lecture par famille</h2><div class="sub">Les familles décrivent les contributions actuelles. Plusieurs indicateurs restent corrélés ; leur regroupement ne garantit pas une information indépendante.</div><div class="indicatorGrid">${fam.map(([k,f])=>{const directional=['momentum','trend','ema','supertrend','rsi','stochRsi','priceAction'].includes(k);const lab=f.signal==='positive'?(directional?'HAUSSIER':'POSITIF'):f.signal==='negative'?(directional?'BAISSIER':'NÉGATIF'):f.signal==='warning'?'À SURVEILLER':'NEUTRE';const cls=f.signal==='positive'?'sigPos':f.signal==='negative'?'sigNeg':f.signal==='warning'?'sigWarn':'sigNeu';return `<div class="indicatorCard"><b>${familyLabel(k)}</b><div class="sub">${formatFamilyValue(f.value,k)}</div><span class="sigBadge ${cls}">${lab}</span><div class="foot">Poids actuel : ${Number(f.weight||0).toFixed(2)}</div></div>`}).join('')}</div></div><div class="panel"><h2>🧪 Laboratoire de résistance</h2><div class="sub">Tests synthétiques intégrés pour vérifier que le moteur sait distinguer confirmation, contradiction et absence de configuration.</div><div class="grid">${Object.entries(lab).map(([k,v])=>`<div class="metric"><small>${k}</small><b class="${v.ok?'good':'bad'}">${v.ok?'✓':'✕'} ${v.score}/100</b><div class="foot">${v.note}</div></div>`).join('')}</div></div>${validationLabHtml()}<div class="panel"><h2>🧪 Laboratoire gouverné — anti-surapprentissage</h2><div class="sub">Ce laboratoire utilise 11 cas synthétiques fixes (5 DEV, 3 validation, 3 HOLDOUT), sans les observations du journal et sans modifier les poids de production. Une proposition n'est retenue que si elle ne dégrade ni la validation ni le test final.</div><div class="grid"><div class="metric"><small>DEV actuel</small><b>${Math.round(governed.baseDev.rate*100)}%</b></div><div class="metric"><small>DEV proposition</small><b>${Math.round(governed.proposal.report.rate*100)}%</b></div><div class="metric"><small>VALIDATION actuel → proposé</small><b>${Math.round(governed.baseVal.rate*100)}% → ${Math.round(governed.proposalVal.rate*100)}%</b></div><div class="metric"><small>HOLDOUT actuel → proposé</small><b>${Math.round(governed.baseHold.rate*100)}% → ${Math.round(governed.proposalHold.rate*100)}%</b></div></div><div class="callout ${governed.accepted?'goodbox':''}"><b>${governed.accepted?'✓ Proposition compatible avec la règle de validation':governed.changed?'⚠️ Proposition rejetée':'ℹ️ Aucun changement de poids retenu'}</b><br>Le HOLDOUT n'est pas utilisé pour optimiser les poids. Il sert uniquement à vérifier la proposition finale.</div></div><div class="panel"><h2>🧬 Mémoire & apprentissage</h2><div class="sub">Le moteur commence à enregistrer les configurations réellement suivies. Ces résultats alimenteront plus tard les tests walk-forward, sans modifier automatiquement les poids.</div><div class="click" onclick="toolPage('memory')">Ouvrir la mémoire des configurations →</div></div><div class="panel"><h2>🔬 Règle d'architecture</h2><div class="callout goodbox"><b>Objectif : une source de vérité commune.</b><br>La version actuelle combine plusieurs calculs et recalcule les scénarios à leur ouverture. Les niveaux se figent à l’ouverture de la projection. L’audit documente les différences restantes.</div></div>`}

function btTs(c){return Number(c?.[0]||0)}
function btClose(c){return Number(c?.[4]||NaN)}
async function historyCandles(instId,bar,limit=300,before=null){
  const q=`/market/history-candles?instId=${encodeURIComponent(instId)}&bar=${encodeURIComponent(bar)}&limit=${Math.min(300,Math.max(20,limit))}`+(before?`&before=${encodeURIComponent(before)}`:'');
  return await get(q);
}
function btSlice(arr,ts,max=140,barMs=3600000){return arr.filter(c=>btTs(c)+barMs<=ts&&Number(c?.[8])===1).sort((a,b)=>btTs(a)-btTs(b)).slice(-max)}
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
  const decided=wins+sl,closed=rows.filter(x=>x.outcome==='TP1'||x.outcome==='SL');
  const expectancy=costPct=>closed.length?closed.reduce((sum,x)=>sum+(x.outcome==='TP1'?(x.rr1||1):-1)-(x.riskPct>0?costPct/x.riskPct:0),0)/closed.length:null;
  return {n:rows.length,decided,wins,sl,timeout:rows.length-decided-noEntry,noEntry,rate:decided?wins/decided*100:0,avgScore:rows.length?rows.reduce((a,x)=>a+x.score,0)/rows.length:0,grossR:expectancy(0),afterLowCostsR:expectancy(.2),afterHighCostsR:expectancy(.5)};
}
async function runWalkForwardLab(){
  const btn=$('btRun');const out=$('btOut');if(!btn||!out)return;btn.disabled=true;btn.textContent='⏳ Téléchargement…';
  try{
    const inst=(currentScenarioInstrument==='perp'&&isListedXperp(current?.perpId)?current.perpId:current?.id)||'BTC-USDT';
    const specs=[['1D',90],['4H',180],['1H',220],['30m',260],['15m',300],['5m',300]];
    const got=await Promise.all(specs.map(async ([bar,lim])=>[bar,await historyCandles(inst,bar,lim)]));
    const raw=Object.fromEntries(got.map(([k,v])=>[k,v.filter(c=>Number(c?.[8])===1&&btTs(c)+timeframeMs(k)<=Date.now()).sort((a,b)=>btTs(a)-btTs(b))]));
    const base=raw['1H']; if(!base||base.length<100)throw Error('Historique 1H insuffisant');
    const cut1=Math.floor(base.length*.70),cut2=Math.floor(base.length*.90);
    const phases=[['DEV',0,cut1],['VALIDATION',cut1,cut2],['HOLDOUT',cut2,base.length]];
    const rows=[];
    for(const [phase,a,b] of phases){
      for(let i=Math.max(80,a);i+18<b;i+=Math.max(1,Math.floor((b-a)/18))){
        const ts=btTs(base[i])+timeframeMs('1H');
        const frames={};for(const [k] of specs)frames[k]=RadarCandles.decode(btSlice(raw[k],ts,k==='1D'?90:120,timeframeMs(k)));
        const px=btClose(base[i]);const prev=base[Math.max(0,i-24)],dayMove=btClose(prev)>0?(px/btClose(prev)-1)*100:null,historyWindow=base.slice(Math.max(0,i-24),i+1),low24=Math.min(...historyWindow.map(c=>Number(c[3]))),high24=Math.max(...historyWindow.map(c=>Number(c[2])));const historical={id:inst,perpId:inst.endsWith('-SWAP')?inst:(current?.perpId||null),price:px,chg:dayMove,rangePos:high24>low24?(px-low24)/(high24-low24):null,vol:Number(base[i][7])||null,oi:null,oiDelta:null,funding:null};const e=adaptiveEngine(frames,historical);
        if(!e)continue;
        let kind=chooseFreshScenario(e,null);let outcome='NO_SETUP',mfe=0,mae=0,rr1=null,riskPct=null;
        if(kind&&scenarioLevelsFromEngine(e,kind)?.entry){const sc=scenarioLevelsFromEngine(e,kind),risk=Math.abs(sc.entry-sc.stop);rr1=risk>0?Math.abs(sc.tp1-sc.entry)/risk:null;riskPct=sc.entry>0?risk/sc.entry*100:null;const o=btOutcome(base,i,kind,sc,18);outcome=o.hit;mfe=o.mfe;mae=o.mae}
        rows.push({phase,ts,regime:e.regime?.key||'unknown',kind:kind||'none',decision:e.decision,score:e.score,outcome,mfe,mae,rr1,riskPct});
      }
    }
    const report={};for(const phase of ['DEV','VALIDATION','HOLDOUT'])report[phase]=btScoreResult(rows.filter(x=>x.phase===phase&&x.kind!=='none'));
    const regime={};for(const r of rows.filter(x=>x.kind!=='none')){const k=r.regime+' / '+r.kind;regime[k]??=[];regime[k].push(r)}
    const cards=Object.entries(regime).sort((a,b)=>b[1].length-a[1].length).slice(0,12).map(([k,v])=>{const z=btScoreResult(v);return `<div class="metric"><small>${esc(k)}</small><b>${z.n} setups • ${z.rate.toFixed(0)}% TP1*</b><div class="foot">TP1 ${z.wins} • SL ${z.sl} • jamais entrés ${z.noEntry} • timeout ${z.timeout} • score ${z.avgScore.toFixed(0)}</div></div>`}).join('');
    const phaseCards=['DEV','VALIDATION','HOLDOUT'].map(p=>{const z=report[p];return `<div class="metric"><small>${p}</small><b>${z.n} setups</b><div class="foot">Décidés ${z.decided} • TP1 ${z.wins} • SL ${z.sl} • jamais entrés ${z.noEntry} • taux ${z.rate.toFixed(0)}% • score ${z.avgScore.toFixed(0)} • R moyen brut ${z.grossR==null?'N/D':z.grossR.toFixed(2)} • après coûts hypothétiques 0,2 % / 0,5 % : ${z.afterLowCostsR==null?'N/D':z.afterLowCostsR.toFixed(2)} / ${z.afterHighCostsR==null?'N/D':z.afterHighCostsR.toFixed(2)}${z.decided<30?' • échantillon insuffisant':''}</div></div>`}).join('');
    out.innerHTML=`<div class="panel"><h2>🧪 Résultat walk-forward</h2><div class="sub">${esc(inst)} • historique 1H comme horloge d'évaluation. Les scénarios utilisent les bougies connues au signal et leur entrée doit être touchée avant qu'un TP/SL compte. Une bougie touchant TP et SL est comptée SL.</div><div class="grid">${phaseCards}</div></div><div class="panel"><h2>🧬 Par régime / configuration</h2><div class="grid">${cards||'<div class="empty">Aucun setup retenu sur cette fenêtre.</div>'}</div><div class="foot">* Taux TP1 calculé uniquement parmi les résultats décidés (TP1/SL), hors scénarios non entrés et timeouts. Les coûts 0,2 % / 0,5 % sont des hypothèses de sensibilité, pas les frais réels. Le R moyen ne compte que TP1 et SL ; timeouts et absences d'entrée sont indiqués séparément. Funding historique, OI historique et exécution intrabougie restent inconnus.</div></div><div class="panel"><h2>🛡️ Décision du laboratoire</h2><div class="callout goodbox"><b>Diagnostic exploratoire ; aucune promotion de poids.</b><br>Les résultats de la dernière partition sont affichés pour diagnostic. Cette exécution ne modifie aucune pondération. Des observations peuvent se chevaucher ; le protocole historique et la confirmation live ne sont pas équivalents. Toute nouvelle formule devra d'abord être proposée sur DEV, validée sur VALIDATION, puis testée sur un HOLDOUT jamais utilisé pour optimiser.</div></div>`;
  }catch(e){out.innerHTML=`<div class="panel danger"><b>Laboratoire interrompu</b><div class="sub">${esc(e.message)}</div></div>`}finally{btn.disabled=false;btn.textContent='▶ Lancer le walk-forward'}
}
function backtestHtml(){return `<button class="btn secondary" onclick="backHome()">← Radar</button><div class="panel"><h2>🧪 Laboratoire walk-forward</h2><div class="sub">Ce diagnostic historique utilise trois partitions temporelles (70 %, 20 %, 10 %). Il ne réentraîne pas le moteur et ne constitue pas encore une validation walk-forward statistique. Les horizons courts peuvent manquer sur les dates anciennes. Le HOLDOUT n'est jamais utilisé pour modifier les règles.</div><div class="toolbar"><button id="btRun" class="btn" onclick="runWalkForwardLab()">▶ Lancer le walk-forward</button></div><div class="callout">Le laboratoire utilise ici les chandeliers historiques. Les dérivés historiques (OI/funding) ne sont pas inventés. Les coûts affichés ensuite sont des hypothèses de sensibilité, pas un relevé de transactions.</div></div><div id="btOut"><div class="panel"><div class="empty">Aucun test lancé.</div></div></div>`}
function toolPage(type){leavePage();stopGraphUpdates();$('back2').onclick=backHome;$('back2').textContent='← Radar';if(scenarioMonitorTimer){clearInterval(scenarioMonitorTimer);scenarioMonitorTimer=null;scenarioMonitorSeq++}$('drawer').classList.remove('open');$('home').classList.add('hidden');$('detail').classList.add('hidden');$('deep').classList.remove('hidden');if(type==='favorites'){$('deepBody').innerHTML=favoritesPage();renderFavorites()}else if(type==='memory'){$('deepBody').innerHTML=`<button class="btn secondary" onclick="backHome()">← Radar</button>${learningHtml()}`}else if(type==='backtest'){$('deepBody').innerHTML=backtestHtml()}else if(type==='brain'){current=current||all[0];$('deepBody').innerHTML=`<button class="btn secondary" onclick="backHome()">← Radar</button><div class="panel"><h2>🧠 Cerveau & laboratoire</h2><div class="sub">Architecture du moteur, familles de signaux et tests de résistance. Les adaptations restent proposées tant qu'elles ne sont pas validées hors échantillon.</div></div>${current?engineHtml():`<div class="panel"><div class="empty">Lance d'abord un scan pour alimenter le moteur.</div></div>`}`}else if(type==='sim'){$('deepBody').innerHTML=`<button class="btn secondary" onclick="backHome()">← Radar</button><div class="panel"><h2>🧮 Simulateur indépendant</h2><div class="sub">Choisis une crypto ou saisis tes niveaux manuellement.</div>${simForm()}</div>`;sim()}else if(type==='gloss'){$('deepBody').innerHTML=`<button class="btn secondary" onclick="backHome()">← Radar</button>${glossaryHtml()}`;bindAcc()}else if(type==='learn'){$('deepBody').innerHTML=`<button class="btn secondary" onclick="backHome()">← Radar</button>${learnHtml()}`}else if(type==='compare'){$('deepBody').innerHTML=`<button class="btn secondary" onclick="backHome()">← Radar</button>${compareHtml()}`}else{$('deepBody').innerHTML=`<button class="btn secondary" onclick="backHome()">← Radar</button>${settingsHtml()}`}}
function backHome(){leavePage();stopScenarioUpdates();stopGraphUpdates();$('deep').classList.add('hidden');$('detail').classList.add('hidden');$('home').classList.remove('hidden')}
document.querySelectorAll('#marketMode .modeBtn').forEach(b=>b.onclick=()=>{marketMode=b.dataset.mode;document.querySelectorAll('#marketMode .modeBtn').forEach(x=>x.classList.remove('active'));b.classList.add('active');const visible=scenarioCandidates().filter(c=>marketMode==='all'||(marketMode==='spot'&&c.market==='spot')||(marketMode==='long'&&c.direction==='long')||(marketMode==='short'&&c.direction==='short'));if(visible.length&&!visible.some(c=>bucket(c.score)===filter))setFilter(preferredFilter(visible));renderRank();void refreshScenarioMarket()});$('scan').onclick=scan;$('back1').onclick=backHome;$('back2').onclick=backDetail;$('sort').onchange=drawTable;$('tier').onchange=drawTable;$('search').oninput=drawTable;document.querySelectorAll('#tradeTabs button').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('#tradeTabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderRank()});document.querySelectorAll('.bottomnav [data-jump]').forEach(b=>b.onclick=()=>{document.querySelectorAll('.bottomnav [data-jump]').forEach(x=>x.classList.remove('active'));b.classList.add('active');$(b.dataset.jump).scrollIntoView({behavior:'smooth',block:'start'})});$('toolsBtn').onclick=()=>$('drawer').classList.add('open');$('closeDrawer').onclick=()=>$('drawer').classList.remove('open');$('drawer').onclick=e=>{if(e.target===$('drawer'))$('drawer').classList.remove('open')};document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[role=button]')){e.preventDefault();e.target.click()}});bindAcc();setInterval(refreshScanFreshness,60000);setInterval(()=>{if(!document.hidden)void refreshScenarioMarket()},45000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refreshScenarioMarket()});setInterval(()=>{$('clock').textContent=new Date().toLocaleTimeString('fr-FR')},1000);$('clock').textContent=new Date().toLocaleTimeString('fr-FR');$('runtimeVersion').textContent=APP_VERSION+' • Learning Engine';render();scan();


if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=8.9.15',{updateViaCache:'none'}).catch(console.warn));
