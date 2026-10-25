export const CONNECTED_STAGING = import.meta.env?.VITE_CONNECTED_OPERATIONS === 'true' && import.meta.env?.VITE_SUPABASE_URL === 'https://ofyfausfhinwgrfmapgc.supabase.co';
export const SERVICES = ['freight', 'otr', 'courier', 'food', 'rideshare', 'waste'];
export const SERVICE_NAMES = { freight: '3PL Freight', otr: 'OTR Trucking', courier: 'Courier', food: 'Food Delivery', rideshare: 'Rideshare', waste: 'Trash Removal' };
export const ACTIVE_STATES = ['offered','assigned','accepted','at_pickup','picked_up','in_transit'];
export const NEXT_LIVE_ACTION = { accepted: ['at_pickup','Arrived at pickup'], at_pickup: ['picked_up','Confirm pickup'], picked_up: ['in_transit','Start trip'] };
export function freshLocation(row, now = Date.now()) { const age = now-Date.parse(row?.last_ping_at); return Boolean(row?.online && row?.sharing && Number.isFinite(row.latitude) && Number.isFinite(row.longitude) && Number.isFinite(age) && age>=-5000 && age<60000); }
export function locationPayload(position, org, token) {
  const c=position?.coords;
  if (!c || !Number.isFinite(c.latitude) || Math.abs(c.latitude)>90 || !Number.isFinite(c.longitude) || Math.abs(c.longitude)>180 || !Number.isFinite(c.accuracy) || c.accuracy<0 || c.accuracy>1000 || !Number.isFinite(position.timestamp) || Date.now()-position.timestamp>60000 || position.timestamp>Date.now()+5000) throw new Error('A fresh, accurate GPS fix is required. Move to an open area and retry.');
  return {p_organization_id:org,p_session_id:token,p_latitude:c.latitude,p_longitude:c.longitude,p_accuracy:c.accuracy,p_captured_at:new Date(position.timestamp).toISOString(),p_heading:Number.isFinite(c.heading)&&c.heading>=0&&c.heading<360?c.heading:null,p_speed_mph:Number.isFinite(c.speed)&&c.speed>=0&&c.speed*2.236936<=200?c.speed*2.236936:null};
}
export function mapLocations(rows) { return (rows||[]).filter(row=>row.sharing&&row.online&&row.latitude!=null&&row.longitude!=null).map(row=>({...row,id:row.driver_user_id,driver_id:row.driver_user_id,company_id:row.organization_id,status:freshLocation(row)?'available':'offline',unit_number:row.display_name||'Driver'})); }
export function createOperations(client) {
  async function rpc(name,args) { if(!CONNECTED_STAGING||!client)throw new Error('Connected operations are enabled only in the staging preview.'); const {data,error}=await client.rpc(name,args);if(error)throw error;return data; }
  return {
    rpc,
    async snapshot(org,user,isPlanner) {
      let query=client.from('at_assignments').select('id,organization_id,reference,service_id,required_license_class,division,customer_name,commodity,pickup_address,dropoff_address,estimated_miles,status,driver_user_id,vehicle_id,updated_at,created_at,scheduled_delivery_at').eq('organization_id',org).order('created_at',{ascending:false}).limit(200);
      if(!isPlanner)query=query.eq('driver_user_id',user);
      const results=await Promise.all([query,client.rpc('at_driver_queue_snapshot',{p_organization_id:org}),client.from('at_live_driver_locations').select('organization_id,driver_user_id,latitude,longitude,accuracy_meters,heading,speed_mph,sharing,online,last_ping_at').eq('organization_id',org),client.from('at_driver_service_access').select('driver_user_id,service_id,enabled,review_note,reviewed_at').eq('organization_id',org),client.from('at_driver_profiles').select('organization_id,user_id,display_name,license_class,license_verified,availability').eq('organization_id',org)]);
      const failure=results.find(r=>r.error)?.error;if(failure)throw failure;
      return {assignments:results[0].data||[],queue:results[1].data||[],locations:results[2].data||[],access:results[3].data||[],drivers:results[4].data||[]};
    },
    async messages(org,driver) { const {data,error}=await client.from('at_dispatch_messages').select('id,driver_user_id,sender_user_id,body,client_nonce,created_at').eq('organization_id',org).eq('driver_user_id',driver).order('created_at',{ascending:false}).limit(100);if(error)throw error;return (data||[]).reverse(); },
    async send(org,driver,body,nonce) {
      if(!CONNECTED_STAGING)throw new Error('Messaging requires the staging connection.');
      if(!body.trim()||body.trim().length>2000)throw new Error('Enter a message between 1 and 2,000 characters.');
      const {data,error}=await client.from('at_dispatch_messages').insert({organization_id:org,driver_user_id:driver,body:body.trim(),client_nonce:nonce}).select().single();
      if(error&&error.code==='23505'){const result=await client.from('at_dispatch_messages').select('*').eq('organization_id',org).eq('driver_user_id',driver).eq('client_nonce',nonce).single();if(result.error)throw result.error;return result.data;}
      if(error)throw error;return data;
    },
  };
}
