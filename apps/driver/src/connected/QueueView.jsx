import React,{useId,useState} from 'react';
import {Clock3,Users} from 'lucide-react';
import {SERVICE_NAMES} from './operations.js';
import {filterQueue} from './queue-state.js';
import './connected.css';

export default function QueueView({queue=[],userId='',onJoin,onCancel,busy=false,canJoin=false,reason='',demo=false}){
  const [query,setQuery]=useState(''),[service,setService]=useState('all');
  const id=useId(),mine=queue.find(r=>r.driver_user_id===userId),rows=filterQueue(queue,query,service);
  const ownPosition=mine?(mine.queue_position||mine.position||queue.indexOf(mine)+1):null;
  return <section className="connected-queue" aria-label="Organization driver queue">
    <header><div><Users size={20}/><h2>Driver request queue</h2></div><strong>{queue.length} waiting</strong></header>
    <p className="connected-muted">All waiting requests in your organization, in server FIFO order. Other drivers’ routes and locations stay private.</p>
    {mine&&<p className="connected-location" role="status">Your request: #{ownPosition} · {SERVICE_NAMES[mine.service_id]||'Legacy assignment'}. Dispatch offers work after checking driver and equipment eligibility.</p>}
    <div className="connected-queue-filters"><label htmlFor={id+'-search'}>Find a driver or request<input id={id+'-search'} className="connected-field" type="search" placeholder="Name or request number" value={query} onChange={e=>setQuery(e.target.value)}/></label><label htmlFor={id+'-service'}>View service<select id={id+'-service'} className="connected-field" value={service} onChange={e=>setService(e.target.value)}><option value="all">All services</option>{Object.entries(SERVICE_NAMES).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label></div>
    {(query||service!=='all')&&<p className="connected-muted" role="status">Showing {rows.length} of {queue.length} requests. Positions remain in the full queue. <button type="button" className="connected-quiet" onClick={()=>{setQuery('');setService('all');}}>Clear filters</button></p>}
    {rows.length?<ol>{rows.map(row=><li key={row.id} className={row.driver_user_id===userId?'mine':''}><b>#{row.queue_position}</b><div><strong>{row.display_name||'Driver'} {row.driver_user_id===userId?'· You':''}</strong><span>{SERVICE_NAMES[row.service_id]||'Legacy assignment'} · Request {row.queue_number}</span><small><Clock3 size={12}/> Requested {new Date(row.requested_at).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</small></div>{row.id===queue[0]?.id&&<em>First in queue</em>}</li>)}</ol>:<p className="connected-empty">{queue.length?'No requests match these filters.':'The queue is clear.'}</p>}
    {(onJoin||onCancel)&&<>{mine?<button className="ud-secondary" disabled={busy} onClick={onCancel}>Leave queue</button>:<button className="ud-primary" disabled={busy||!canJoin} onClick={onJoin}>Request next assignment</button>}{!mine&&!canJoin&&reason&&<p className="connected-muted">{reason}</p>}</>}
    {demo&&<small className="connected-muted">Sample queue · no dispatch request is sent</small>}
  </section>;
}
