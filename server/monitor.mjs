// Continuous public-trade observer. Prices and quote volumes are observed, not executable orders.
export class MarketMonitor {
  constructor({now=()=>Date.now(),keep=500}={}){this.now=now;this.keep=keep;this.bars=new Map();this.events=[];this.seen=new Map();this.connections=0;this.lastTradeAt=null}
  trade(row){
    const id=row.instId,price=Number(row.px),size=Number(row.sz),ts=Number(row.ts);
    if(!/^[A-Z0-9]+-USDT$/.test(id)||!(price>0)||!(size>0)||!Number.isFinite(ts)||ts>this.now()+60000||ts<this.now()-120000)return;
    const key=id+':'+row.tradeId;
    if(row.tradeId&&this.seen.has(key))return;
    if(row.tradeId)this.seen.set(key,ts);
    this.lastTradeAt=this.now();
    const minute=Math.floor(ts/60000)*60000,series=this.bars.get(id)||[];
    let bar=series.at(-1);
    if(!bar||bar.ts!==minute){if(bar&&bar.ts>minute)return;bar={ts:minute,open:price,close:price,usd:0,count:0};series.push(bar);while(series.length>25)series.shift();this.bars.set(id,series)}
    bar.close=price;bar.usd+=price*size;bar.count++;
    const previous=series.slice(0,-1).filter(b=>b.ts>=minute-21*60000);
    // A disconnected feed or quiet market cannot establish a trustworthy minute baseline.
    if(previous.some((b,i)=>i&&b.ts-previous[i-1].ts!==60000)||previous.at(-1)?.ts!==minute-60000)return;
    const baseline=previous.map(b=>b.usd).sort((a,b)=>a-b);
    if(baseline.length<8||bar.usd<200)return;
    const typical=(baseline[Math.floor((baseline.length-1)/2)]+baseline[Math.ceil((baseline.length-1)/2)])/2;
    const ratio=typical?bar.usd/typical:0,movePct=(price/bar.open-1)*100;
    if(ratio<3||Math.abs(movePct)<.5)return;
    const existing=this.events.find(e=>e.instId===id&&e.minute===minute);
    if(existing){existing.ratio=ratio;existing.movePct=movePct;existing.usd=bar.usd;existing.price=price;existing.updatedAt=this.now();return}
    this.events.unshift({instId:id,market:'spot',minute,detectedAt:this.now(),updatedAt:this.now(),ratio,movePct,usd:bar.usd,price,status:'detected',execution:'unverified'});
    if(this.events.length>this.keep)this.events.length=this.keep;
  }
  prune(){const cutoff=this.now()-30*60000;for(const [key,ts] of this.seen)if(ts<cutoff)this.seen.delete(key);for(const [id,series] of this.bars){const recent=series.filter(b=>b.ts>=this.now()-30*60000);if(recent.length)this.bars.set(id,recent);else this.bars.delete(id)}}
  snapshot(){return {version:1,updatedAt:this.now(),lastTradeAt:this.lastTradeAt,connections:this.connections,events:this.events,bars:[...this.bars]}}
  restore(saved){if(saved?.version!==1)return;this.events=Array.isArray(saved.events)?saved.events.slice(0,this.keep):[];this.bars=new Map(Array.isArray(saved.bars)?saved.bars:[]);this.lastTradeAt=saved.lastTradeAt||null;this.prune()}
  publicState(){const fresh=this.lastTradeAt!==null&&this.now()-this.lastTradeAt<120000&&this.connections>0;return {fresh,lastTradeAt:this.lastTradeAt,connections:this.connections,coverage:this.bars.size,events:this.events.map(e=>({...e,live:fresh&&this.now()-e.updatedAt<120000&&this.bars.get(e.instId)?.at(-1)?.ts>=this.now()-120000}))}}
}
