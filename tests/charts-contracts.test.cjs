const {test}=require('node:test'),assert=require('node:assert/strict');
const core=require('../chart-core.js');const {env,frames,plain}=require('./harness.cjs');
test('L1: immutable chart model isolates input objects and rejects ghost levels',()=>{
 const source={instrument:'T-USD_UM_XPERP-310101',timeframe:'1H',bars:frames(.1)['1H'],overlays:[{value:null},{value:0},{value:150,label:'TP3'}]};
 const m=core.model(source);assert.ok(Object.isFrozen(m.bars[0]));assert.equal(m.overlays.length,1);
 source.bars[0].c=999;source.overlays[2].value=200;assert.notEqual(m.bars[0].c,999);assert.equal(m.overlays[0].value,150);
 assert.equal(m.instrument,source.instrument);
});
test('L1/G02: timeframe, zoom and reset do not invoke the business cycle or alter storage',async()=>{
 const e=env();e.ctx.bars=frames(.1)['1H'];e.ctx.business=()=>{throw Error('Graph invoked business cycle')};
 e.run("current={id:'T-USDT'};renderScenarioMonitor=business;candidateModel=business;journalAdvance=business;scenarioChartSnapshot=RadarChartCore.immutable({instrument:'T-USDT',kind:'breakout',frames:{'1H':bars,'15m':bars},lock:{entry:100},live:101,state:'yellow',overlays:[]});");
 const before=plain([...e.store]);await e.run("setScenarioMonitorBar('breakout','1H')");e.run("zoomScenarioMonitor('breakout',30);resetScenarioChartView()");
 assert.deepEqual(plain([...e.store]),before);assert.match(e.node('scenarioChartContent').innerHTML,/bougies affichées/);
});
test('L1: consultation-only 1m load cannot enter decision frames',async()=>{
 const e=env();e.ctx.bars=frames(.1)['1H'];e.ctx.candles=async()=>e.ctx.bars;
 e.run("current={id:'T-USDT'};scenarioMonitorFrames={'15m':bars};scenarioChartSnapshot=RadarChartCore.immutable({instrument:'T-USDT',kind:'breakout',frames:scenarioMonitorFrames,lock:{},overlays:[]});");
 await e.run("setScenarioMonitorBar('breakout','1m')");assert.equal(e.run("scenarioMonitorFrames['1m']"),undefined);assert.equal(e.run("scenarioChartFrames['1m'].length"),180);
});
