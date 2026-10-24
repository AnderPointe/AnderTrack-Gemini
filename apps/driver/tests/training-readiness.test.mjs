import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TRAINING_FIXTURES,TRAINING_DRIVER_ID,TRAINING_ORG_ID,
  trainingTransition,transitionTrainingList,trainingActionsFor,freshTrainingJobs,
} from '../src/training.js';
import {assessDriverReadiness} from '../src/readiness.js';

test('training objects use unmistakable fictional identities and routes',()=>{
  assert.equal(TRAINING_FIXTURES.length,2);
  for(const job of TRAINING_FIXTURES){
    assert.ok(job.reference.startsWith('DEMO-'));
    assert.equal(job.organization_id,TRAINING_ORG_ID);
    assert.equal(job.driver_user_id,TRAINING_DRIVER_ID);
    assert.ok(job.pickup_address.includes('(fictional)'));
    assert.ok(job.dropoff_address.includes('(fictional)'));
  }
});
test('training progress remains local and stops before delivery confirmation',()=>{
  const original=TRAINING_FIXTURES[0];
  const accepted=trainingTransition(original,'accept');
  assert.equal(accepted.status,'accepted');
  assert.equal(original.status,'offered');
  const atPickup=trainingTransition(accepted,'arrive');
  const pickedUp=trainingTransition(atPickup,'pickup');
  const inTransit=trainingTransition(pickedUp,'depart');
  assert.equal(inTransit.status,'in_transit');
  assert.deepEqual(trainingActionsFor(inTransit),[]);
  assert.equal(trainingTransition(inTransit,'deliver'),inTransit);
  assert.equal(trainingTransition(accepted,'decline'),accepted);
});
test('training decline returns the sample offer to unassigned without changing another job',()=>{
  const jobs=freshTrainingJobs();
  const result=transitionTrainingList(jobs,jobs[0].id,'decline');
  assert.equal(result[0].status,'unassigned');
  assert.equal(result[1].status,'offered');
  assert.equal(jobs[0].status,'offered');
  assert.equal(transitionTrainingList(jobs,'unknown','accept')[0].status,'offered');
});
test('training cannot change live tenant-scoped jobs or unrelated identities',()=>{
  const job={...TRAINING_FIXTURES[0],organization_id:'real-organization'};
  assert.equal(trainingTransition(job,'accept'),job);
  const another={...TRAINING_FIXTURES[0],driver_user_id:'real-user'};
  assert.equal(trainingTransition(another,'accept'),another);
  const unknown={...TRAINING_FIXTURES[0],id:'other'};
  assert.equal(trainingTransition(unknown,'accept'),unknown);
});
test('readiness is false for offline, unverified staging driver',()=>{
  const a=assessDriverReadiness({membership:{role:'driver'},profile:{
    user_id:'test',license_verified:false,availability:'offline'
  },online:true});
  assert.equal(a.canRequestRealAssignment,false);
  assert.equal(a.completed,3);
  assert.equal(a.total,5);
});
test('readiness checks do not grant actual server authorization',()=>{
  const a=assessDriverReadiness({membership:{role:'driver'},profile:{
    user_id:'test',license_verified:true,availability:'available'
  },online:true,jobCount:2});
  assert.equal(a.canRequestRealAssignment,true);
  assert.equal(a.jobCount,2);
  const b=assessDriverReadiness({membership:{role:'admin'},profile:{
    user_id:'test',license_verified:true,availability:'available'
  },online:true});
  assert.equal(b.canRequestRealAssignment,false);
});
