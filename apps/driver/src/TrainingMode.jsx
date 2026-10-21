import React,{useState} from 'react';
import {
  ArrowLeft,ArrowRight,CheckCircle2,FlaskConical,Info,Package,RefreshCcw,
  Route,ShieldOff,Truck,XCircle,
} from 'lucide-react';
import {freshTrainingJobs,trainingActionsFor,transitionTrainingList} from './training.js';
import {formatAssignmentStatus} from './driver-logic.js';
import DispatchTraining from './DispatchTraining.jsx';

/**
 * Isolated UI-only simulation: intentionally no Supabase client, real auth,
 * addresses, geolocation, navigation, storage, or network requests.
 */
export default function TrainingMode({onExit=()=>{}}){
  const [jobs,setJobs]=useState(freshTrainingJobs);
  const [showDispatch,setShowDispatch]=useState(false);
  const [feedback,setFeedback]=useState('Use a sample offer to practice the dispatch-to-driver lifecycle.');
  const [history,setHistory]=useState([]);
  function act(job,action){
    const changed=transitionTrainingList(jobs,job.id,action);
    const previous=jobs.find(item=>item.id===job.id);
    const next=changed.find(item=>item.id===job.id);
    if(previous?.status===next?.status)return;
    setJobs(changed);
    setHistory(items=>[{
      id:items.length+1,
      reference:job.reference,
      from:previous.status,to:next.status,
    },...items].slice(0,8));
    setFeedback(
      action==='decline'
        ?'Sample offer returned to the training dispatch queue. No server request was made.'
        :'Sample status changed locally. No server request was made.'
    );
  }
  const offers=jobs.filter(j=>j.status==='offered').length;
  const started=jobs.filter(j=>['accepted','at_pickup','picked_up','in_transit'].includes(j.status)).length;
  if(showDispatch)return <DispatchTraining onExit={()=>setShowDispatch(false)}/>;
  return <div className="at-training-root" data-testid="training-mode">
    <div className="at-training-alert" role="note">
      <FlaskConical size={23}/>
      <div><strong>TRAINING SIMULATION — NO LIVE OPERATIONS</strong>
        <p>All jobs, locations and statuses below are fictional. Accepting or declining changes this screen only.
        Nothing is submitted to Supabase, dispatch, GPS or a real driver account.</p></div>
    </div>
    <div className="at-training-header">
      <div>
        <span className="driver-eyebrow"><ShieldOff size={14}/> SAFE SANDBOX · NO LOGIN REQUIRED</span>
        <h1>Driver assignment walkthrough</h1>
        <p>Practice receiving offers, making dispatch decisions, and progressing a Class C delivery.
          Delivery completion remains intentionally locked until the authenticated proof-of-delivery workflow is validated.</p>
      </div>
      <Truck className="at-training-truck" size={63}/>
    </div>
    <div className="at-training-actions">
      <button className="driver-secondary" type="button" onClick={onExit}>
        <ArrowLeft size={16}/> Return to secure login
      </button>
      <button className="driver-secondary" type="button" onClick={()=>{
        setJobs(freshTrainingJobs());setHistory([]);setFeedback('Training state reset. This affects no real assignments.');
      }}><RefreshCcw size={16}/> Reset simulation</button>
      <button className="driver-primary" type="button" onClick={()=>setShowDispatch(true)}>
        <ArrowRight size={16}/> Open Dispatch QA Lab
      </button>
    </div>
    <div className="driver-kpi-grid">
      <div className="driver-kpi"><span><Package size={17}/> Fictional offers</span><strong>{offers}</strong></div>
      <div className="driver-kpi"><span><Route size={17}/> In training</span><strong>{started}</strong></div>
      <div className="driver-kpi"><span><ShieldOff size={17}/> Server operations</span><strong className="driver-kpi-word">Disabled</strong></div>
    </div>
    <div className="at-training-jobs" aria-label="Fictional training assignments">
      {jobs.map(job=>{
        const actions=trainingActionsFor(job);
        return <article key={job.id} className="driver-job-card at-training-job">
          <div className="driver-job-heading">
            <div><span className="driver-eyebrow">FAKE LOAD · CLASS C DELIVERY</span>
              <h3>{job.reference}</h3></div>
            <span className="driver-status">{formatAssignmentStatus(job.status)}</span>
          </div>
          <div className="at-training-route">
            <span><Package size={16}/> {job.commodity}</span>
            <span><Route size={16}/> {job.estimated_miles} fictional miles</span>
            <span>FROM: {job.pickup_address}</span>
            <span>TO: {job.dropoff_address}</span>
          </div>
          <div className="driver-job-actions">
            {actions.map(a=><button key={a.id} type="button"
              className={a.id==='decline'?'driver-secondary':'driver-primary'}
              onClick={()=>act(job,a.id)}>
              {a.id==='decline'?<XCircle size={16}/>:<ArrowRight size={16}/>} {a.label}
            </button>)}
            {job.status==='in_transit'&&
              <p className="driver-readonly-note">Training ends at in transit. Final delivery requires verified ePOD in the live driver workflow.</p>}
            {job.status==='unassigned'&&
              <p className="driver-readonly-note">The fictional offer was declined and removed from this driver's sample workload.</p>}
          </div>
        </article>;
      })}
    </div>
    <section className="driver-section at-training-audit" aria-label="Training action history">
      <div className="driver-section-title">
        <div><span className="driver-eyebrow">LOCAL-ONLY AUDIT</span><h2>Simulation events</h2></div>
        <Info size={19}/>
      </div>
      <p role="status" className="at-training-feedback">{feedback}</p>
      {history.length ? <ul>{history.map(entry=><li key={entry.id}>
        <CheckCircle2 size={14}/><strong>{entry.reference}</strong>
        <span>{formatAssignmentStatus(entry.from)} <ArrowRight size={12}/> {formatAssignmentStatus(entry.to)}</span>
      </li>)}</ul> :<p className="driver-readonly-note">No training actions yet.</p>}
    </section>
    <p className="at-training-disclaimer">Training mode is not a vehicle or licensing certification, does not validate eligibility,
      and never authorizes a dispatcher to assign work.</p>
  </div>;
}
