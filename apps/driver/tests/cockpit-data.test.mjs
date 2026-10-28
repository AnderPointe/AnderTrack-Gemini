import test from 'node:test';
import assert from 'node:assert/strict';
import {cockpitAssignment,telemetry,driverHistoryCsv} from '../src/universal/cockpit-data.js';
test('cockpit prioritizes an underway job over offers and never mixes the selected service',()=>{
 const jobs=[{id:'offer',service_id:'otr',status:'offered'},{id:'done',service_id:'food',status:'delivered'},{id:'live',service_id:'otr',status:'in_transit'}];
 assert.equal(cockpitAssignment(jobs,'otr').id,'live');assert.equal(cockpitAssignment(jobs,'food'),null);assert.equal(cockpitAssignment(jobs,'waste'),null);assert.equal(cockpitAssignment(jobs,'all').id,'live');
});
test('telemetry never presents stale, missing or invalid values as real readings',()=>{
 assert.deepEqual(telemetry({speed_mph:62,heading:315},true),{speed:62,heading:315,direction:'NW'});
 assert.deepEqual(telemetry({speed_mph:62,heading:315},false),{speed:null,heading:null,direction:null});
 for(const value of [null,undefined,NaN,-1,Infinity,'62'])assert.equal(telemetry({speed_mph:value},true).speed,null);
 assert.equal(telemetry({heading:360,speed_mph:201},true).direction,null);assert.equal(telemetry({heading:359,speed_mph:0},true).direction,'N');assert.equal(telemetry({speed_mph:0},true).speed,0);
});
test('history export neutralizes formulas and preserves quoted/newline addresses without GPS or user fields',()=>{
 const csv=driverHistoryCsv([{reference:'=CMD()',service_id:'otr',status:'in_transit',pickup:'Depot "A"\nGate 2',destination:' @SUM(1)',latitude:33,user_id:'private'}]);
 assert.ok(csv.includes('"\'=CMD()"'));assert.ok(csv.includes('Depot ""A""\nGate 2'));assert.ok(csv.includes("' @SUM(1)"));assert.ok(!csv.includes('private'));assert.equal(driverHistoryCsv([]).split('\r\n').length,1);
});
