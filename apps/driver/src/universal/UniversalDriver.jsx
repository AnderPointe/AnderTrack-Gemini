import React,{useEffect,useRef,useState} from 'react';
import {Truck,Package,CarFront,UtensilsCrossed,Trash2,Home,BriefcaseBusiness,Wallet,MessageCircle,UserRound,ArrowLeft,ArrowRight,MapPin,Check,LogOut,RefreshCw,Navigation,ShieldCheck,Users,Radio} from 'lucide-react';
import {supabase,configured} from '../supabase.js';
import {DRIVER_SERVICES,NEXT_ACTION,STATE_LABEL,money,nextJobState,sampleJobs} from './logic.js';
import {CONNECTED_STAGING,NEXT_LIVE_ACTION,SERVICE_NAMES,ACTIVE_STATES,freshLocation} from '../connected/operations.js';
import {useOperations} from '../connected/useOperations.js';
import {useDriverLocation} from '../connected/useDriverLocation.js';
import Messenger from '../connected/Messenger.jsx';
import QueueView from '../connected/QueueView.jsx';
import {requestedService} from '../connected/queue-state.js';
import DriverLiveMap from '../connected/DriverLiveMap.jsx';
import './universal-driver.css';

const icons={truck:Truck,package:Package,van:Truck,food:UtensilsCrossed,car:CarFront,trash:Trash2};
const tabs=[{id:'home',label:'Home',icon:Home},{id:'jobs',label:'Jobs',icon:BriefcaseBusiness},{id:'queue',label:'Queue',icon:Users},{id:'earnings',label:'Earnings',icon:Wallet},{id:'messages',label:'Messages',icon:MessageCircle},{id:'account',label:'Account',icon:UserRound}];
const pretty=value=>STATE_LABEL[value]||String(value||'Unknown').replaceAll('_',' ');
function Brand(){return <a className="ud-brand" href="/universal"><span aria-hidden="true"><b>A</b><i>T</i></span><div>ANDERTRACK<small>UNIVERSAL DRIVER APP</small></div></a>;}

export default function UniversalDriver(){
  const [demo,setDemo]=useState(new URLSearchParams(window.location.search).get('demo')==='1');
  const [session,setSession]=useState(null),[ready,setReady]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState('');
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[tab,setTab]=useState('home');
  const [serviceId,setServiceId]=useState('otr'),[profiles,setProfiles]=useState([]),[orgId,setOrgId]=useState(''),[activeId,setActiveId]=useState('');
  const [demoJobs,setDemoJobs]=useState(sampleJobs),[demoOnline,setDemoOnline]=useState(false),[filter,setFilter]=useState('active'),[query,setQuery]=useState('');
  const [demoQueued,setDemoQueued]=useState(null),[retryAt,setRetryAt]=useState(0),[clock,setClock]=useState(Date.now());
  const identity=useRef(''),epoch=useRef(0);const user=session?.user?.id||'';
  const live=useOperations(supabase,orgId,user,false,!demo&&Boolean(session));
  const location=useDriverLocation(live.api,orgId,user,!demo&&Boolean(session)&&CONNECTED_STAGING);
  const profile=live.drivers.find(p=>p.user_id===user)||profiles.find(p=>p.organization_id===orgId);
  const jobs=demo?demoJobs:live.assignments;
  const active=jobs.find(job=>job.id===activeId);
  const service=DRIVER_SERVICES.find(s=>s.id===(active?.service_id||serviceId));
  const titleService=service?.label||'Unclassified assignment';
  const online=demo?demoOnline:location.sharing;
  const approvals=live.access.filter(a=>a.driver_user_id===user&&a.enabled).map(a=>a.service_id);
  const demoQueue=[{id:'demo-a',driver_user_id:'sample-driver-a',display_name:'Sample Driver A',service_id:'courier',queue_number:'101',requested_at:new Date(clock-120000).toISOString(),position:1},...(demoQueued?[{id:'demo-you',driver_user_id:'demo-user',display_name:'Ivan Anderson',service_id:demoQueued.serviceId,queue_number:'102',requested_at:demoQueued.requestedAt,position:2}]:[])];
  const queue=demo?demoQueue:live.queue;
  const complete=jobs.filter(j=>demo?j.status==='completed':j.status==='delivered');
  const visible=jobs.filter(j=>(serviceId==='all'||j.service_id===serviceId)&&(filter==='all'||(filter==='history'?(demo?j.status==='completed':['delivered','cancelled'].includes(j.status)):(demo?j.status!=='completed':ACTIVE_STATES.includes(j.status))))).filter(j=>[j.reference,j.pickup,j.pickup_address,j.destination,j.dropoff_address].join(' ').toLowerCase().includes(query.toLowerCase()));

  useEffect(()=>{const id=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(id);},[]);
  useEffect(()=>{
    if(demo||!configured||!CONNECTED_STAGING){setReady(true);return;}
    let mounted=true;
    const apply=next=>{if(!mounted)return;const nextId=next?.user?.id||'';if(identity.current!==nextId){identity.current=nextId;epoch.current++;setProfiles([]);setOrgId('');setActiveId('');setError('');setBusy(false);}setSession(next);setReady(true);};
    supabase.auth.getSession().then(({data,error:e})=>{if(e&&mounted)setError(e.message);apply(data?.session||null);}).catch(e=>{if(mounted){setError(e.message);setReady(true);}});
    const {data}=supabase.auth.onAuthStateChange((_event,next)=>apply(next));
    return()=>{mounted=false;epoch.current++;data.subscription.unsubscribe();};
  },[demo]);
  useEffect(()=>{
    if(demo||!user||!CONNECTED_STAGING)return;let mounted=true;
    supabase.from('at_driver_profiles').select('organization_id,display_name,license_class,license_verified,availability').eq('user_id',user).then(({data,error:e})=>{if(!mounted)return;if(e)setError(e.message);else{setProfiles(data||[]);setOrgId(data?.[0]?.organization_id||'');}}).catch(e=>{if(mounted)setError(e.message);});
    return()=>{mounted=false;};
  },[demo,user]);
  async function run(action){setBusy(true);setError('');setNotice('');const scope=epoch.current;try{await action();}catch(e){if(scope===epoch.current)setError(e.message||'Unable to complete the request.');}finally{if(scope===epoch.current)setBusy(false);}}
  async function signIn(event){event.preventDefault();await run(async()=>{const {error:e}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(e)throw e;setPassword('');});}
  async function sendLink(){if(!email.trim()||clock<retryAt)return;setRetryAt(Date.now()+60000);await run(async()=>{const {error:e}=await supabase.auth.signInWithOtp({email:email.trim(),options:{shouldCreateUser:false,emailRedirectTo:window.location.origin+'/universal'}});if(e)throw e;setNotice('Check your email for a staging sign-in link.');});}
  async function toggleOnline(){if(demo){setDemoOnline(!demoOnline);if(demoOnline)setDemoQueued(null);setNotice('Demo availability only. Your device location is not requested.');return;}await run(async()=>{if(location.sharing)await location.stop();else await location.start();await live.refresh();});}
  async function progress(job,decline=false){await run(async()=>{
    if(demo){setDemoJobs(rows=>rows.map(j=>j.id===job.id?{...j,status:nextJobState(j.status)||j.status}:j));return;}
    if(job.status==='offered'){if(!decline&&!location.sharing)throw new Error('Share your location and go online before accepting a task.');await live.api.rpc('at_respond_assignment',{p_assignment_id:job.id,p_accept:!decline});}
    else {const next=NEXT_LIVE_ACTION[job.status];if(!next)throw new Error('Use the proof-of-delivery workflow to complete this task.');await live.api.rpc('at_advance_assignment',{p_assignment_id:job.id,p_next_status:next[0]});}
    await live.refresh();setNotice(decline?'Offer declined and returned to dispatch.':'Task progress saved.');
  });}
  function openJob(job){setActiveId(job.id);setTab('jobs');setNotice('');}
  const ownRemote=live.locations.find(row=>row.driver_user_id===user);
  const locationFresh=demo||Boolean(location.sharing&&freshLocation(ownRemote,clock));
  const queueService=requestedService(serviceId);
  const canJoin=demo?demoOnline:Boolean(locationFresh&&profile?.license_verified&&approvals.includes(queueService));
  const queueReason=demo?'Go online in the demo to join the sample queue.':!locationFresh?'Share a fresh GPS location and go online first.':!profile?.license_verified?'Dispatch must verify your driver license.':!approvals.includes(queueService)?'Dispatch must approve you for the selected service.':'';
  async function joinQueue(){if(demo){setDemoQueued({serviceId:queueService,requestedAt:new Date().toISOString()});return;}await run(async()=>{await live.api.rpc('at_join_driver_queue',{p_organization_id:orgId,p_service_id:queueService});await live.refresh();setNotice('Your request is in the shared dispatch queue.');});}
  async function leaveQueue(){if(demo){setDemoQueued(null);return;}await run(async()=>{await live.api.rpc('at_cancel_dispatch',{p_organization_id:orgId});await live.refresh();});}
  const currentError=error||live.error||location.error;
  const currentPosition=location.sharing?(location.position||(freshLocation(ownRemote,clock)?ownRemote:null)):null;
  const map=()=>currentPosition?<><DriverLiveMap position={currentPosition}/><p className="ud-muted">Your GPS location · destination routing opens in navigation.</p></>:<div className="connected-location"><strong><Radio size={17}/> {demo?'Sample workflow':'Location sharing is off'}</strong><small>{demo?'This demo does not request or transmit location.':'Tap Share location & go online to make your position visible to dispatch.'}</small></div>;

  return <div className="ud-page"><div className="ud-desktop-head"><Brand/><a href="/">Driver workspace <ArrowRight size={16}/></a></div><main className="ud-app">
    <header className="ud-top"><Brand/><span className="ud-env">{demo?'VISUAL DEMO':'STAGING LIVE'}</span></header>
    <div className="ud-banner">{demo?'Sample data · Changes stay in this preview':'Connected to dispatch · Staging only'}</div>
    {currentError&&<p className="ud-feedback ud-error" role="alert">{currentError}</p>}{notice&&<p className="ud-feedback" role="status">{notice}</p>}
    {!ready?<p className="ud-empty">Checking session…</p>:!demo&&!session?<section className="ud-login"><ShieldCheck size={36}/><h1>Your work.<br/>One driver app.</h1><p>Sign in to connect with your dispatch team.</p>
      {configured&&CONNECTED_STAGING?<form onSubmit={signIn}><label>Email<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="ud-primary" disabled={busy||!password}>{busy?'Signing in…':'Sign in to staging'}</button><button type="button" className="ud-secondary" disabled={busy||!email.trim()||clock<retryAt} onClick={sendLink}>{clock<retryAt?`Retry email in ${Math.ceil((retryAt-clock)/1000)}s`:'Email me a sign-in link'}</button><small>Existing driver accounts only. Your dispatcher manages access.</small></form>:<p>Connected operations are available only on the configured staging preview.</p>}
      <button className="ud-secondary" onClick={()=>{setDemo(true);setError('');}}>Explore visual demo</button>
    </section>:<><div className="ud-content">
      {!demo&&profiles.length>1&&<label className="ud-org">Workspace<select value={orgId} onChange={e=>{epoch.current++;void location.stop();setOrgId(e.target.value);setActiveId('');setBusy(false);}}>{profiles.map(p=><option key={p.organization_id} value={p.organization_id}>{p.display_name} · {p.organization_id.slice(0,8)}</option>)}</select></label>}
      {!demo&&!orgId&&<p className="ud-empty">Your account needs a driver profile in a staging organization. Dispatch can help with access.</p>}
      {tab==='home'&&<><div className="ud-greeting"><div><p className="ud-eyebrow">DRIVER WORKSPACE</p><h1>Hello, {demo?'Ivan':profile?.display_name||'driver'}</h1><p>{demo?'Choose your service':live.sync}</p></div><button className={'ud-toggle '+(online?'on':'')} aria-pressed={online} aria-label="Driver availability" disabled={busy||location.starting||(!demo&&!orgId)} onClick={toggleOnline}><span/>{location.starting?'Locating…':online?'Online':'Offline'}</button></div>
        <div className="ud-services">{DRIVER_SERVICES.map(item=>{const Icon=icons[item.icon];return <button key={item.id} className={'ud-service '+(serviceId===item.id?'selected':'')} aria-pressed={serviceId===item.id} onClick={()=>setServiceId(item.id)}><Icon size={29}/><strong>{item.label}</strong><small>{demo?item.subtitle:approvals.includes(item.id)?'Approved service':'Approval required'}</small><ArrowRight size={15} className="ud-card-arrow"/></button>;})}</div>
        <div className="ud-summary"><div><span>{demo?'Sample work completed':'Completed assignments'}</span><strong>{complete.length} tasks</strong></div><Check size={26}/></div>
        <button className="ud-primary" onClick={()=>{setActiveId('');setTab('jobs');}}>View {SERVICE_NAMES[serviceId]||'all'} jobs <ArrowRight size={18}/></button>
        <div className="connected-location"><strong><MapPin size={17}/>{online?'Sharing location with dispatch':'Location required to go online'}</strong><small>{demo?'Demo mode never requests your real location.':'Shares GPS only with authorized dispatch in your organization while this app is visible. Going offline, switching workspaces, or hiding the app stops sharing.'}</small></div>
        <button className="ud-secondary" disabled={busy||location.starting||(!demo&&!orgId)} onClick={toggleOnline}>{online?'Stop sharing & go offline':demo?'Go online in demo':'Share location & go online'}</button>
        {!demo&&map()}
      </>}
      {tab==='jobs'&&(active?<><button className="ud-back" onClick={()=>setActiveId('')}><ArrowLeft size={16}/> All jobs</button><div className="ud-job-heading"><span className="ud-eyebrow">{titleService}</span><h1>{active.reference}</h1><span className="ud-chip">{pretty(active.status)}</span></div>{map()}<section className="ud-job-sheet"><h2>{demo?active.destination:active.dropoff_address}</h2><p><MapPin size={15}/> From {demo?active.pickup:active.pickup_address}</p>{demo&&<div className="ud-estimate"><span>Sample estimated pay<strong>{money(active.estimated_cents)}</strong></span><small>No payout is processed</small></div>}<p className="ud-detail">{demo?active.detail:active.commodity}</p>
        {!demo&&<><p className="ud-muted">{active.customer_name} · {active.estimated_miles??'—'} estimated miles</p><a className="ud-secondary" href={'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(active.status==='offered'||active.status==='accepted'?active.pickup_address:active.dropoff_address)} target="_blank" rel="noreferrer"><Navigation size={16}/> Open navigation</a></>}
        {(demo?NEXT_ACTION[active.status]:active.status==='offered'?'Accept assignment':NEXT_LIVE_ACTION[active.status]?.[1])&&<button className="ud-primary" disabled={busy||(!demo&&active.status==='offered'&&!online)} onClick={()=>progress(active)}>{busy?'Saving…':demo?NEXT_ACTION[active.status]:active.status==='offered'?'Accept assignment':NEXT_LIVE_ACTION[active.status][1]}</button>}
        {!demo&&active.status==='offered'&&<button className="ud-secondary" disabled={busy} onClick={()=>progress(active,true)}>Decline offer</button>}
        {((demo&&active.status==='completed')||(!demo&&active.status==='delivered'))&&<p className="ud-complete"><Check size={20}/>{demo?'Test job complete':'Delivery confirmed'}</p>}
        {!demo&&active.status==='in_transit'&&<p className="connected-muted">Proof of delivery is required to finish. Open the existing driver workspace for package scans and POD; completion is never inferred from arrival.</p>}
        <button className="ud-secondary" onClick={()=>setTab('messages')}><MessageCircle size={16}/> Message dispatch</button>
      </section></>:<><p className="ud-eyebrow">YOUR ASSIGNMENTS</p><h1>{demo?'Test jobs':'My jobs'}</h1><input className="connected-field" aria-label="Search jobs" placeholder="Search reference or address" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="Filter jobs by service" className="ud-filter" value={serviceId} onChange={e=>setServiceId(e.target.value)}><option value="all">All services</option>{DRIVER_SERVICES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select><div className="connected-tab-row">{['active','history','all'].map(value=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{value==='active'?'Active':value==='history'?'History':'All jobs'}</button>)}</div>{visible.length?visible.map(job=><button className="ud-job-card" key={job.id} onClick={()=>openJob(job)}><div><span className="ud-chip">{pretty(job.status)}</span><h2>{job.reference}</h2><p>{demo?job.pickup:job.pickup_address}</p><p>→ {demo?job.destination:job.dropoff_address}</p>{demo&&<strong>{money(job.estimated_cents)} <small>sample estimate</small></strong>}</div><ArrowRight size={20}/></button>):<p className="ud-empty">No matching assignments. Check the queue or select another service.</p>}</>)}
      {tab==='queue'&&<><p className="ud-eyebrow">SHARED FIFO DISPATCH</p><h1>Driver queue</h1><label className="ud-org">Requested service<select value={queueService} onChange={e=>setServiceId(e.target.value)}>{DRIVER_SERVICES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label><QueueView queue={queue} userId={demo?'demo-user':user} onJoin={joinQueue} onCancel={leaveQueue} busy={busy} canJoin={canJoin} reason={queueReason} demo={demo}/></>}
      {tab==='earnings'&&<><p className="ud-eyebrow">WORK & SETTLEMENTS</p><h1>{demo?'Earnings preview':'Earnings'}</h1><div className="ud-summary"><div><span>{demo?'Sample value of completed test jobs':'Completed tasks'}</span><strong>{demo?money(complete.reduce((sum,j)=>sum+j.estimated_cents,0)):complete.length}</strong></div><Wallet size={27}/></div><p className="ud-muted">{demo?'Illustrative estimates only. No funds, tips, settlements, or payouts are connected.':'Payroll and settlements are not connected. Amounts will appear after dispatch connects a verified earnings source.'}</p>{complete.map(j=><button key={j.id} className="ud-job-card" onClick={()=>openJob(j)}>{j.reference}<strong>{demo?money(j.estimated_cents):'Delivered'}</strong></button>)}</>}
      <div hidden={tab!=='messages'}><p className="ud-eyebrow">TWO-WAY COMMUNICATION</p><h1>Messages</h1><Messenger key={orgId+':'+user+':'+demo} client={supabase} organizationId={orgId} driverUserId={demo?'demo-user':user} currentUserId={demo?'demo-user':user} demo={demo} active={tab==='messages'}/></div>
      {tab==='account'&&<><p className="ud-eyebrow">DRIVER ACCOUNT</p><h1>{demo?'Ivan Anderson':profile?.display_name||'Driver'}</h1><div className="ud-summary"><div><span>Workspace</span><strong>{demo?'Visual demo':'Andertrack Staging'}</strong></div><ShieldCheck/></div><p className="ud-muted">{demo?'Sample account':session?.user?.email}</p><h2>Service access</h2><div>{DRIVER_SERVICES.map(s=><span key={s.id} className="connected-chip">{s.label} · {demo?'Sample':approvals.includes(s.id)?'Approved':'Review required'}</span>)}</div><h2>Location & privacy</h2><p className="ud-muted">{online?'Sharing is active. Dispatch can see your latest position.':'Sharing is off. Go online from Home to enable dispatch tracking.'} Drivers cannot see other drivers’ GPS coordinates. Tracking expires after 60 seconds without a fresh update.</p><button className="ud-secondary" disabled={!online||busy} onClick={toggleOnline}>Stop location sharing</button>{!demo&&<><p className="ud-muted">License: Class {profile?.license_class||'—'} · {profile?.license_verified?'Verified':'Verification required'}</p><button className="ud-secondary" disabled={busy} onClick={()=>run(async()=>{await location.stop();const {error:e}=await supabase.auth.signOut({scope:'local'});if(e)throw e;})}><LogOut size={18}/> Sign out</button></>}<a className="ud-secondary" href="/">Existing driver controls & proof of delivery</a></>}
    </div><nav className="ud-nav" aria-label="Driver navigation">{tabs.map(item=>{const Icon=item.icon;return <button key={item.id} aria-current={tab===item.id?'page':undefined} onClick={()=>{setTab(item.id);setActiveId('');setNotice('');}}><Icon size={20}/><span>{item.label}</span></button>;})}</nav></>}
    {session&&!demo&&orgId&&<button className="ud-refresh" disabled={busy||live.loading} onClick={()=>run(live.refresh)}><RefreshCw size={13}/>{live.loading?'Refreshing…':'Refresh dispatch data'}</button>}
  </main><p className="ud-footnote">ANDERTRACK · UNIVERSAL LOGISTICS OS · DRIVER PREVIEW</p></div>;
}
