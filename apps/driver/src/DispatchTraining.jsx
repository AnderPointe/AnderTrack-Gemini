import React,{useState} from 'react';
import {ArrowLeft,ArrowRight,CheckCircle2,ClipboardList,FlaskConical,Radio,
  RefreshCcw,ShieldAlert,ShieldCheck,Truck,Users,XCircle} from 'lucide-react';
import {QA_TENANT,QA_VEHICLE,QA_DRIVERS,createDispatchQaState,dispatchQaStep,
  queueHead,evaluateQaClaim,visibleQaDriverJobs} from './dispatch-training.js';

export default function DispatchTraining({onExit=()=>{}}){
  const [state,setState]=useState(createDispatchQaState);
  const [driverId,setDriverId]=useState(QA_DRIVERS[0].id);
  const [jobId,setJobId]=useState('qa-job-1');
  const [notice,setNotice]=useState('Two fake driver requests are queued; FIFO head is first.');
  const head=queueHead(state);
  const driver=state.drivers.find(x=>x.id===driverId);
  const headDriver=state.drivers.find(x=>x.id===head?.driver_id);
  const ownJobs=visibleQaDriverJobs(state,driverId);
  const claim=evaluateQaClaim(state,jobId,QA_VEHICLE);
  function step(action){
    const result=dispatchQaStep(state,{...action,organizationId:QA_TENANT});
    if(result.ok)setState(result.state);
    setNotice(result.reason);
  }
  function reset(){
    setState(createDispatchQaState());setDriverId(QA_DRIVERS[0].id);
    setJobId('qa-job-1');setNotice('Simulation reset. No backend records changed.');
  }
  return <div className="at-qa-screen" data-testid="dispatch-training">
    <div className="at-training-alert" role="note"><FlaskConical size={23}/>
      <div><strong>FICTIONAL DISPATCH TRAINING · NOT CONNECTED TO SUPABASE</strong>
        <p>These two panes simulate simultaneous dispatcher and driver updates using the same browser state.
          No actual real-time subscription, vehicle, driver, location, or assignment is involved.</p></div>
    </div>
    <div className="at-training-actions">
      <button className="driver-secondary" type="button" onClick={onExit}>
        <ArrowLeft size={16}/> Back to driver training
      </button>
      <button className="driver-secondary" type="button" onClick={reset}>
        <RefreshCcw size={16}/> Reset fictional dispatch
      </button>
    </div>
    <header className="at-qa-header">
      <div><span className="driver-eyebrow"><Radio size={14}/> PHASE 5 · LOCAL QUEUE SIMULATION</span>
        <h1>Dispatch ↔ Driver QA Lab</h1>
        <p>Follow FIFO queue matching, qualification interlocks, sample offer decisions, and an immediate
          shared-state view of dispatch events. A real backend is not used in this exercise.</p>
      </div>
      <span className="at-qa-revision">Local revision #{state.revision}</span>
    </header>
    <div className="at-qa-columns">
      <section className="driver-section at-qa-panel" aria-label="Fictional dispatcher queue">
        <div className="driver-section-title"><div>
          <span className="driver-eyebrow"><ClipboardList size={14}/> SIMULATED DISPATCHER</span>
          <h2>FIFO request queue</h2>
        </div><span className="driver-count">{state.requests.length} waiting</span></div>
        <div className="at-qa-queue">{[...state.requests].sort((a,b)=>a.queue_number-b.queue_number)
          .map((q,i)=>{const d=state.drivers.find(x=>x.id===q.driver_id);return <div
            key={q.id} className={'at-qa-queue-row '+(i===0?'at-qa-head':'')}>
            <span>#{q.queue_number}</span><div><strong>{d?.name||'Unknown'}</strong>
              <small>{d?.license_verified?'Verified':'Unverified'} · {d?.availability}</small></div>
            {i===0&&<span className="driver-eyebrow">NEXT</span>}
          </div>})}</div>
        {head?<p className="at-qa-hint">FIFO head: <strong>{headDriver?.name}</strong>.
          A blocked head cannot be silently skipped.</p>:
          <p className="at-qa-hint">No queued requests. Reset to restore fictional queue.</p>}
        <label className="at-qa-select-label" htmlFor="qa-load">Sample unassigned load</label>
        <select id="qa-load" className="at-qa-select" value={jobId}
          onChange={e=>setJobId(e.target.value)}>
          {state.jobs.filter(j=>j.status==='unassigned').map(j=><option key={j.id} value={j.id}>{j.reference}</option>)}
          {!state.jobs.some(j=>j.status==='unassigned')&&<option value="">No unassigned loads</option>}
        </select>
        <p className="at-qa-hint"><Truck size={14}/> QA Cargo Van · Class C · fictional, enabled</p>
        <button type="button" className="driver-primary" disabled={!claim.ok}
          onClick={()=>step({type:'claim',jobId,vehicleId:QA_VEHICLE})}>
          <ArrowRight size={16}/> Offer to FIFO head
        </button>
        {!claim.ok&&<p className="at-qa-blocked"><ShieldAlert size={16}/>{claim.reason}</p>}
      </section>
      <section className="driver-section at-qa-panel" aria-label="Fictional driver assignment view">
        <div className="driver-section-title"><div>
          <span className="driver-eyebrow"><Users size={14}/> SIMULATED DRIVER</span>
          <h2>My offers and loads</h2>
        </div><span className="driver-count">{ownJobs.length} visible</span></div>
        <label className="at-qa-select-label" htmlFor="qa-driver">Switch fictional driver</label>
        <select id="qa-driver" className="at-qa-select" value={driverId}
          onChange={e=>setDriverId(e.target.value)}>
          {state.drivers.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <div className={'at-qa-driver-status '+(driver?.license_verified?'qualified':'restricted')}>
          {driver?.license_verified?<ShieldCheck size={17}/>:<ShieldAlert size={17}/>}
          <span>{driver?.license_verified?'Verified Class C, available':
            'Class C unverified and offline — cannot accept offers'}</span>
        </div>
        {ownJobs.length ? ownJobs.map(job=><article key={job.id} className="at-qa-driver-job">
          <strong>{job.reference}</strong>
          <span className="driver-eyebrow">{job.status.replaceAll('_',' ')}</span>
          <small>{job.pickup_address} → {job.dropoff_address}</small>
          <div className="at-qa-job-actions">
            {job.status==='offered'&&<>
              <button type="button" className="driver-primary"
                disabled={!driver?.license_verified||driver.availability!=='available'}
                onClick={()=>step({type:'accept',driverId,jobId:job.id})}><CheckCircle2 size={15}/> Accept fake offer</button>
              <button type="button" className="driver-secondary"
                onClick={()=>step({type:'decline',driverId,jobId:job.id})}><XCircle size={15}/> Decline</button>
            </>}
            {['accepted','at_pickup','picked_up'].includes(job.status)&&<button type="button"
              className="driver-primary" disabled={!driver?.license_verified||driver.availability!=='available'}
              onClick={()=>step({type:'advance',driverId,jobId:job.id})}>
              <ArrowRight size={15}/> Advance fictional job
            </button>}
            {job.status==='in_transit'&&<small>Delivery completion is locked; real ePOD required.</small>}
          </div>
        </article>):<p className="at-qa-hint">No fictional assignments visible for this driver.</p>}
        {state.requests.some(q=>q.driver_id===driverId)&&<button
          type="button" className="driver-secondary" onClick={()=>step({type:'withdraw',driverId})}>
          <XCircle size={15}/> Withdraw my fictional queue request
        </button>}
      </section>
    </div>
    <section className="driver-section at-qa-panel at-qa-events" aria-label="Fictional synchronization event log">
      <div className="driver-section-title"><div><span className="driver-eyebrow">LOCAL SYNCHRONIZATION</span>
        <h2>Shared-state event timeline</h2></div><span className="driver-count">{state.audit.length} events</span></div>
      <p role="status" className="at-training-feedback">{notice}</p>
      {state.audit.length?<ul>{state.audit.map(a=><li key={a.id}>
        <span>#{a.id}</span><strong>{a.type}</strong><span>{a.detail}</span>
      </li>)}</ul>:<p className="at-qa-hint">No simulated actions yet.</p>}
      <p className="at-qa-disclaimer">This validates client-state transitions only. Actual Supabase Realtime
        delivery, concurrency, cross-tenant RLS, and protected RPCs require authenticated staging QA.</p>
    </section>
  </div>;
}
