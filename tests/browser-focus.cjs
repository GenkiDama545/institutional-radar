// Optional browser acceptance using deterministic public-API fixtures, not live OKX.
// node tests/browser-focus.cjs <chromium-executable> <artifacts-directory>
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
 let outage=false;
 const inst=s=>s+'-USD_UM_XPERP-310101',symbols=['NEAR','SUI','AVAX','SOL','BTC'];
 const ticker=s=>({instId:inst(s),last:'100',open24h:'98',high24h:'102',low24h:'96',bidPx:'99.99',askPx:'100.01',volCcy24h:'1000000',ts:String(Date.now())});
 await page.route('https://www.okx.com/**',async route=>{
  const u=new URL(route.request().url()),p=u.pathname,q=u.searchParams;requests.push(p+u.search);
  if(outage)return route.fulfill({status:503,json:{code:'500',msg:'Fixture outage'}});
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
  assert.equal(await page.locator('[data-focus-symbol]').count(),5);assert.match(await page.locator('[data-focus-symbol="HYPE"]').innerText(),/Aucun X-Perp/);
  assert.ok(requests.every(p=>!p.includes('instType=SPOT')&&!p.includes(encodeURIComponent(inst('BTC')))));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  results.push('Default targeted scan: five stable cards, four exact contracts analysed, absent HYPE explicit, no Spot or BTC analysis.');
  await page.screenshot({path:path.join(output,'focus-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'Ouvrir l’analyse de NEAR'}).click();await page.waitForSelector('#detailChartPlot .ir-chart');
  const plot=page.locator('#detailChartPlot .ir-plot'),wideCount=Number(await plot.getAttribute('data-visible-count'));assert.ok(wideCount>=65);
  await page.locator('#detailChartPlot [data-action=detail]').click();await page.waitForFunction(n=>Number(document.querySelector('#detailChartPlot .ir-plot').dataset.visibleCount)<n,wideCount);
  await page.locator('#detailChartPlot [data-action=reset]').click();await page.waitForFunction(n=>Number(document.querySelector('#detailChartPlot .ir-plot').dataset.visibleCount)>=n,wideCount);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await plot.screenshot({path:path.join(output,'chart-wide-mobile.png')});
  results.push('Wide mobile chart shows at least 65 candles, detail enlarges them, wide reset restores context without horizontal overflow.');
  const snapshot=await page.evaluate(()=>JSON.stringify({score:current.score,model:current.scenarioModel,locks:localStorage.getItem('ir_scenario_locks_v871')}));
  assert.equal(await page.locator('#detailChartPlot').evaluate(el=>el.querySelector('.ir-plot').previousElementSibling.className),'ir-timeframes');
  assert.equal(await page.locator('#detailChartPlot [data-timeframe]').count(),7);
  await page.locator('#detailChartPlot [data-timeframe="1m"]').click();
  await page.locator('#detailChartPlot [data-timeframe="5m"]').click();
  await page.waitForFunction(()=>sharedChartViews.get('detailChartPlot').controller.panel.model.timeframe==='5m');
  assert.equal(await page.locator('#detailChartPlot [data-timeframe="5m"]').getAttribute('aria-pressed'),'true');
  const beforeRefresh=await page.evaluate(()=>sharedChartViews.get('detailChartPlot').controller.panel.model.asOf);
  await page.waitForFunction(t=>sharedChartViews.get('detailChartPlot').controller.panel.model.asOf>t,beforeRefresh,{timeout:15000});
  assert.equal(await page.evaluate(()=>sharedChartViews.get('detailChartPlot').controller.panel.model.timeframe),'5m');
  assert.equal(await page.evaluate(()=>JSON.stringify({score:current.score,model:current.scenarioModel,locks:localStorage.getItem('ir_scenario_locks_v871')})),snapshot);
  results.push('Seven timeframes sit immediately above the plot; rapid 1m → 5m selection and periodic refresh preserve the chosen timeframe, scores, scenarios and locks.');
  await page.getByRole('button',{name:'4 · Scénarios'}).click();
  await page.waitForSelector('.positionRiskSettings');
  await page.locator('[data-risk-setting=basis]').selectOption('margin');
  await page.locator('[data-risk-setting=maxLoss]').fill('20');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.evaluate(()=>openDeep(current.id,'graph'));
  await page.waitForSelector('#garea .ir-chart');
  await page.locator('#garea [data-timeframe="15m"]').click();
  await page.waitForFunction(()=>sharedChartViews.get('garea').controller.panel.model.timeframe==='15m');
  assert.equal(await page.locator('#sim_capital').inputValue(),'100');assert.equal(await page.locator('#sim_leverage').inputValue(),'10');
  await page.locator('#sim_entry').fill('100');await page.locator('#sim_stop').fill('96');await page.locator('#sim_tp1').fill('110');
  assert.match(await page.locator('#simRiskOut').innerText(),/SL trop coûteux/);assert.match(await page.locator('#simRiskOut').innerText(),/40,00 USD/);
  await page.locator('[data-risk-setting=maxLoss]').fill('50');
  assert.match(await page.locator('#simRiskOut').innerText(),/Perte de prix dans le budget/);
  await page.locator('[data-risk-setting=basis]').selectOption('notional');
  assert.equal(await page.locator('#sim_capital').inputValue(),'100','Existing simulator input must not be silently overwritten');
  await page.getByRole('button',{name:'Appliquer mon profil au simulateur'}).click();
  assert.equal(await page.locator('#sim_capital').inputValue(),'10');assert.match(await page.locator('#simRiskOut').innerText(),/4,00 USD/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('.scenarioSimulator').screenshot({path:path.join(output,'risk-mobile.png')});
  results.push('Mobile risk profile persists into simulator: margin 100 × 10, SL 4% gives USD 40; budget edits update immediately; explicit total-position profile application gives USD 4 without moving the stop.');
  await page.evaluate(()=>backDetail());await page.waitForSelector('#detailChartPlot .ir-chart');
  assert.equal(await page.evaluate(()=>current.id),inst('NEAR'));await page.locator('#back1').click();
  results.push('NEAR card opens its exact X-Perp detail and shared chart; return to home succeeds.');
  await page.evaluate(()=>{all.forEach(x=>{if(x.scenarioModel)x.scenarioModel.analysisAt=Date.now()-86400000});renderRank()});
  assert.equal(await page.locator('[data-focus-symbol]').count(),5);assert.match(await page.locator('#focusBoard').innerText(),/À actualiser/);
  assert.equal(await page.evaluate(()=>scenarioCandidates().length),0);
  results.push('Expired analyses remain visible and cannot enter scenario ranking.');
  await page.locator('#focusSettings summary').click();await page.locator('#focusSymbols').fill('SUI');await page.locator('#focusAuto').uncheck();
  await page.locator('#focusApply').click();await page.waitForFunction(()=>!scanRunning&&focusConfig.symbols.length===2);
  assert.equal(await page.locator('[data-focus-symbol]').count(),2);assert.match(await page.locator('#focusSymbols').inputValue(),/NEAR, SUI/);
  await page.reload();await page.waitForFunction(()=>lastCompletedScanAt&&!scanRunning);
  assert.equal(await page.locator('[data-focus-symbol]').count(),2);assert.equal(await page.locator('#focusAuto').isChecked(),false);
  results.push('Selection and auto-refresh choice persist after reload, with NEAR pinned.');
  outage=true;await page.locator('#scan').click();await page.waitForFunction(()=>!scanRunning&&focusScanError.length>0);
  assert.equal(await page.locator('[data-focus-symbol]').count(),2);assert.equal(await page.evaluate(()=>scenarioCandidates().length),0);
  outage=false;await page.locator('#scan').click();await page.waitForFunction(()=>!scanRunning&&!focusScanError);
  results.push('API outage leaves both cards visible, blocks readiness and recovers on next scan.');
  await page.setViewportSize({width:1440,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:path.join(output,'focus-desktop.png'),fullPage:true});
  assert.equal(await page.locator('#scanScope').count(),0);
  await page.evaluate(()=>localStorage.setItem(RadarFocus.key,JSON.stringify({...focusConfig,scope:'wide'})));
  await page.reload();await page.waitForFunction(()=>lastCompletedScanAt&&!scanRunning);
  assert.equal(await page.evaluate(()=>focusConfig.scope),'focus');assert.equal(await page.locator('[data-focus-symbol]').count(),2);
  assert.ok(requests.every(p=>!p.includes('instType=SPOT')&&!p.includes(encodeURIComponent(inst('BTC')))));
  results.push('Wide scan is absent from UI; an old wide-scope preference cannot reactivate other markets.');
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify({results,errors,fixture:true},null,2));console.log(JSON.stringify({results,errors},null,2));
 }finally{await browser.close();server.close()}
})().catch(err=>{console.error(err);server.close();process.exitCode=1});
