const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {env,frames,plain}=require('./harness.cjs');

test('L0/G01: characterize identical formulas on different historical seeds without blessing them as engine references',()=>{
 const e=env();e.ctx.bars=frames(.1)['1H'];
 const values=[30,90,120,180].map(n=>e.run(`ema(bars.slice(-${n}),50).at(-1)`));
 [116.48108904062981,115.7494663927949,115.7129613735674,115.69078601358926].forEach((v,i)=>assert.ok(Math.abs(values[i]-v)<1e-10));
 assert.equal(e.run('stochRsi(bars.slice(-30)).k.at(-1)'),null);
 assert.equal(e.run('stochRsi(bars.slice(-90)).k.at(-1)'),.5);
});
test('L0: the six decision horizons and selected contract remain the baseline',()=>{
 const e=env();assert.deepEqual(plain(e.run('DECISION_SPECS')),[['1D',120],['4H',100],['1H',140],['30m',140],['15m',180],['5m',180]]);
 e.run("current={id:'T-USD_UM_XPERP-310101',perpId:'T-USD_UM_XPERP-310101',market:'xperp'}");
 assert.equal(e.run('activeInstrumentId()'),'T-USD_UM_XPERP-310101');
});
test('L0/G06/G07: characterize legacy overlay zero coercion and overlay-derived extrema before replacement',()=>{
 const e=env();e.ctx.bars=frames(.1)['1H'];
 assert.match(e.run("proChart(bars,bars,[{value:null,label:'Missing TP'}])"),/Missing TP 0 \$/);
 assert.match(e.run("proChart(bars,bars,[{value:150,label:'TP3'}])"),/<small>MAX<\/small><b>150,00 \$/);
});
test('L0/G04: characterize legacy observation axis before timestamp migration',()=>{
 const e=env();const html=e.run("lineSvg([1,2,3],String,[1700000000000,1700000060000,1700003660000])");
 const points=html.match(/<polyline points="([^"]+)"/)[1].split(' ').map(p=>Number(p.split(',')[0]));
 assert.deepEqual(points,[78,480,882]);
});
test('L0: inventory C01–C11 and preserve both simulator hosts',()=>{
 const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
 for(const name of ['detailAsync','graphPage','projectionChart','metricPage','proChart','lineSvg','makeSpark','radar'])assert.match(source,new RegExp('function '+name+'\\('));
 for(const metric of ['Prix','Volume','Momentum','OI','Funding','Score'])assert.ok(source.includes("'"+metric+"'"));
 assert.match(source,/id="graphSimulator"/);assert.match(source,/scenarioSimPanel\(sc,side\)/);
});
test('L0: reading a projection preserves an existing lock and simulation hypotheses',()=>{
 const e=env();e.ctx.bars=frames(.1)['1H'];e.run("current={id:'T-USDT'}; scenarioLocks.test={id:'fixed',entry:100,stop:95,tp1:105,tp2:110,tp3:115};scenarioSimValues.test={entry:91,capital:500};");
 const before=e.run('JSON.stringify({scenarioLocks,scenarioSimValues})');
 e.run("projectionChart(bars,scenarioLocks.test,110,'green',[{value:100,label:'Entrée'}],true)");
 assert.equal(e.run('JSON.stringify({scenarioLocks,scenarioSimValues})'),before);
});
