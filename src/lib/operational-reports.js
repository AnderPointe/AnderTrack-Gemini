import {ACTIVE_STATUSES} from './operations.js';
export function reportRows(assignments,{from='',to='',division='all',status='all'}={}){
 if(from&&to&&from>to)throw Error('The start date must not be after the end date.');
 return assignments.filter(a=>{const stamp=Date.parse(a.created_at),day=Number.isFinite(stamp)?new Date(stamp).toISOString().slice(0,10):'';return (!from||(day&&day>=from))&&(!to||(day&&day<=to))&&(division==='all'||a.division===division)&&(status==='all'||a.status===status);});
}
export function reportSummary(rows){return {total:rows.length,delivered:rows.filter(r=>r.status==='delivered').length,active:rows.filter(r=>ACTIVE_STATUSES.has(r.status)).length,unassigned:rows.filter(r=>r.status==='unassigned').length,cancelled:rows.filter(r=>r.status==='cancelled').length,estimatedMiles:rows.reduce((sum,r)=>{const miles=Number(r.estimated_miles);return sum+(r.estimated_miles!=null&&Number.isFinite(miles)&&miles>=0?miles:0);},0),missingMiles:rows.filter(r=>r.estimated_miles==null||!Number.isFinite(Number(r.estimated_miles))||Number(r.estimated_miles)<0).length};}
