// DOM/event unit tests, not a claim of native browser layout or physical touch validation.
const {test}=require('node:test'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');const C=require('../chart-core.js'),P=require('../chart-panel.js'),{frames}=require('./harness.cjs');
function setup(){
 const dom=new JSDOM('<main><div id="chart"></div><div class="scenarioSimulator"><input value="91.13"></div></main>',{pretendToBeVisual:true});const host=dom.window.document.querySelector('#chart');
 host.getBoundingClientRect=()=>({width:318,left:0,top:0});const bars=frames(.1)['1H'],vm=C.model({instrument:'T-USDT',timeframe:'1H',quote:'USDT',bars,version:1,overlays:[{key:'tp1',label:'TP1',value:150}]});
 const panel=P.mount(host,vm);const svg=host.querySelector('svg');svg.getBoundingClientRect=()=>({width:318,left:0,top:0});
 function pointer(type,id,x,y,pointerType='touch'){const ev=new dom.window.Event(type,{bubbles:true,cancelable:true});Object.assign(ev,{pointerId:id,clientX:x,clientY:y,pointerType,button:0});svg.dispatchEvent(ev);}
 return {dom,host,vm,panel,svg,pointer,close:()=>{panel.dispose();dom.window.close()}};
}
test('L4 DOM: tap pins a timestamp; append, zoom, pan and toggles preserve selection and simulator',()=>{
 const x=setup();try{
  x.pointer('pointerdown',1,150,130);x.pointer('pointerup',1,150,130);x.panel.redraw();const selected=x.panel.state.selectedTs;assert.ok(selected);assert.equal(x.host.querySelectorAll('.ir-selection circle').length,2);
  x.host.querySelector('[data-action=zoomIn]').click();x.panel.redraw();assert.equal(x.panel.state.selectedTs,selected);
  x.pointer('pointerdown',1,150,130);x.pointer('pointermove',1,230,132);x.pointer('pointerup',1,230,132);x.panel.redraw();assert.equal(x.panel.state.selectedTs,selected);
  const checkbox=x.host.querySelector('[data-toggle=rsi]');checkbox.checked=true;checkbox.dispatchEvent(new x.dom.window.Event('change',{bubbles:true}));x.panel.redraw();assert.ok(x.svg.getAttribute('height')>500);
  const next=C.model({...x.vm,version:2,bars:[...x.vm.bars,{...x.vm.bars.at(-1),t:x.vm.bars.at(-1).t+3600000}]});x.panel.update(next);x.panel.redraw();assert.equal(x.panel.state.selectedTs,selected);
  assert.equal(x.dom.window.document.querySelector('input[value="91.13"]').value,'91.13');assert.match(x.host.querySelector('.ir-readout').textContent,/Volume.*USDT/);
 }finally{x.close()}
});
test('L4 DOM: two-pointer pinch changes only viewport; vertical touch drag does not pan',()=>{
 const x=setup();try{
  const before=x.panel.state.to-x.panel.state.from,model=JSON.stringify(x.panel.model);
  x.pointer('pointerdown',1,100,120);x.pointer('pointerdown',2,200,120);x.pointer('pointermove',2,250,120);x.pointer('pointerup',1,100,120);x.pointer('pointerup',2,250,120);x.panel.redraw();
  assert.ok(x.panel.state.to-x.panel.state.from<before);assert.equal(JSON.stringify(x.panel.model),model);
  const range=[x.panel.state.from,x.panel.state.to];x.pointer('pointerdown',3,150,120);x.pointer('pointermove',3,152,200);x.pointer('pointerup',3,152,200);assert.deepEqual([x.panel.state.from,x.panel.state.to],range);
 }finally{x.close()}
});
test('L4 DOM: keyboard selection, three price meanings and legitimate reference control',()=>{
 const x=setup();try{
  x.svg.dispatchEvent(new x.dom.window.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));x.panel.redraw();assert.ok(x.panel.state.selectedTs);
  x.svg.dispatchEvent(new x.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));x.panel.redraw();assert.equal(x.panel.state.selectedTs,null);
  const text=x.host.querySelector('.ir-price-readings').textContent;assert.match(text,/Ticker non actualisé/);assert.match(text,/Bougie en formation/);assert.match(text,/Dernière clôture confirmée/);
  assert.equal(x.host.querySelector('option[value="engine"]').disabled,true);
 }finally{x.close()}
});
test('L7: a ticker whose supplied freshness deadline has elapsed cannot remain labelled live',()=>{
 const x=setup();try{const vm=C.model({...x.vm,ticker:{value:118,ts:Date.now()-130000,fresh:true,expiresAt:Date.now()-10000}});x.panel.update(vm);x.panel.redraw();assert.match(x.host.querySelector('.ir-price-readings').textContent,/Ticker non actualisé/);assert.doesNotMatch(x.host.querySelector('.ir-price-readings').textContent,/Ticker live/);}finally{x.close()}
});
