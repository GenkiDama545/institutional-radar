const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('../position-risk.js'),{env,plain}=require('./harness.cjs');
const levels={entry:5,stop:4.8,side:'long'},profile={amount:100,leverage:10,basis:'margin',maxLoss:20};
test('Margin and total position are explicit; leverage is counted exactly once for both directions',()=>{
 const a=R.evaluate(levels,profile),b=R.evaluate(levels,{...profile,basis:'notional'}),short=R.evaluate({entry:5,stop:5.2,side:'short'},profile);
 assert.equal(a.notional,1000);assert.equal(a.margin,100);assert.ok(Math.abs(a.loss-40)<1e-10);assert.ok(Math.abs(short.loss-a.loss)<1e-10);
 assert.equal(b.notional,100);assert.equal(b.margin,10);assert.ok(Math.abs(b.loss-4)<1e-10);
 assert.equal(R.evaluate(levels,R.defaults).needsBasis,true);
 assert.equal(R.evaluate(levels,{...profile,maxLoss:null}).overBudget,null);
});
test('Budget sizing keeps the technical stop fixed and rejects invalid inputs',()=>{
 const before=JSON.stringify({levels,profile}),r=R.evaluate(levels,profile);
 assert.equal(r.overBudget,true);assert.ok(Math.abs(r.maxMargin-50)<1e-10);assert.ok(Math.abs(r.maxNotional-500)<1e-10);
 assert.equal(R.evaluate(levels,{...profile,maxLoss:40}).overBudget,false);
 assert.equal(JSON.stringify({levels,profile}),before);
 for(const p of [{amount:0},{leverage:11},{amount:Infinity},{amount:1e308},{maxLoss:-1},{maxLoss:0}])assert.equal(R.evaluate(levels,{...profile,...p}).ok,false);
 for(const l of [{stop:5.1},{stop:0},{side:'invalid'},{entry:NaN}])assert.equal(R.evaluate({...levels,...l},profile).ok,false);
 assert.equal(R.evaluate(null,profile).ok,false);assert.deepEqual(R.profile(null),R.defaults);
 assert.equal(R.evaluate({entry:5,stop:4.4,side:'long'},profile).marginExhausted,true);
});
test('Profile changes persist separately, leave old state intact, and never overwrite saved simulator inputs',()=>{
 const key='ir_scenario_locks_v871',old='{"locked":{"entry":5,"stop":4.8}}',e=env({[key]:old});
 e.run("current={id:'NEAR',market:'xperp'}");
 assert.equal(e.run("scenarioSimRead({id:'new'},'long').capital"),'');
 e.run("savePositionRiskSetting('basis','margin');savePositionRiskSetting('maxLoss','20')");
 assert.equal(e.run("scenarioSimRead({id:'new'},'long').capital"),100);
 assert.equal(e.run("scenarioSimRead({id:'new'},'long').leverage"),10);
 e.run("scenarioSimValues['NEAR|long|saved']={capital:27,leverage:3};savePositionRiskSetting('basis','notional')");
 assert.equal(e.run("scenarioSimRead({id:'new'},'long').capital"),10);
 assert.deepEqual(plain(e.run("scenarioSimRead({id:'saved'},'long')")),{capital:27,leverage:3});
 assert.equal(JSON.parse(e.store.get(R.key)).maxLoss,20);assert.equal(e.store.get(key),old);
 assert.match(e.run("positionRiskSummary({entry:5,stop:4.8,side:'long'})"),/Perte de prix dans le budget/);
 e.run("savePositionRiskSetting('basis','margin')");assert.match(e.run("positionRiskSummary({entry:5,stop:4.8,side:'long'})"),/SL trop coûteux/);
 e.run("savePositionRiskSetting('amount','')");assert.equal(e.run('riskSimulationDefaults().margin'),'');
});
test('Simulator risk includes entered costs in quote USD even when its capital is EUR',()=>{
 const e=env();e.run("current={id:'NEAR',market:'xperp'};positionRiskProfile={amount:100,leverage:10,basis:'margin',maxLoss:40}");
 const out=e.node('simRiskOut');e.ctx.v={capital:50,leverage:10,currency:'EUR',fx:2,sizing:'margin',entry:5,stop:4.8,side:'long',feePct:.1,slippagePct:0,fundingCost:0,targets:[{price:5.5,pct:100}]};
 e.run('renderSimulatorPositionRisk(v,RadarSim.calculate(v))');
 assert.match(out.innerHTML,/1[\s\u202f]000,00 USD/);assert.match(out.innerHTML,/41,96 USD/);assert.match(out.innerHTML,/budget dépassé/);
});
