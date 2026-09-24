import http from 'node:http';
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {MarketMonitor} from './monitor.mjs';

const base='https://www.okx.com',socketUrl='wss://ws.okx.com:8443/ws/v5/public';
const port=Number(process.env.PORT||8080),stateFile=process.env.RADAR_STATE_FILE||'./radar-state.json';
const allowedOrigin=process.env.RADAR_ORIGIN||'https://genkidama545.github.io';
const monitor=new MarketMonitor();
try{monitor.restore(JSON.parse(await readFile(stateFile,'utf8')))}catch(e){if(e.code!=='ENOENT')throw e}
let persisting=Promise.resolve();
function save(){persisting=persisting.then(async()=>{await mkdir(dirname(stateFile),{recursive:true});await writeFile(stateFile+'.tmp',JSON.stringify(monitor.snapshot()));await rename(stateFile+'.tmp',stateFile)}).catch(e=>console.error('Persist error:',e));return persisting}
const server=http.createServer((req,res)=>{
  if(req.method!=='GET'||!['/health','/api/discoveries'].includes(req.url)){res.writeHead(404);return res.end()}
  const origin=req.headers.origin;
  if(origin===allowedOrigin)res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
  const state=monitor.publicState();res.end(JSON.stringify(req.url==='/health'?{fresh:state.fresh,lastTradeAt:state.lastTradeAt,connections:state.connections,coverage:state.coverage}:state));
});
server.listen(port,()=>console.log(`Radar public monitor listening on ${port}`));

async function instruments(){const response=await fetch(`${base}/api/v5/public/instruments?instType=SPOT`,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(`Instruments HTTP ${response.status}`);const body=await response.json();if(body.code!=='0'||!Array.isArray(body.data))throw Error('Unexpected instruments response');return body.data.filter(x=>x.state==='live'&&x.quoteCcy==='USDT'&&/^[A-Z0-9]+-USDT$/.test(x.instId)).map(x=>x.instId)}
const sockets=new Map();let stopping=false;
function connect(index,ids){if(stopping)return;const ws=new WebSocket(socketUrl);sockets.set(index,ws);let lastMessage=Date.now(),opened=false;
  const ping=setInterval(()=>{if(ws.readyState!==WebSocket.OPEN)return;if(Date.now()-lastMessage>65000)ws.close();else if(Date.now()-lastMessage>20000)ws.send('ping')},15000);
  ws.addEventListener('open',()=>{opened=true;monitor.connections++;for(let i=0;i<ids.length;i+=25)ws.send(JSON.stringify({op:'subscribe',args:ids.slice(i,i+25).map(instId=>({channel:'trades',instId}))}))});
  ws.addEventListener('message',ev=>{lastMessage=Date.now();if(ev.data==='pong')return;try{const msg=JSON.parse(ev.data);if(msg.event==='error')console.error('OKX subscription:',msg);if(msg.arg?.channel==='trades'&&Array.isArray(msg.data))for(const row of msg.data)monitor.trade(row)}catch(e){console.error('Invalid OKX message:',e)}});
  ws.addEventListener('error',e=>console.error('OKX WebSocket error:',e.message||'connection failed'));
  ws.addEventListener('close',()=>{clearInterval(ping);if(sockets.get(index)===ws)sockets.delete(index);if(opened)monitor.connections=Math.max(0,monitor.connections-1);if(!stopping)setTimeout(()=>{if(!sockets.has(index))connect(index,ids)},5000+Math.random()*5000).unref()});
}
async function refresh(){try{const ids=await instruments();const groups=[];for(let i=0;i<ids.length;i+=50)groups.push(ids.slice(i,i+50));groups.forEach((group,i)=>{if(!sockets.has(i))connect(i,group)});for(const [i,ws] of sockets)if(i>=groups.length)ws.close();console.log(`Tracking ${ids.length} live Spot USDT instruments`)}catch(e){console.error('Instrument refresh failed:',e)}}
await refresh();setInterval(refresh,3600000).unref();setInterval(()=>{monitor.prune();void save()},60000).unref();
async function shutdown(){stopping=true;for(const ws of sockets.values())ws.close();server.close();await save();process.exit(0)}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
