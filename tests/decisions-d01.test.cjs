const {test}=require('node:test'),assert=require('node:assert/strict');
const {env,frames}=require('./harness.cjs');
test('D01: computed ADX reaches trigger signal and confidence without new weights',()=>{
 const {ctx,run}=env();ctx.f=frames(.1);
 const e=run("adaptiveEngine(f,{price:f['5m'].at(-2).c,perpId:'T-USD_UM_XPERP-310101'})");
 assert.ok(e.trigger.t.adx>=25);assert.equal(e.signals.find(x=>x.name==='ADX').status,'positive');
 assert.ok(e.confluences.includes('ADX '+e.trigger.t.adx.toFixed(0)));
});
test('D01: ADX resolves a trigger tie using the existing +1 bonus',()=>{
 const {ctx,run}=env();ctx.f=frames(.1);
 run(`const originalTF=timeframeFeatures;let calls=0;timeframeFeatures=cs=>{const f=originalTF(cs);f.t.adx=(++calls===2?30:10);return f}`);
 const e=run("adaptiveEngine(f,{price:f['5m'].at(-2).c,perpId:'T-USD_UM_XPERP-310101'})");assert.equal(e.triggerKey,'15m');
});
