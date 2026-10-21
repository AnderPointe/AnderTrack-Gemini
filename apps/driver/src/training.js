/** Standalone, nonpersistent demo data. Never mix with Supabase records. */
export const TRAINING_DRIVER_ID='training-only-driver';
export const TRAINING_ORG_ID='training-only-org';
export const TRAINING_FIXTURES=Object.freeze([
  Object.freeze({
    id:'training-class-c-001',
    reference:'DEMO-COURIER-001', division:'Class C', status:'offered',
    organization_id:TRAINING_ORG_ID, driver_user_id:TRAINING_DRIVER_ID,
    commodity:'Training supply crates', estimated_miles:12.5,
    pickup_address:'Practice Warehouse A (fictional)',
    dropoff_address:'Practice Distribution Center B (fictional)',
  }),
  Object.freeze({
    id:'training-class-c-002',
    reference:'DEMO-COURIER-002', division:'Class C', status:'offered',
    organization_id:TRAINING_ORG_ID, driver_user_id:TRAINING_DRIVER_ID,
    commodity:'Practice documents', estimated_miles:5.2,
    pickup_address:'Sample Depot C (fictional)',
    dropoff_address:'Sample Office D (fictional)',
  }),
]);

export const TRAINING_ACTIONS=Object.freeze({
  offered:Object.freeze({
    accept:Object.freeze({next:'accepted',label:'Accept sample offer'}),
    decline:Object.freeze({next:'unassigned',label:'Decline sample offer'}),
  }),
  accepted:Object.freeze({arrive:Object.freeze({next:'at_pickup',label:'Arrive at pickup'})}),
  at_pickup:Object.freeze({pickup:Object.freeze({next:'picked_up',label:'Confirm sample pickup'})}),
  picked_up:Object.freeze({depart:Object.freeze({next:'in_transit',label:'Start sample delivery'})}),
});

/** No assignment.status 'delivered' without the protected proof-of-delivery workflow. */
export function trainingTransition(job,action){
  if(!job||job.organization_id!==TRAINING_ORG_ID||
    job.driver_user_id!==TRAINING_DRIVER_ID||
    !TRAINING_FIXTURES.some(f=>f.id===job.id))return job;
  const next=TRAINING_ACTIONS[job.status]?.[action]?.next;
  return next?{...job,status:next}:job;
}
export function transitionTrainingList(jobs,jobId,action){
  if(!Array.isArray(jobs))return [];
  return jobs.map(job=>job.id===jobId?trainingTransition(job,action):job);
}
export function freshTrainingJobs(){
  return TRAINING_FIXTURES.map(job=>({...job}));
}
export function trainingActionsFor(job){
  if(!job || job.organization_id!==TRAINING_ORG_ID||job.driver_user_id!==TRAINING_DRIVER_ID) return [];
  return Object.entries(TRAINING_ACTIONS[job.status]||{}).map(([id,info])=>({id,...info}));
}
