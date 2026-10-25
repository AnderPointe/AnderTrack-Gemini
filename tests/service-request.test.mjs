import test from 'node:test';
import assert from 'node:assert/strict';
import {REQUEST_SERVICES,serviceInput,serviceSummary,serviceDetailsText} from '../apps/driver/src/connected/service-request.js';
test('all services expose their actual inputs, not a universal freight form',()=>{
 assert.deepEqual(Object.keys(REQUEST_SERVICES),['freight','otr','courier','food','rideshare','waste']);
 assert.equal(REQUEST_SERVICES.food.weight,undefined);assert.equal(REQUEST_SERVICES.food.pallets,undefined);
 assert.deepEqual(REQUEST_SERVICES.food.fields.map(f=>f.key),['restaurant_name','order_reference','meal_count','food_handling']);
 assert.equal(REQUEST_SERVICES.courier.pallets,undefined);assert.equal(REQUEST_SERVICES.courier.weight,true);
 assert.ok(REQUEST_SERVICES.rideshare.fields.some(f=>f.key==='passenger_count'));assert.ok(REQUEST_SERVICES.waste.fields.some(f=>f.key==='volume_cuyd'));
});
test('food input drops stale freight values and persists only food details',()=>{
 const input=serviceInput('food',{pallets:4,payload:4200,details:{restaurant_name:' Cafe Example ',order_reference:'Order 31',meal_count:'3',food_handling:'hot',equipment:'flatbed'}});
 assert.equal(input.pallets,null);assert.equal(input.payload,null);assert.deepEqual(input.details,{restaurant_name:'Cafe Example',order_reference:'Order 31',meal_count:3,food_handling:'hot'});
 assert.throws(()=>serviceInput('food',{details:{restaurant_name:'Cafe',order_reference:'Order 1',meal_count:0,food_handling:'hot'}}));
});
test('freight and courier retain appropriate weight requirements',()=>{
 assert.throws(()=>serviceInput('freight',{pallets:4,payload:null,details:{equipment:'box_truck'}}));
 assert.throws(()=>serviceInput('courier',{payload:100,details:{package_count:0,package_type:'parcels'}}));
 assert.deepEqual(serviceInput('courier',{pallets:4,payload:10,details:{package_count:2,package_type:'parcels'}}),{pallets:null,payload:10,details:{package_count:2,package_type:'parcels'}});
});
test('passenger and waste inputs validate counts and supported service categories',()=>{
 assert.equal(serviceInput('rideshare',{details:{passenger_count:2,luggage_count:0}}).payload,null);
 assert.throws(()=>serviceInput('rideshare',{details:{passenger_count:9,luggage_count:0}}));
 assert.throws(()=>serviceInput('waste',{details:{waste_category:'hazardous',item_count:1,volume_cuyd:1}}));
});
test('request summaries and driver details describe meals and passengers without weight',()=>{
 const r={service_id:'food',pallets:4,payload_lbs:4200,service_details:{restaurant_name:'Cafe',meal_count:3,order_reference:'Order 31',food_handling:'hot'}};
 assert.match(serviceSummary(r),/3 meals/);assert.doesNotMatch(serviceSummary(r),/pallet|lb/);assert.match(serviceDetailsText(r),/Order 31/);
 assert.match(serviceSummary({service_id:'rideshare',service_details:{passenger_count:2}}),/2 passengers/);
});
