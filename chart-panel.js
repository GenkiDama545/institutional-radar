/* SVG renderer and consultation gestures. Dependencies: chart-core only. */
(function(root){
 'use strict';
 const C=typeof module!=='undefined'&&module.exports?require('./chart-core.js'):root.RadarChartCore;
 const palette={up:'#45dc7a',down:'#ff6974',ema20:'#ffd166',ema50:'#bd91ff',supertrend:'#65b8ff',rsi:'#65b8ff',stochK:'#bd91ff',stochD:'#65b8ff'};
 const names={ema20:'EMA 20',ema50:'EMA 50',supertrend:'Supertrend 10/3',rsi:'RSI 14',stoch:'StochRSI 14 · K3/D3',tp2:'TP2',tp3:'TP3',structure:'Structure du moteur',closedPrice:'Ligne clôture confirmée',formingPrice:'Ligne bougie en formation'};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const number=v=>!Number.isFinite(v)?'N/D':v.toLocaleString('fr-FR',{maximumSignificantDigits:17});
 const axisNumber=(v,step)=>Math.abs(v)>0&&Math.abs(v)<1e-6?v.toExponential(3):v.toLocaleString('fr-FR',{maximumFractionDigits:Math.max(0,Math.min(8,1-Math.floor(Math.log10(Math.max(step,1e-12)))))});
 const short=v=>!Number.isFinite(v)?'N/D':Math.abs(v)>=1e6?number(v/1e6)+' M':Math.abs(v)>=1e3?number(Math.round(v)/1000)+' k':number(v);
 const stamp=t=>Number.isFinite(t)?new Date(t).toLocaleString('fr-FR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}):'N/D';
 const timezone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone||'locale';
 function geometry(vm,s,width){
  C.viewport(vm,s,width);const priceH=width<500?310:360,plotW=Math.max(40,width-84),top=24,volTop=top+priceH+32,volH=64;
  let end=volTop+volH,panels={};if(s.visibility.rsi){panels.rsi={top:end+28,height:84};end+=112;}if(s.visibility.stoch){panels.stoch={top:end+28,height:84};end+=112;}
  const range=C.extent(vm,s),x=t=>8+(t-s.from)/Math.max(1,s.to-s.from)*plotW,y=v=>top+(range.max-v)/Math.max(1e-18,range.max-range.min)*priceH;
  return {width,plotW,top,priceH,volTop,volH,end,height:end+44,panels,range,x,y,step:plotW*C.intervals[vm.timeframe]/Math.max(1,s.to-s.from)};
 }
 function path(vm,s,key,g,area,low,high){
  let parts=[],previous=null;const values=vm.series[key]||{},iv=C.intervals[vm.timeframe];
  for(const c of vm.bars){if(c.t<s.from-iv||c.t>s.to+iv)continue;const value=values[c.t];if(!Number.isFinite(value)){previous=null;continue;}
   const y=area.top+area.height-(value-low)/Math.max(1e-18,high-low)*area.height;
   parts.push(`${previous!=null&&c.t-previous<=iv*1.5?'L':'M'}${g.x(c.t).toFixed(2)},${y.toFixed(2)}`);previous=c.t;
  }return parts.join(' ');
 }
 function selected(vm,s){return vm.bars.find(c=>c.t===(s.pinned?s.selectedTs:s.hoverTs??s.selectedTs));}
 function readout(vm,s){
  const c=selected(vm,s);if(!c)return 'Touchez ou survolez une bougie. Les flèches permettent une inspection précise.';
  const fields=[['Open',c.o],['High',c.h],['Low',c.l],['Close',c.c]].map(([k,v])=>`<span><b>${k}</b> ${number(v)} ${esc(vm.quote)}</span>`).join('');
  const indicators=['ema20','ema50','supertrend','rsi',...(s.visibility.stoch?['stochK','stochD']:[])].filter(k=>s.visibility[k]||k.startsWith('stoch')).map(k=>`<span>${esc(names[k]||k)} ${number(vm.series[k]?.[c.t])}</span>`).join('');
  return `<b>${stamp(c.t)} · ${c.confirm===1?'Confirmée':'En formation · provisoire'}</b><div class="ir-ohlc">${fields}<span><b>Volume</b> ${number(c.v)} ${esc(vm.quote)}</span></div><div class="ir-indicator-values">${indicators}</div>`;
 }
 function render(vm,s,width=800){
  const g=geometry(vm,s,Math.max(180,width)),cs=C.visible(vm,s),iv=C.intervals[vm.timeframe],svg=[],q=esc(vm.quote),levels=C.activeOverlays(vm,s),maxVol=Math.max(1,...cs.map(c=>c.v));
  const body=Math.min(C.density.maxBody,Math.max(1.5,g.step*C.density.bodyFraction));
  svg.push(`<defs><clipPath id="price-clip"><rect x="8" y="${g.top}" width="${g.plotW}" height="${g.priceH}"/></clipPath></defs><rect width="100%" height="100%" fill="#0b0d11" rx="12"/>`);
  for(let i=0;i<=5;i++){const v=g.range.max-(g.range.max-g.range.min)*i/5,y=g.y(v);svg.push(`<line x1="8" x2="${8+g.plotW}" y1="${y}" y2="${y}" stroke="#20252c"/><text x="${14+g.plotW}" y="${y+4}" fill="#c4cad3">${esc(axisNumber(v,(g.range.max-g.range.min)/5))}</text>`);}
  const ticks=Math.max(2,Math.floor(g.plotW/110));for(let i=0;i<=ticks;i++){const t=s.from+(s.to-s.from)*i/ticks,x=g.x(t),d=new Date(t),label=(s.to-s.from)>86400000?d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}):d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});svg.push(`<line x1="${x}" x2="${x}" y1="${g.top}" y2="${g.end}" stroke="#171c22"/><text x="${x}" y="${g.height-12}" text-anchor="${i===0?'start':i===ticks?'end':'middle'}" fill="#b6c4cd">${label}</text>`);}
  svg.push(`<text x="8" y="16" fill="#b6c4cd">Prix · ${q}</text><g clip-path="url(#price-clip)">`);
  for(const c of cs){const x=g.x(c.t),color=c.c>=c.o?palette.up:palette.down;svg.push(`<g class="ir-candle" data-ts="${c.t}"><line x1="${x}" x2="${x}" y1="${g.y(c.h)}" y2="${g.y(c.l)}" stroke="${color}" stroke-width="1.4"/><rect x="${x-body/2}" y="${g.y(Math.max(c.o,c.c))}" width="${body}" height="${Math.max(1.5,Math.abs(g.y(c.o)-g.y(c.c)))}" fill="${color}"/></g>`);}
  for(const key of ['ema20','ema50','supertrend'])if(s.visibility[key])svg.push(`<path d="${path(vm,s,key,g,{top:g.top,height:g.priceH},g.range.min,g.range.max)}" fill="none" stroke="${palette[key]}" stroke-width="1.7"${key==='supertrend'?' stroke-dasharray="5 3"':''}/>`);
  for(const level of levels)if(level.value>=g.range.min&&level.value<=g.range.max)svg.push(`<line class="ir-level" data-value="${level.value}" x1="8" x2="${8+g.plotW}" y1="${g.y(level.value)}" y2="${g.y(level.value)}" stroke="${level.color||'#65b8ff'}" stroke-dasharray="6 4"/>`);
  const forming=vm.bars.findLast(c=>c.confirm===0),closed=vm.bars.findLast(c=>c.confirm===1),prices=[];
  if(vm.ticker?.fresh&&C.valid(vm.ticker.value))prices.push({value:vm.ticker.value,color:palette.up,label:'Ticker'});
  if(s.visibility.formingPrice&&forming)prices.push({value:forming.c,color:'#ffd166',label:'Provisoire'});
  if(s.visibility.closedPrice&&closed)prices.push({value:closed.c,color:'#b6c4cd',label:'Clôture'});
  for(const p of prices)if(p.value>=g.range.min&&p.value<=g.range.max)svg.push(`<line x1="8" x2="${8+g.plotW}" y1="${g.y(p.value)}" y2="${g.y(p.value)}" stroke="${p.color}" stroke-dasharray="2 4"/>`);
  svg.push('</g>');
  svg.push(`<text x="8" y="${g.volTop-10}" fill="#b6c4cd">Volume · ${q}</text>`);
  for(const c of cs){const x=g.x(c.t),h=c.v/maxVol*g.volH;svg.push(`<rect x="${x-body/2}" y="${g.volTop+g.volH-h}" width="${body}" height="${Math.max(.5,h)}" fill="${c.c>=c.o?palette.up:palette.down}" opacity=".65"/>`);}
  for(const [key,p] of Object.entries(g.panels)){
   svg.push(`<rect x="8" y="${p.top}" width="${g.plotW}" height="${p.height}" fill="#0d1015" stroke="#20252c"/><text x="13" y="${p.top+15}" fill="#b6c4cd">${esc(names[key])}</text>`);
   for(const ratio of key==='stoch'?[.2,.5,.8]:[.3,.5,.7])svg.push(`<line x1="8" x2="${8+g.plotW}" y1="${p.top+p.height*(1-ratio)}" y2="${p.top+p.height*(1-ratio)}" stroke="#303640" stroke-dasharray="3 3"/>`);
   for(const k of key==='stoch'?['stochK','stochD']:['rsi'])svg.push(`<path d="${path(vm,s,k,g,p,0,key==='stoch'?1:100)}" fill="none" stroke="${palette[k]}" stroke-width="1.6"/>`);
  }
  const c=selected(vm,s);if(c&&c.t>=s.from&&c.t<=s.to){const x=g.x(c.t);svg.push(`<g class="ir-selection" pointer-events="none"><rect x="${x-Math.max(3,body/2+2)}" y="${g.top}" width="${Math.max(6,body+4)}" height="${g.end-g.top}" fill="#eaf7ff" opacity=".13"/><line x1="${x}" x2="${x}" y1="${g.top}" y2="${g.end}" stroke="#f8fafb" stroke-dasharray="4 3"/>`);for(const [label,v,color] of [['H',c.h,'#8be2b1'],['L',c.l,'#ffadb3']])svg.push(`<circle cx="${x}" cy="${g.y(v)}" r="3.5" fill="${color}"/><line x1="${x}" x2="${8+g.plotW}" y1="${g.y(v)}" y2="${g.y(v)}" stroke="${color}" stroke-dasharray="2 3"/><text x="${14+g.plotW}" y="${g.y(v)+(label==='H'?-5:14)}" fill="${color}">${label} ${esc(axisNumber(v,(g.range.max-g.range.min)/10))}</text>`);svg.push('</g>');}
  for(const event of vm.events||[])if(C.valid(event.t)&&event.t>=s.from&&event.t<=s.to)svg.push(`<g><title>${esc(event.label)} · ${stamp(event.t)}</title><circle cx="${g.x(event.t)}" cy="${g.top+g.priceH-7}" r="4" fill="#65b8ff"/></g>`);
  const levelList=levels.map(l=>`<span style="--series:${esc(l.color||'#65b8ff')}"><b>${esc(l.label)}</b> ${number(l.value)} ${q}${l.value>g.range.max?' ↑ hors champ':l.value<g.range.min?' ↓ hors champ':''}${l.timeframe?' · '+esc(l.timeframe):''}${l.origin?' · '+esc(l.origin):''}${l.asOf?' · '+stamp(l.asOf):''}</span>`).join('');
  return {svg:svg.join(''),geometry:g,readout:readout(vm,s),levels:levelList,visible:cs,bodyWidth:body,forming,closed};
 }
 function mount(host,initial,options={}){
  let vm=initial,s=options.state||C.state(options.preferences),width=host.getBoundingClientRect?.().width||800,frame=null,disposed=false,lastDataEnd=null;
  const clipId='ir-price-clip-'+(mount.nextId=(mount.nextId||0)+1);
  const document=host.ownerDocument,win=document.defaultView,raf=win.requestAnimationFrame?.bind(win)||((fn)=>win.setTimeout(fn,16)),cancel=win.cancelAnimationFrame?.bind(win)||win.clearTimeout.bind(win);
  host.innerHTML=`<section class="ir-chart"><div class="ir-chart-meta"></div><div class="ir-price-readings"></div><div class="ir-controls"><button type="button" data-action="previous" aria-label="Bougie précédente">←</button><button type="button" data-action="next" aria-label="Bougie suivante">→</button><button type="button" data-action="zoomIn" aria-label="Zoomer">＋</button><button type="button" data-action="zoomOut" aria-label="Dézoomer">−</button><button type="button" data-action="latest">Dernier cours</button><button type="button" data-action="reset">Réinitialiser la vue</button><button type="button" data-action="levels" aria-pressed="false">Voir tous les niveaux</button><button type="button" data-action="inspect" aria-pressed="false">Inspection</button></div><details class="ir-options"><summary>Indicateurs et affichage</summary><div class="ir-toggles">${Object.entries(names).map(([k,label])=>`<label><input type="checkbox" data-toggle="${k}"${s.visibility[k]?' checked':''}><span style="color:${palette[k]||'#c4cad3'}">${label}</span></label>`).join('')}</div><label>Référence <select class="ir-reference"><option value="historical">Consultation historique</option><option value="engine">Référence moteur</option></select></label><button type="button" data-action="rebase">Renouveler la référence historique</button></details><div class="ir-readout" role="status" aria-live="polite"></div><svg class="ir-plot" tabindex="0" role="img" aria-label="Graphique de bougies. Flèches : sélection. Plus et moins : zoom. Fin : dernier cours. Échap : quitter la sélection."></svg><div class="ir-levels"></div><div class="ir-events"></div><div class="ir-coverage"></div><div class="ir-status" role="status"></div><button class="ir-more" type="button" data-action="more">Charger l’historique antérieur</button></section>`;
  const query=x=>host.querySelector(x),svg=query('.ir-plot'),read=query('.ir-readout'),points=new Map();let gesture=null,longPress=null,inspection=false,loading=false;
  const button=a=>query(`[data-action="${a}"]`);
  function draw(){
   if(disposed)return;const start=win.performance?.now()||0;frame=null;
   const output=render(vm,s,width),g=output.geometry;svg.setAttribute('viewBox',`0 0 ${g.width} ${g.height}`);svg.setAttribute('height',g.height);svg.innerHTML=output.svg.replaceAll('price-clip',clipId);
   const content=output.readout;if(read.innerHTML!==content)read.innerHTML=content;
   query('.ir-chart-meta').textContent=`${vm.instrument} · ${vm.timeframe} · ${vm.reference==='engine'?'Référence moteur · analyse actuelle':'Consultation historique'} · ${timezone()}`;
   query('.ir-price-readings').innerHTML=`<span><b>${vm.ticker?.fresh?'Ticker live':'Ticker non actualisé'}</b> ${number(vm.ticker?.value)} ${esc(vm.quote)}${vm.ticker?.ts?' · '+stamp(vm.ticker.ts):''}</span><span><b>Bougie en formation</b> ${output.forming?number(output.forming.c)+' '+esc(vm.quote):'aucune'}</span><span><b>Dernière clôture confirmée</b> ${output.closed?number(output.closed.c)+' '+esc(vm.quote)+' · '+stamp(output.closed.t):'N/D'}</span>`;
   query('.ir-levels').innerHTML=output.levels;query('.ir-events').textContent=vm.events.map(e=>`${e.label} · ${stamp(e.t)}`).join(' · ');
   query('.ir-coverage').textContent=vm.bars.length?`${output.visible.length} bougies visibles / ${vm.bars.length} chargées · du ${stamp(vm.bars[0].t)} au ${stamp(vm.bars.at(-1).t+C.intervals[vm.timeframe])} · données ${stamp(vm.asOf)}${s.selectedTs!=null&&!output.visible.some(c=>c.t===s.selectedTs)?' · sélection conservée hors champ':''}`:'Aucune bougie disponible.';
   query('.ir-status').textContent=vm.error||vm.coverage?.notice||'';
   query('.ir-reference').value=vm.reference;query('.ir-reference option[value="engine"]').disabled=!options.hasEngine;
   button('rebase').hidden=vm.reference!=='historical';button('more').hidden=!options.onLoadMore;button('levels').setAttribute('aria-pressed',String(s.fitLevels));button('inspect').setAttribute('aria-pressed',String(inspection));
   svg.dataset.visibleCount=output.visible.length;svg.dataset.bodyWidth=output.bodyWidth;svg.dataset.from=s.from;svg.dataset.to=s.to;svg.dataset.selectedTs=s.selectedTs??'';svg.dataset.version=vm.version;svg.dataset.renderMs=(win.performance?.now()||0)-start;
  }
  function schedule(){if(!disposed&&frame==null)frame=raf(draw)}
  function pick(time,pin=true){const c=C.nearest(vm,time);if(!c)return;if(pin){s.selectedTs=c.t;s.pinned=true;}else s.hoverTs=c.t;schedule();}
  function step(delta){let i=vm.bars.findIndex(c=>c.t===(s.selectedTs??s.hoverTs));if(i<0)i=vm.bars.length-1;const c=vm.bars[Math.max(0,Math.min(vm.bars.length-1,i+delta))];if(!c)return;pick(c.t);if(c.t<s.from||c.t>s.to){const span=s.to-s.from;s.follow=false;s.to=c.t+span/2;C.viewport(vm,s,width);}}
  async function more(){if(loading||!options.onLoadMore)return;loading=true;button('more').disabled=true;try{await options.onLoadMore()}catch(e){query('.ir-status').textContent='Historique indisponible : '+e.message}finally{loading=false;if(!disposed)button('more').disabled=false;}}
  function action(name){
   if(name==='previous')step(-1);if(name==='next')step(1);
   if(name==='zoomIn')C.zoom(vm,s,width,.75);if(name==='zoomOut')C.zoom(vm,s,width,1/.75);
   if(name==='latest'){s.follow=true;C.viewport(vm,s,width);}if(name==='reset'){s.from=s.to=null;s.follow=true;s.fitLevels=false;}
   if(name==='levels')s.fitLevels=!s.fitLevels;if(name==='inspect')inspection=!inspection;
   if(name==='rebase')options.onRebase?.();if(name==='more')more();schedule();
  }
  host.onclick=ev=>{const a=ev.target.closest?.('[data-action]');if(a)action(a.dataset.action);};
  host.onchange=ev=>{const key=ev.target.dataset.toggle;if(key&&Object.hasOwn(s.visibility,key)){s.visibility[key]=ev.target.checked;options.onPreferences?.({...s.visibility});schedule();}if(ev.target.matches?.('.ir-reference'))options.onReferenceChange?.(ev.target.value);};
  function local(ev){const r=svg.getBoundingClientRect();return {x:ev.clientX-r.left,y:ev.clientY-r.top};}
  function at(x){return s.from+(x-8)/Math.max(40,width-84)*(s.to-s.from);}
  function capture(ev){try{svg.setPointerCapture?.(ev.pointerId)}catch(_){}}
  const pointerdown=ev=>{
   if(ev.button!=null&&ev.button!==0)return;const p=local(ev);points.set(ev.pointerId,{...p,startX:p.x,startY:p.y});svg.focus?.({preventScroll:true});
   if(points.size===1){gesture={from:s.from,to:s.to,start:p,moved:false,multi:false,vertical:false};if(ev.pointerType==='touch')longPress=win.setTimeout(()=>{if(gesture&&!gesture.moved){inspection=true;pick(at(p.x));}},450);}
   if(points.size===2){if(longPress)win.clearTimeout(longPress);const [a,b]=[...points.values()];gesture={from:s.from,to:s.to,distance:Math.hypot(a.x-b.x,a.y-b.y),anchor:((a.x+b.x)/2-8)/Math.max(40,width-84),multi:true,moved:true};capture(ev);}
  };
  const pointermove=ev=>{
   const p=local(ev),old=points.get(ev.pointerId);
   if(!old){if(ev.pointerType!=='touch'&&!s.pinned)pick(at(p.x),false);return;}
   points.set(ev.pointerId,{...old,...p});if(!gesture)return;
   if(points.size===2&&gesture.multi){const [a,b]=[...points.values()];s.from=gesture.from;s.to=gesture.to;C.zoom(vm,s,width,gesture.distance/Math.max(5,Math.hypot(a.x-b.x,a.y-b.y)),Math.max(0,Math.min(1,gesture.anchor)));ev.preventDefault?.();schedule();return;}
   if(gesture.multi||gesture.vertical)return;const dx=p.x-gesture.start.x,dy=p.y-gesture.start.y;
   if(Math.abs(dx)+Math.abs(dy)>6){gesture.moved=true;if(longPress)win.clearTimeout(longPress);}
   if(ev.pointerType==='touch'&&Math.abs(dy)>Math.abs(dx)*1.2&&Math.abs(dy)>8){gesture.vertical=true;return;}
   if(!gesture.moved)return;capture(ev);
   if(inspection){pick(at(p.x));return;}
   s.from=gesture.from;s.to=gesture.to;C.pan(vm,s,width,-dx/Math.max(40,width-84));if(s.from<=vm.bars[0]?.t-C.intervals[vm.timeframe]*.45)more();schedule();
  };
  function end(ev,cancelled){if(longPress)win.clearTimeout(longPress);const p=local(ev);if(!cancelled&&gesture&&!gesture.moved&&!gesture.multi)pick(at(p.x));points.delete(ev.pointerId);if(points.size===0)gesture=null;}
  const pointerHandlers={pointerdown,pointermove,pointerup:ev=>end(ev,false),pointercancel:ev=>end(ev,true),pointerleave:()=>{if(!points.size&&!s.pinned){s.hoverTs=null;schedule()}}};
  for(const [name,fn] of Object.entries(pointerHandlers))svg.addEventListener(name,fn);
  const wheel=ev=>{if(document.activeElement!==svg)return;ev.preventDefault();const p=local(ev);if(Math.abs(ev.deltaX)>Math.abs(ev.deltaY))C.pan(vm,s,width,ev.deltaX/Math.max(40,width-84));else C.zoom(vm,s,width,Math.exp(Math.max(-.5,Math.min(.5,ev.deltaY*.002))),Math.max(0,Math.min(1,(p.x-8)/Math.max(40,width-84))));schedule();};
  svg.addEventListener('wheel',wheel,{passive:false});
  svg.onkeydown=ev=>{const key=ev.key,map={ArrowLeft:'previous',ArrowRight:'next','+':'zoomIn','=':'zoomIn','-':'zoomOut',End:'latest'};if(map[key]){ev.preventDefault();action(map[key]);}if(key==='Escape'){s.pinned=false;s.selectedTs=s.hoverTs=null;inspection=false;gesture=null;points.clear();schedule();}if(key==='Home'&&vm.bars.length){ev.preventDefault();pick(vm.bars[0].t);s.follow=false;s.to=vm.bars[0].t+(s.to-s.from);schedule();}};
  const observer=typeof win.ResizeObserver==='function'?new win.ResizeObserver(entries=>{const w=entries[0]?.contentRect.width;if(w>0&&Math.abs(w-width)>.5){width=w;schedule();}}):null;observer?.observe(host);
  function update(next){vm=next;if(lastDataEnd!==vm.bars.at(-1)?.t&&s.follow)C.viewport(vm,s,width);lastDataEnd=vm.bars.at(-1)?.t;schedule();}
  function dispose(){disposed=true;if(frame!=null)cancel(frame);if(longPress)win.clearTimeout(longPress);observer?.disconnect();svg.removeEventListener('wheel',wheel);for(const [name,fn] of Object.entries(pointerHandlers))svg.removeEventListener(name,fn);svg.onkeydown=null;host.onclick=host.onchange=null;points.clear();}
  draw();return {update,dispose,state:s,action,redraw:draw,get model(){return vm;},setOptions:next=>Object.assign(options,next)};
 }
 const api={render,mount,geometry,readout,number,stamp,palette};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.RadarChartPanel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
