const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../chart-metrics.js'),{env,frames}=require('./harness.cjs');
test('L6: elapsed time, missing observations, signed values and score zero remain distinct',()=>{
 const points=M.observations([0,null,-2,3],[1000,2000,61000,121000]),r=M.plot(points,{kind:'line',interval:1000,signed:true});
 assert.equal(r.points[0].value,0);assert.equal(r.points[1].y,null);assert.ok(r.points[2].y>r.points[0].y);assert.ok(r.points[3].y<r.points[0].y);
 assert.equal((r.html.match(/M[\d.]+,/g)||[]).length,3);assert.doesNotMatch(r.html,/L[\d.]+,/);
 assert.equal(M.observations([1,2],[1000,null]).length,1);
 assert.doesNotMatch(M.spark([1,null,2],[1000,2000,3000]),/ L/);
});
test('L6: volume and funding use histograms, never interpolated events',()=>{
 const html=M.html([2,-3,0],String,[1000,2000,61000],'Funding',{kind:'histogram',signed:true});
 assert.match(html,/fill="#ff6974"/);assert.match(html,/data-value="0"/);assert.doesNotMatch(html,/<path/);
});
test('L6: metric selection uses timestamp and remains selected after resize/redraw',()=>{
 const e=env(),state={selectedTs:2000};const p=M.mount(e.node('metric'),[1,0,3],[1000,2000,61000],{label:'Score',state});
 assert.match(e.node('metric').querySelector('.ir-metric-readout').textContent,/Score : 0/);
 e.node('metric').querySelector('[data-step="1"]').click();assert.equal(state.selectedTs,61000);p.dispose();
 const second=M.mount(e.node('metric'),[1,0,3,4],[1000,2000,61000,62000],{state});assert.equal(second.state.selectedTs,61000);second.dispose();e.dom.window.close();
});
test('L6: metric pages expose only meaningful controls, exact quote volume, score 0 and missing funding',async()=>{
 const e=env(),now=Date.now();e.ctx.samples=[{ts:now-10000,score:0,oi:100},{ts:now-5000,score:null,oi:null},{ts:now,score:60,oi:150}];e.ctx.bars=frames(.1)['1H'];
 e.run("current={id:'T-USDT',perpId:'T-USD_UM_XPERP-310101',sym:'T'};history[current.id]={samples}");e.ctx.candles=async()=>e.ctx.bars;
 await e.run("metricPage('Score')");assert.equal(e.dom.window.document.querySelector('#bars'),null);assert.ok(e.node('metricPlot').querySelector('[data-value="0"]'));assert.equal(e.node('metricPlot').querySelectorAll('.ir-metric-point').length,2);
 await e.run("metricPage('Volume')");assert.ok(e.dom.window.document.querySelector('#bars'));assert.equal(+e.node('metricPlot').querySelector('.ir-metric-point').dataset.value,e.ctx.bars[0].v);assert.match(e.node('metricPlot').textContent,/USDT/);
 e.ctx.get=async()=>[{fundingTime:String(now),fundingRate:null},{fundingTime:String(now-1000),fundingRate:'-0.01'},{fundingTime:null,fundingRate:'0.01'}];
 await e.run("metricPage('Funding')");assert.equal(e.dom.window.document.querySelector('#bars'),null);assert.equal(e.node('metricPlot').querySelectorAll('.ir-metric-point').length,1);assert.equal(e.node('metricPlot').querySelector('.ir-metric-point').dataset.value,'-0.01');assert.match(e.node('metricMeta').textContent,/1 observations/);
 e.run('leavePage()');e.dom.window.close();
});
