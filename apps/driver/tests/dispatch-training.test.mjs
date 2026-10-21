import test from 'node:test';
import assert from 'node:assert/strict';
import {QA_TENANT,QA_VEHICLE,QA_DRIVERS,createDispatchQaState,dispatchQaStep,queueHead,
  evaluateQaClaim,visibleQaDriverJobs} from '../src/dispatch-training.js';

const attempt=(state,type,fields={})=>dispatchQaStep(state,{type,organizationId:QA_TENANT,...fields});
test('FIFO queue starts with qualified driver and a subsequent restricted driver',()=>{
  const s=createDispatchQaState();
  assert.equal(queueHead(s).driver_id,QA_DRIVERS[0].id);
  assert.equal(s.requests.length,2);
  assert.equal(evaluateQaClaim(s,'qa-job-1',QA_VEHICLE).ok,true);
});
test('offer consumes only FIFO head and immediately reflects in owner-only view',()=>{
  const s=createDispatchQaState();
  const a=attempt(s,'claim',{jobId:'qa-job-1',vehicleId:QA_VEHICLE});
  assert.equal(a.ok,true);
  assert.equal(s.jobs[0].status,'unassigned');
  assert.equal(a.state.jobs[0].status,'offered');
  assert.equal(a.state.requests.length,1);
  assert.equal(queueHead(a.state).driver_id,QA_DRIVERS[1].id);
  assert.deepEqual(visibleQaDriverJobs(a.state,QA_DRIVERS[0].id).map(x=>x.id),['qa-job-1']);
  assert.deepEqual(visibleQaDriverJobs(a.state,QA_DRIVERS[1].id),[]);
});
test('blocked FIFO head cannot be skipped for any later driver',()=>{
  const s=attempt(createDispatchQaState(),'claim',{jobId:'qa-job-1',vehicleId:QA_VEHICLE}).state;
  const result=attempt(s,'claim',{jobId:'qa-job-2',vehicleId:QA_VEHICLE});
  assert.equal(result.ok,false);
  assert.match(result.reason,/FIFO head/);
  assert.equal(result.state,s);
});
test('duplicate claim fails, active driver exclusivity enforced',()=>{
  const s=createDispatchQaState();
  const a=attempt(s,'claim',{jobId:'qa-job-1',vehicleId:QA_VEHICLE}).state;
  assert.equal(attempt(a,'claim',{jobId:'qa-job-1',vehicleId:QA_VEHICLE}).ok,false);
  const manipulated={...a,requests:[{...s.requests[0],id:'qa-request-retry',queue_number:3}]};
  assert.equal(attempt(manipulated,'claim',{jobId:'qa-job-2',vehicleId:QA_VEHICLE}).ok,false);
});
test('only owner can accept or advance and transitions stop before delivered',()=>{
  const s=attempt(createDispatchQaState(),'claim',{jobId:'qa-job-1',vehicleId:QA_VEHICLE}).state;
  assert.equal(attempt(s,'accept',{jobId:'qa-job-1',driverId:QA_DRIVERS[1].id}).ok,false);
  let current=attempt(s,'accept',{jobId:'qa-job-1',driverId:QA_DRIVERS[0].id}).state;
  assert.equal(current.jobs[0].status,'accepted');
  for(const st of ['at_pickup','picked_up','in_transit']){
    const r=attempt(current,'advance',{jobId:'qa-job-1',driverId:QA_DRIVERS[0].id});
    assert.equal(r.ok,true);
    current=r.state;
    assert.equal(current.jobs[0].status,st);
  }
  assert.equal(attempt(current,'advance',{jobId:'qa-job-1',driverId:QA_DRIVERS[0].id}).ok,false);
  assert.equal(attempt(current,'deliver',{jobId:'qa-job-1',driverId:QA_DRIVERS[0].id}).ok,false);
});
test('declining offer releases fictional assignment and clears vehicle',()=>{
  const s=attempt(createDispatchQaState(),'claim',{jobId:'qa-job-1',vehicleId:QA_VEHICLE}).state;
  const r=attempt(s,'decline',{jobId:'qa-job-1',driverId:QA_DRIVERS[0].id});
  assert.equal(r.ok,true);
  assert.equal(r.state.jobs[0].status,'unassigned');
  assert.equal(r.state.jobs[0].driver_user_id,null);
  assert.equal(r.state.jobs[0].vehicle_id,null);
});
test('unverified offline driver cannot accept even with forged queued offer',()=>{
  let s=createDispatchQaState();
  s={...s,jobs:s.jobs.map(j=>j.id==='qa-job-2'?{...j,status:'offered',driver_user_id:QA_DRIVERS[1].id}:j)};
  assert.equal(attempt(s,'accept',{jobId:'qa-job-2',driverId:QA_DRIVERS[1].id}).ok,false);
});
test('invalid tenant or other organization data is rejected',()=>{
  const s=createDispatchQaState();
  assert.equal(dispatchQaStep(s,{type:'claim',organizationId:'other',jobId:'qa-job-1',vehicleId:QA_VEHICLE}).ok,false);
  assert.equal(evaluateQaClaim(s,'production-id',QA_VEHICLE).ok,false);
  assert.deepEqual(visibleQaDriverJobs({...s,organization_id:'another'},QA_DRIVERS[0].id),[]);
});
test('withdrawal only affects own request and never skips FIFO silently',()=>{
  const s=createDispatchQaState();
  const result=attempt(s,'withdraw',{driverId:QA_DRIVERS[0].id});
  assert.equal(result.ok,true);
  assert.equal(queueHead(result.state).driver_id,QA_DRIVERS[1].id);
  assert.equal(s.requests.length,2);
});
