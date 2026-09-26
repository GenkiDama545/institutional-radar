/* Isolated evaluation adapter; never imported by index.html or the service worker. */
(function(root){
 'use strict';
 function mount(container,vm,onSelect=()=>{}){
  const lib=root.LightweightCharts;
  const chart=lib.createChart(container,{autoSize:true,height:560,layout:{background:{type:'solid',color:'#0b0d11'},textColor:'#c4cad3',fontFamily:'Inter,system-ui,sans-serif',attributionLogo:true},grid:{vertLines:{color:'#171c22'},horzLines:{color:'#20252c'}},timeScale:{timeVisible:true,secondsVisible:false,barSpacing:9,minBarSpacing:4},handleScroll:{mouseWheel:false,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},handleScale:{mouseWheel:true,pinch:true},localization:{locale:'fr-FR',timeFormatter:t=>new Date(t*1000).toLocaleString('fr-FR',{timeZoneName:'short'})}});
  const candles=chart.addSeries(lib.CandlestickSeries,{upColor:'#45dc7a',downColor:'#ff6974',wickUpColor:'#45dc7a',wickDownColor:'#ff6974',borderVisible:false,priceLineVisible:false});
  const volume=chart.addSeries(lib.HistogramSeries,{priceFormat:{type:'volume'},priceLineVisible:false,lastValueVisible:false},1);
  candles.setData(vm.bars.map(c=>({time:c.t/1000,open:c.o,high:c.h,low:c.l,close:c.c})));
  volume.setData(vm.bars.map(c=>({time:c.t/1000,value:c.v,color:c.c>=c.o?'#45dc7a99':'#ff697499'})));
  for(const [key,color,pane] of [['ema20','#ffd166',0],['ema50','#bd91ff',0],['rsi','#65b8ff',2],['stochK','#bd91ff',3],['stochD','#65b8ff',3]]){
   const s=chart.addSeries(lib.LineSeries,{color,lineWidth:2,priceLineVisible:false,lastValueVisible:false,...(pane===0?{autoscaleInfoProvider:()=>null}:{})},pane);
   s.setData(vm.bars.map(c=>Number.isFinite(vm.series[key]?.[c.t])?{time:c.t/1000,value:vm.series[key][c.t]}:{time:c.t/1000}));
  }
  for(const level of vm.overlays) candles.createPriceLine({price:level.value,color:level.color,lineWidth:1,lineStyle:lib.LineStyle.Dashed,axisLabelVisible:true,title:level.label});
  const count=Math.max(12,Math.floor((container.clientWidth-76)/9));chart.timeScale().setVisibleLogicalRange({from:Math.max(0,vm.bars.length-count),to:vm.bars.length});
  chart.subscribeClick(p=>{if(p.time)onSelect(vm.bars.find(c=>c.t===p.time*1000))});
  return {chart,candles,dispose:()=>chart.remove()};
 }
 root.RadarLightweightPrototype={mount};
})(typeof globalThis!=='undefined'?globalThis:this);
