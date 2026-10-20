import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SERVICE_TYPES,SERVICE_DIVISIONS,SERVICE_SOURCE_KINDS,SERVICE_STATES,
  normalizeUniversalJob,isDispatchableJob,isActiveServiceJob,
  summarizeExistingDispatch,
} from '../src/lib/universal-jobs.js';
import {evaluateUniversalCandidate} from '../src/lib/universal-eligibility.js';

const ORG='org-1',NOW=Date.parse('2026-10-20T18:00:00.000Z');
const makeRow=(service_type='food_delivery',overrides={})=>({
  id:'job-1',organization_id:ORG,service_type,
  source_kind:SERVICE_SOURCE_KINDS[service_type],source_id:'source-1',
  status:'ready',requirements:{required_capabilities:[]},...overrides,
});
const makeJob=(type='local_courier',overrides={})=>
  normalizeUniversalJob(makeRow(type,overrides),ORG);
const driver=()=>({user_id:'driver-1',organization_id:ORG,license_class:'C',license_verified:true,availability:'available'});
const vehicle=()=>({id:'vehicle-1',organization_id:ORG,required_license_class:'C',
  enabled:true,payload_capacity_lbs:2400,verified_passenger_capacity:4,verified_capabilities:['insulated_bag']});
const approval=(type='local_courier')=>({service_type:type,organization_id:ORG,
  status:'approved',checked_at:new Date(NOW-1000).toISOString(),
  approved_capabilities:['insulated_bag','regulated_cargo'],
  operational_permits_verified:true});
const safety=()=>({state:'ready',organizationId:ORG,holds:[],
  coveredVehicleIds:['vehicle-1'],checkedAt:NOW-1000});
const inputs=(type='local_courier')=>({job:makeJob(type),driver:driver(),vehicle:vehicle(),
  organizationId:ORG,serviceApproval:approval(type),safetySnapshot:safety(),assignments:[],now:NOW});

test('exactly six service types and Class C isolation',()=>{
  assert.equal(SERVICE_TYPES.length,6);
  assert.deepEqual(SERVICE_TYPES.filter(x=>SERVICE_DIVISIONS[x]==='class-c'),
    ['local_courier','food_delivery','passenger_ride']);
  for(const type of SERVICE_TYPES){
    assert.ok(SERVICE_SOURCE_KINDS[type]);
    assert.ok(SERVICE_STATES[type].length>=4);
  }
});
test('normalization validates service-specific source, status and organization',()=>{
  for(const type of SERVICE_TYPES) assert.equal(makeJob(type,type==='passenger_ride' ?
    {requirements:{passenger_count:1}} : {})?.serviceType,type);
  assert.equal(normalizeUniversalJob(makeRow('food_delivery'), 'other-org'),null);
  assert.equal(normalizeUniversalJob(makeRow('food_delivery',{source_kind:'passenger_trip'}),ORG),null);
  assert.equal(normalizeUniversalJob(makeRow('food_delivery',{status:'in_transit'}),ORG),null);
  assert.equal(normalizeUniversalJob(makeRow('local_courier',{service_type:'unrecognized'}),ORG),null);
  assert.equal(normalizeUniversalJob(makeRow('local_courier',{id:''}),ORG),null);
});
test('requirements are validated and de-duplicated without mutating source',()=>{
  const row=makeRow('local_courier',{requirements:{weight_lbs:150,
    required_capabilities:['insulated_bag','insulated_bag']}});
  const job=normalizeUniversalJob(row,ORG);
  assert.deepEqual(job.requirements.requiredCapabilities,['insulated_bag']);
  assert.equal(job.requirements.weightLbs,150);
  assert.equal(row.requirements.required_capabilities.length,2);
  assert.equal(normalizeUniversalJob(makeRow('local_courier',{requirements:{weight_lbs:0}}),ORG),null);
  assert.equal(normalizeUniversalJob(makeRow('local_courier',{requirements:{required_capabilities:['ok','']}}),ORG),null);
  assert.equal(normalizeUniversalJob(makeRow('food_delivery',{requirements:{regulated_commodity:true}}),ORG),null);
  assert.equal(normalizeUniversalJob(makeRow('passenger_ride'),ORG),null);
  assert.equal(normalizeUniversalJob(makeRow('passenger_ride',{requirements:{passenger_count:2}}),ORG)?.requirements.passengerCount,2);
});
test('each service has independent dispatch and active lifecycle',()=>{
  assert.ok(isDispatchableJob(makeJob('food_delivery')));
  assert.ok(isDispatchableJob(makeJob('passenger_ride',{requirements:{passenger_count:2}})));
  assert.equal(isDispatchableJob(makeJob('local_courier',{status:'requested'})),false);
  assert.equal(isDispatchableJob(makeJob('food_delivery',{status:'preparing'})),false);
  assert.ok(isActiveServiceJob({serviceType:'passenger_ride',status:'in_progress'}));
  assert.ok(isActiveServiceJob({serviceType:'food_delivery',status:'delivering'}));
  assert.equal(isActiveServiceJob({serviceType:'food_delivery',status:'completed'}),false);
});
test('legacy at_assignments remain unclassified by service, and scoped by organization',()=>{
  const records=[
    {id:'a',organization_id:ORG,division:'CDL',status:'assigned',commodity:'Hotshot freight'},
    {id:'b',organization_id:ORG,division:'Class C',status:'delivered',commodity:'Food delivery'},
    {id:'c',organization_id:'other-org',division:'CDL',status:'assigned'},
    {id:'d',organization_id:ORG,division:'mystery',status:'unassigned'},
    {id:'e',division:'CDL',status:'assigned'},
  ];
  assert.deepEqual(summarizeExistingDispatch(records,ORG),{
    legacyFreight:1,legacyClassC:1,unclassified:1,total:3,active:1,demo:false,
  });
  assert.equal(summarizeExistingDispatch(records,'').total,0);
  assert.equal(summarizeExistingDispatch([{id:'a',division:'CDL',status:'assigned'}],
    'demo-only',{isDemo:true}).total,1);
});
test('all verified advisory criteria allow a matching local courier',()=>{
  assert.deepEqual(evaluateUniversalCandidate(inputs()),{eligible:true,reasons:[],advisory:true});
});
test('tenant isolation for job, driver, vehicle and approval',()=>{
  const base=inputs();
  for(const mutation of [
    {job:{...base.job,organizationId:'other-org'}},
    {driver:{...base.driver,organization_id:'other-org'}},
    {vehicle:{...base.vehicle,organization_id:'other-org'}},
    {serviceApproval:{...base.serviceApproval,organization_id:'other-org'}},
  ]) assert.equal(evaluateUniversalCandidate({...base,...mutation}).eligible,false);
});
test('missing, stale and held safety snapshots always block suggestions',()=>{
  const base=inputs();
  for(const x of [
    null,{...safety(),checkedAt:NOW-70_000},
    {...safety(),holds:['vehicle-1']},
    {...safety(),coveredVehicleIds:[]},
    {...safety(),organizationId:'other-org'},
  ]) assert.equal(evaluateUniversalCandidate({...base,safetySnapshot:x}).eligible,false);
});
test('driver qualifications, availability, vehicle status and service approval fail closed',()=>{
  const base=inputs();
  for(const mutation of [
    {driver:{...driver(),license_verified:false}},
    {driver:{...driver(),availability:'offline'}},
    {vehicle:{...vehicle(),enabled:false}},
    {vehicle:{...vehicle(),required_license_class:'B'}},
    {serviceApproval:null},
    {serviceApproval:{...approval(),checked_at:new Date(NOW-400_000).toISOString()}},
    {job:makeJob('local_courier',{status:'requested'})},
    {assignments:null},
  ]) assert.equal(evaluateUniversalCandidate({...base,...mutation}).eligible,false);
});
test('payload, passenger seating, service permit and regulated-cargo gates',()=>{
  const base=inputs();
  const weightJob=makeJob('local_courier',{requirements:{weight_lbs:3000}});
  assert.equal(evaluateUniversalCandidate({...base,job:weightJob}).eligible,false);
  const pax=inputs('passenger_ride');
  pax.job=makeJob('passenger_ride',{requirements:{passenger_count:5}});
  assert.equal(evaluateUniversalCandidate(pax).eligible,false);
  pax.job=makeJob('passenger_ride',{requirements:{passenger_count:3}});
  pax.serviceApproval={...approval('passenger_ride'),operational_permits_verified:false};
  assert.equal(evaluateUniversalCandidate(pax).eligible,false);
  pax.serviceApproval=approval('passenger_ride');
  assert.equal(evaluateUniversalCandidate(pax).eligible,true);
  const food=inputs('food_delivery');
  food.job=makeJob('food_delivery',{requirements:{required_capabilities:['insulated_bag']}});
  food.serviceApproval={...approval('food_delivery'),operational_permits_verified:false};
  assert.equal(evaluateUniversalCandidate(food).eligible,false);
  food.serviceApproval=approval('food_delivery');
  assert.equal(evaluateUniversalCandidate(food).eligible,true);
  food.vehicle={...vehicle(),verified_capabilities:[]};
  assert.equal(evaluateUniversalCandidate(food).eligible,false);
  const regulated=inputs('freight_3pl');
  regulated.job=makeJob('freight_3pl',{requirements:{regulated_commodity:true,
    required_capabilities:['regulated_cargo']}});
  assert.equal(evaluateUniversalCandidate(regulated).eligible,false);
});
test('active assignments block double booking, completed do not',()=>{
  const base=inputs();
  for(const a of [
    {id:'a',organization_id:ORG,driver_user_id:'driver-1',vehicle_id:'other',status:'assigned'},
    {id:'b',organization_id:ORG,driver_user_id:'other',vehicle_id:'vehicle-1',status:'in_transit'},
    {id:'c',organization_id:ORG,driver_user_id:'driver-1',vehicle_id:'vehicle-1',
      service_type:'food_delivery',status:'delivering'},
  ]) assert.equal(evaluateUniversalCandidate({...base,assignments:[a]}).eligible,false);
  const done={id:'d',organization_id:ORG,driver_user_id:'driver-1',vehicle_id:'vehicle-1',status:'delivered'};
  assert.equal(evaluateUniversalCandidate({...base,assignments:[done]}).eligible,true);
});

test('unknown nonterminal statuses, same-job claims and unscoped feeds fail closed',()=>{
  const base=inputs();
  for(const assignment of [
    {id:'job-1',organization_id:ORG,driver_user_id:'driver-1',vehicle_id:'vehicle-1',status:'assigned'},
    {id:'u1',organization_id:ORG,driver_user_id:'driver-1',vehicle_id:'vehicle-1',service_type:'unknown',status:'sailing'},
    {id:'u2',organization_id:ORG,driver_user_id:'driver-1',vehicle_id:'vehicle-1',status:'unrecognized'},
  ]) assert.equal(evaluateUniversalCandidate({...base,assignments:[assignment]}).eligible,false);
  assert.equal(evaluateUniversalCandidate({...base,
    assignments:[{id:'x',organization_id:'other-org',driver_user_id:'another',vehicle_id:'other',status:'assigned'}]
  }).eligible,false);
});
