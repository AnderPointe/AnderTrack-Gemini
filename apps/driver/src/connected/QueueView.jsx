import React from 'react';
import {Clock3,Users} from 'lucide-react';
import {SERVICE_NAMES} from './operations.js';
import './connected.css';

export default function QueueView({queue=[],userId='',onJoin,onCancel,busy=false,canJoin=false,reason='',demo=false}){
  const mine=queue.find(r=>r.driver_user_id===userId);
  return <section className="connected-queue" aria-label="Organization driver queue"><header><div><Users size={20}/><h2>Driver request queue</h2></div><strong>{queue.length} waiting</strong></header><p className="connected-muted">All waiting requests in your organization, in server FIFO order. Other drivers’ routes and locations stay private.</p>
    {queue.length?<ol>{queue.map((row,index)=><li key={row.id} className={row.driver_user_id===userId?'mine':''}><b>#{row.queue_position||row.position||index+1}</b><div><strong>{row.display_name||'Driver'} {row.driver_user_id===userId?'· You':''}</strong><span>{SERVICE_NAMES[row.service_id]||'Legacy assignment'} · Request {row.queue_number}</span><small><Clock3 size={12}/> {new Date(row.requested_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></div>{index===0&&<em>Next</em>}</li>)}</ol>:<p className="connected-empty">The queue is clear.</p>}
    {(onJoin||onCancel)&&<>{mine?<button className="ud-secondary" disabled={busy} onClick={onCancel}>Leave queue</button>:<button className="ud-primary" disabled={busy||!canJoin} onClick={onJoin}>Request next assignment</button>}{!mine&&!canJoin&&reason&&<p className="connected-muted">{reason}</p>}</>}
    {demo&&<small className="connected-muted">Sample queue · no dispatch request is sent</small>}
  </section>;
}
