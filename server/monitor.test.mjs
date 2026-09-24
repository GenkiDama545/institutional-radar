import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MarketMonitor} from './monitor.mjs';

test('retains a qualifying small asset and deduplicates trades and minute events',()=>{
 let clock=1_800_000_000_000;const monitor=new MarketMonitor({now:()=>clock});
 for(let i=0;i<9;i++){clock=1_800_000_000_000+i*60000;monitor.trade({instId:'ALLO-USDT',px:'1',sz:'100',ts:String(clock),tradeId:String(i)})}
 clock+=60000;
 const trade={instId:'ALLO-USDT',px:'1',sz:'400',ts:String(clock),tradeId:'trigger'};
 monitor.trade(trade);monitor.trade(trade);
 monitor.trade({...trade,px:'1.01',sz:'50',tradeId:'followup'});
 assert.equal(monitor.events.length,1);assert.equal(monitor.events[0].instId,'ALLO-USDT');
 assert.equal(monitor.events[0].status,'detected');assert.equal(monitor.events[0].execution,'unverified');
 assert.equal(monitor.events[0].usd,450.5);
 const recovered=new MarketMonitor({now:()=>clock});recovered.restore(monitor.snapshot());
 assert.equal(recovered.events.length,1);assert.equal(recovered.publicState().fresh,false);
});

test('rejects stale, future and non Spot USDT trades',()=>{
 const monitor=new MarketMonitor({now:()=>1_800_000_000_000});
 for(const [instId,ts] of [['ALLO-USD',1_800_000_000_000],['ALLO-USDT',1_799_999_000_000],['ALLO-USDT',1_800_001_000_000]])monitor.trade({instId,px:1,sz:10,ts});
 assert.equal(monitor.bars.size,0);
});
