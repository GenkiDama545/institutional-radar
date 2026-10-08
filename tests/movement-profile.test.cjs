const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../movement-profile.js'),Candles=require('../candle-store.js'),{env,plain}=require('./harness.cjs');
const end=Date.UTC(2026,9,8,3),hour=3600000,day=24*hour;
function series(scale=1){return Object.fromEntries([['15m',900000,7],['1H',hour,30]].map(([tf,ms,days])=>{
 const n=days*day/ms+1;return [tf,Array.from({length:n},(_,i)=>{const o=100*Math.exp(Math.sin(i/4)*.04+i*.00002)*scale,c=100*Math.exp(Math.sin((i+1)/4)*.04+(i+1)*.00002)*scale;return {t:end-(n-i)*ms,o,c,h:Math.max(o,c)*1.002,l:Math.min(o,c)*.998,v:1000,confirm:1}})];
}))}
const bars=series();
function service(){
 const calls=[],assets=['NEAR','SUI','SOL','BTC','ETH','AVAX','HYPE','INJ'].map((sym,i)=>({sym,id:sym+'-USD_UM_XPERP-310101',market:'xperp',volUsd:1000000-i*1000,marketTs:end+60000,bidPx:100,askPx:100.02}));
 const options={selected:['NEAR','SUI'],now:()=>end+60000,decode:Candles.decode,resolve:()=>assets,get:async p=>{
  calls.push(p);if(p.includes('/instruments')||p.includes('/tickers'))return [];
  const u=new URL('https://fixture'+p),tf=u.searchParams.get('bar'),cursor=Number(u.searchParams.get('after')),limit=Number(u.searchParams.get('limit'));
  return bars[tf].filter(b=>b.t<cursor).slice(-limit).reverse().map(b=>[b.t,b.o,b.h,b.l,b.c,1,1,b.v,b.confirm].map(String));
 }};return {options,calls,assets};
}
test('Movement: normalized TR, wick share, efficiency and quote volume have known values',()=>{
 const ms=900000,w={key:'test',ms,tf:'15m',days:2/96},input=[{t:end-3*ms,o:100,h:101,l:99,c:100,v:1,confirm:1},{t:end-2*ms,o:100,h:104,l:99,c:103,v:10,confirm:1},{t:end-ms,o:103,h:104,l:100,c:101,v:20,confirm:1}];
 const r=M.measure(input,w,end);assert.equal(r.ok,true);assert.ok(Math.abs(r.trPct-(5+4/103*100)/2)<1e-10);assert.equal(r.wickShare,.45);assert.equal(r.efficiency,.2);assert.equal(r.returnPct,1);assert.equal(r.volumePerDay,1440);
});
test('Movement: completed close swings censor both boundary legs; regularity needs four',()=>{
 const input=[100,103,101,104,102,105,103].map((c,i)=>({c,t:i*hour})),legs=M.swings(input);
 assert.equal(legs.length,4);assert.deepEqual(legs.map(x=>x.direction),[-1,1,-1,1]);assert.ok(Math.abs(legs[0].pct-2/103*100)<1e-10);assert.equal(legs[0].hours,1);
 assert.equal(M.swings([100,102,105,110].map((c,i)=>({c,t:i*hour}))).length,0);
 const p=M.profile(bars,end);assert.ok(p.windows['15m-1d'].swingCount>=4);assert.ok(p.windows['15m-1d'].regularity>=0);
});
test('Movement: same shape in different price units is identical; no input mutation or forming/future leakage',()=>{
 const before=JSON.stringify(bars),a=M.profile(bars,end),b=M.profile(series(.003),end),r=M.compare(a,b);assert.equal(r.complete,true);assert.ok(Math.abs(r.score-100)<1e-8);
 const future={t:end,o:1,h:900,l:.1,c:800,v:1e12,confirm:0},withFuture=M.profile({'15m':[...bars['15m'],future],'1H':[...bars['1H'],future]},end);
 assert.deepEqual(a,withFuture);assert.equal(JSON.stringify(bars),before);
 const different=series();different['15m']=different['15m'].map(b=>({...b,h:b.h*1.2,l:b.l*.8}));assert.ok(M.compare(M.profile(different,end),a).score<99);
});
test('Movement: gaps, duplicate timestamps, off-grid, invalid OHLC, unconfirmed and stale windows cannot produce a full score',()=>{
 for(const change of [a=>a.slice(1),a=>[...a,a[100]],a=>a.map((b,i)=>i===100?{...b,t:b.t+1}:b),a=>a.map((b,i)=>i===100?{...b,h:0}:b),a=>a.map((b,i)=>i===100?{...b,confirm:0}:b),a=>a.slice(0,-1)]){
  const result=M.profile({...bars,'1H':change(bars['1H'])},end);assert.equal(result.windows['1H-30d'].ok,false);assert.equal(M.compare(result,M.profile(bars,end)).complete,false);
 }
 assert.equal(M.compare(M.profile(bars,end),M.profile(bars,end+hour)).score,null);
 const flat=Object.fromEntries(Object.entries(bars).map(([tf,a])=>[tf,a.map(b=>({...b,o:100,h:100,l:100,c:100}))]));assert.equal(M.compare(M.profile(flat,end),M.profile(flat,end)).score,null);
});
test('Movement: stale/missing/crossed spread is unavailable; discovery excludes selected, duplicate and previously seen contracts',()=>{
 const {assets}=service();assert.ok(M.execution(assets[0],end+60000).spreadPct>0);
 for(const changes of [{marketTs:end-180000},{marketTs:end+600001},{bidPx:null},{askPx:90}])assert.equal(M.execution({...assets[0],...changes},end+60000).spreadPct,null);
 const pool=M.candidates([...assets,{...assets[2],id:'another-SOL'}],['NEAR'],[assets[1].id],end+60000);
 assert.ok(pool.every(x=>!['NEAR','SUI','SOL'].includes(x.sym)));assert.equal(pool[0].sym,'BTC');
});
test('Movement: persistence requires separated observations and resets on mismatch, failure or long gaps',()=>{
 const check={asOf:end,candidateId:'SUI',referenceId:'NEAR-a',comparison:{complete:true,close:true}};
 const a=M.observe(null,check);assert.equal(a.confirmed,false);assert.equal(M.observe(a,check).confirmed,false);assert.equal(M.observe(a,{...check,asOf:end+day}).confirmed,true);
 for(const changes of [{referenceId:'NEAR-b'},{asOf:end+8*day},{comparison:{complete:false,close:false}}])assert.equal(M.observe(a,{...check,...changes}).confirmed,false);
 const failed=M.observe(a,{...check,asOf:end+hour,comparison:{complete:true,close:false}});assert.equal(M.observe(failed,{...check,asOf:end+day}).confirmed,false);
});
test('Movement collector: shared fixed windows, exact contracts, closed quote volume, cache and bounded discovery',async()=>{
 const {options,calls}=service(),cache=new Map(),r=await M.collect({...options,cache});
 assert.equal(r.asOf,end);assert.equal(r.rows.length,2);assert.equal(r.requests,15);assert.equal(r.rows[1].comparison.score,100);assert.ok(calls.every(p=>!/open-interest|funding|SPOT/.test(p)));
 const repeat=await M.collect({...options,cache});assert.equal(repeat.requests,3);assert.equal(repeat.cacheHits,4);
 const explore=await M.collect({...options,cache,mode:'discover'});assert.equal(explore.rows.length,6);assert.equal(explore.rows[0].sym,'NEAR');assert.ok(explore.rows.slice(1).every(x=>!options.selected.includes(x.sym)));assert.ok(explore.requests<=99);
 const next=await M.collect({...options,mode:'discover',seen:explore.rows.slice(1).map(x=>x.asset.id)});assert.equal(next.rows.length,2);
});
test('Movement collector: unavailable/ambiguous reference, cancellation, and incomplete responses fail closed',async()=>{
 const {options,assets,calls}=service();
 await assert.rejects(()=>M.collect({...options,mode:'discover',resolve:()=>assets.filter(x=>x.sym!=='NEAR')}),/NEAR indisponible/);
 const before=calls.length;await assert.rejects(()=>M.collect({...options,job:{cancelled:true}}),e=>e.cancelled);assert.equal(calls.length,before);
 const job={cancelled:false};await assert.rejects(()=>M.collect({...options,job,onProgress:p=>{if(p.requests===3)job.cancelled=true}}),e=>e.cancelled);
 const empty=await M.collect({...options,get:async()=>[]});assert.equal(empty.rows[1].comparison.score,null);
 await assert.rejects(()=>M.collect({...options,selected:['SUI']}),/invalide/);
});
test('Movement integration: the active job pauses focused scan; observation does not mutate business state',async()=>{
 const prior={'ir_scenario_locks_v871':'{}','ir_favorites_v1':'{}','ir_learning_journal_v866':'[]'},e=env(prior);
 e.run("movementBusy=true;let movementScanCalls=0;get=async()=>{movementScanCalls++;return []}");await e.run('scan()');assert.equal(e.run('movementScanCalls'),0);
 e.run("let autoCalls=0;scan=async()=>{autoCalls++};focusConfig.auto=true;lastScanAttemptAt=0");await e.run('refreshRadar()');assert.equal(e.run('autoCalls'),0);
 for(const [k,v] of Object.entries(prior))assert.equal(e.store.get(k),v);
 assert.deepEqual(plain(e.run('DECISION_SPECS')).map(x=>x[0]),['1D','4H','1H','30m','15m','5m']);
});

test('Movement collector: failed final quote refresh hides costs without fabricating or discarding historical measures',async()=>{
 const {options}=service(),get=options.get;let tickers=0;
 const r=await M.collect({...options,get:async p=>{if(p.includes('/tickers')&&++tickers===2)throw Error('quote failure');return get(p)}});
 assert.equal(r.rows[1].comparison.complete,true);assert.equal(r.rows[1].execution.spreadPct,null);assert.match(r.executionError,/quote failure/);
});
