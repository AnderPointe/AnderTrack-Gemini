/**
 * Phase 2 read-only eligibility screening. Never authorizes a real offer/claim.
 * Existing at_* RPCs must recheck org, FIFO, lock order, safety and concurrency.
 */
import {screenVehicleSafety} from './fleet-safety-interlocks.js';
import {isDispatchableJob,isActiveServiceJob} from './universal-jobs.js';

const LICENSE_LEVEL={C:1,B:2,A:3};
const HIGH_RISK_SERVICES=new Set(['food_delivery','passenger_ride']);
const LEGACY_ACTIVE=new Set(['offered','assigned','accepted','at_pickup','picked_up','in_transit']);

function meetsLicense(driver,vehicle){
  return LICENSE_LEVEL[driver?.license_class]>=LICENSE_LEVEL[vehicle?.required_license_class];
}
function isVerifiedServiceApproval(approval,serviceType,organizationId,now,maxAgeMs){
  if(!approval || approval.service_type!==serviceType ||
     approval.organization_id!==organizationId || approval.status!=='approved')return false;
  const checked=Date.parse(approval.checked_at||'');
  return Number.isFinite(checked) && checked<=now && now-checked<=maxAgeMs;
}

/**
 * Advisory only. Missing information blocks a positive recommendation.
 * The server is the source of truth and checks regulatory requirements.
 */
export function evaluateUniversalCandidate({
  job,driver,vehicle,organizationId='',serviceApproval=null,
  safetySnapshot=null,assignments=[],now=Date.now(),
  approvalMaxAgeMs=300_000,
}={}){
  const reasons=[];
  if(!job?.id || job.organizationId!==organizationId || !organizationId)
    reasons.push('Job organization scope unavailable or mismatched');
  if(!isDispatchableJob(job))reasons.push('Job is not ready to dispatch');
  if(!driver?.user_id||driver.organization_id!==organizationId)
    reasons.push('Driver organization or identity not verified');
  if(!vehicle?.id||vehicle.organization_id!==organizationId)
    reasons.push('Vehicle organization or identity not verified');
  if(driver?.license_verified!==true||!meetsLicense(driver,vehicle))
    reasons.push('Driver license qualification unverified');
  if(driver?.availability!=='available')reasons.push('Driver unavailable');
  if(vehicle?.enabled!==true)reasons.push('Vehicle unavailable');
  if(!isVerifiedServiceApproval(serviceApproval,job?.serviceType,organizationId,now,approvalMaxAgeMs))
    reasons.push('Service-specific authorization not verified');

  const requirements=job?.requirements || {};
  const required=Array.isArray(requirements.requiredCapabilities)?requirements.requiredCapabilities:[];
  const approvedCapabilities=new Set(
    Array.isArray(serviceApproval?.approved_capabilities)?serviceApproval.approved_capabilities:[]);
  const vehicleCapabilities=new Set(
    Array.isArray(vehicle?.verified_capabilities)?vehicle.verified_capabilities:[]);
  for(const capability of required)if(!approvedCapabilities.has(capability)||
    !vehicleCapabilities.has(capability))reasons.push('Required capability missing: '+capability);

  const capacity=Number(vehicle?.payload_capacity_lbs);
  if(requirements.weightLbs!=null && (!Number.isFinite(capacity)||
    capacity<requirements.weightLbs))reasons.push('Vehicle payload capacity insufficient or unknown');
  const passengerCapacity=vehicle?.verified_passenger_capacity;
  if(job?.serviceType==='passenger_ride' &&
    (!Number.isSafeInteger(passengerCapacity) || passengerCapacity<requirements.passengerCount))
    reasons.push('Verified passenger capacity insufficient or unknown');
  if(requirements.regulatedCommodity===true && !approvedCapabilities.has('regulated_cargo'))
    reasons.push('Regulated commodity clearance unverified');
  if(HIGH_RISK_SERVICES.has(job?.serviceType) &&
    serviceApproval?.operational_permits_verified!==true)
    reasons.push('Service permits and insurance verification required');

  const safety=screenVehicleSafety(safetySnapshot,vehicle?.id,{
    organizationId,now,
  });
  if(!safety.eligible)reasons.push(safety.reason);

  if(!Array.isArray(assignments))reasons.push('Existing assignments unavailable');
  else for(const a of assignments){
    if(!a || a.organization_id!==organizationId)continue;
    if(a.driver_user_id!==driver?.user_id && a.vehicle_id!==vehicle?.id)continue;
    const active= a.service_type?
      isActiveServiceJob({serviceType:a.service_type,status:a.status}) :
      LEGACY_ACTIVE.has(a.status);
    if(active && (!job?.id || a.id!==job.id)) {
      reasons.push('Driver or vehicle has another active assignment');
      break;
    }
  }
  return {eligible:reasons.length===0,reasons,advisory:true};
}
