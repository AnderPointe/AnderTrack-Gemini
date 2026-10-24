import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignmentsForDriver,driverAssignmentAction,externalRouteUrl,
  classifyLegacyAssignment,groupDriverAssignments,validLocalPosition
} from '../src/driver-logic.js';

const assignments=[
  {id:'1',organization_id:'orgA',driver_user_id:'me',division:'Class C',status:'offered',created_at:'2026-10-01'},
  {id:'2',organization_id:'orgA',driver_user_id:'me',division:'CDL',status:'assigned',created_at:'2026-10-02'},
  {id:'3',organization_id:'orgB',driver_user_id:'me',status:'offered',created_at:'2026-10-03'},
  {id:'4',organization_id:'orgA',driver_user_id:'notme',status:'offered',created_at:'2026-10-04'},
];
test('driver load list is scoped to exact organization and own user',()=>{
  assert.deepEqual(assignmentsForDriver(assignments,'orgA','me').map(x=>x.id),['2','1']);
  assert.deepEqual(assignmentsForDriver(assignments,'orgA','other'),[]);
  assert.deepEqual(assignmentsForDriver(assignments,'','me'),[]);
});
test('only offered, accepted and pickup stages have supported actions',()=>{
  const a={id:'1',driver_user_id:'me',status:'offered'};
  assert.equal(driverAssignmentAction(a,'me',true).kind,'offer');
  assert.equal(driverAssignmentAction(a,'other',true),null);
  assert.equal(driverAssignmentAction(a,'me',false),null);
  assert.deepEqual(driverAssignmentAction({...a,status:'accepted'},'me',true),
    {kind:'advance',label:'Arrived at pickup',next:'at_pickup'});
  assert.equal(driverAssignmentAction({...a,status:'in_transit'},'me',true),null);
});
test('navigation links are external and require valid addresses',()=>{
  const url=externalRouteUrl({pickup_address:'123 Main St, Dallas TX',dropoff_address:'Fort Worth TX'});
  assert.ok(url.startsWith('https://www.google.com/maps/dir/'));
  assert.ok(url.includes('123%20Main%20St'));
  assert.equal(externalRouteUrl({pickup_address:'',dropoff_address:'FW'}),null);
  assert.equal(externalRouteUrl({pickup_address:'X'.repeat(501),dropoff_address:'FW'}),null);
});
test('legacy Class C does not pretend to represent food and passenger service',()=>{
  assert.equal(classifyLegacyAssignment(assignments[0]),'Class C delivery');
  assert.equal(classifyLegacyAssignment(assignments[1]),'Commercial freight');
  assert.equal(classifyLegacyAssignment({division:'unknown'}),'Unclassified assignment');
});
test('driver job tabs are derived from backend state',()=>{
  const g=groupDriverAssignments([{status:'offered'},{status:'assigned'},{status:'delivered'}]);
  assert.deepEqual(Object.values(g).map(x=>x.length),[1,1,1]);
});
test('device position is validated locally without submitting GPS',()=>{
  assert.equal(validLocalPosition({latitude:32.7,longitude:-97.3,accuracy:12}),true);
  assert.equal(validLocalPosition({latitude:100,longitude:-97,accuracy:12}),false);
  assert.equal(validLocalPosition({latitude:0,longitude:0,accuracy:-1}),false);
});
