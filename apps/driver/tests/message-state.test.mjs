import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeMessages,draftAfterSend,connectionLabel} from '../src/connected/message-state.js';
const message=(id,n)=>({id,created_at:new Date(n*1000).toISOString(),body:id});
test('a delayed refresh cannot hide an acknowledged send or duplicate retries',()=>{
  const sent=message('sent',3),merged=mergeMessages([sent],[message('old',1),message('incoming',2)]);
  assert.deepEqual(merged.map(m=>m.id),['old','incoming','sent']);
  assert.deepEqual(mergeMessages(merged,[sent]),merged);
});
test('message windows stay bounded and chronological when snapshots overlap',()=>{
  assert.deepEqual(mergeMessages([message('a',1),message('b',2)],[message('c',3),message('b',2)],2).map(m=>m.id),['b','c']);
});
test('successful send preserves text typed while the request was pending',()=>{
  assert.equal(draftAfterSend('Ready','Ready'),'');
  assert.equal(draftAfterSend('New instructions','Ready'),'New instructions');
});
test('connection indicators distinguish offline, failed sync, polling and realtime',()=>{
  const state={ready:true,online:true,subscribed:false};
  assert.equal(connectionLabel(state),'Checking every 5 seconds');
  assert.equal(connectionLabel({...state,subscribed:true}),'Live updates connected');
  assert.equal(connectionLabel({...state,online:false,subscribed:true}),'Offline · draft kept');
  assert.equal(connectionLabel({...state,failed:true}),'Sync failed · retry available');
  assert.equal(connectionLabel({...state,ready:false}),'Sign-in required');
});
