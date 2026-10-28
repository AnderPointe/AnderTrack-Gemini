export function cockpitAssignment(jobs=[],service='all') {
 const rows=jobs.filter(j=>service==='all'||j.service_id===service);
 return rows.find(j=>['accepted','at_pickup','picked_up','in_transit'].includes(j.status))||rows.find(j=>['offered','assigned'].includes(j.status))||null;
}
export function telemetry(position,fresh) {
 const speed=position?.speed_mph,heading=position?.heading;
 const validSpeed=fresh&&typeof speed==='number'&&Number.isFinite(speed)&&speed>=0&&speed<=200;
 const validHeading=fresh&&typeof heading==='number'&&Number.isFinite(heading)&&heading>=0&&heading<360;
 return {speed:validSpeed?Math.round(speed):null,heading:validHeading?Math.round(heading):null,direction:validHeading?['N','NE','E','SE','S','SW','W','NW'][Math.round(heading/45)%8]:null};
}
function csv(value){let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function driverHistoryCsv(jobs=[]) {
 return [['Reference','Service','Status','Pickup','Destination','Updated'],...jobs.map(j=>[j.reference,j.service_id,j.status,j.pickup_address||j.pickup,j.dropoff_address||j.destination,j.updated_at||j.created_at||''])].map(row=>row.map(csv).join(',')).join('\r\n');
}
