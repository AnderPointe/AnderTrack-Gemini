import React from 'react';
import {Activity, Layers3, ShieldCheck, ArrowRight, ClipboardList} from 'lucide-react';
import {summarizeExistingDispatch} from '../../lib/universal-jobs.js';

/** RLS-scoped legacy assignments only; no food or ride volumes inferred. */
export default function UniversalDispatchFoundation({
  assignments=[],organizationId='',isDemo=false,canPlan=false,onOpenDispatch=()=>{},onOpenPlanner=()=>{},
}) {
  const counts=summarizeExistingDispatch(assignments,organizationId,{isDemo});
  return <section className="at-surface at-universal-foundation" aria-label="Unified dispatch foundation">
    <header className="at-universal-foundation-header">
      <div><span className="at-kicker">PHASE 2 / DISPATCH FOUNDATION</span>
        <h2>Shared operational contracts</h2>
        <p>Existing assignment records remain scoped to their organization. New service marketplaces are not active.</p>
      </div>
      <span className="at-universal-architecture-tag">{isDemo?'DEMO / SAMPLE':'LEGACY ASSIGNMENT VIEW'}</span>
    </header>
    <div className="at-universal-foundation-grid">
      <div><Layers3 size={19}/><span>Legacy CDL records</span><strong>{counts.legacyFreight}</strong>
        <small>Not automatically classified as 3PL or hotshot</small></div>
      <div><ClipboardList size={19}/><span>Legacy Class C records</span><strong>{counts.legacyClassC}</strong>
        <small>Not automatically classified as food, courier or rides</small></div>
      <div><Activity size={19}/><span>Active legacy assignments</span><strong>{counts.active}</strong>
        <small>Existing assignment statuses only</small></div>
      <div><ShieldCheck size={19}/><span>Unknown classification</span><strong>{counts.unclassified}</strong>
        <small>Needs a verified service discriminator</small></div>
    </div>
    <footer className="at-universal-foundation-footer">
      <span>Candidate matching remains advisory; assignment writes use existing protected RPCs and safety interlocks.</span>
      <div>
        {canPlan&&<button type="button" onClick={onOpenPlanner}>Review planner <ArrowRight size={14}/></button>}
        <button type="button" onClick={onOpenDispatch}>Dispatch queue <ArrowRight size={14}/></button>
      </div>
    </footer>
  </section>;
}
