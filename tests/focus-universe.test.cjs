const {test}=require('node:test'),assert=require('node:assert/strict');
const {env,frames,plain}=require('./harness.cjs'),Focus=require('../focus-universe.js');
const id=s=>s+'-USD_UM_XPERP-310101';
function market(initial={}){
 const e=env(initial),data=frames(.1),now=Date.now(),calls=[],reads=[];
 for(const [tf,bars] of Object.entries(data)){const ms=e.run(`timeframeMs('${tf}')`),end=Math.floor(now/ms)*ms;bars.forEach((b,i)=>b.t=end-(bars.length-1-i)*ms)}
 const price=data['5m'].at(-2).c;
 e.ctx.listed=['NEAR','SUI','SOL','BTC'].map(sym=>({instId:id(sym),ruleType:'xperp',state:'live'}));
 e.ctx.ticks=e.ctx.listed.map((x,i)=>({instId:x.instId,last:String(price),open24h:String(price-1),volCcy24h:String((i+1)*10000),high24h:String(price+2),low24h:String(price-2),bidPx:String(price-.01),askPx:String(price+.01),ts:String(now)}));
 e.ctx.get=async p=>{calls.push(p);if(p.includes('/instruments'))return e.ctx.listed;if(p.includes('instType=SPOT'))return [];if(p.includes('/tickers'))return e.ctx.ticks;if(p.includes('open-interest'))return [{oiUsd:'500000'}];return []};
 e.ctx.candles=async(inst,tf,n)=>{reads.push([inst,tf,n]);return data[tf].slice(-n)};
 return {...e,data,calls,reads};
}
test('focus selection pins NEAR, normalizes symbols and rejects invalid/oversized lists',()=>{
 assert.deepEqual(Focus.symbols('sui, NEAR, sui;sol'),['NEAR','SUI','SOL']);assert.deepEqual(Focus.symbols(''),['NEAR']);
 assert.throws(()=>Focus.symbols('NEAR-USDT'));assert.throws(()=>Focus.symbols(Array.from({length:15},(_,i)=>'X'+i)));
 assert.equal(Focus.config(null).scope,'focus');assert.deepEqual(Focus.config({symbols:['<script>']}).symbols,[...Focus.defaults]);
});
test('focus never substitutes Spot or another expiry for a missing or ambiguous contract',()=>{
 const result=Focus.resolve(['NEAR','SUI','HYPE'],[{sym:'NEAR',market:'spot',id:'NEAR-USDT'},{sym:'SUI',market:'xperp',id:'a'},{sym:'SUI',market:'xperp',id:'b'}]);
 assert.ok(result.every(x=>x.asset===null));assert.match(result[1].reason,/Plusieurs contrats/);
});
test('focus scans only selected exact X-Perps, six horizons and their derivatives; no Spot request',async()=>{
 const e=market();await e.run('scan()');
 assert.deepEqual(new Set(e.reads.map(x=>x[0])),new Set(['NEAR','SUI','SOL'].map(id)));
 assert.equal(e.reads.length,18);assert.ok(e.reads.every(x=>x[1]!=='1m'));
 assert.ok(e.calls.every(p=>!p.includes('SPOT')&&!p.includes(encodeURIComponent(id('BTC')))));
 assert.equal(e.run('all.length'),3);assert.ok(e.run("all.every(x=>x.analysisCoverage==='complete')"));
 assert.equal(e.node('focusBoard').querySelectorAll('[data-focus-symbol]').length,5);
 assert.match(e.node('focusBoard').querySelector('[data-focus-symbol="HYPE"]').textContent,/Aucun X-Perp/);
});
test('focus preserves full-market references, tiers, scores and scenario levels for identical observations',async()=>{
 const focused=market(),wide=market();wide.run("focusConfig.scope='wide'");
 // Fix model time so the comparison covers complete models, not just scores.
 for(const e of [focused,wide])e.run('const originalCandidate=candidateModel;candidateModel=(f,x)=>originalCandidate(f,{...x,decisionAt:Math.floor(Date.now()/60000)*60000})');
 await focused.run('scan()');await wide.run('scan()');
 for(const row of plain(focused.run('all'))){const other=plain(wide.run(`all.find(x=>x.id==='${row.id}')`));
  for(const key of ['medVol','marketMedianVol','tier','score','longScore','shortScore','scenarioModel'])assert.deepEqual(row[key],other[key],key);
 }
});
test('expired analysis leaves NEAR visible, removes readiness and is rebuilt by the next focused scan',async()=>{
 const e=market();await e.run('scan()');
 assert.ok(e.run('scenarioCandidates().length')>0);e.run("all.forEach(x=>{x.scenarioModel.analysisAt=Date.now()-86400000});renderRank()");
 assert.equal(e.run('scenarioCandidates().length'),0);assert.match(e.node('focusBoard').textContent,/À actualiser/);
 assert.equal(e.node('focusBoard').querySelectorAll('[data-focus-symbol]').length,5);
 await e.run('scan()');assert.ok(e.run('scenarioCandidates().length')>0);
});
test('no setup and partial data remain visible without being labeled ready',async()=>{
 const e=market();await e.run('scan()');
 e.run("all.forEach(x=>{x.scenarioModel.longSetup=false;x.scenarioModel.shortSetup=false;x.scenarioModel.shortPattern=null});renderRank()");
 assert.equal(e.run('scenarioCandidates().length'),0);assert.match(e.node('focusBoard').textContent,/En attente/);
 const original=e.ctx.candles;e.ctx.candles=async(inst,tf,n)=>{if(tf==='30m')throw Error('fixture unavailable');return original(inst,tf,n)};
 await e.run('scan()');assert.equal(e.run('scenarioCandidates().length'),0);assert.match(e.node('focusBoard').textContent,/Analyse incomplète/);
});
test('catalogue failure retains visible assets, fails closed, and recovery reanalyses all selected assets',async()=>{
 const e=market();e.ctx.console={...console,error:()=>{}};await e.run('scan()');const original=e.ctx.get;
 e.ctx.get=async()=>{throw Error('fixture network unavailable')};await e.run('scan()');
 assert.equal(e.run('scenarioCandidates().length'),0);assert.equal(e.node('focusBoard').querySelectorAll('[data-focus-symbol]').length,5);
 assert.match(e.node('focusBoard').textContent,/indisponibles/);assert.equal(e.node('scan').disabled,false);
 e.ctx.get=original;await e.run('scan()');assert.ok(e.run('scenarioCandidates().length')>0);
});
test('delisted contracts stay as unavailable selection cards and receive no further analysis',async()=>{
 const e=market();await e.run('scan()');e.ctx.listed=e.ctx.listed.filter(x=>x.instId!==id('NEAR'));e.reads.length=0;
 await e.run('scan()');assert.ok(e.reads.every(x=>x[0]!==id('NEAR')));assert.equal(e.run("all.some(x=>x.sym==='NEAR')"),false);
 assert.match(e.node('focusBoard').querySelector('[data-focus-symbol="NEAR"]').textContent,/Aucun X-Perp/);
});
test('final quote failure cannot admit a scenario even if candle analysis succeeded',async()=>{
 const e=market(),original=e.ctx.get;let tickCalls=0;e.ctx.get=async p=>{if(p.includes('/tickers')&&++tickCalls>1)throw Error('fixture quote failure');return original(p)};
 await e.run('scan()');assert.equal(e.run('scenarioCandidates().length'),0);assert.match(e.node('focusBoard').textContent,/Actualisation finale/);
});
test('auto scan respects visibility, navigation, toggle, interval and concurrent work',async()=>{
 const e=market();e.run('let scanCalls=0;scan=async()=>{scanCalls++}');
 for(const guard of ["document.visibilityState='hidden'","$('home').classList.add('hidden')","focusConfig.auto=false","scanRunning=true","marketRefreshRunning=true","lastScanAttemptAt=Date.now()"]){
  e.run("document.visibilityState='visible';$('home').classList.remove('hidden');focusConfig.auto=true;scanRunning=false;marketRefreshRunning=false;lastScanAttemptAt=0;"+guard);
  await e.run('refreshRadar()');assert.equal(e.run('scanCalls'),0,guard);
 }
 e.run('lastScanAttemptAt=0');await e.run('refreshRadar()');assert.equal(e.run('scanCalls'),1);
});
test('selection settings survive reload independently of existing favorites, locks and journal',async()=>{
 const prior={'ir_favorites_v1':'{}','ir_learning_journal_v866':'[]','ir_scenario_locks_v871':'{}'},e=market(prior);
 e.node('scanScope').value='focus';e.node('focusSymbols').value='SUI';e.node('focusAuto').checked=false;
 await e.run('saveFocusSettings()');assert.deepEqual(plain(e.run('focusConfig.symbols')),['NEAR','SUI']);
 for(const [key,value] of Object.entries(prior))assert.equal(e.store.get(key),value);
 const reloaded=env(Object.fromEntries(e.store));assert.deepEqual(plain(reloaded.run('focusConfig')),{scope:'focus',symbols:['NEAR','SUI'],auto:false});
});
test('concurrent scans are ignored and selected controls stay disabled until completion',async()=>{
 const e=market(),original=e.ctx.get;let release;const held=new Promise(r=>release=r);e.ctx.get=async p=>{await held;return original(p)};
 const first=e.run('scan()');await e.run('scan()');assert.equal(e.node('focusApply').disabled,true);release();await first;
 assert.equal(e.reads.length,18);assert.equal(e.node('focusApply').disabled,false);
});
