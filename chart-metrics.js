/* Timestamp-based observed metrics. Missing values remain gaps; no analysis or interpolation. */
(function(root){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function observations(values,times){return values.map((value,i)=>({t:times?.[i],value:Number.isFinite(value)?value:null})).filter(p=>Number.isFinite(p.t)).sort((a,b)=>a.t-b.t);}
 function plot(points,{width=800,height=280,kind='line',interval=0,signed=false,formatter=String,label='Valeur'}={}){
  const valid=points.filter(p=>Number.isFinite(p.value));if(!valid.length)return {html:'<div class="empty">Aucune observation disponible pour cette source et cette période.</div>',points:[]};
  const left=12,right=76,top=24,bottom=height-44,plotW=Math.max(40,width-left-right),first=points[0].t,last=points.at(-1).t,span=last-first||1;
  let low=Math.min(...valid.map(p=>p.value)),high=Math.max(...valid.map(p=>p.value));if(signed||kind==='histogram'){low=Math.min(0,low);high=Math.max(0,high);}const pad=(high-low||Math.abs(high)||1)*.08;low-=pad;high+=pad;
  const x=t=>left+(last===first ? .5 :(t-first)/span)*plotW,y=v=>bottom-(v-low)/(high-low)*(bottom-top),svg=[];
  for(let i=0;i<=4;i++){const v=high-(high-low)*i/4;svg.push(`<line x1="${left}" x2="${width-right}" y1="${y(v)}" y2="${y(v)}" stroke="#252a31"/><text x="${width-right+6}" y="${y(v)+4}" fill="#b6c4cd">${esc(formatter(v))}</text>`);}
  const tickCount=Math.max(1,Math.floor(plotW/105));for(let i=0;i<=tickCount;i++){const t=first+span*i/tickCount,d=new Date(t),label=span>86400000?d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}):d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});svg.push(`<text x="${left+plotW*i/tickCount}" y="${height-14}" fill="#b6c4cd" text-anchor="${i===0?'start':i===tickCount?'end':'middle'}">${label}</text>`);}
  if(signed||kind==='histogram')svg.push(`<line x1="${left}" x2="${width-right}" y1="${y(0)}" y2="${y(0)}" stroke="#62717a" stroke-dasharray="3 3"/>`);
  let previous=null,path=[];const mapped=points.map((p,i)=>({...p,x:x(p.t),y:p.value==null?null:y(p.value),i}));
  for(const p of mapped){if(p.value==null){previous=null;continue;}
   if(kind==='line'){path.push(`${previous&&(!interval||p.t-previous.t<=interval*1.5)?'L':'M'}${p.x},${p.y}`);previous=p;}
   if(kind==='histogram')svg.push(`<rect x="${p.x-3}" y="${Math.min(p.y,y(0))}" width="6" height="${Math.max(1,Math.abs(p.y-y(0)))}" fill="${p.value>=0?'#45dc7a':'#ff6974'}"/>`);
   svg.push(`<circle class="ir-metric-point" data-ts="${p.t}" data-value="${p.value}" cx="${p.x}" cy="${p.y}" r="${kind==='scatter'?3:2}" fill="#65b8ff"><title>${esc(new Date(p.t).toLocaleString('fr-FR',{timeZoneName:'short'}))} · ${esc(formatter(p.value))}</title></circle>`);
  }
  if(path.length)svg.push(`<path d="${path.join(' ')}" fill="none" stroke="#65b8ff" stroke-width="1.8"/>`);
  return {points:mapped,html:`<div class="ir-metric-axis">${esc(label)}</div><svg class="ir-metric-plot" viewBox="0 0 ${width} ${height}" height="${height}" tabindex="0" role="img" aria-label="${esc(label)} : observations datées, flèches pour sélectionner"><rect width="100%" height="100%" fill="#0b0d11" rx="12"/>${svg.join('')}<g class="ir-metric-selection"></g></svg><div class="ir-metric-summary">MIN ${esc(formatter(Math.min(...valid.map(p=>p.value))))} · Dernière observation ${esc(formatter(valid.at(-1).value))} · MAX ${esc(formatter(Math.max(...valid.map(p=>p.value))))}</div>`,first,last,left,plotW};
 }
 function html(values,formatter,times,label='Valeur',options={}){return plot(observations(values,times),{...options,formatter,label}).html;}
 function spark(values,times,{kind='line',interval=0}={}){
  const points=observations(values||[],times),valid=points.filter(p=>p.value!=null);if(valid.length<2)return '';
  const low=Math.min(...valid.map(p=>p.value)),high=Math.max(...valid.map(p=>p.value)),span=points.at(-1).t-points[0].t||1,x=t=>2+(t-points[0].t)/span*236,y=v=>40-(v-low)/(high-low||1)*36;let parts=[],previous=null;
  for(const p of points){if(p.value==null){previous=null;continue;}if(kind==='scatter')parts.push(`<circle cx="${x(p.t)}" cy="${y(p.value)}" r="2" fill="#65b8ff"/>`);else{parts.push(`<path d="M${x(p.t)},${y(p.value)}${previous&&(!interval||p.t-previous.t<=interval*1.5)?' L'+x(previous.t)+','+y(previous.value):''}" stroke="#65b8ff" fill="none" stroke-width="2"/>`);previous=p;}}
  return `<div class="spark"><svg viewBox="0 0 240 42" preserveAspectRatio="none" role="img" aria-label="Aperçu des observations datées">${parts.join('')}</svg></div>`;
 }
 function mount(host,values,times,options={}){
  const document=host.ownerDocument,win=document.defaultView,points=observations(values,times),state=options.state||{selectedTs:null},formatter=options.formatter||String;
  let width=host.getBoundingClientRect().width||800,result,observer;const date=t=>new Date(t).toLocaleString('fr-FR',{timeZoneName:'short'});
  function inspect(t){state.selectedTs=t;const p=result.points.find(p=>p.t===t);host.querySelector('.ir-metric-readout').textContent=p?`${date(p.t)} · ${options.label||'Valeur'} : ${p.value==null?'indisponible':formatter(p.value)}`:'Observation hors de cette période.';const group=host.querySelector('.ir-metric-selection');if(group)group.innerHTML=p&&p.y!=null?`<line x1="${p.x}" x2="${p.x}" y1="24" y2="236" stroke="#f5f3ee" stroke-dasharray="3 3"/><circle cx="${p.x}" cy="${p.y}" r="5" fill="none" stroke="#f5f3ee"/>`:'';}
  function step(delta){let i=points.findIndex(p=>p.t===state.selectedTs);if(i<0)i=points.length-1;const p=points[Math.max(0,Math.min(points.length-1,i+delta))];if(p)inspect(p.t);}
  function draw(){result=plot(points,{...options,width});host.innerHTML=`<div class="ir-metric">${result.html}<div class="ir-metric-controls"><button type="button" data-step="-1" aria-label="Observation précédente">←</button><button type="button" data-step="1" aria-label="Observation suivante">→</button></div><div class="ir-metric-readout" role="status">Touchez un point pour sa date et sa valeur. Fuseau : ${esc(Intl.DateTimeFormat().resolvedOptions().timeZone)}.</div></div>`;const svg=host.querySelector('svg');if(svg){svg.addEventListener('pointerdown',ev=>{const x=ev.clientX-svg.getBoundingClientRect().left;const p=result.points.reduce((best,p)=>!best||Math.abs(p.x-x)<Math.abs(best.x-x)?p:best,null);if(p)inspect(p.t)});svg.onkeydown=ev=>{if(['ArrowLeft','ArrowRight'].includes(ev.key)){ev.preventDefault();step(ev.key==='ArrowLeft'?-1:1)}};}for(const b of host.querySelectorAll('[data-step]'))b.onclick=()=>step(Number(b.dataset.step));if(state.selectedTs!=null)inspect(state.selectedTs);}
  draw();if(typeof win.ResizeObserver==='function'){observer=new win.ResizeObserver(e=>{const w=e[0]?.contentRect.width;if(w>0&&w!==width){width=w;draw();}});observer.observe(host);}
  return {dispose(){observer?.disconnect();host.replaceChildren()},state};
 }
 const api={observations,plot,html,spark,mount};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.RadarChartMetrics=api;
})(typeof globalThis!=='undefined'?globalThis:this);
