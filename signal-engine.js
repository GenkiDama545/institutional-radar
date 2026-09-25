// Pure signal families, market regime and ranking score. No DOM or network access.
/* V8.4 — CENTRAL SIGNAL ENGINE
   One shared vocabulary for ranking, analysis and scenarios.
   The ranking layer can work with fast market data; deeper layers enrich the same families with candles.
*/
function classifyRegime(x,deep){
  const d=deep||{};
  const pa=d.priceAction||'neutral', ema=d.emaBias||'neutral', st=d.supertrendBias||'neutral';
  const adx=Number(d.adx||0), rsi=Number(d.rsi), sk=Number(d.stochK), z=Number(d.bb?.z), vol=Number(x?.vol||0), med=Number(x?.medVol||0), vr=med>0?vol/med:null;
  const comp=!!d.compression, exp=!!d.expansion;
  const paDir=pa==='bullish'?'bull':pa==='bearish'?'bear':'neutral';
  const aligned=(paDir!=='neutral'&&paDir===ema&&ema===st);
  const extreme=(Number.isFinite(rsi)&&(rsi>=68||rsi<=32))||(Number.isFinite(sk)&&(sk>=.86||sk<=.14));
  const breakout=(aligned && adx>=20 && exp && vr!=null && vr>=1.15 && (x?.rangePos==null || x.rangePos>.72 || x.rangePos<.28));
  const reversal=(extreme && pa!=='neutral' && ((pa==='bearish'&&ema==='bull')||(pa==='bullish'&&ema==='bear')));
  const squeeze=(comp && ((x?.oiDelta!=null&&Math.abs(x.oiDelta)>=1.5)||vr!=null&&vr>=1.05));
  const range=(adx<18 && (comp || !exp) && (!Number.isFinite(z)||Math.abs(z)<1.2) && !aligned);
  if(reversal) return {key:'reversal',label:'Retournement',reason:'momentum extrême + Price Action en opposition au contexte'};
  if(breakout) return {key:'breakout',label:'Cassure / continuation',reason:'structure alignée + expansion + participation'};
  if(squeeze) return {key:'squeeze',label:'Compression / squeeze',reason:'volatilité comprimée avec participation en évolution'};
  if(range) return {key:'range',label:'Range / mean reversion',reason:'tendance faible et volatilité contenue'};
  return {key:'continuation',label:'Tendance / continuation',reason:'lecture directionnelle sans déclencheur de cassure clair'};
}
const REGIME_WEIGHTS={
  breakout:{activity:1.35,trend:1.35,priceAction:1.45,range:1.0,derivatives:1.05,funding:.55,positioning:.85,volume:1.25,momentum:.85,volatility:1.0,adx:1.15},
  reversal:{activity:1.0,trend:1.05,priceAction:1.5,range:1.2,derivatives:.8,funding:.65,positioning:.75,momentum:1.25,rsi:1.25,stochRsi:.9,volatility:1.0,adx:.85},
  range:{activity:.9,trend:.65,priceAction:1.35,range:1.45,derivatives:.7,funding:.75,positioning:.7,momentum:1.0,rsi:1.15,stochRsi:.85,volatility:1.2,adx:.55,bollinger:1.2},
  squeeze:{activity:1.3,trend:.9,priceAction:1.05,range:.85,derivatives:1.35,funding:.9,positioning:1.2,momentum:.8,volatility:1.35,adx:.8,bollinger:1.15},
  continuation:{activity:1.15,trend:1.3,priceAction:1.3,range:.9,derivatives:1.0,funding:.65,positioning:.8,momentum:.95,volatility:.85,adx:1.1}
};
function centralSignalEngine(x,deep=null,opts={}){
  const volRatio=x?.medVol>0?x.vol/x.medVol:null;
  const rangePos=Number.isFinite(x?.rangePos)?x.rangePos:null;
  const oiDelta=Number.isFinite(x?.oiDelta)?x.oiDelta:null;
  const funding=Number.isFinite(x?.funding)?x.funding:null;
  const momentum=Number.isFinite(x?.chg)?x.chg:null;
  const dir=deep?.priceAction==='bullish'||deep?.emaBias==='bull'||deep?.supertrendBias==='bull'?'bull':deep?.priceAction==='bearish'||deep?.emaBias==='bear'||deep?.supertrendBias==='bear'?'bear':momentum!=null?(momentum>=1?'bull':momentum<=-1?'bear':null):null;
  const extInputs=[
    momentum!=null?Math.min(100,Math.abs(momentum)/20*100):0,
    Number.isFinite(deep?.rsi)?(deep.rsi>=70||deep.rsi<=30?100:deep.rsi>=65||deep.rsi<=35?60:0):0,
    Number.isFinite(deep?.bb?.z)?(Math.abs(deep.bb.z)>=2.5?100:Math.abs(deep.bb.z)>=2?75:Math.abs(deep.bb.z)>=1.5?45:0):0,
    funding!=null?Math.min(100,Math.abs(funding)/.001*100):0,
    oiDelta!=null?Math.min(100,Math.abs(oiDelta)/5*100):0,
    rangePos!=null?(rangePos>.97||rangePos<.03?80:rangePos>.92||rangePos<.08?45:0):0
  ].filter(Number.isFinite);
  const extensionRisk=Math.round(extInputs.length?extInputs.reduce((a,b)=>a+b,0)/extInputs.length:0);
  const families={
    activity:{value:volRatio,signal:volRatio==null?'neutral':volRatio>=1.35?'positive':volRatio>=.85?'warning':'negative',weight:1.15,role:'context'},
    extension:{value:extensionRisk,signal:extensionRisk>=72?'warning':extensionRisk>=45?'warning':'neutral',weight:1.0,role:'context'},
    momentum:{value:momentum,signal:momentum==null?'neutral':momentum>=3?'positive':momentum<=-3?'negative':Math.abs(momentum)>=1?'warning':'neutral',weight:.9,role:'directional'},
    range:{value:rangePos,signal:rangePos==null?'neutral':dir==='bull'&&rangePos>.70?'positive':dir==='bear'&&rangePos<.30?'positive':dir==='bull'&&rangePos<.20?'negative':dir==='bear'&&rangePos>.80?'negative':'neutral',weight:.75,role:'directional'},
    derivatives:{value:oiDelta,signal:oiDelta==null?'neutral':Math.abs(oiDelta)>=2?'warning':Math.abs(oiDelta)>=.5?'warning':'neutral',weight:.8,role:'context'},
    funding:{value:funding,signal:funding==null?'neutral':Math.abs(funding)>.0005?'warning':'neutral',weight:.65,role:'context'},
    positioning:{value:x?.oiRatio,signal:x?.oiRatio==null?'neutral':x.oiRatio>.15?'positive':'neutral',weight:.7,role:'context'}
  };
  if(deep){
    const d=deep;
    families.trend={value:d.trend?.strength,signal:d.trend?.bull?'positive':d.trend?.bear?'negative':'neutral',weight:1.25,role:'directional'};
    families.ema={value:d.emaBias,signal:d.emaBias==='bull'?'positive':d.emaBias==='bear'?'negative':'neutral',weight:.9,role:'directional'};
    families.supertrend={value:d.supertrendBias,signal:d.supertrendBias==='bull'?'positive':d.supertrendBias==='bear'?'negative':'neutral',weight:.9,role:'directional'};
    families.rsi={value:d.rsi,signal:Number.isFinite(d.rsi)?(d.rsi>=52&&d.rsi<70?'positive':d.rsi<=48&&d.rsi>30?'negative':(d.rsi>=70||d.rsi<=30)?'warning':'neutral'):'neutral',weight:.85,role:'directional'};
    families.stochRsi={value:d.stochK,signal:Number.isFinite(d.stochK)?(d.stochK>.8?'warning':d.stochK<.2?'warning':d.stochK>.55?'positive':d.stochK<.45?'negative':'neutral'):'neutral',weight:.55,role:'directional'};
    families.adx={value:d.adx,signal:d.adx==null?'neutral':d.adx>=25?'positive':d.adx>=18?'warning':'neutral',weight:1.0,role:'context'};
    families.bollinger={value:d.bb?.z,signal:d.bb?.z==null?'neutral':Math.abs(d.bb.z)>=2?'warning':Math.abs(d.bb.z)>=1?'positive':'neutral',weight:.7,role:'context'};
    families.volatility={value:d.atrPct,signal:d.compression?'warning':d.expansion?'positive':'neutral',weight:.65,role:'context'};
    families.priceAction={value:d.priceAction,signal:d.priceAction==='bullish'?'positive':d.priceAction==='bearish'?'negative':'neutral',weight:1.25,role:'directional'};
  }
  const regime=classifyRegime(x,deep);
  const regimeWeights=REGIME_WEIGHTS[regime.key]||{};
  Object.entries(regimeWeights).forEach(([k,v])=>{if(families[k]&&Number.isFinite(v))families[k].weight=Math.max(.05,Math.min(2.5,v))});
  const weightOverrides=opts?.weights||{}; Object.entries(weightOverrides).forEach(([k,v])=>{if(families[k]&&Number.isFinite(v))families[k].weight=Math.max(.05,Math.min(2.5,v))});
  const entries=Object.values(families); let signed=0,confidence=0,total=0,positiveW=0,negativeW=0,warningW=0;
  for(const f of entries){
    const w=f.weight||0;
    if(f.signal==='positive'){if(f.role==='directional')signed+=w;confidence+=w;if(f.role==='directional')positiveW+=w}
    else if(f.signal==='negative'){if(f.role==='directional')signed-=w;confidence+=w;if(f.role==='directional')negativeW+=w}
    else if(f.signal==='warning'){confidence+=w*.15;if(f.role==='directional')warningW+=w}
    total+=w;
  }
  const biasScore=Math.round(50+(signed/Math.max(total,1))*50);
  const confidenceScore=Math.round(50+(confidence/Math.max(total,1))*50);
  const directional=Math.max(positiveW,negativeW)/Math.max(total,1);
  const contradiction=Math.min(positiveW,negativeW)/Math.max(total,1);
  let quality=confidenceScore;
  // Confluence is not tradability: penalise mixed directional evidence and warnings.
  quality-=Math.round(contradiction*32);
  quality-=Math.round((warningW/Math.max(total,1))*18);
  if(dir && ((dir==='bull'&&biasScore<50)||(dir==='bear'&&biasScore>50))) quality-=10;
  if(!dir) quality-=6;
  if(deep && Number.isFinite(deep.adx) && deep.adx<15) quality-=5;
  if(deep && deep.compression) quality-=3;
  if(volRatio!=null && volRatio<.75) quality-=15;
  if(extensionRisk>=72) quality-=18;
  else if(extensionRisk>=55) quality-=10;
  else if(extensionRisk>=45) quality-=5;
  if(Math.abs(momentum||0)>12) quality-=4;
  const counts={positive:entries.filter(f=>f.signal==='positive').length,warning:entries.filter(f=>f.signal==='warning').length,negative:entries.filter(f=>f.signal==='negative').length,neutral:entries.filter(f=>f.signal==='neutral').length};
  return {families,counts,score:Math.max(0,Math.min(100,confidenceScore)),qualityScore:Math.max(0,Math.min(100,quality)),directionalAgreement:Math.round(directional*100),contradiction:Math.round(contradiction*100),biasScore:Math.max(0,Math.min(100,biasScore)),direction:dir,extensionRisk,complete:!!deep,regime};
}
function sharedMarketSignals(x){return centralSignalEngine(x,x?.deep||null)}
function calibratedScore(x,side='best'){
  // Comparable 0–100 scale for every asset and for both directional cards.
  // The number ranks observed setups; it is never a probability of success.
  const m=x.signalModel||sharedMarketSignals(x),d=x.directional||{};
  const direction=side==='long'?d.longScore:side==='short'?(x.perpScenarioModel?.directional?.shortScore??d.shortScore):Math.max(d.longScore||0,d.shortScore||0);
  const hasModel=!!x.scenarioModel;
  const ready=side==='long'?!!x.hasLongScenario:side==='short'?!!x.hasShortScenario:!!x.hasValidScenario;
  const forming=side==='short'?!!x.scenarioModel?.shortSetup:side==='long'?!!x.scenarioModel?.longSetup:!!(x.scenarioModel?.longSetup||x.scenarioModel?.shortSetup);
  const coverage=hasModel?1:0;
  const median=Math.max(1,x.marketMedianVol||x.medVol||1);
  const liquidity=Math.max(20,Math.min(90,55+18*Math.log10(Math.max(1,x.volUsd||x.vol||0)/median)));
  const safety=Math.max(10,100-(m.extensionRisk||0));
  const execution=ready?80:forming?45:hasModel?22:8;
  let result=.42*m.qualityScore+.26*(Number(direction)||0)+.12*liquidity+.10*safety+.10*execution;
  if(!coverage)result=Math.min(result,57); // Analysis missing: never rank as fully tradable.
  if(!ready)result=Math.min(result,forming?72:63); // Distinguish observation from actionable scenario.
  if(side==='short'&&!x.perpId)result=Math.min(result,47);
  return Math.max(0,Math.min(100,Math.round(result)));
}
function score(x){return calibratedScore(x,'best')}
