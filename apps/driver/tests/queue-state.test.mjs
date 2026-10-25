import test from 'node:test';
import assert from 'node:assert/strict';
import {filterQueue,requestedService} from '../src/connected/queue-state.js';
const queue=[{id:'a',display_name:'Alex',service_id:'courier',queue_number:'101'},{id:'b',display_name:'Blair',service_id:'otr',queue_number:'102'},{id:'c',display_name:'Casey',service_id:'otr',queue_number:'103'}];
test('queue service filtering preserves global FIFO positions and order',()=>{
  assert.deepEqual(filterQueue(queue,'','otr').map(row=>[row.id,row.queue_position]),[['b',2],['c',3]]);
  assert.equal(queue[1].queue_position,undefined);
});
test('driver and request search combines with service filtering',()=>{
  assert.deepEqual(filterQueue(queue,'  BLAIR ','otr').map(row=>row.id),['b']);
  assert.deepEqual(filterQueue(queue,'103').map(row=>row.id),['c']);
  assert.equal(filterQueue(queue,'Alex','otr').length,0);
  assert.equal(filterQueue(queue).length,3);
});
test('server FIFO ranks are retained when the supplied queue starts later',()=>{
  assert.equal(filterQueue([{...queue[0],queue_position:7}])[0].queue_position,7);
});
test('all-services job filter resolves to the same concrete queue service shown in the selector',()=>{
  assert.equal(requestedService('all'),'otr');assert.equal(requestedService('waste'),'waste');
});
