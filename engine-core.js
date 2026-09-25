// Technical features, market regimes and directional scenario engine.
function avgVol(cs,len=20){let a=cs.slice(-len).map(x=>x.v).filter(Number.isFinite);return a.length?a.reduce((s,v)=>s+v,0)/a.length:null}
function smaVals(cs,len,field='c'){
 let out=Array(cs.length).fill(null),q=[];
 for(let i=0;i<cs.length;i++){let v=n(cs[i]?.[field]);if(!Number.isFinite(v))continue;q.push(v);if(q.length>len)q.shift();if(q.length===len)out[i]=q.reduce((a,b)=>a+b,0)/len}
 return out;
}
function trSeries(cs){let out=[];for(let i=0;i<cs.length;i++){let p=cs[i-1],c=cs[i];out.push(i===0?Math.max(0,c.h-c.l):Math.max(c.h-c.l,Math.abs(c.h-p.c),Math.abs(c.l-p.c)))}return out}
function atrSeries(cs,len=14){let tr=trSeries(cs),out=Array(cs.length).fill(null);if(!tr.length)return out;let a=tr.slice(0,Math.min(len,tr.length)).reduce((x,y)=>x+y,0)/Math.min(len,tr.length);for(let i=0;i<tr.length;i++){if(i>=len)a=(a*(len-1)+tr[i])/len;out[i]=a}return out}
function atrValue(cs,len=14){let a=atrSeries(cs,len).filter(Number.isFinite);return a.at(-1)||null}
function adxValue(cs,len=14){if(cs.length<len*2+2)return null;let plus=[],minus=[];for(let i=0;i<cs.length;i++){if(i===0){plus.push(0);minus.push(0);continue}let up=cs[i].h-cs[i-1].h,down=cs[i-1].l-cs[i].l;plus.push(up>down&&up>0?up:0);minus.push(down>up&&down>0?down:0)}let atr=atrSeries(cs,len),dx=[];for(let i=len;i<cs.length;i++){let tr=atr[i];if(!tr)continue;let p=plus.slice(i-len+1,i+1).reduce((a,b)=>a+b,0)/(len*tr),m=minus.slice(i-len+1,i+1).reduce((a,b)=>a+b,0)/(len*tr);let den=p+m;dx.push(den?100*Math.abs(p-m)/den:0)}return dx.length?dx.slice(-len).reduce((a,b)=>a+b,0)/Math.min(len,dx.length):null}
function bollinger(cs,len=20,mult=2){let vals=cs.map(x=>x.c),a=vals.slice(-len);if(a.length<len)return null;let mean=a.reduce((x,y)=>x+y,0)/len,sd=Math.sqrt(a.reduce((x,y)=>x+(y-mean)**2,0)/len);return {mid:mean,upper:mean+mult*sd,lower:mean-mult*sd,width:mean?((mult*2*sd)/mean):null,z:sd?(vals.at(-1)-mean)/sd:0}}
function rocValue(cs,len=10){if(cs.length<=len)return null;let a=cs.at(-1).c,b=cs.at(-1-len).c;return b?((a-b)/b)*100:null}
function volumeStats(cs,len=20){let vs=cs.slice(-len).map(x=>x.v).filter(Number.isFinite);if(!vs.length)return null;let mean=vs.reduce((a,b)=>a+b,0)/vs.length,sd=Math.sqrt(vs.reduce((a,b)=>a+(b-mean)**2,0)/vs.length);let last=cs.at(-1)?.v;return {mean,last,ratio:mean?last/mean:null,z:sd?(last-mean)/sd:0}}
function efficiencyValue(cs,len=20){if(cs.length<=len)return null;let net=Math.abs(cs.at(-1).c-cs.at(-1-len).c),path=0;for(let i=cs.length-len;i<cs.length;i++)path+=Math.abs(cs[i].c-cs[i-1].c);return path?net/path:null}
function lastCompleted(cs){let a=[...cs].reverse().find(x=>x.confirm===1||x.confirm==='1');return a||cs.at(-1)||null}
function pivots(cs,left=2,right=2){let hi=[],lo=[];for(let i=left;i<cs.length-right;i++){let h=cs[i].h,l=cs[i].l,okH=true,okL=true;for(let j=1;j<=left;j++){if(cs[i-j].h>=h)okH=false;if(cs[i-j].l<=l)okL=false}for(let j=1;j<=right;j++){if(cs[i+j].h>h)okH=false;if(cs[i+j].l<l)okL=false}if(okH)hi.push({i,t:cs[i].t,v:h});if(okL)lo.push({i,t:cs[i].t,v:l})}return {hi,lo}}
function clusterLevels(cs,priceNow){if(!cs?.length)return {support:priceNow*.99,resistance:priceNow*1.01,nextSupport:null,nextResistance:null};let p=pivots(cs,2,2),raw=[...p.hi.map(x=>({v:x.v,type:'r'})),...p.lo.map(x=>({v:x.v,type:'s'}))].sort((a,b)=>a.v-b.v);let atr=atrValue(cs,14)||priceNow*.01,tol=Math.max(atr*.28,priceNow*.0015),groups=[];for(const x of raw){let g=groups.find(z=>Math.abs(z.v-x.v)<=tol);if(g){g.v=(g.v*g.n+x.v)/(g.n+1);g.n++;g.types.add(x.type)}else groups.push({v:x.v,n:1,types:new Set([x.type])})}let below=groups.filter(x=>x.v<priceNow).sort((a,b)=>b.v-a.v),above=groups.filter(x=>x.v>priceNow).sort((a,b)=>a.v-b.v);let support=below[0]?.v, resistance=above[0]?.v;if(!support){let lows=cs.slice(-Math.min(80,cs.length)).map(x=>x.l);support=Math.min(...lows)}if(!resistance){let highs=cs.slice(-Math.min(80,cs.length)).map(x=>x.h);resistance=Math.max(...highs)}return {support,resistance,nextSupport:below[1]?.v||null,nextResistance:above[1]?.v||null,groups}}
function trendState(cs){if(!cs?.length)return {bull:false,bear:false,label:'N/D',strength:0};let e20=ema(cs,20),e50=ema(cs,50),p=lastCompleted(cs)?.c??cs.at(-1).c,a=e20.at(-1),b=e50.at(-1),adx=adxValue(cs,14),roc=rocValue(cs,10);let trendSep=Math.abs((a-b)/Math.max(Math.abs(p),1e-12))*10000,trendAdx=adx||0,trendRoc=roc||0,trendEff=efficiencyValue(cs,20)||0,trendConfirmed=(trendAdx>=18||trendEff>=.35||trendSep>=2.0);let bull=a>b&&p>a&&trendRoc>=0.25&&trendConfirmed,bear=a<b&&p<a&&trendRoc<=-0.25&&trendConfirmed,strength=Math.min(100,trendSep+trendAdx*.4+Math.min(20,Math.abs(trendRoc)*1.5)+trendEff*15);return {bull,bear,label:bull?'haussier':bear?'baissier':'mixte',strength,adx,roc,e20:a,e50:b}}
function timeframeFeatures(cs){let c=lastCompleted(cs);if(!c)return null;let priceNow=c.c,a=atrValue(cs,14),bb=bollinger(cs,20,2),vol=volumeStats(cs,20),t=trendState(cs),r=rsi(cs,14).filter(Number.isFinite).at(-1),sr=stochRsi(cs,14),levels=clusterLevels(cs,priceNow),roc=rocValue(cs,10),eff=efficiencyValue(cs,20);let range=(levels.resistance-levels.support)||a*4;let distR=Math.abs(levels.resistance-priceNow),distS=Math.abs(priceNow-levels.support);return {cs,c,priceNow,atr:a||priceNow*.01,bb,vol,t,rsi:r,stoch:sr?.k?.at(-1),stochK:sr?.k?.at(-1),stochD:sr?.d?.at(-1),levels,roc,eff,distR,distS,range,compression:bb?.width!=null&&bb.width<0.035,expansion:(vol?.ratio||0)>1.35&&Math.abs(roc||0)>(a/Math.max(priceNow,1e-12))*100*.35}}

function multiTimeframeConsensus(mtf){
  const order=['1D','4H','1H','30m','15m','5m','1m'];
  const rows=order.map(tf=>{const f=mtf?.[tf]; if(!f) return null; const t=f.t||{}; let bias=t.bull?'bull':t.bear?'bear':'neutral';
    const strength=Number.isFinite(t.strength)?t.strength:0;
    const adx=Number.isFinite(t.adx)?t.adx:0;
    const quality=Math.max(0,Math.min(100,50 + (bias==='bull'?1:bias==='bear'?-1:0)*Math.min(35,strength*.35) + Math.min(15,adx*.3)));
    return {tf,bias,strength,adx,quality};
  }).filter(Boolean);
  if(!rows.length) return {rows:[],bias:'neutral',score:50,agreement:0,contradiction:0,detail:'N/D'};
  const weights={ '1D':3.0,'4H':2.5,'1H':2.0,'30m':1.5,'15m':1.0,'5m':.7,'1m':.4 };
  let bull=0,bear=0,total=0; for(const r of rows){const w=weights[r.tf]||1;total+=w;if(r.bias==='bull')bull+=w;if(r.bias==='bear')bear+=w;}
  const major=rows.filter(r=>['1D','4H','1H'].includes(r.tf));
  const majorBull=major.filter(r=>r.bias==='bull').length, majorBear=major.filter(r=>r.bias==='bear').length;
  const dominant=bull>bear?'bull':bear>bull?'bear':'neutral';
  const agreement=Math.round(Math.max(bull,bear)/Math.max(total,1)*100);
  const contradiction=Math.round(Math.min(bull,bear)/Math.max(total,1)*100);
  const majorConflict=majorBull>0&&majorBear>0;
  let score=50 + (dominant==='bull'?1:dominant==='bear'?-1:0)*Math.min(35,agreement*.35);
  if(majorConflict) score-=12;
  if((majorBull===major.length&&major.length>=2)||(majorBear===major.length&&major.length>=2)) score+=8;
  return {rows,bias:dominant,score:Math.max(0,Math.min(100,Math.round(score))),agreement,contradiction,majorConflict,detail:majorConflict?'Conflit entre timeframes majeurs':agreement>=70?'Alignement multi-timeframe fort':'Alignement partiel'};
}

function regimeContextFromMTF(F,currentData){
  const mtf=multiTimeframeConsensus(F);
  const rows=mtf.rows||[];
  const get=k=>F[k]||null;
  const majorBull=['1D','4H','1H'].filter(k=>get(k)?.t?.bull).length;
  const majorBear=['1D','4H','1H'].filter(k=>get(k)?.t?.bear).length;
  const trigger=get('15m')||get('5m')||get('1m')||get('1H');
  const anchor=get('4H')||get('1H')||get('1D');
  const vr=trigger?.vol?.ratio??null, adx=trigger?.t?.adx??0, roc=trigger?.roc??0;
  const comp=!!trigger?.compression, exp=!!trigger?.expansion;
  const near=trigger?Math.min(trigger.distR,trigger.distS)<=Math.max(trigger.atr*1.2,trigger.priceNow*.004):false;
  const counter=(anchor?.t?.bull&&trigger?.t?.bear)||(anchor?.t?.bear&&trigger?.t?.bull);
  let key='continuation',reason='Contexte directionnel sans déclencheur spécifique';
  if(counter && trigger && ((Number.isFinite(trigger.rsi)&&(trigger.rsi>=68||trigger.rsi<=32))||Math.abs(roc)>=1.5)){
    key='reversal'; reason='désaccord contexte/déclenchement + momentum extrême';
  }else if(comp && ((currentData?.oiDelta!=null&&Math.abs(currentData.oiDelta)>=1.5)||(vr!=null&&vr>=1.05))){
    key='squeeze'; reason='compression multi-timeframe + participation en évolution';
  }else if(exp && vr!=null&&vr>=1.15 && near && (majorBull>=2||majorBear>=2) && adx>=18){
    key='breakout'; reason='niveau proche + expansion + volume + contexte majeur cohérent';
  }else if(adx<18 && !exp && !counter){
    key='range'; reason='absence de tendance forte et volatilité contenue';
  }
  const profile=REGIME_PROFILES[key]||REGIME_PROFILES.continuation;
  return {...mtf,key,label:profile.label,reason,profile,majorBull,majorBear,counter};
}
// Only labels are consumed today. tf/priority/avoid are documentary metadata, not active weights.
const REGIME_PROFILES={
  breakout:{label:'Cassure / continuation',priority:['structure','priceAction','volume','trend','derivatives','adx'],avoid:['fundingExtreme'],tf:{'1D':1.8,'4H':1.6,'1H':1.35,'30m':1.15,'15m':1.3,'5m':.85,'1m':.35}},
  reversal:{label:'Retournement',priority:['priceAction','structure','momentum','rsi','range','volatility'],avoid:['chasing'],tf:{'1D':1.4,'4H':1.5,'1H':1.35,'30m':1.1,'15m':1.3,'5m':.95,'1m':.4}},
  range:{label:'Range / mean reversion',priority:['range','priceAction','rsi','bollinger','volatility'],avoid:['trendChase'],tf:{'1D':1.0,'4H':1.15,'1H':1.25,'30m':1.25,'15m':1.2,'5m':.9,'1m':.35}},
  squeeze:{label:'Compression / squeeze',priority:['volatility','derivatives','volume','bollinger','priceAction'],avoid:['earlyDirection'],tf:{'1D':1.5,'4H':1.5,'1H':1.4,'30m':1.2,'15m':1.25,'5m':1.0,'1m':.35}},
  continuation:{label:'Tendance / continuation',priority:['structure','trend','priceAction','volume','adx'],avoid:['counterTrend'],tf:{'1D':1.8,'4H':1.6,'1H':1.4,'30m':1.15,'15m':1.05,'5m':.75,'1m':.3}}
};

function adaptiveEngine(frames,currentData){
 const order=['1m','5m','15m','30m','1H','4H','1D'],F={};for(const k of order)if(frames[k]?.length>=40)F[k]=timeframeFeatures(frames[k]);
 const keys=Object.keys(F);if(keys.length<2)return null;
 const live=currentData?.price||F[keys[0]].priceNow;
 const mtf=regimeContextFromMTF(F,currentData);
 // Anchor selection: prefer the highest timeframe with a readable structure and enough room to the nearest key level.
 let anchorKey=keys[keys.length-1];for(const k of ['1D','4H','1H','30m','15m'])if(F[k]&&F[k].t.label!=='mixte'&&F[k].levels.support&&F[k].levels.resistance){anchorKey=k;break}
 const anchor=F[anchorKey];
 // Trigger selection: choose the shortest timeframe whose volatility, volume and structure can define a precise trigger without being excessively noisy.
 let triggerKey=null,best=-Infinity;for(const k of keys.filter(k=>['5m','15m','30m','1H'].includes(k))){let f=F[k],score=0;score+=(f.vol?.ratio>1?1:0)+(f.t.label===anchor.t.label?2:0)+(f.adx&&f.adx>18?1:0)+(f.eff&&f.eff>.25?1:0);score-=k==='1m'&&keys.length>3?.25:0;if(score>best){best=score;triggerKey=k}}
 const trigger=F[triggerKey||keys[0]], nearR=trigger.distR<=Math.max(trigger.atr*1.2,live*.004),nearS=trigger.distS<=Math.max(trigger.atr*1.2,live*.004), shortNearR=trigger.distR<=Math.max(trigger.atr*1.5,live*.006), shortNearS=trigger.distS<=Math.max(trigger.atr*1.5,live*.006);
 const biasBull=anchor.t.bull && (F['1H']?.t.bull||F['15m']?.t.bull||trigger.t.bull),biasBear=anchor.t.bear && (F['1H']?.t.bear||F['15m']?.t.bear||trigger.t.bear);
 const r=trigger.levels.resistance,s=trigger.levels.support,buf=Math.max(trigger.atr*.10,live*.00035),micro=Math.max(trigger.atr*.18,live*.00025);
 const brEntry=r+buf,brStop=Math.max(0,r-Math.max(trigger.atr*.65,micro)),brRisk=Math.max(1e-12,brEntry-brStop);
 const brT1=trigger.levels.nextResistance&&trigger.levels.nextResistance>brEntry?Math.max(brEntry+brRisk,trigger.levels.nextResistance):brEntry+brRisk;
 const brT2=Math.max(brT1+brRisk*.7,brEntry+brRisk*2),brT3=Math.max(brT2+brRisk*.7,brEntry+brRisk*3);
 const puEntry=s+Math.max(trigger.atr*.06,live*.0002),puStop=Math.max(0,s-Math.max(trigger.atr*.60,micro)),puRisk=Math.max(1e-12,puEntry-puStop);
 const puT1=Math.max(puEntry+puRisk, r),puT2=Math.max(puT1+puRisk*.65,trigger.levels.nextResistance||0),puT3=Math.max(puT2+puRisk*.65,puEntry+puRisk*3);
 const bdEntry=Math.max(0,s-buf),bdStop=s+Math.max(trigger.atr*.65,micro),bdRisk=Math.max(1e-12,bdStop-bdEntry);
 const bdT1=trigger.levels.nextSupport&&trigger.levels.nextSupport<bdEntry?Math.min(bdEntry-bdRisk,trigger.levels.nextSupport):bdEntry-bdRisk,bdT2=bdT1-bdRisk*.9,bdT3=bdT2-bdRisk*.9;
 const confluences=[];
 if(anchor.t.label!=='mixte')confluences.push(`tendance ${anchorKey} ${anchor.t.label}`);if(trigger.t.label===anchor.t.label)confluences.push(`alignement ${triggerKey}`);if(trigger.vol?.ratio>=1.15)confluences.push(`volume ${trigger.vol.ratio.toFixed(2)}x`);if(trigger.adx&&trigger.adx>=18)confluences.push(`ADX ${trigger.adx.toFixed(0)}`);if(trigger.bb?.z!=null&&Math.abs(trigger.bb.z)>=1)confluences.push(`position Bollinger ${trigger.bb.z.toFixed(1)}σ`);if(trigger.eff!=null&&trigger.eff>.3)confluences.push(`efficacité ${trigger.eff.toFixed(2)}`);if(trigger.rsi!=null&&trigger.rsi>52&&biasBull)confluences.push(`RSI ${trigger.rsi.toFixed(0)} haussier`);if(trigger.rsi!=null&&trigger.rsi<48&&biasBear)confluences.push(`RSI ${trigger.rsi.toFixed(0)} baissier`);
 const signals=[];
 const addSig=(name,status,detail,family)=>signals.push({name,status,detail,family});
 addSig(`Tendance ${anchorKey}`,anchor.t.label==='mixte'?'neutral':((biasBull&&anchor.t.bull)||(biasBear&&anchor.t.bear))?'positive':'negative',anchor.t.label,'structure');
 addSig(`Alignement ${triggerKey}`,trigger.t.label===anchor.t.label?'positive':trigger.t.label==='mixte'?'neutral':'negative',trigger.t.label,'structure');
 addSig('Volume déclencheur',trigger.vol?.ratio==null?'neutral':trigger.vol.ratio>=1.15?'positive':trigger.vol.ratio>=.85?'warning':'negative',trigger.vol?.ratio==null?'N/D':trigger.vol.ratio.toFixed(2)+'x moyenne','volume');
 addSig('RSI',!Number.isFinite(trigger.rsi)?'neutral':((biasBull&&trigger.rsi>=52)||(biasBear&&trigger.rsi<=48))?'positive':(trigger.rsi>=70||trigger.rsi<=30)?'warning':'negative',Number.isFinite(trigger.rsi)?trigger.rsi.toFixed(1):'N/D','momentum');
 addSig('Bollinger',trigger.bb?.z==null?'neutral':Math.abs(trigger.bb.z)>=2?'warning':Math.abs(trigger.bb.z)>=1?'positive':'neutral',trigger.bb?.z==null?'N/D':trigger.bb.z.toFixed(2)+'σ','volatilité');
 addSig('ADX',trigger.adx==null?'neutral':trigger.adx>=25?'positive':trigger.adx>=18?'warning':'negative',trigger.adx==null?'N/D':trigger.adx.toFixed(1),'tendance');
 addSig('Efficacité',trigger.eff==null?'neutral':trigger.eff>=.4?'positive':trigger.eff>=.25?'warning':'negative',trigger.eff==null?'N/D':trigger.eff.toFixed(2),'price action');
 addSig('Volatilité',trigger.compression?'warning':trigger.expansion?'positive':'neutral',trigger.compression?'compression':trigger.expansion?'expansion':'normale','volatilité');
 addSig('Distance au niveau',nearR||nearS?'positive':'neutral',nearR?'résistance proche':nearS?'support proche':'hors zone','structure');
 if(currentData?.oiDelta!=null)addSig('Open Interest',Math.abs(currentData.oiDelta)>=2?'warning':'neutral',(currentData.oiDelta>=0?'+':'')+currentData.oiDelta.toFixed(2)+'% • participation, pas direction','dérivés');else addSig('Open Interest','neutral','historique insuffisant','dérivés');
 if(currentData?.funding!=null){let f=currentData.funding;let adverse=(biasBull&&f>.0008)||(biasBear&&f<-.0008);addSig('Funding',adverse?'warning':(biasBull&&f<0)||(biasBear&&f>0)?'positive':'neutral',(f*100).toFixed(4)+'%','dérivés')}else addSig('Funding','neutral','N/D','dérivés');
 let score=38+confluences.length*6+(anchor.t.label===trigger.t.label?8:0)+(trigger.vol?.ratio>1.5?6:0)+(trigger.adx>25?6:0)+(trigger.eff>.4?5:0);
 const majorCount=(mtf.rows||[]).filter(r=>['1D','4H','1H'].includes(r.tf)).length;
 score+=mtf.majorBull===majorCount&&majorCount>=2&&biasBull?8:0;
  score+=mtf.majorBear===majorCount&&majorCount>=2&&biasBear?8:0;
 score-=mtf.majorConflict?15:0;
 score-=mtf.counter?8:0;
 if(mtf.key==='breakout' && !(nearR||nearS)) score-=8;
 if(mtf.key==='range' && (biasBull||biasBear)) score-=6;
 if(mtf.key==='squeeze' && !(trigger.compression||trigger.expansion)) score-=5;
 if(mtf.key==='reversal' && !(mtf.counter||trigger.rsi>=68||trigger.rsi<=32)) score-=6;
 score=Math.max(0,Math.min(100,Math.round(score)));
 const directional=directionalAssessment({F,extensionRisk:0,biasBull,biasBear,nearR,nearS},currentData||{});
 // V8.6.5 — the SHORT engine is pattern-led, not simply trend-led.
 // A valid short may come from a bearish continuation, a resistance rejection,
 // a failed breakout or a confirmed reversal even when the 1D anchor is not yet bearish.
 const triggerBear = !!(trigger?.t?.bear || (Number.isFinite(trigger?.t?.e20) && live<trigger.t.e20) || (Number.isFinite(trigger?.roc) && trigger.roc<0));
 const triggerBull = !!(trigger?.t?.bull || (Number.isFinite(trigger?.t?.e20) && live>trigger.t.e20) || (Number.isFinite(trigger?.roc) && trigger.roc>0));
 const bearishMomentum = !!(triggerBear && ((Number.isFinite(trigger?.rsi)&&trigger.rsi<=49) || (Number.isFinite(trigger?.roc)&&trigger.roc<0)));
 const shortRejectionPattern = !!(shortNearR && (bearishMomentum || (mtf.counter&&triggerBear) || (Number.isFinite(trigger?.bb?.z)&&trigger.bb.z>=1.2)));
 const shortBreakdownPattern = !!(shortNearS && triggerBear && ((Number.isFinite(trigger?.roc)&&trigger.roc<0) || (trigger?.eff||0)>=.25 || (trigger?.vol?.ratio||0)>=1.05));
 const shortReversalPattern = !!(mtf.counter && triggerBear && ((Number.isFinite(trigger?.rsi)&&trigger.rsi<=48) || (Number.isFinite(trigger?.roc)&&trigger.roc<0)));
 const shortExtensionReversal = !!((Number.isFinite(trigger?.rsi)&&trigger.rsi<52) && (Number.isFinite(trigger?.bb?.z)&&trigger.bb.z>1.4) && shortNearR);
 const shortPattern = shortRejectionPattern?'rejection':shortBreakdownPattern?'breakdown':shortReversalPattern?'reversal':shortExtensionReversal?'reversal':null;
 const shortBoost = shortPattern ? (shortPattern==='reversal'?12:shortPattern==='rejection'?10:8) : 0;
 directional.shortScore=Math.max(0,Math.min(100,Math.round(directional.shortScore+shortBoost)));
 directional.spread=Math.abs(directional.longScore-directional.shortScore);
 directional.strongest=directional.longScore>directional.shortScore?'long':directional.shortScore>directional.longScore?'short':'neutral';
 directional.shortPattern=shortPattern;
 directional.shortEligible=!!(currentData?.perpId && shortPattern && directional.shortScore>=62 && directional.shortScore>=directional.longScore-3);
 // V8.6.5 — LONG remains independent; its instrument is selected later by the scenario layer.
 const shortBuf=Math.max(trigger.atr*.08,live*.0002);
 const srEntry=Math.max(0,r-shortBuf);
 const srStop=r+Math.max(trigger.atr*.55,micro);
 const srRisk=Math.max(1e-12,srStop-srEntry);
 const srT1=trigger.levels.nextSupport&&trigger.levels.nextSupport<srEntry?Math.min(srEntry-srRisk,trigger.levels.nextSupport):srEntry-srRisk;
 const srT2=Math.min(srT1-srRisk*.75,srEntry-srRisk*2);
 const srT3=Math.min(srT2-srRisk*.75,srEntry-srRisk*3);
 const shortRejection={entry:srEntry,stop:srStop,tp1:srT1,tp2:srT2,tp3:srT3,risk:srRisk,rr:[Math.max(0,(srEntry-srT1)/srRisk),Math.max(0,(srEntry-srT2)/srRisk),Math.max(0,(srEntry-srT3)/srRisk)]};
 const bearishContext=directional.shortEligible;
 const bullishContext=directional.longEligible && !mtf.majorConflict;
 const longSetup=!!(bullishContext&&(nearR||nearS)&&!mtf.counter);
 const shortSetup=!!(bearishContext && shortPattern);
 const breakdownValid=shortSetup&&shortPattern==='breakdown'&&scenarioValid('breakdown',{entry:bdEntry,stop:bdStop,tp1:bdT1,tp2:bdT2,tp3:bdT3},live);
 const rejectionValid=shortSetup&&(shortPattern==='rejection'||shortPattern==='reversal')&&scenarioValid('rejection',shortRejection,live);
 const longValid=(longSetup&&(scenarioValid('breakout',{entry:brEntry,stop:brStop,tp1:brT1,tp2:brT2,tp3:brT3},live)||scenarioValid('pullback',{entry:puEntry,stop:puStop,tp1:puT1,tp2:puT2,tp3:puT3},live)));
 const decision=score>=78&&confluences.length>=5&&!mtf.majorConflict?'SETUP':score>=62?'WATCH':'NO_SETUP';
 const readiness=decision==='SETUP'?'CONFIGURATION À APPROFONDIR':decision==='WATCH'?'CONFIGURATION EN FORMATION':'ATTENTE';
 const shared={families:{},counts:{positive:0,warning:0,negative:0,neutral:0},score:score};
 signals.forEach(sig=>{const key=String(sig.family||'autre');if(!shared.families[key])shared.families[key]={positive:0,negative:0,warning:0,neutral:0};shared.families[key][sig.status]=(shared.families[key][sig.status]||0)+1;shared.counts[sig.status]=(shared.counts[sig.status]||0)+1;});
 return {F,anchorKey,triggerKey,anchor,trigger,live,mtf,regime:mtf,decision,shared,biasBull,biasBear,nearR,nearS,shortNearR,shortNearS,shortPattern,confluences,signals,directional,signalCounts:{positive:signals.filter(x=>x.status==='positive').length,negative:signals.filter(x=>x.status==='negative').length,warning:signals.filter(x=>x.status==='warning').length,neutral:signals.filter(x=>x.status==='neutral').length},score,readiness,levels:trigger.levels,breakout:{entry:brEntry,stop:brStop,tp1:brT1,tp2:brT2,tp3:brT3,risk:brRisk,rr:[(brT1-brEntry)/brRisk,(brT2-brEntry)/brRisk,(brT3-brEntry)/brRisk]},pullback:{entry:puEntry,stop:puStop,tp1:puT1,tp2:puT2,tp3:puT3,risk:puRisk,rr:[(puT1-puEntry)/puRisk,(puT2-puEntry)/puRisk,(puT3-puEntry)/puRisk]},breakdown:{entry:bdEntry,stop:bdStop,tp1:bdT1,tp2:bdT2,tp3:bdT3,risk:bdRisk,rr:[Math.max(0,(bdEntry-bdT1)/bdRisk),Math.max(0,(bdEntry-bdT2)/bdRisk),Math.max(0,(bdEntry-bdT3)/bdRisk)]},shortRejection,longSetup,shortSetup,longValid,rejectionValid,breakdownValid,buffer:buf};
}
function directionalAssessment(e,x={}){
  const F=e?.F||{}, order=['1D','4H','1H','30m','15m','5m'], weights={"1D":4,"4H":3.4,"1H":2.7,"30m":2.1,"15m":1.6,"5m":1.1};
  let bull=0,bear=0,total=0;
  for(const tf of order){const f=F[tf];if(!f)continue;const w=weights[tf]||1;total+=w;let b=0,r=0;
    if(f.t?.bull)b+=2.4;if(f.t?.bear)r+=2.4;
    if(f.t?.e20!=null&&f.t?.e50!=null){if(f.t.e20>f.t.e50)b+=1.6;if(f.t.e20<f.t.e50)r+=1.6}
    if(Number.isFinite(f.rsi)){if(f.rsi>=52&&f.rsi<72)b+=1.1;if(f.rsi<=48&&f.rsi>28)r+=1.1;if(f.rsi>=75)r-=.8;if(f.rsi<=25)b-=.8}
    if(Number.isFinite(f.stochK)){if(f.stochK>.55&&f.stochK<.9)b+=.45;if(f.stochK<.45&&f.stochK>.1)r+=.45}
    if(Number.isFinite(f.roc)){if(f.roc>0)b+=.8;if(f.roc<0)r+=.8}
    if(f.eff!=null&&f.eff>.25){if(f.t?.bull)b+=.5;if(f.t?.bear)r+=.5}
    if(f.vol?.ratio!=null&&f.vol.ratio>=1.15){if(f.t?.bull)b+=.35;if(f.t?.bear)r+=.35}
    bull+=b*w;bear+=r*w;
  }
  const denom=Math.max(1,total*7.0);
  let longScore=50+(bull-bear)/denom*50,shortScore=50+(bear-bull)/denom*50;
  const ext=e?.extensionRisk||0;
  if(ext>=72){if(e?.biasBull)longScore-=12;if(e?.biasBear)shortScore-=12}
  if(e?.nearS&&e?.biasBull)longScore+=5;if(e?.nearR&&e?.biasBear)shortScore+=5;
  if(e?.nearR&&e?.biasBull)longScore+=2;if(e?.nearS&&e?.biasBear)shortScore+=2;
  const funding=x?.funding;if(Number.isFinite(funding)){if(funding>.0008){longScore-=3;shortScore+=1}else if(funding<-.0008){shortScore-=3;longScore+=1}}
  const oi=x?.oiDelta;if(Number.isFinite(oi)&&Number.isFinite(x?.chg)){if(x.chg>0&&oi>0)longScore+=2;if(x.chg<0&&oi>0)shortScore+=2;if(x.chg>0&&oi<0)longScore-=1;if(x.chg<0&&oi<0)shortScore-=1}
  longScore=Math.max(0,Math.min(100,Math.round(longScore)));shortScore=Math.max(0,Math.min(100,Math.round(shortScore)));
  const spread=Math.abs(longScore-shortScore),strongest=longScore>shortScore?'long':shortScore>longScore?'short':'neutral';
  return {longScore,shortScore,spread,strongest,longEligible:longScore>=66&&longScore>=shortScore+7,shortEligible:shortScore>=66&&shortScore>=longScore+7};
}
