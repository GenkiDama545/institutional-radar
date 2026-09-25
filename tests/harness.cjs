const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function env(initial={}){
 const store=new Map(Object.entries(initial)),nodes={},timers=new Map();let next=0;
 const node=id=>nodes[id]??=( {innerHTML:'',textContent:'',value:'',disabled:false,dataset:{},classList:{s:new Set(),add(x){this.s.add(x)},remove(x){this.s.delete(x)},contains(x){return this.s.has(x)},toggle(x){this.s.has(x)?this.s.delete(x):this.s.add(x)}},insertAdjacentHTML(where,html){this.innerHTML=html+this.innerHTML},setAttribute(){},querySelectorAll(){return []}});
 const ctx=vm.createContext({console,localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},setTimeout,clearTimeout,setInterval:f=>{timers.set(++next,f);return next},clearInterval:id=>timers.delete(id),crypto:{randomUUID:()=> 'fixture-lock'},alert:()=>{},document:{getElementById:node,querySelectorAll:()=>[],querySelector:()=>null,activeElement:null,visibilityState:'visible'}});
 for(const f of ['chart-core.js','chart-series.js','signal-engine.js','market-screen.js','engine-core.js','trade-sim.js','candle-store.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
 const app=fs.readFileSync(path.join(root,'app.js'),'utf8');vm.runInContext(app.slice(0,app.indexOf("document.querySelectorAll('#marketMode")),ctx,{filename:'app.js'});
 return {ctx,run:s=>vm.runInContext(s,ctx),store,nodes,node,timers};
}
function frames(slope=0,scale=1){return Object.fromEntries(['1D','4H','1H','30m','15m','5m'].map((tf,j)=>[tf,Array.from({length:180},(_,i)=>{const p=(100+slope*i+Math.sin(i/8)*.4)*scale;return {t:1700000000000+i*({'1D':86400000,'4H':14400000,'1H':3600000,'30m':1800000,'15m':900000,'5m':300000}[tf]),o:p,h:p+scale,l:p-scale,c:p+.15*scale,v:10000+i*30,confirm:i===179?0:1}})]))}
const plain=x=>JSON.parse(JSON.stringify(x));
module.exports={env,frames,plain};
