import test from 'node:test';
import assert from 'node:assert/strict';
import {freshLocation,locationPayload,mapLocations,SERVICES,SERVICE_NAMES,NEXT_LIVE_ACTION} from '../src/connected/operations.js';

test('all requested services have distinct dispatch identities',()=>{
  assert.equal(new Set(SERVICES).size,6);for(const service of SERVICES)assert.ok(SERVICE_NAMES[service]);
});
test('a fresh GPS row requires online consent and finite coordinates',()=>{
  const now=Date.now(),row={latitude:32.75,longitude:-97.33,online:true,sharing:true,last_ping_at:new Date(now-2000).toISOString()};
  assert.equal(freshLocation(row,now),true);
  for(const patch of [{sharing:false},{online:false},{latitude:NaN},{longitude:null},{last_ping_at:new Date(now-61000).toISOString()},{last_ping_at:new Date(now+6000).toISOString()}])assert.equal(freshLocation({...row,...patch},now),false);
});
test('location writes include a session token, capture time and validated GPS fields',()=>{
  const value=locationPayload({timestamp:Date.now(),coords:{latitude:32.75,longitude:-97.33,accuracy:8,heading:30,speed:10}},'org','token');
  assert.equal(value.p_session_id,'token');assert.equal(value.p_organization_id,'org');assert.ok(value.p_speed_mph>22&&value.p_speed_mph<23);assert.equal(value.p_heading,30);
});
test('invalid and stale device locations are never published',()=>{
  const position={timestamp:Date.now(),coords:{latitude:32.75,longitude:-97.33,accuracy:8}};
  for(const patch of [{latitude:100},{longitude:200},{accuracy:1001},{latitude:Infinity}])assert.throws(()=>locationPayload({...position,coords:{...position.coords,...patch}},'org','token'));
  assert.throws(()=>locationPayload({...position,timestamp:Date.now()-61000},'org','token'));
});
test('map adapter removes consent-stopped locations and preserves tenant identity',()=>{
  const rows=[{organization_id:'org',driver_user_id:'driver',online:true,sharing:true,latitude:32.75,longitude:-97.33,last_ping_at:new Date().toISOString()},{driver_user_id:'off',online:false,sharing:false,latitude:null,longitude:null}];
  const points=mapLocations(rows);assert.equal(points.length,1);assert.equal(points[0].driver_id,'driver');assert.equal(points[0].company_id,'org');assert.equal(points[0].status,'available');
});
test('operational progress does not fabricate proof of delivery',()=>{
  assert.equal(NEXT_LIVE_ACTION.accepted[0],'at_pickup');assert.equal(NEXT_LIVE_ACTION.picked_up[0],'in_transit');assert.equal(NEXT_LIVE_ACTION.in_transit,undefined);
});
