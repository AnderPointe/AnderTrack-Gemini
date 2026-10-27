import React from 'react';
import {
  ArrowRight, CheckCircle2, Clock3, Truck, Package, Warehouse,
  UtensilsCrossed, CarFront, Zap,
} from 'lucide-react';
import {
  UNIVERSAL_DIVISIONS, getUniversalWorkspace,
} from '../../lib/universal-navigation.js';
import './universal-workspace.css';
import {CONNECTED_STAGING} from '../../../apps/driver/src/connected/operations.js';

const icons = {
  freight:Truck, hotshot:Zap, warehouse:Warehouse,
  package:Package, food:UtensilsCrossed, passenger:CarFront,
};

export function UniversalDivisionLaunchpad({onNavigate=()=>{}}) {
  return <section className="at-universal-launchpad" aria-label="Logistics division workspaces">
    <div className="at-universal-launchpad-head">
      <div><span className="at-kicker">UNIVERSAL LOGISTICS OS</span>
        <h2>Operating divisions</h2><p>One command center, with dedicated workspaces for each service.</p>
      </div>
      <span className="at-universal-architecture-tag">Division overview</span>
    </div>
    <div className="at-universal-divisions">
      {UNIVERSAL_DIVISIONS.map(d=>{
        const Icon=icons[d.icon]||Package;
        return <button key={d.id} type="button" className="at-universal-division-card"
          onClick={()=>onNavigate(d.id)} aria-label={d.label+' workspace'}>
          <span className="at-universal-division-icon"><Icon size={20}/></span>
          <span className="at-universal-division-body"><strong>{d.label}</strong><small>{d.subtitle}</small></span>
          <span className={'at-universal-status '+(d.state==='existing'?'ready':'planned')}>
            {d.state==='existing'?<CheckCircle2 size={12}/>:<Clock3 size={12}/>}
            {d.state==='existing'?'Existing UI':'Planned'}
          </span>
          <ArrowRight size={16} className="at-universal-card-arrow"/>
        </button>;
      })}
    </div>
  </section>;
}

export function UniversalDivisionWorkspace({view,onNavigate=()=>{},role='',isDemo=false}) {
  const workspace=getUniversalWorkspace(view);
  if(!workspace)return null;
  const planner=isDemo||role==='admin'||role==='dispatcher';
  const links=workspace.links.filter(link=>!link.planner||planner);
  return <section className="at-universal-workspace" aria-labelledby="at-universal-workspace-heading">
    <div className="at-universal-workspace-intro">
      <span className="at-universal-architecture-tag">{CONNECTED_STAGING&&view!=='hotshot'?'Staging tasks available • Marketplace planned':'Architecture preview • No live service'}</span>
      <h2 id="at-universal-workspace-heading">{workspace.title}</h2>
      <p>{workspace.description}</p>
    </div>
    <div className="at-universal-capability-grid">
      {workspace.capabilities.map((title,index)=><div className="at-universal-capability" key={title}>
        <span>{String(index+1).padStart(2,'0')}</span>
        <strong>{title}</strong><small>Planned — integration not active</small>
      </div>)}
    </div>
    {links.length>0&&<div className="at-universal-workspace-actions">
      <h3>Existing AnderTrack components you can open</h3>
      <div>{links.map(link=><button key={link.id} type="button" className="at-button at-button-secondary"
        onClick={()=>onNavigate(link.id)}>{link.label}<ArrowRight size={16}/></button>)}</div>
    </div>}
    <p className="at-universal-release-note">{CONNECTED_STAGING&&view!=='hotshot'?'Dispatch-created service tasks are available below in staging. Customer ordering, marketplace payments and production services remain inactive.':'No food orders, ride requests, payment processing, or freight tendering are activated by this preview. Real workflows require dedicated authorization, data models, and staging QA.'}</p>
  </section>;
}
