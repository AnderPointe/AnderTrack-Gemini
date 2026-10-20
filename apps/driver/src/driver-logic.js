/**
 * Shared AnderTrack at_* schema adapter for driver presentation.
 * All reads MUST also be filtered and authorized by Supabase RLS.
 */
export const DRIVER_ACTIVE_STATES = new Set(['offered','assigned','accepted','at_pickup','picked_up','in_transit']);
export const DRIVER_NEXT_STATUS = Object.freeze({
  accepted:{next:'at_pickup',label:'Arrived at pickup'},
  at_pickup:{next:'picked_up',label:'Confirm pickup'},
  picked_up:{next:'in_transit',label:'Start delivery route'},
});

export function assignmentsForDriver(items,organizationId,userId) {
  if(!organizationId||!userId||!Array.isArray(items))return [];
  return items.filter(item=>item?.id && item.organization_id===organizationId &&
    item.driver_user_id===userId).sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0));
}

export function driverAssignmentAction(assignment,userId,licenseVerified) {
  if(!assignment?.id || assignment.driver_user_id!==userId || !licenseVerified)return null;
  if(assignment.status==='offered')return {kind:'offer',label:'Accept assignment'};
  const next=DRIVER_NEXT_STATUS[assignment.status];
  return next?{kind:'advance',label:next.label,next:next.next}:null;
}

export function externalRouteUrl(assignment) {
  const pickup=String(assignment?.pickup_address||'').trim();
  const dropoff=String(assignment?.dropoff_address||'').trim();
  if(!pickup||!dropoff||pickup.length>500||dropoff.length>500)return null;
  return 'https://www.google.com/maps/dir/?api=1&origin='+
    encodeURIComponent(pickup)+'&destination='+encodeURIComponent(dropoff)+
    '&travelmode=driving';
}

export function classifyLegacyAssignment(assignment){
  if(assignment?.division==='Class C')return 'Class C delivery';
  if(assignment?.division==='CDL')return 'Commercial freight';
  return 'Unclassified assignment';
}

export function groupDriverAssignments(assignments){
  return {
    offers:assignments.filter(item=>item.status==='offered'),
    active:assignments.filter(item=>DRIVER_ACTIVE_STATES.has(item.status)&&item.status!=='offered'),
    history:assignments.filter(item=>!DRIVER_ACTIVE_STATES.has(item.status))
  };
}

export function formatAssignmentStatus(status){
  return String(status||'Unknown').replaceAll('_',' ').replace(/\b\w/g,ch=>ch.toUpperCase());
}

export function validLocalPosition(position){
  const {latitude,longitude,accuracy}=position||{};
  return typeof latitude==='number' && typeof longitude==='number' &&
    Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude>=-90 && latitude<=90 && longitude>=-180 && longitude<=180 &&
    typeof accuracy==='number' && Number.isFinite(accuracy) && accuracy>=0;
}
