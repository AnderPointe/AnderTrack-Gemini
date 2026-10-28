import test from 'node:test';import assert from 'node:assert/strict';
import {seedBeacons,moveBeacons,syncSummary} from '../src/lib/beacon-fixtures.js';
import {reconcileBeacons} from '../src/lib/beacon-reconciler.js';
test('20 simultaneous beacons keep all marker identities through 1200 updates',()=>{
 const start=Date.now(),registry=new Map();let created=0,removed=0,updates=0;
 const adapter={create:()=>{created++;return {};},update:()=>updates++,remove:()=>removed++};let points=seedBeacons(20,start);
 reconcileBeacons(registry,points,adapter,start,60000);const pins=points.map(p=>registry.get(p.id).pin);
 for(let tick=1;tick<=1200;tick++){
  points=moveBeacons(points,start+tick*1000);const result=reconcileBeacons(registry,points,adapter,start+tick*1000,60000);
  assert.equal(result.moved,20);assert.equal(result.created,0);assert.equal(result.removed,0);assert.equal(registry.size,20);
 }
 assert.equal(created,20);assert.equal(removed,0);assert.equal(updates,24000);points.forEach((p,i)=>assert.equal(registry.get(p.id).pin,pins[i]));
 const stale=reconcileBeacons(registry,points,adapter,start+1200*1000+70000,60000);assert.equal(stale.restyled,20);
 points=moveBeacons(points,start+1200*1000+71000);assert.equal(reconcileBeacons(registry,points,adapter,start+1200*1000+71000,60000).restyled,20);
 assert.equal(reconcileBeacons(registry,points.slice(1),adapter,start+1200*1000+71000,60000).removed,1);assert.equal(registry.size,19);
});
test('20 fixture stays in the metro grid initially and refreshes every coordinate/timestamp',()=>{
 const points=seedBeacons(20,0),next=moveBeacons(points,1000);assert.equal(new Set(points.map(p=>p.id)).size,20);
 assert.ok(points.every(p=>p.latitude>=32.69&&p.latitude<32.8&&p.longitude>=-97.42&&p.longitude< -97.3));
 assert.ok(next.every((p,i)=>p.latitude!==points[i].latitude&&p.longitude!==points[i].longitude&&p.last_ping_at!==points[i].last_ping_at));
 assert.equal(points[0].last_ping_at,new Date(0).toISOString());assert.deepEqual(syncSummary([1,3,2,4]),{count:4,p95:4,max:4});
});
