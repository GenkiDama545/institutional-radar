// Static SVG evidence and Node timing only. This is NOT a browser/native-touch acceptance test.
// node tests/chart-evidence.cjs <output-directory> [baseline-app.js]
const fs=require('node:fs'),path=require('node:path'),{performance}=require('node:perf_hooks');
const {env}=require('./harness.cjs'),C=require('../chart-core.js'),S=require('../chart-series.js'),P=require('../chart-panel.js');
const output=process.argv[2];if(!output)throw Error('Output directory required');fs.mkdirSync(output,{recursive:true});
const e=env(),bars=Array.from({length:3000},(_,i)=>{const c=100+i*.007+Math.sin(i/7)*1.8,o=c+Math.sin(i)*.3;return {t:1700000000000+i*3600000,o,c,h:Math.max(o,c)+.3,l:Math.min(o,c)-.25,v:12000+(i%17)*1000,confirm:i===2999?0:1}}),math=e.run('chartMath()');
const series=S.calculate(bars,math),vm=C.model({instrument:'T-USDT',timeframe:'1H',quote:'USDT',bars,series,overlays:[{key:'entry',value:120.8,label:'Entrée'},{key:'stop',value:118.5,label:'SL / invalidation'},{key:'tp1',value:5000,label:'TP1'}]});
let baseline=null;if(process.argv[3]){baseline=env({},fs.readFileSync(process.argv[3],'utf8'));baseline.ctx.bars=bars.slice(-180);}
const rows=[];
for(const width of [288,318,696,1368]){
 const state=C.state();state.selectedTs=bars.at(-8).t;state.pinned=true;const result=P.render(vm,state,width);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${result.geometry.height}" viewBox="0 0 ${width} ${result.geometry.height}"><style>text{font:11px sans-serif}</style>${result.svg}</svg>`;
 fs.writeFileSync(path.join(output,'candidate-'+width+'.svg'),svg);
 if(baseline){baseline.ctx.window={innerWidth:width+72};const html=baseline.run("proChart(bars,bars,[{value:5000,label:'TP1'}])"),svg=html.match(/<svg[\s\S]*?<\/svg>/)[0].replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ');fs.writeFileSync(path.join(output,'baseline-'+width+'.svg'),svg);}
 const timings=[];for(let i=0;i<50;i++){const start=performance.now();P.render(vm,state,width);timings.push(performance.now()-start);}timings.sort((a,b)=>a-b);
 rows.push({containerWidth:width,loaded:bars.length,visible:result.visible.length,candleBodyPx:result.bodyWidth,svgHeight:result.geometry.height,medianNodeMs:timings[25],p95NodeMs:timings[47],note:'SVG string generation only; no layout, paint, browser or native touch measurement'});
}
fs.writeFileSync(path.join(output,'static-render-results.json'),JSON.stringify(rows,null,2)+'\n');console.log(JSON.stringify(rows,null,2));e.dom.window.close();baseline?.dom.window.close();
