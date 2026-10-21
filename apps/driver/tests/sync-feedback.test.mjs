import test from 'node:test';
import assert from 'node:assert/strict';
import {DRIVER_POLL_MS,DRIVER_REFRESH_DEBOUNCE_MS,normalizeRealtimeStatus,describeDriverSync}
  from '../src/sync-feedback.js';

test('realtime SUBSCRIBED is the only positive subscription state',()=>{
  assert.equal(normalizeRealtimeStatus('SUBSCRIBED'),'connected');
  for(const state of ['CHANNEL_ERROR','TIMED_OUT','CLOSED'])
    assert.equal(normalizeRealtimeStatus(state),'degraded');
  assert.equal(normalizeRealtimeStatus('JOINING'),'connecting');
});
test('offline device never claims live connectivity',()=>{
  assert.equal(describeDriverSync('connected',false).level,'offline');
  assert.equal(describeDriverSync('degraded',true).level,'degraded');
  assert.match(describeDriverSync('degraded',true).label,/fallback/);
  assert.equal(describeDriverSync('connected',true).level,'live');
  assert.equal(describeDriverSync('disconnected',true).level,'pending');
});
test('bounded polling and coalescing intervals are configured',()=>{
  assert.equal(DRIVER_POLL_MS,30000);
  assert.equal(DRIVER_REFRESH_DEBOUNCE_MS,450);
});
