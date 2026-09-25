const {test}=require('node:test'),assert=require('node:assert/strict');const {env,frames,plain}=require('./harness.cjs');
test('L2/G01: zoom and history prepend preserve every existing indicator value and calculation version',()=>{
 const e=env();e.ctx.bars=frames(.1)['1H'];e.run("provider=RadarChartSeries.create(chartMath());provider.update(bars.slice(90));");
 const before=plain(e.run('provider.snapshot()'));
 e.run('provider.aligned(bars.slice(-30));provider.aligned(bars.slice(-60));provider.update(bars)');
 const after=plain(e.run('provider.snapshot()'));assert.deepEqual(after.series,before.series);assert.equal(after.version,before.version);assert.equal(after.bars.length,180);
 assert.equal(e.run('provider.aligned(bars.slice(0,20)).ema20[0]'),null);
 e.run('provider.rebase()');assert.ok(e.run('provider.snapshot().version')>before.version);
 assert.notEqual(e.run('provider.snapshot().series.ema50[bars.at(-1).t]'),before.series.ema50[e.ctx.bars.at(-1).t]);
});
test('L2: reference mode uses exactly the confirmed input array supplied by the engine',()=>{
 const e=env();e.ctx.f=frames(.1);e.run("model=candidateModel(f,{price:117,perpId:'T-USD_UM_XPERP-310101'});provider=RadarChartSeries.create(chartMath(),{reference:'engine'});provider.update(f['1H'],{referenceBars:model.F['1H'].cs});");
 const last=e.run("model.F['1H'].cs.at(-1).t");
 assert.equal(e.run(`provider.snapshot().series.rsi[${last}]`),e.run("model.F['1H'].rsi"));
 assert.equal(e.run(`provider.snapshot().series.ema50[${last}]`),e.run("ema(model.F['1H'].cs,50).at(-1)"));
 assert.equal(e.run("provider.snapshot().series.rsi[f['1H'].at(-1).t]"),undefined);
});
test('L2: no data mutation and no Math implementation introduced by the provider',()=>{
 const e=env();e.ctx.bars=frames(.1)['1H'];const original=JSON.stringify(e.ctx.bars);
 e.run('provider=RadarChartSeries.create(chartMath());provider.update(bars);provider.aligned(bars.slice(-30))');
 assert.equal(JSON.stringify(e.ctx.bars),original);
});
