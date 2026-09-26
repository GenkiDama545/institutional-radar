const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs');
const {env,plain}=require('./harness.cjs'),baseline=require('./fixtures/charts-business-v8916.json');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
test('L7: audited V8.9.16 business functions, engines, storage and horizons remain byte-identical',()=>{
 const e=env();for(const [name,expected] of Object.entries(baseline.functions))assert.equal(hash(e.run(name+'.toString()')),expected,name);
 for(const [name,expected] of Object.entries(baseline.files))assert.equal(hash(fs.readFileSync(require.resolve('../'+name))),expected,name);
 for(const [name,expected] of Object.entries(baseline.constants))assert.deepEqual(plain(e.run(name)),expected,name);
 e.dom.window.close();
});
test('L7: old local data survives chart preferences and chart consultation without migration',()=>{
 const initial={'ir_scan_history_v866':JSON.stringify({'T-USDT':{samples:[{ts:1700000000000,score:0}]}}),'ir_scenario_locks_v871':JSON.stringify({'T-USDT::breakout':{id:'legacy',entry:100,stop:95,tp1:110}}),'ir_learning_journal_v866':'[]','ir_favorites_v1':'{}'};
 const e=env(initial);e.run("RadarChartCore.state({rsi:true});localStorage.setItem(RadarChartHost.preferenceKey,JSON.stringify({rsi:true}))");
 for(const [key,value] of Object.entries(initial))assert.equal(e.store.get(key),value,key);e.dom.window.close();
});
test('L7: isolated prototype and npm test tooling never enter the application precache',()=>{
 for(const name of ['index.html','sw.js'])assert.doesNotMatch(fs.readFileSync(require.resolve('../'+name),'utf8'),/lightweight-charts|prototypes\/|node_modules/);
});
