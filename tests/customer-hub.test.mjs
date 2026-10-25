import test from 'node:test';
import assert from 'node:assert/strict';
import {SAMPLE_POLICY,estimateQuote,trackingPosition} from '../src/features/customer/pricing.js';
test('four-pallet priority quote explains mileage, payload and urgency without hidden fees',()=>{
 const q=estimateQuote(SAMPLE_POLICY,{miles:65,pallets:4,payload:4200,urgency:'priority'});
 assert.equal(q.base_cents,2500);assert.equal(q.distance_cents,13000);assert.equal(q.pallet_cents,4000);assert.equal(q.payload_cents,2500);assert.equal(q.urgency_cents,5500);assert.equal(q.total_cents,27500);assert.equal(q.driver_cents,22000);assert.equal(q.service_fee_cents,5500);
 assert.equal(q.base_cents+q.distance_cents+q.pallet_cents+q.payload_cents+q.urgency_cents+q.minimum_adjustment_cents,q.total_cents);assert.equal(q.driver_cents+q.service_fee_cents,q.total_cents);
});
test('minimum and driver floor apply once; partial payload increments round upward',()=>{
 const q=estimateQuote(SAMPLE_POLICY,{miles:1,pallets:0,payload:1,urgency:'standard'});assert.equal(q.total_cents,5000);assert.equal(q.driver_cents,4000);assert.equal(q.minimum_adjustment_cents,1800);
 assert.equal(estimateQuote(SAMPLE_POLICY,{miles:65,pallets:4,payload:5001,urgency:'express'}).payload_cents,3000);
});
test('invalid, unknown and excessive cargo cannot produce a customer estimate',()=>{
 const input={miles:65,pallets:4,payload:4200,urgency:'standard'};
 for(const patch of [{miles:NaN},{miles:0},{miles:10001},{pallets:1.5},{pallets:27},{payload:44001},{payload:0},{urgency:'unlimited'}])assert.equal(estimateQuote(SAMPLE_POLICY,{...input,...patch}),null);
});
test('customer GPS is visible only during transit, while fresh and within its entitlement',()=>{
 const now=Date.now(),shipment={status:'in_transit',tracking_expires_at:new Date(now+5000).toISOString(),gps:{latitude:32.75,longitude:-97.33,online:true,sharing:true,last_ping_at:new Date(now-2000).toISOString()}};
 assert.ok(trackingPosition(shipment,now));for(const status of ['submitted','accepted','delivered','cancelled'])assert.equal(trackingPosition({...shipment,status},now),null);
 assert.equal(trackingPosition({...shipment,tracking_expires_at:new Date(now-1).toISOString()},now),null);
 for(const patch of [{sharing:false},{online:false},{latitude:91},{longitude:181},{last_ping_at:new Date(now-61000).toISOString()}])assert.equal(trackingPosition({...shipment,gps:{...shipment.gps,...patch}},now),null);
});
