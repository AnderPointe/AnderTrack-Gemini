import React,{useMemo,useState} from 'react';
import {supabase} from '../../lib/supabase.js';
import {CONNECTED_STAGING,SERVICE_NAMES,createOperations,freshLocation} from '../../../apps/driver/src/connected/operations.js';
import {useOperations} from '../../../apps/driver/src/connected/useOperations.js';
import Messenger from '../../../apps/driver/src/connected/Messenger.jsx';
import QueueView from '../../../apps/driver/src/connected/QueueView.jsx';
import '../../../apps/driver/src/connected/connected.css';

export function CreateServiceTask({organizationId,onChanged,initialService='courier'}){
  const api=useMemo(()=>createOperations(supabase),[]);
  const [fields,setFields]=useState({service:initialService,license:['freight','otr'].includes(initialService)?'A':'C',reference:'',customer:'',detail:'',pickup:'',destination:'',miles:''});
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const edit=(key,value)=>setFields(previous=>({...previous,[key]:value,...(key==='service'?{license:['freight','otr'].includes(value)?'A':'C'}:{})}));
  async function submit(e){e.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');
    try{await api.rpc('at_create_service_task',{p_organization_id:organizationId,p_service_id:fields.service,p_required_license_class:fields.license,p_reference:fields.reference.trim(),p_customer:fields.customer.trim(),p_detail:fields.detail.trim(),p_pickup:fields.pickup.trim(),p_destination:fields.destination.trim(),p_estimated_miles:fields.miles===''?null:Number(fields.miles)});setNotice(`Task ${fields.reference} created. Select it below to offer equipment to a qualified queued driver.`);setFields(previous=>({...previous,reference:'',customer:'',detail:'',pickup:'',destination:'',miles:''}));await onChanged?.();}
    catch(e){setError(e.code==='23505'?'That reference already exists in this organization.':e.message);}finally{setBusy(false);}
  }
  if(!CONNECTED_STAGING)return null;
  return <section className="connected-panel" aria-label="Create service assignment"><h2>Create a dispatch task</h2><p className="connected-muted">All six services share the assignment system. Tasks start unassigned; offers still require approved service access, current location, license verification and qualified equipment.</p>
    {error&&<p className="connected-error" role="alert">{error}</p>}{notice&&<p role="status" className="connected-location">{notice}</p>}
    <form onSubmit={submit}><label htmlFor="task-service">Service</label><select id="task-service" className="connected-field" value={fields.service} onChange={e=>edit('service',e.target.value)}>{Object.entries(SERVICE_NAMES).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>
      <label>Required equipment class<select className="connected-field" value={fields.license} onChange={e=>edit('license',e.target.value)}>{(fields.service==='waste'?['A','B','C']:['freight','otr'].includes(fields.service)?['A','B']:['C']).map(value=><option key={value} value={value}>Class {value}</option>)}</select></label>
      {[['reference','Task reference',3,80],['customer','Customer / account',2,160],['detail','Task description',2,1000],['pickup','Pickup / collection address',3,300],['destination','Delivery / disposal address',3,300]].map(([key,label,min,max])=><label key={key}>{label}<input className="connected-field" value={fields[key]} onChange={e=>edit(key,e.target.value)} required minLength={min} maxLength={max}/></label>)}
      <label>Estimated miles (optional)<input className="connected-field" type="number" min="0" max="10000" step="0.1" value={fields.miles} onChange={e=>edit('miles',e.target.value)}/></label><button className="connected-action" disabled={busy}>{busy?'Creating…':'Create unassigned task'}</button>
    </form>
  </section>;
}

export const SERVICE_WORKSPACE_MAP={'freight-3pl':'freight','local-courier':'courier','food-delivery':'food','passenger-services':'rideshare','waste-services':'waste'};
export function ServiceTaskWorkspace({view,organizationId,role,assignments=[],onChanged,onReview,isDemo=false}){
  const id=SERVICE_WORKSPACE_MAP[view];if(!id||(!CONNECTED_STAGING&&!isDemo))return null;
  const rows=assignments.filter(a=>a.service_id===id||(id==='freight'&&a.service_id==='otr'));
  return <div className="connected-grid" style={{marginTop:20}}><section className="connected-panel"><h2>{SERVICE_NAMES[id]} tasks</h2><p className="connected-muted">{isDemo?'Sample view. Sign in to staging to create and dispatch tasks.':'Authorized dispatch-created tasks. Customer booking and payments are separate integrations.'}</p>{rows.length?rows.map(row=><button key={row.id} className="connected-task-card" onClick={()=>onReview(row.id)}><span><strong>{row.reference}</strong><small>{row.pickup_address} → {row.dropoff_address}</small></span><span>{row.status}</span></button>):<p className="connected-empty">No tasks for this service yet.</p>}</section>{!isDemo&&['admin','dispatcher'].includes(role)&&<CreateServiceTask key={view+':'+organizationId} organizationId={organizationId} initialService={id} onChanged={onChanged}/>}</div>;
}

function ServiceAccess({organizationId,drivers,onChanged}){
  const api=useMemo(()=>createOperations(supabase),[]);
  const [driver,setDriver]=useState(''),[service,setService]=useState('courier'),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  async function save(enabled){setBusy(true);setError('');setNotice('');try{await api.rpc('at_set_driver_service_access',{p_organization_id:organizationId,p_driver_user_id:driver,p_service_id:service,p_enabled:enabled,p_note:note.trim()});setNotice(`Service access ${enabled?'approved':'revoked'}.`);setNote('');await onChanged?.();}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <section className="connected-panel"><h2>Driver service review</h2><p className="connected-muted">Record the completed service-specific qualification review. This does not verify a license, insurance, permit or vehicle on its own.</p><label>Driver<select className="connected-field" value={driver} onChange={e=>setDriver(e.target.value)}><option value="">Choose a driver</option>{drivers.map(d=><option key={d.user_id} value={d.user_id}>{d.display_name} · {d.license_verified?'License verified':'License unverified'}</option>)}</select></label><label>Service<select className="connected-field" value={service} onChange={e=>setService(e.target.value)}>{Object.entries(SERVICE_NAMES).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label>Qualification review notes<textarea className="connected-field" value={note} onChange={e=>setNote(e.target.value)} minLength={10} maxLength={1000} rows={3}/></label>{error&&<p className="connected-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}<div className="connected-tab-row"><button disabled={busy||!driver||note.trim().length<10} onClick={()=>save(true)}>Approve service</button><button disabled={busy||!driver||note.trim().length<10} onClick={()=>save(false)}>Revoke service</button></div></section>;
}

export default function ConnectedDispatch({organizationId,session,role,drivers=[],onChanged,isDemo=false}){
  const planner=['admin','dispatcher'].includes(role),user=session?.user?.id||'';
  const live=useOperations(supabase,organizationId,user,planner,!isDemo);
  const [selectedDriver,setSelectedDriver]=useState('');
  const thread=planner?(drivers.some(d=>d.user_id===selectedDriver)?selectedDriver:drivers[0]?.user_id||''):user;
  const refresh=async()=>{await live.refresh();await onChanged?.();};
  if(isDemo)return <section className="connected-panel"><h2>Connected dispatch</h2><p className="connected-muted">Sign in to the staging website for private messaging, service task creation and the live driver queue. Demo screens never send messages or assignments to real drivers.</p></section>;
  if(!CONNECTED_STAGING)return <section className="connected-panel"><h2>Staging connection required</h2><p className="connected-muted">The website and driver preview must use the same staging database and connected-operations setting.</p></section>;
  const active=live.locations.filter(row=>freshLocation(row));
  return <div><div className="connected-stats"><div><span>Drivers sharing GPS</span><strong>{active.length}</strong></div><div><span>Waiting requests</span><strong>{live.queue.length}</strong></div><div><span>Tasks in workspace</span><strong>{live.assignments.length}</strong></div></div><p className="connected-muted">{live.sync} · Same staging data as the driver app</p>{live.error&&<p className="connected-error" role="alert">{live.error}</p>}
    <div className="connected-grid"><div>{planner&&<label className="connected-panel" style={{display:'block',marginBottom:16}}>Driver conversation<select className="connected-field" aria-label="Driver conversation" value={thread} onChange={e=>setSelectedDriver(e.target.value)}><option value="">Select driver</option>{drivers.map(d=><option key={d.user_id} value={d.user_id}>{d.display_name}</option>)}</select></label>}<Messenger key={organizationId+':'+thread+':'+user} client={supabase} organizationId={organizationId} driverUserId={thread} currentUserId={user} title={planner?'Driver instant messenger':'Dispatch instant messenger'}/><div style={{marginTop:20}}><QueueView queue={live.queue} userId={user}/></div></div>
      <div>{planner&&<><CreateServiceTask organizationId={organizationId} onChanged={refresh}/><div style={{marginTop:20}}><ServiceAccess organizationId={organizationId} drivers={drivers} onChanged={refresh}/></div></>}<section className="connected-panel" style={{marginTop:20}}><h2>Location connection audit</h2><p className="connected-muted">Fresh means a GPS update within 60 seconds. Offline rows contain no coordinates after sharing stops successfully.</p>{live.locations.length?live.locations.map(row=><p key={row.driver_user_id}><strong>{drivers.find(d=>d.user_id===row.driver_user_id)?.display_name||'Driver'}</strong> · {freshLocation(row)?'Live':row.online?'Stale':'Offline'}<br/><small>{row.last_ping_at?new Date(row.last_ping_at).toLocaleString():'No location received'}</small></p>):<p className="connected-muted">No driver locations received.</p>}</section></div>
    </div></div>;
}
