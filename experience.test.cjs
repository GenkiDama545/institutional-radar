const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs'),vm=require('node:vm');
const sim=require('./trade-sim.js'),candles=require('./candle-store.js');
const input={capital:500,leverage:1,currency:'USD',side:'short',entry:91.13363233762972,stop:94.5,targets:[{price:85,pct:10},{price:83,pct:10},{price:82,pct:80}]};
test('user SHORT example: partial exits, zero allocations and full TP3',()=>{
 let r=sim.calculate(input);assert.equal(r.ok,true);assert.equal(r.net.toFixed(2),'47.92');assert.equal(r.rows[0].net.toFixed(2),'3.37');assert.equal(r.rows[2].net.toFixed(2),'40.09');
 r=sim.calculate({...input,targets:input.targets.map((t,i)=>({...t,pct:i===2?100:0}))});assert.equal(r.rows[0].net,0);assert.equal(r.net.toFixed(2),'50.11');
});
test('fees apply to actual entry and exit notionals; FX converts quantity and reporting',()=>{
 const r=sim.calculate({...input,feePct:.1,slippagePct:.05,fundingCost:2});
 const q=500/input.entry,exit=q*(85*.1+83*.1+82*.8),cost=(500+exit)*.0015+2;
 assert.ok(Math.abs(r.cost-cost)<1e-9);assert.ok(Math.abs(r.net-(47.91662591299755-cost))<1e-9);
 const eur=sim.calculate({...input,currency:'EUR',fx:1.2});assert.ok(Math.abs(eur.quantity-q*1.2)<1e-9);assert.equal((eur.net/eur.fx).toFixed(2),'47.92');
 assert.equal(sim.calculate({...input,currency:'EUR',fx:''}).ok,false);
});
test('long, risk budget, invalid stop and allocation failures',()=>{
 const r=sim.calculate({capital:1000,leverage:5,sizing:'risk',riskPct:1,entry:100,stop:95,side:'long',targets:[{price:110,pct:100}]});
 assert.equal(r.quantity,2);assert.equal(r.margin,40);assert.equal(r.risk,10);assert.equal(r.net,20);
 assert.equal(sim.calculate({...input,stop:80}).ok,false);assert.equal(sim.calculate({...input,targets:[{price:82,pct:110}]}).ok,false);
 assert.equal(sim.calculate({...input,targets:[{price:95,pct:100}]}).ok,false);
 assert.equal(sim.calculate({...input,targets:[{price:'',pct:0},{price:82,pct:100}]}).ok,true);
});
test('contract estimates require verified matching linear specifications',()=>{
 assert.equal(sim.contracts(5.486,{ctType:'linear',ctVal:'.1',ctMult:'1',ctValCcy:'X',lotSz:'1',minSz:'1'},'X').rounded,54);
 assert.equal(sim.contracts(5.486,{ctType:'inverse',ctVal:'100',ctValCcy:'USD'},'X'),null);
 assert.equal(sim.contracts(5.486,{},'X'),null);
});
const interval=300000,epoch=1800000000000;
let rows=Array.from({length:400},(_,i)=>[epoch+i*interval,100+i,102+i,99+i,101+i,10,10,1000+i,i===399?0:1]);
function source(log){return async path=>{const u=new URL('https://example.test'+path),limit=+u.searchParams.get('limit'),after=+u.searchParams.get('after');log.push(path);const a=after?rows.filter(x=>x[0]<after):rows;return a.slice(-limit).reverse()};}
test('pagination reads older pages, deduplicates and preserves order',async()=>{
 const log=[],store=candles.create(source(log),{now:()=>rows.at(-1)[0]+100});
 const data=await store.load('X','5m',400);assert.equal(data.length,400);assert.equal(data[0].t,epoch);assert.equal(data.at(-1).t,rows.at(-1)[0]);assert.match(log[1],/after=/);
});
test('incremental windows equal full refresh after mutable candle and closure updates',async()=>{
 const log=[],store=candles.create(source(log),{now:()=>rows.at(-1)[0]+100});
 await store.load('X','5m',180);
 rows[399]=[...rows[399]];rows[399][4]+=0.5;rows[399][8]=1;
 rows.push([epoch+400*interval,500,502,499,501,12,12,1200,0]);
 const warm=await store.load('X','5m',180),fresh=await candles.create(source([]),{now:()=>rows.at(-1)[0]+100}).load('X','5m',180);
 assert.deepEqual(warm,fresh);assert.ok(store.stats.reused>=175);assert.match(log[1],/limit=5/);
 const ctx=vm.createContext({console,localStorage:{getItem:()=>null,setItem:()=>{}},setTimeout,clearTimeout,setInterval,clearInterval});
 for(const f of ['market-screen.js','signal-engine.js','engine-core.js','trade-sim.js','candle-store.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
 const app=fs.readFileSync('app.js','utf8');vm.runInContext(app.slice(0,app.indexOf("document.querySelectorAll('#marketMode")),ctx);
 ctx.framesA=Object.fromEntries(['1D','4H','1H','30m','15m','5m'].map(tf=>[tf,warm.map((c,i)=>({...c,t:1700000000000+i*candles.intervals[tf]}))]));ctx.framesB=Object.fromEntries(['1D','4H','1H','30m','15m','5m'].map(tf=>[tf,fresh.map((c,i)=>({...c,t:1700000000000+i*candles.intervals[tf]}))]));
 assert.equal(vm.runInContext('JSON.stringify(adaptiveEngine(framesA,{price:501,decisionAt:1750000000000}))',ctx),vm.runInContext('JSON.stringify(adaptiveEngine(framesB,{price:501,decisionAt:1750000000000}))',ctx),'same full scenario model, scores and levels');
 ctx.state={crossed:true,triggerClose:false,volOk:true,trendOk:true,invalid:false,near:true,entry:100,stop:95,live:101,triggerKey:'15m',volRatio:2};
 assert.match(vm.runInContext('monitorTriggerStatus(state).label',ctx),/SEUIL FRANCHI/);
 ctx.state.triggerClose=true;assert.equal(vm.runInContext('monitorTriggerStatus(state).state',ctx),'green');ctx.state.invalid=true;assert.equal(vm.runInContext('monitorTriggerStatus(state).state',ctx),'red');
});
test('concurrent reads share the same request; callers cannot mutate cached bars',async()=>{
 const log=[],store=candles.create(source(log),{now:()=>rows.at(-1)[0]+100});
 const [a,b]=await Promise.all([store.load('X','5m',90),store.load('X','5m',90)]);assert.equal(log.length,1);a[0].c=-1;assert.notEqual(b[0].c,-1);
});
test('a failed refresh throws instead of presenting stale cached candles',async()=>{
 let fail=false;const store=candles.create(async p=>{if(fail)throw Error('offline');return source([])(p)},{now:()=>rows.at(-1)[0]+100});await store.load('X','5m',90);fail=true;await assert.rejects(store.load('X','5m',90),/offline/);
});
