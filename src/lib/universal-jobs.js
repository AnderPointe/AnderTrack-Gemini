/**
 * Phase 2 universal job contract. Pure/review-only: does not create bookings,
 * payments, offers, or database writes. Do not map legacy 'CDL'/'Class C'
 * records into a specific business service without a verified discriminator.
 */
export const SERVICE_TYPES=Object.freeze([
  'freight_3pl','hotshot','warehouse_transfer',
  'local_courier','food_delivery','passenger_ride',
]);
export const SERVICE_DIVISIONS=Object.freeze({
  freight_3pl:'freight',
  hotshot:'hotshot',
  warehouse_transfer:'warehouse',
  local_courier:'class-c',
  food_delivery:'class-c',
  passenger_ride:'class-c',
});
export const SERVICE_SOURCE_KINDS=Object.freeze({
  freight_3pl:'freight_load',hotshot:'freight_load',
  warehouse_transfer:'warehouse_task',local_courier:'courier_order',
  food_delivery:'food_order',passenger_ride:'passenger_trip',
});
/** Service-specific states must never be merged into a freight status column. */
export const SERVICE_STATES=Object.freeze({
  freight_3pl:Object.freeze(['draft','ready','offered','assigned','at_pickup','loaded','in_transit','delivered','completed','cancelled']),
  hotshot:Object.freeze(['draft','ready','offered','assigned','at_pickup','loaded','in_transit','delivered','completed','cancelled']),
  warehouse_transfer:Object.freeze(['draft','ready','assigned','in_progress','completed','cancelled']),
  local_courier:Object.freeze(['requested','ready','offered','assigned','at_pickup','picked_up','in_transit','delivered','completed','cancelled']),
  food_delivery:Object.freeze(['placed','merchant_accepted','preparing','ready','offered','courier_assigned','picked_up','delivering','delivered','cancelled','rejected']),
  passenger_ride:Object.freeze(['requested','quoted','ready','offered','driver_assigned','arriving','in_progress','completed','cancelled']),
});
export const DISPATCHABLE_STATES=Object.freeze({
  freight_3pl:['ready'], hotshot:['ready'], warehouse_transfer:['ready'],
  local_courier:['ready'], food_delivery:['ready'], passenger_ride:['ready'],
});
const ACTIVE_BY_SERVICE=Object.freeze({
  freight_3pl:['offered','assigned','at_pickup','loaded','in_transit'],
  hotshot:['offered','assigned','at_pickup','loaded','in_transit'],
  warehouse_transfer:['assigned','in_progress'],
  local_courier:['offered','assigned','at_pickup','picked_up','in_transit'],
  food_delivery:['offered','courier_assigned','picked_up','delivering'],
  passenger_ride:['offered','driver_assigned','arriving','in_progress'],
});
const TERMINAL=new Set(['completed','cancelled','rejected','delivered']);
const SERVICE_SET=new Set(SERVICE_TYPES);

function positiveNumber(value) {
  if (value===null||value===undefined||value==='') return null;
  const num=Number(value);
  return Number.isFinite(num)&&num>0?num:null;
}
function requiredText(value) {
  return typeof value==='string'&&value.trim().length>0?value.trim():null;
}

/**
 * Rejects unknown job status/source and missing org scope.
 * This is an application data contract, not a server authorization boundary.
 */
export function normalizeUniversalJob(row, expectedOrganizationId) {
  if(!row || !requiredText(expectedOrganizationId) ||
     row.organization_id!==expectedOrganizationId ||
     !requiredText(row.id) || !SERVICE_SET.has(row.service_type)) return null;
  const serviceType=row.service_type;
  if(row.source_kind!==SERVICE_SOURCE_KINDS[serviceType] ||
    !requiredText(row.source_id) || !SERVICE_STATES[serviceType].includes(row.status)) return null;
  const requirements=row.requirements;
  if(requirements!=null && (typeof requirements!=='object'||Array.isArray(requirements))) return null;
  const capabilities=requirements?.required_capabilities??[];
  if(!Array.isArray(capabilities)||!capabilities.every(x=>typeof x==='string'&&x.trim()))return null;
  const weightRaw=requirements?.weight_lbs;
  if(weightRaw!=null && positiveNumber(weightRaw)===null)return null;
  const passengersRaw=requirements?.passenger_count;
  if(passengersRaw!=null && (!Number.isSafeInteger(passengersRaw)||passengersRaw<1))return null;
  if(serviceType==='passenger_ride' && (!Number.isSafeInteger(passengersRaw)||passengersRaw<1))return null;
  if(serviceType==='food_delivery'&&requirements?.regulated_commodity===true)return null;
  return Object.freeze({
    id:row.id, organizationId:expectedOrganizationId,
    serviceType,division:SERVICE_DIVISIONS[serviceType],
    sourceKind:row.source_kind,sourceId:row.source_id,status:row.status,
    requirements:Object.freeze({
      requiredCapabilities:[...new Set(capabilities.map(x=>x.trim()))],
      weightLbs:positiveNumber(weightRaw),
      passengerCount:passengersRaw??null,
      regulatedCommodity:requirements?.regulated_commodity===true,
    }),
  });
}
export function isDispatchableJob(job) {
  return Boolean(job && DISPATCHABLE_STATES[job.serviceType]?.includes(job.status));
}
export function isActiveServiceJob(job) {
  return Boolean(job && ACTIVE_BY_SERVICE[job.serviceType]?.includes(job.status));
}
export function isTerminalServiceJob(job) {
  return Boolean(job && TERMINAL.has(job.status) &&
    SERVICE_STATES[job.serviceType]?.includes(job.status));
}

/**
 * Existing at_assignments has a coarse division but does not reliably describe
 * Uber Eats, passenger trips, 3PL and hotshot service type. Leave it UNCLASSIFIED.
 * org scope is checked here in addition to the RLS-scoped upstream query.
 */
export function summarizeExistingDispatch(assignments=[],organizationId='',{isDemo=false}={}) {
  const summary={legacyFreight:0,legacyClassC:0,unclassified:0,total:0,active:0,demo:Boolean(isDemo)};
  if(!organizationId || !Array.isArray(assignments))return summary;
  for(const item of assignments){
    if(!item?.id)continue;
    if(!isDemo && item.organization_id!==organizationId)continue;
    if(item.organization_id&&item.organization_id!==organizationId)continue;
    summary.total+=1;
    if(item.division==='CDL')summary.legacyFreight+=1;
    else if(item.division==='Class C')summary.legacyClassC+=1;
    else summary.unclassified+=1;
    if(['offered','assigned','accepted','at_pickup','picked_up','in_transit'].includes(item.status))summary.active++;
  }
  return summary;
}
