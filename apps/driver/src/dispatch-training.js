// Phase 5 dispatcher + driver training model: deliberately disconnected from Supabase.
// Data is fictional; this module has no imports, HTTP, persistence or authentication APIs.
export const QA_TENANT='qa-fictional-tenant';
export const QA_DISPATCHER='qa-fictional-dispatcher';
export const QA_VEHICLE='qa-fictional-van';
export const QA_DRIVERS=Object.freeze([
  Object.freeze({id:'qa-driver-verified',name:'Alex (fictional)',license_class:'C',license_verified:true,availability:'available'}),
  Object.freeze({id:'qa-driver-unverified',name:'Morgan (fictional)',license_class:'C',license_verified:false,availability:'offline'}),
]);
export const QA_FIXTURES=Object.freeze([
  Object.freeze({id:'qa-job-1',organization_id:QA_TENANT,reference:'QA-LOAD-001',
    division:'Class C',status:'unassigned',driver_user_id:null,vehicle_id:null,
    pickup_address:'Sample Warehouse (fictional)',dropoff_address:'Sample Store (fictional)'}),
  Object.freeze({id:'qa-job-2',organization_id:QA_TENANT,reference:'QA-LOAD-002',
    division:'Class C',status:'unassigned',driver_user_id:null,vehicle_id:null,
    pickup_address:'Sample Depot (fictional)',dropoff_address:'Sample Office (fictional)'}),
]);
export function createDispatchQaState(){
  return {
    mode:'fictional-training',organization_id:QA_TENANT,
    drivers:QA_DRIVERS.map(d=>({...d})),
    vehicles:[{id:QA_VEHICLE,organization_id:QA_TENANT,name:'QA Cargo Van (fictional)',license:'C',enabled:true}],
    jobs:QA_FIXTURES.map(j=>({...j})),
    requests:[{id:'qa-request-1',organization_id:QA_TENANT,driver_id:QA_DRIVERS[0].id,queue_number:1},
      {id:'qa-request-2',organization_id:QA_TENANT,driver_id:QA_DRIVERS[1].id,queue_number:2}],
    audit:[],revision:0,
  };
}
export function visibleQaDriverJobs(state,driverId){
  if(!validState(state))return [];
  return state.jobs.filter(job=>job.organization_id===QA_TENANT&&job.driver_user_id===driverId);
}
export function queueHead(state){
  if(!validState(state))return null;
  return [...state.requests].sort((a,b)=>a.queue_number-b.queue_number)[0]||null;
}
function validState(state){
  return state?.mode==='fictional-training'&&state.organization_id===QA_TENANT
    &&Array.isArray(state?.jobs)&&Array.isArray(state?.requests);
}
const rank={C:1,B:2,A:3};
const nextStatus={accepted:'at_pickup',at_pickup:'picked_up',picked_up:'in_transit'};
function readyDriver(driver,vehicle){
  return Boolean(driver&&driver.license_verified===true&&driver.availability==='available'&&
    vehicle?.enabled===true&&rank[driver.license_class]>=rank[vehicle.license]);
}
export function evaluateQaClaim(state,jobId,vehicleId){
  if(!validState(state))return {ok:false,reason:'Not a training environment'};
  const head=queueHead(state);
  if(!head)return {ok:false,reason:'No queued driver'};
  const driver=state.drivers.find(x=>x.id===head.driver_id);
  if(!driver||!driver.license_verified||driver.availability!=='available')
    return {ok:false,reason:'FIFO head is not verified and available. Do not skip this request.'};
  const job=state.jobs.find(x=>x.id===jobId&&x.organization_id===QA_TENANT);
  if(!job||job.status!=='unassigned'||job.driver_user_id)
    return {ok:false,reason:'Choose an unassigned fictional Class C load'};
  const vehicle=state.vehicles.find(x=>x.id===vehicleId&&x.organization_id===QA_TENANT);
  if(job.division!=='Class C'||!readyDriver(driver,vehicle)||vehicle.license!=='C')
    return {ok:false,reason:'Driver and enabled vehicle must satisfy Class C eligibility'};
  const active=state.jobs.some(x=>x.driver_user_id===driver.id
    &&['offered','assigned','accepted','at_pickup','picked_up','in_transit'].includes(x.status));
  if(active)return {ok:false,reason:'Driver already has an active assignment'};
  return {ok:true,reason:'Eligible FIFO head (fictional)',head,driver,job,vehicle};
}
function committed(state,type,detail,updates){
  return {...state,...updates,revision:state.revision+1,
    audit:[{id:state.revision+1,type,detail},...state.audit].slice(0,16)};
}
function rejected(state,reason){return {state,ok:false,reason};}
export function dispatchQaStep(state,action){
  if(!validState(state)||!action||action.organizationId!==QA_TENANT)
    return rejected(state,'Wrong tenant or invalid training state');
  // Training-only optimistic revision gate models a competing dispatch request.
  // Database concurrency must still be tested with two real staging sessions.
  if(action.expectedRevision!==undefined && action.expectedRevision!==state.revision)
    return rejected(state,'Stale dispatch revision. Refresh before retrying.');
  if(action.type==='claim'){
    const check=evaluateQaClaim(state,action.jobId,action.vehicleId);
    if(!check.ok)return rejected(state,check.reason);
    const {head,job,driver,vehicle}=check;
    return {ok:true,reason:'Fictional offer entered the driver queue immediately',state:committed(state,'OFFER',
      `${job.reference} offered to ${driver.name}; local state only`,{
        requests:state.requests.filter(q=>q.id!==head.id),
        jobs:state.jobs.map(x=>x.id===job.id?{...x,driver_user_id:driver.id,
          vehicle_id:vehicle.id,status:'offered'}:x),
      })};
  }
  if(action.type==='withdraw'){
    const q=state.requests.find(x=>x.driver_id===action.driverId);
    if(!q)return rejected(state,'This fictional driver has no request to withdraw');
    return {ok:true,reason:'Training request removed; next queued driver moves to FIFO head',state:committed(state,
      'WITHDRAW',`${action.driverId} withdrew fictional request`,{
        requests:state.requests.filter(x=>x.id!==q.id),
      })};
  }
  const job=state.jobs.find(x=>x.id===action.jobId&&x.organization_id===QA_TENANT);
  if(!job||job.driver_user_id!==action.driverId)return rejected(state,'Driver cannot change another driver’s load');
  const driver=state.drivers.find(x=>x.id===action.driverId);
  let next,changes;
  if(action.type==='decline'&&job.status==='offered'){
    next='unassigned';changes={driver_user_id:null,vehicle_id:null};
  } else if(action.type==='accept'&&job.status==='offered'&&driver?.license_verified===true&&driver.availability==='available'){
    next='accepted';changes={};
  } else if(action.type==='advance'&&nextStatus[job.status]&&driver?.license_verified===true
    &&driver.availability==='available'){
    next=nextStatus[job.status];changes={};
  }else return rejected(state,'Unsupported transition or unverified/offline driver');
  return {ok:true,reason:'Fictional driver and dispatcher views synchronized immediately',state:committed(state,
    action.type.toUpperCase(),`${job.reference}: ${job.status} → ${next}`,{
      jobs:state.jobs.map(x=>x.id===job.id?{...x,...changes,status:next}:x),
    })};
}
