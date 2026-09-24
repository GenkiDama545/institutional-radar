const assert=require('node:assert/strict');const {runInNewContext}=require('node:vm');const {readFileSync}=require('node:fs');
const sandbox={};runInNewContext(readFileSync('hosted-feed.js','utf8'),sandbox);
const now=1800000000000;
const state=sandbox.RadarHosted.normalize({fresh:true,lastTradeAt:now,coverage:3,events:[{instId:'ALLO-USDT',minute:now,ratio:4,movePct:1,usd:1000,detectedAt:now,updatedAt:now,live:true},{instId:'<img>',minute:now,ratio:4,movePct:1,usd:1000,updatedAt:now,live:true}]},now);
assert.equal(state.fresh,true);assert.equal(state.events.length,1);assert.equal(sandbox.RadarHosted.normalize({fresh:true,lastTradeAt:now-200000,events:[]},now).fresh,false);console.log('hosted feed checks passed');
