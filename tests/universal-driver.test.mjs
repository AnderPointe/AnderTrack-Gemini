import test from 'node:test';
import assert from 'node:assert/strict';
import { DRIVER_SERVICES, JOB_STATES, nextJobState, sampleJobs, money } from '../src/lib/universal-driver.js';

test('all requested services have unique identities and local food/rides remain Class C', () => {
  assert.equal(new Set(DRIVER_SERVICES.map(s => s.id)).size, 6);
  for (const id of ['food','rideshare']) assert.equal(DRIVER_SERVICES.find(s => s.id === id).division, 'Class C Local Services');
});
test('test job lifecycle moves once per step and stops at completion', () => {
  let state = 'offered'; const visited = [state];
  while (nextJobState(state)) { state = nextJobState(state); visited.push(state); }
  assert.deepEqual(visited, JOB_STATES);
  assert.equal(nextJobState('completed'), null);
  assert.equal(nextJobState('invalid'), null);
});
test('sample jobs are isolated fresh copies and prices are integer cents', () => {
  const first = sampleJobs(); first[0].status = 'completed';
  assert.equal(sampleJobs()[0].status, 'offered');
  assert.ok(sampleJobs().every(j => j.reference.startsWith('TEST-') && Number.isInteger(j.estimated_cents)));
  assert.equal(money(1475), '$14.75');
});
