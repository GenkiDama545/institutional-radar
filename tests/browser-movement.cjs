// Optional browser acceptance using deterministic public-API fixtures, not live OKX.
// node tests/browser-movement.cjs <chromium-executable> <artifacts-directory>
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const [executablePath,output]=process.argv.slice(2);if(!executablePath||!output)throw Error('Chromium and output paths required');
const root=path.resolve(__dirname,'..');fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.statusCode=403;return res.end()}
 try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(fs.readFileSync(file))}catch{res.statusCode=404;res.end()}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'}),page=await context.newPage(),errors=[],requests=[],results=[];
 page.on('pageerror',err=>errors.push(err.message));
 let outage=false,held=false,releaseHistory=null,historyReached=false;
 const inst=s=>s+'-USD_UM_XPERP-310101',symbols=['NEAR','SUI','AVAX','SOL','BTC','ETH','INJ','DOGE','WIF'];
 const ticker=s=>({instId:inst(s),last:'100',open24h:'98',high24h:'102',low24h:'96',bidPx:'99.99',askPx:'100.01',volCcy24h:'1000000',ts:String(Date.now())});
 await page.route('https://www.okx.com/**',async route=>{
  const u=new URL(route.request().url()),p=u.pathname,q=u.searchParams;requests.push(p+u.search);
  if(outage)return route.fulfill({status:503,json:{code:'500',msg:'Fixture outage'}});
  if(held&&p.endsWith('/history-candles')&&q.get('instId')===inst('BTC')){historyReached=true;await new Promise(r=>releaseHistory=r)}
  let data=[];
  if(p.endsWith('/instruments'))data=symbols.map(s=>({instId:inst(s),ruleType:'xperp',state:'live'}));
  else if(p.endsWith('/tickers'))data=q.get('instType')==='SPOT'?[]:symbols.map(ticker);
  else if(p.endsWith('/ticker'))data=[ticker(q.get('instId').split('-')[0])];
  else if(p.endsWith('/open-interest'))data=[{oiUsd:'5000000',ts:String(Date.now())}];
  else if(p.endsWith('/candles')||p.endsWith('/history-candles')){
   const ms={'1m':60000,'5m':300000,'15m':900000,'30m':1800000,'1H':3600000,'4H':14400000,'1D':86400000}[q.get('bar')];
   const end=Math.floor(Date.now()/ms)*ms,after=Number(q.get('after'))||end+ms,count=Number(q.get('limit'))||100;
   const start=Math.min(end,after-ms);
   data=Array.from({length:count},(_,i)=>{const t=start-i*ms,k=(end-t)/ms,p=100*Math.pow(.999,k),o=p*.9995;return [t,o,p*1.002,p*.997,p,1000,1000,100000,t===end?0:1].map(String)});
  }
  await route.fulfill({json:{code:'0',data}});
 });
 try{
  await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>lastCompletedScanAt&&!scanRunning);
  await page.evaluate(()=>focusConfig.auto=false);
  const business=await page.evaluate(()=>JSON.stringify(all.map(x=>({id:x.id,score:x.score,model:x.scenarioModel}))));
  const untouched=await page.evaluate(()=>Object.fromEntries(['ir_favorites_v1','ir_learning_journal_v866','ir_scenario_locks_v871'].map(k=>[k,localStorage.getItem(k)])));
  const before=requests.length;
  await page.getByRole('button',{name:'Comparer les profils de mouvement'}).click();
  assert.equal(requests.length,before,'Opening the page must not trigger exploration');
  await page.getByRole('button',{name:'Comparer ma sélection (5)',exact:true}).click();
  await page.waitForFunction(()=>!movementBusy&&document.querySelectorAll('[data-movement-symbol]').length===5);
  assert.match(await page.locator('[data-movement-symbol=HYPE]').innerText(),/indisponible/);
  assert.equal(await page.evaluate(()=>JSON.stringify(all.map(x=>({id:x.id,score:x.score,model:x.scenarioModel})))),business);
  assert.deepEqual(await page.evaluate(()=>Object.fromEntries(['ir_favorites_v1','ir_learning_journal_v866','ir_scenario_locks_v871'].map(k=>[k,localStorage.getItem(k)]))),untouched);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const beforeWindow=requests.length;await page.locator('[data-window="1H-30d"]').click();assert.equal(requests.length,beforeWindow);
  await page.screenshot({path:path.join(output,'movement-mobile.png'),fullPage:true});
  results.push('Comparison requires a click; five selected rows, missing HYPE visible, four windows, business state unchanged and no mobile page overflow.');
  held=true;await page.getByRole('button',{name:'Explorer 5 nouveaux candidats',exact:true}).click();
  for(let i=0;i<100&&!historyReached;i++)await new Promise(r=>setTimeout(r,20));
  assert.ok(historyReached);await page.getByRole('button',{name:'Arrêter',exact:true}).click();held=false;releaseHistory();
  await page.waitForFunction(()=>!movementBusy);assert.match(await page.locator('.movementStatus').innerText(),/arrêtée/);
  assert.equal(await page.evaluate(()=>focusConfig.symbols.length),5);
  await page.getByRole('button',{name:'Explorer 5 nouveaux candidats',exact:true}).click();
  await page.waitForFunction(()=>!movementBusy&&document.querySelectorAll('[data-movement-symbol]').length===6);
  assert.ok(requests.filter(p=>p.includes(encodeURIComponent(inst('BTC')))).every(p=>p.includes('/history-candles')));
  assert.equal(await page.evaluate(()=>all.some(x=>x.sym==='BTC')),false);
  await page.locator('[data-movement-symbol=BTC] [data-add]').click();
  await page.waitForFunction(()=>!scanRunning&&focusConfig.symbols.includes('BTC')&&all.some(x=>x.sym==='BTC'&&x.analysisCoverage==='complete'));
  assert.ok(requests.some(p=>p.includes('open-interest')&&p.includes(encodeURIComponent(inst('BTC')))));
  results.push('Cancellation stops after the in-flight read; bounded manual discovery reads only history outside the selection; explicit BTC addition triggers the existing six-horizon engine.');
  assert.ok(await page.evaluate(()=>localStorage.getItem('ir_movement_checks_v1')));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(output,'movement-desktop.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify({results,errors,fixture:true},null,2));console.log(JSON.stringify({results,errors},null,2));
 }finally{await browser.close();server.close()}
})().catch(err=>{console.error(err);server.close();process.exitCode=1});
