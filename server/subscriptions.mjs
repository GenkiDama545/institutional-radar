// Determine WebSocket subscriptions independently of socket lifecycle.
export function subscriptionPlan(instruments,activeGroups,maxPerSocket=50){
 const groups=new Map();
 for(let i=0;i<instruments.length;i+=maxPerSocket)groups.set(groups.size,instruments.slice(i,i+maxPerSocket));
 const changed=[...groups].filter(([index,ids])=>activeGroups.get(index)?.join(',')!==ids.join(',')).map(([index])=>index);
 const removed=[...activeGroups.keys()].filter(index=>!groups.has(index));
 return {groups,changed,removed};
}
