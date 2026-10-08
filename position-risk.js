/* Read-only position sizing. Never changes technical levels, admission or journal. */
(function(root){
 'use strict';
 const key='ir_position_risk_v1';
 const defaults=Object.freeze({amount:100,leverage:10,basis:'',maxLoss:null});
 const number=v=>v==null||v===''?null:Number(v);
 function profile(input={}){
  if(!input||typeof input!=='object')input={};
  return {amount:input.amount===undefined?100:number(input.amount),leverage:input.leverage===undefined?10:number(input.leverage),basis:['margin','notional'].includes(input.basis)?input.basis:'',maxLoss:number(input.maxLoss)};
 }
 function evaluate(levels={},input){
  if(!levels||typeof levels!=='object')levels={};
  const p=profile(input),entry=number(levels.entry),stop=number(levels.stop),side=levels.side;
  const errors=[];
  if(!(Number.isFinite(entry)&&entry>0&&Number.isFinite(stop)&&stop>0))errors.push('Entrée et SL valides requis.');
  if(!['long','short'].includes(side)||side==='long'&&stop>=entry||side==='short'&&stop<=entry)errors.push('SL incompatible avec le sens du scénario.');
  if(!(Number.isFinite(p.amount)&&p.amount>0&&Number.isFinite(p.leverage)&&p.leverage>=1&&p.leverage<=10))errors.push('Montant positif et levier de 1 à 10 requis.');
  if(p.maxLoss!==null&&!(Number.isFinite(p.maxLoss)&&p.maxLoss>0))errors.push('La perte maximale doit être positive, ou laissée vide.');
  if(errors.length)return {ok:false,errors};
  const distance=Math.abs(entry-stop),distancePct=distance/entry*100;
  if(!p.basis)return {ok:false,needsBasis:true,distancePct,errors:['Précise si le montant correspond à la marge ou à la position totale.']};
  const notional=p.basis==='margin'?p.amount*p.leverage:p.amount,margin=notional/p.leverage;
  const loss=notional*distance/entry,budgetSet=p.maxLoss!==null;
  const overBudget=budgetSet?loss-p.maxLoss>Math.max(1e-8,p.maxLoss*1e-10):null;
  const maxNotional=budgetSet?p.maxLoss*entry/distance:null;
  if(![notional,margin,distancePct,loss,loss/margin].every(Number.isFinite)||margin<=0||budgetSet&&!Number.isFinite(maxNotional))return {ok:false,errors:['Valeurs hors de la plage de calcul.']};
  return {ok:true,notional,margin,distancePct,loss,lossPctMargin:loss/margin*100,budgetSet,overBudget,maxNotional,maxMargin:maxNotional===null?null:maxNotional/p.leverage,marginExhausted:loss>=margin};
 }
 const api={key,defaults,profile,evaluate};root.RadarPositionRisk=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
