const {test}=require('node:test'),assert=require('node:assert/strict');const {env,frames,plain}=require('./harness.cjs');
function ready(){const e=env(),f=frames(.1),now=Date.now(),id='T-USD_UM_XPERP-310101';for(const [tf,bars] of Object.entries(f)){const ms=e.run(`timeframeMs('${tf}')`),end=Math.floor(now/ms)*ms;bars.forEach((b,i)=>b.t=end-(bars.length-1-i)*ms)}e.ctx.f=f;
 e.ctx.candles=async(inst,tf,n)=>f[tf].slice(-n);e.ctx.get=async p=>p.includes('/instruments')?[{instId:id,ruleType:'xperp',state:'live'}]:[{last:String(f['5m'].at(-2).c),bidPx:'117',askPx:'117.01',ts:String(Date.now())}];
 e.run(`current={id:'${id}',perpId:'${id}',sym:'T',market:'xperp',price:117,volUsd:1e6,vol:1e6,medVol:1e6,marketFresh:true,marketTs:Date.now(),spreadPct:.1,tier:['small','Petite']};all=[current];current.scenarioModel=candidateModel(f,current);current.directional=current.scenarioModel.directional;bindScenarioSim=()=>{}`);return e;
}
test('L5: projection gestures preserve scenario, model and journal; periodic refresh preserves actual simulator DOM',async()=>{
 const e=ready();await e.run("openScenarioMonitor(current.id,'breakout')");
 const controller=e.run("sharedChartViews.get('scenarioPlot').controller");assert.ok(controller);assert.equal(controller.panel.model.reference,'engine');
 const lock=e.run('JSON.stringify(scenarioLocks)'),model=e.run('JSON.stringify(current.scenarioModel)'),journal=e.store.get('ir_learning_journal_v866');
 const input=e.dom.window.document.querySelector('#sim_entry');input.value='111.123';const element=input;
 for(const action of ['zoomIn','zoomOut','previous','next','levels','latest','reset'])controller.panel.action(action);controller.panel.redraw();
 await e.run("setScenarioMonitorBar('breakout','1H')");
 assert.equal(e.run('JSON.stringify(scenarioLocks)'),lock);assert.equal(e.run('JSON.stringify(current.scenarioModel)'),model);assert.equal(e.store.get('ir_learning_journal_v866'),journal);
 await e.run("renderScenarioMonitor('breakout',false)");assert.equal(e.dom.window.document.querySelector('#sim_entry'),element);assert.equal(element.value,'111.123');assert.equal(e.run('JSON.stringify(scenarioLocks)'),lock);
 e.run('leavePage()');e.dom.window.close();
});
test('L5: Price and deep routes share the same host; controls do not change simulator inputs',async()=>{
 const e=ready();e.ctx.subscribeCandleStream=()=>({stop(){}});await e.run("metricPage('Prix')");
 assert.ok(e.node('garea').querySelector('.ir-chart'));assert.ok(e.node('graphSimulator').querySelector('.scenarioSimulator'));
 const input=e.dom.window.document.querySelector('#sim_entry');input.value='101.125';const host=e.run("sharedChartViews.get('garea').controller");
 host.panel.action('zoomIn');host.panel.action('previous');await e.node('graphRefresh').onclick();assert.equal(input.value,'101.125');assert.equal(e.dom.window.document.querySelector('#sim_entry'),input);
 e.run('leavePage()');e.dom.window.close();
});
test('L5: structural adapter reads existing levels and reports their actual horizon/date without zones',()=>{
 const e=ready();const before=e.run('JSON.stringify(current.scenarioModel)');const output=plain(e.run("RadarChartHost.structure(current.scenarioModel.F['1H'],'1H')"));
 assert.ok(output.some(o=>o.key==='structure-resistance'));assert.ok(output.every(o=>o.timeframe==='1H'&&o.asOf>0&&!('bounds' in o)));assert.equal(e.run('JSON.stringify(current.scenarioModel)'),before);e.dom.window.close();
});
