export const SAMPLE_POLICY={organization_id:'demo-provider',display_name:'Example Logistics · demo',base_cents:2500,mile_cents:200,pallet_cents:1000,weight_1000_cents:500,minimum_cents:5000,driver_share_bps:8000,driver_floor_cents:4000,max_payload_lbs:44000,version:1};
export function estimateQuote(policy,{miles,pallets,payload,urgency}){
  if(!policy||![miles,pallets,payload].every(Number.isFinite)||miles<1||miles>10000||!Number.isInteger(pallets)||pallets<0||pallets>26||!Number.isInteger(payload)||payload<1||payload>policy.max_payload_lbs||!['standard','priority','express'].includes(urgency))return null;
  const distance_cents=Math.ceil(Math.round(miles*100)*policy.mile_cents/100),pallet_cents=pallets*policy.pallet_cents,payload_cents=Math.ceil(payload/1000)*policy.weight_1000_cents;
  const subtotal=policy.base_cents+distance_cents+pallet_cents+payload_cents,urgency_cents=Math.ceil(subtotal*({standard:0,priority:.25,express:.5}[urgency]));
  const total_cents=Math.max(policy.minimum_cents,subtotal+urgency_cents),driver_cents=Math.max(policy.driver_floor_cents,Math.floor(total_cents*policy.driver_share_bps/10000));
  return{currency:'USD',policy_version:policy.version,base_cents:policy.base_cents,distance_cents,pallet_cents,payload_cents,urgency_cents,minimum_adjustment_cents:total_cents-subtotal-urgency_cents,total_cents,driver_cents,service_fee_cents:total_cents-driver_cents,miles,mile_rate_cents:policy.mile_cents,urgency};
}
export const dollars=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((cents||0)/100);
export function trackingPosition(shipment,now=Date.now()){
  const p=shipment?.gps,age=now-Date.parse(p?.last_ping_at);
  return shipment?.status==='in_transit'&&p?.online&&p?.sharing&&Number.isFinite(p.latitude)&&Math.abs(p.latitude)<=90&&Number.isFinite(p.longitude)&&Math.abs(p.longitude)<=180&&age>=-5000&&age<60000&&now<Date.parse(shipment.tracking_expires_at)?p:null;
}
export function localInputTime(date){return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
