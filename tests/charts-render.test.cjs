const {test}=require('node:test'),assert=require('node:assert/strict');const C=require('../chart-core.js'),P=require('../chart-panel.js');const {frames}=require('./harness.cjs');
function fixture(){return C.model({instrument:'T-USD_UM_XPERP-310101',quote:'USD',timeframe:'1H',bars:frames(.1)['1H'],overlays:[{key:'entry',value:116,label:'Entrée'},{key:'tp1',value:1000,label:'TP1'},{key:'tp3',value:5000,label:'TP3'}],series:{ema20:{[frames(.1)['1H'].at(-1).t]:1e6}}});}
test('L4: container density gives readable bodies on mobile with thousands of available candles',()=>{
 const vm=fixture(),many=C.model({...vm,bars:Array.from({length:3000},(_,i)=>({...vm.bars[i%vm.bars.length],t:1700000000000+i*3600000}))});
 for(const width of [240,288,318,360,390,768,1440]){const state=C.state(),r=P.render(many,state,width);assert.ok(r.bodyWidth>=5.5,`${width}: ${r.bodyWidth}`);assert.ok(r.visible.length<=Math.ceil((width-84)/9));assert.ok(r.visible.length>=10);assert.ok(r.visible.length<3000);}
});
test('L4/G07/G08: price auto-fit includes only visible candles; distant levels remain truthful',()=>{
 const vm=fixture(),s=C.state({tp3:true});const r=P.render(vm,s,318),max=Math.max(...r.visible.map(c=>c.h));
 assert.equal(r.geometry.range.high,max);assert.ok(r.geometry.range.max<200);assert.match(r.levels,/1 000 USD ↑ hors champ/);assert.doesNotMatch(r.svg,/data-value="1000"/);
 s.fitLevels=true;const fitted=P.render(vm,s,318);assert.ok(fitted.geometry.range.max>5000);assert.match(fitted.svg,/data-value="5000"/);assert.equal(fitted.geometry.range.high,max);
});
test('L4: selection stays anchored to timestamp through viewport changes and data append/prepend',()=>{
 const vm=fixture(),s=C.state();P.render(vm,s,390);s.selectedTs=vm.bars.at(-10).t;s.pinned=true;const ts=s.selectedTs;
 const frozen=JSON.stringify(vm);C.zoom(vm,s,390,.5);C.pan(vm,s,390,-.5);P.render(vm,s,288);assert.equal(s.selectedTs,ts);assert.equal(JSON.stringify(vm),frozen);
 const next=C.model({...vm,bars:[{...vm.bars[0],t:vm.bars[0].t-3600000},...vm.bars,{...vm.bars.at(-1),t:vm.bars.at(-1).t+3600000}]});P.render(next,s,390);assert.equal(s.selectedTs,ts);assert.match(P.readout(next,s),/High|Volume/);
});
test('L4: timestamp gaps are genuine empty space and optional indicators cannot change data',()=>{
 const vm=fixture(),s=C.state();P.render(vm,s,390);const g=P.geometry(vm,s,390),a=vm.bars.at(-10).t;assert.equal(Math.round((g.x(a+3600000*3)-g.x(a))/g.step),3);
 const before=JSON.stringify(vm);s.visibility.rsi=true;s.visibility.stoch=true;const result=P.render(vm,s,390);assert.ok(result.geometry.height>600);assert.equal(JSON.stringify(vm),before);
 s.visibility.rsi=false;s.visibility.stoch=false;assert.ok(P.render(vm,s,390).geometry.height<500);
});
