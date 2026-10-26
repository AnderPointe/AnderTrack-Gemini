import {validGpsPosition,freshGpsPosition} from './operations.js';
export function reconcileBeacons(registry,points,adapter,now=Date.now(),maxAgeMs=300000){
 const seen=new Set(),stats={created:0,moved:0,restyled:0,relabeled:0,removed:0,unchanged:0};
 for(const point of points){
  if(!validGpsPosition(point))continue;
  const id=String(point.id??point.driver_user_id??point.driver_id??point.user_id??point.unit_number??`${point.latitude}:${point.longitude}`);
  if(seen.has(id))continue;seen.add(id);
  const next={latitude:Number(point.latitude),longitude:Number(point.longitude),style:String(point.status||'unknown')+':'+freshGpsPosition(point,now,maxAgeMs),label:JSON.stringify([point.unit_number,point.vehicle_type,point.display_name,point.status,point.last_ping_at])};
  let entry=registry.get(id);
  if(!entry){entry={...next,point};entry.pin=adapter.create(entry);registry.set(id,entry);stats.created++;continue;}
  const flags={moved:entry.latitude!==next.latitude||entry.longitude!==next.longitude,restyled:entry.style!==next.style,relabeled:entry.label!==next.label};
  Object.assign(entry,next,{point});
  if(flags.moved||flags.restyled||flags.relabeled){adapter.update(entry,flags);for(const key of Object.keys(flags))if(flags[key])stats[key]++;}else stats.unchanged++;
 }
 for(const [id,entry] of registry)if(!seen.has(id)){adapter.remove(entry);registry.delete(id);stats.removed++;}
 return stats;
}
