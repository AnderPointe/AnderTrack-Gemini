import React from 'react';
import {CheckCircle2,ClipboardCheck,LockKeyhole,ShieldAlert} from 'lucide-react';
import {assessDriverReadiness} from './readiness.js';

export default function DriverReadiness({membership,profile,online,jobCount}){
  const summary=assessDriverReadiness({membership,profile,online,jobCount});
  return <section className="driver-section at-readiness" aria-label="Driver onboarding readiness">
    <div className="driver-section-title">
      <div><span className="driver-eyebrow">ACCOUNT STATUS · READ-ONLY</span><h2>Driver onboarding checks</h2></div>
      <span className="driver-count">{summary.completed}/{summary.total} checks</span>
    </div>
    <p className="at-readiness-intro">These checks reflect your authorized staging account and browser.
      Passing them does not guarantee dispatch eligibility; the server independently validates vehicle, safety and assignment rules.</p>
    <div className="at-readiness-grid">
      {summary.checks.map(item=><div key={item.id} className={'at-readiness-check '+(item.passed?'passed':'pending')}>
        {item.passed?<CheckCircle2 size={17}/>:<LockKeyhole size={17}/>}
        <div><strong>{item.label}</strong>
          <span>{item.passed?'Confirmed':item.hint}</span></div>
      </div>)}
    </div>
    {summary.canRequestRealAssignment?
      <p className="at-readiness-footer"><ClipboardCheck size={16}/> Initial account checks complete.
        Actual dispatch authorization is verified server-side.</p>:
      <p className="at-readiness-footer"><ShieldAlert size={16}/> Driver remains restricted until the outstanding
        qualifications are reviewed by operations.</p>}
  </section>;
}
