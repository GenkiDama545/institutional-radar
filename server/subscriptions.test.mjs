import {test} from 'node:test';
import assert from 'node:assert/strict';
import {subscriptionPlan} from './subscriptions.mjs';

test('new listings and delistings update existing subscription groups',()=>{
 const active=new Map([[0,['A-USDT','B-USDT']],[1,['C-USDT']]]);
 const added=subscriptionPlan(['A-USDT','B-USDT','D-USDT','C-USDT'],active,2);
 assert.deepEqual(added.changed,[1]);
 assert.deepEqual(added.groups.get(1),['D-USDT','C-USDT']);
 const removed=subscriptionPlan(['A-USDT'],active,2);
 assert.deepEqual(removed.changed,[0]);
 assert.deepEqual(removed.removed,[1]);
});
