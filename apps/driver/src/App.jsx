import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {
  Activity,ArrowRight,CheckCircle2,ChevronDown,Clock3,Compass,ExternalLink,
  LockKeyhole,LogOut,MapPin,Navigation,Package,RefreshCw,Route,ShieldCheck,
  Truck,UserRound,Wifi,WifiOff,XCircle,
} from 'lucide-react';
import {supabase,configured} from './supabase.js';
import {
  assignmentsForDriver,classifyLegacyAssignment,driverAssignmentAction,
  externalRouteUrl,formatAssignmentStatus,groupDriverAssignments,validLocalPosition,
} from './driver-logic.js';

const TABS=[
  {id:'offers',label:'Offers'},
  {id:'active',label:'In progress'},
  {id:'history',label:'History'},
];

function PageShell({children,user,onSignOut,online}) {
  return <div className="driver-shell">
    <header className="driver-topbar">
      <div className="driver-brand"><span className="driver-logo"><Route size={23}/></span>
        <div><strong>ANDER<span>TRACK</span></strong><small>DRIVER WORKSPACE</small></div>
      </div>
      <div className="driver-topbar-end">
        <span className={'driver-connect '+(online?'online':'offline')}>
          {online?<Wifi size={14}/>:<WifiOff size={14}/>}
          <span>{online?'Online':'Offline'}</span>
        </span>
        {user&&<button type="button" className="driver-icon-button" aria-label="Sign out" title="Sign out" onClick={onSignOut}><LogOut size={19}/></button>}
      </div>
    </header>
    <main className="driver-main">{children}</main>
    <footer className="driver-footer">ANDERTRACK OS · Secure driver access · Some services are still in development</footer>
  </div>;
}

function Login({onLogin,loading,message}) {
  const [email,setEmail]=useState('');
  return <section className="driver-auth">
    <div className="driver-auth-icon"><ShieldCheck size={31}/></div>
    <span className="driver-eyebrow">AUTHORIZED DRIVER LOGIN</span>
    <h1>Your next assignment starts here.</h1>
    <p>Sign in using your approved AnderTrack email. Dispatch assignments will appear only after your account is linked to a driver organization.</p>
    <form onSubmit={e=>{e.preventDefault();onLogin(email);}}>
      <label htmlFor="driver-email">Work email</label>
      <input id="driver-email" type="email" placeholder="driver@company.com"
        value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/>
      <button disabled={loading} className="driver-primary" type="submit">
        {loading?<RefreshCw className="spin" size={18}/>:<ArrowRight size={18}/>}
        Send sign-in link
      </button>
      {message&&<p className="driver-form-message" role="status">{message}</p>}
    </form>
  </section>;
}

function DriverOrderCard({job,userId,verified,perform,busy}) {
  const act=driverAssignmentAction(job,userId,verified);
  const directions=externalRouteUrl(job);
  const offered=job.status==='offered';
  return <article className={'driver-job-card '+(offered?'driver-job-offer':'')}>
    <div className="driver-job-heading">
      <div><span className="driver-eyebrow">{classifyLegacyAssignment(job)}</span>
        <h3>{job.reference||job.id.slice(0,8)}</h3>
      </div>
      <span className={'driver-status status-'+job.status}>{formatAssignmentStatus(job.status)}</span>
    </div>
    <div className="driver-trip">
      <div className="driver-trip-step"><span className="driver-dot start"/>
        <div><small>PICKUP</small><strong>{job.pickup_address||'Address unavailable'}</strong></div>
      </div>
      <div className="driver-trip-separator"/>
      <div className="driver-trip-step"><span className="driver-dot end"/>
        <div><small>DROP OFF</small><strong>{job.dropoff_address||'Address unavailable'}</strong></div>
      </div>
    </div>
    <div className="driver-job-tags">
      <span><Package size={14}/>{job.commodity||'Load details unavailable'}</span>
      {Number.isFinite(Number(job.estimated_miles)) && job.estimated_miles!=null &&
        <span><Route size={14}/>{Number(job.estimated_miles).toLocaleString()} estimated mi</span>}
      {job.scheduled_pickup_at&&<span><Clock3 size={14}/>{new Date(job.scheduled_pickup_at).toLocaleString()}</span>}
    </div>
    {job.division==='CDL'&&<p className="driver-safety-note">Consumer maps do not validate truck restrictions, commercial clearance or hazmat routing.</p>}
    <div className="driver-job-actions">
      {act&&<button type="button" className="driver-primary" disabled={busy}
        onClick={()=>perform(job,act.kind,act.next)}>
        {busy?<RefreshCw className="spin" size={16}/>:<CheckCircle2 size={16}/>}
        {act.label}
      </button>}
      {offered&&<button type="button" className="driver-secondary" disabled={busy} onClick={()=>perform(job,'decline')}>
        <XCircle size={16}/> Decline
      </button>}
      {directions&&<a className="driver-secondary" href={directions} rel="noopener noreferrer"
        target="_blank"><Navigation size={16}/> Open map <ExternalLink size={13}/></a>}
    </div>
    {job.status==='in_transit'&&<p className="driver-readonly-note">
      Delivery completion requires the existing protected proof-of-delivery workflow in the main AnderTrack application.
    </p>}
  </article>;
}

function DriverDashboard({user,membership,profile,jobs,loading,error,notice,onRefresh,onAction,actionId,
  onMembershipChange,memberships,location,locating,onLocate}) {
  const [tab,setTab]=useState('offers');
  const grouped=useMemo(()=>groupDriverAssignments(jobs),[jobs]);
  const list=grouped[tab]||[];
  return <div className="driver-dashboard">
    <section className="driver-hero">
      <div><span className="driver-eyebrow"><Activity size={13}/> LIVE DRIVER ACCOUNT</span>
        <h1>Ready for your next route?</h1>
        <p>Welcome back, {profile?.display_name||user.email?.split('@')[0]||'driver'}.
          Your assignments and offers are scoped to your approved company.</p>
      </div>
      <div className="driver-hero-icon"><Truck size={51}/></div>
    </section>
    <div className="driver-context-row">
      <label className="driver-org-select">Organization
        <span className="driver-select-wrap"><select value={membership.organization_id}
          onChange={e=>onMembershipChange(e.target.value)}>
          {memberships.map(m=><option key={m.organization_id} value={m.organization_id}>{m.organization_id.slice(0,8)}… · Driver</option>)}
        </select><ChevronDown size={16}/></span>
      </label>
      <button type="button" className="driver-secondary" onClick={onRefresh} disabled={loading}>
        <RefreshCw size={16} className={loading?'spin':''}/> Refresh
      </button>
    </div>
    <div className="driver-kpi-grid">
      <div className="driver-kpi"><span><Package size={17}/> New offers</span><strong>{grouped.offers.length}</strong></div>
      <div className="driver-kpi"><span><Route size={17}/> Active jobs</span><strong>{grouped.active.length}</strong></div>
      <div className="driver-kpi"><span><ShieldCheck size={17}/> License</span><strong className="driver-kpi-word">{profile?.license_verified?'Verified':'Not verified'}</strong></div>
    </div>
    <section className="driver-section">
      <div className="driver-section-title"><div><span className="driver-eyebrow">DISPATCH CENTER</span><h2>My assignments</h2></div>
        <span className="driver-count">{jobs.length} visible</span>
      </div>
      <div className="driver-tabs" role="tablist" aria-label="Driver assignment categories">
        {TABS.map(t=><button key={t.id} type="button" role="tab"
          aria-selected={tab===t.id} className={tab===t.id?'selected':''}
          onClick={()=>setTab(t.id)}>{t.label} <span>{grouped[t.id].length}</span></button>)}
      </div>
      {error&&<div className="driver-alert" role="alert"><XCircle size={17}/>{error}</div>}
      {notice&&<div className="driver-notice" role="status"><CheckCircle2 size={17}/>{notice}</div>}
      {loading&&!jobs.length?<div className="driver-empty">Loading authorized assignments…</div>:
       list.length===0?<div className="driver-empty">
         <Package size={28}/><strong>No {tab==='offers'?'pending offers':tab==='active'?'active assignments':'past assignments'}</strong>
         <p>Your dispatch team will see new work here after it is assigned to you.</p>
       </div>:
       <div className="driver-jobs">{list.map(job=><DriverOrderCard key={job.id} job={job}
         userId={user.id} verified={profile?.license_verified===true}
         perform={onAction} busy={actionId===job.id}/>)}</div>}
    </section>
    <section className="driver-section driver-location">
      <div><span className="driver-eyebrow">DEVICE LOCATION</span><h2>Your position</h2>
        <p>Location is checked only when you request it. This version does not upload your GPS position to dispatch.</p>
      </div>
      <button className="driver-secondary" type="button" onClick={onLocate} disabled={locating}>
        <MapPin size={17}/>{locating?'Locating…':'Check my location'}
      </button>
      {location&&<div className="driver-coordinate">{location.error?
        <span role="alert">{location.error}</span>:<>
          <Compass size={17}/>{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
          · ±{Math.round(location.accuracy)} m accuracy
        </>}</div>}
    </section>
    <p className="driver-readonly-note">Food delivery, passenger rides and earnings are not yet enabled in this driver app. A service-specific backend and compliance review are required.</p>
  </div>;
}

export default function App(){
  const [user,setUser]=useState(null);
  const [authLoading,setAuthLoading]=useState(true);
  const [busyLogin,setBusyLogin]=useState(false);
  const [loginMessage,setLoginMessage]=useState('');
  const [memberships,setMemberships]=useState([]);
  const [organizationId,setOrganizationId]=useState('');
  const [profile,setProfile]=useState(null);
  const [jobs,setJobs]=useState([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [actionId,setActionId]=useState('');
  const [location,setLocation]=useState(null);
  const [locating,setLocating]=useState(false);
  const [online,setOnline]=useState(typeof navigator==='undefined'||navigator.onLine!==false);
  const requestRef=useRef(0);

  useEffect(()=>{
    const onOnline=()=>setOnline(navigator.onLine);
    window.addEventListener('online',onOnline);
    window.addEventListener('offline',onOnline);
    return ()=>{window.removeEventListener('online',onOnline);window.removeEventListener('offline',onOnline);};
  },[]);

  useEffect(()=>{
    if(!supabase){setAuthLoading(false);return;}
    let live=true;
    supabase.auth.getUser().then(({data})=>{
      if(live){setUser(data.user||null);setAuthLoading(false);}
    }).catch(()=>{if(live)setAuthLoading(false);});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      if(!live)return;
      if(event==='SIGNED_OUT'){setUser(null);setMemberships([]);setOrganizationId('');setJobs([]);setProfile(null);}
      else if(session?.user){setUser(session.user);setAuthLoading(false);}
    });
    return ()=>{live=false;subscription.unsubscribe();};
  },[]);

  useEffect(()=>{
    if(!user||!supabase){setMemberships([]);setOrganizationId('');return;}
    let live=true;
    setError('');
    supabase.from('at_organization_members').select('organization_id,role')
      .eq('user_id',user.id).then(({data,error:err})=>{
        if(!live)return;
        if(err){setError(err.message);setMemberships([]);setOrganizationId('');return;}
        const allowed=(data||[]).filter(x=>x.role==='driver');
        setMemberships(allowed);
        setOrganizationId(current=>allowed.some(m=>m.organization_id===current)?
          current:allowed[0]?.organization_id||'');
      });
    return ()=>{live=false;};
  },[user?.id]);

  const refresh=useCallback(async()=>{
    if(!user?.id||!organizationId||!supabase)return;
    const generation=++requestRef.current;
    setLoading(true);setError('');
    try {
      const [a,p]=await Promise.all([
        supabase.from('at_assignments')
          .select('id,organization_id,reference,division,commodity,pickup_address,dropoff_address,estimated_miles,status,driver_user_id,scheduled_pickup_at,created_at,updated_at')
          .eq('organization_id',organizationId).eq('driver_user_id',user.id)
          .order('created_at',{ascending:false}).limit(100),
        supabase.from('at_driver_profiles')
          .select('user_id,organization_id,display_name,license_class,license_verified,availability')
          .eq('organization_id',organizationId).eq('user_id',user.id).maybeSingle()
      ]);
      if(a.error)throw a.error;
      if(p.error)throw p.error;
      if(generation!==requestRef.current)return;
      setJobs(assignmentsForDriver(a.data||[],organizationId,user.id));
      setProfile(p.data||null);
    } catch(e){
      if(generation===requestRef.current){setError(e?.message||'Could not load driver records');setJobs([]);setProfile(null);}
    } finally {if(generation===requestRef.current)setLoading(false);}
  },[user?.id,organizationId]);

  useEffect(()=>{
    requestRef.current++;
    setJobs([]);setProfile(null);setLocation(null);setNotice('');
    if(!organizationId)return;
    void refresh();
  },[organizationId,refresh]);

  useEffect(()=>{
    if(!supabase||!organizationId||!user?.id)return;
    const channel=supabase.channel('driver-assignments-'+organizationId+'-'+user.id)
      .on('postgres_changes',{event:'*',schema:'public',table:'at_assignments',
        filter:'organization_id=eq.'+organizationId},payload=>{
          // RLS secures row visibility. Always re-query own rows before rendering.
          if(payload)void refresh();
      }).subscribe();
    return ()=>{void supabase.removeChannel(channel);};
  },[organizationId,user?.id,refresh]);

  async function signIn(email){
    if(!supabase)return;
    setBusyLogin(true);setLoginMessage('');
    try {
      const {error:e}=await supabase.auth.signInWithOtp({
        email:email.trim().toLowerCase(),
        options:{emailRedirectTo:window.location.origin,shouldCreateUser:false}
      });
      if(e)throw e;
      setLoginMessage('Check your email for your sign-in link.');
    }catch(e){setLoginMessage(e?.message||'Sign-in unavailable.');}
    finally{setBusyLogin(false);}
  }

  async function action(job,kind,next){
    if(!supabase||!user||job.driver_user_id!==user.id||
      profile?.license_verified!==true)return;
    const operation=kind==='offer'||kind==='decline'?'at_respond_assignment':
      kind==='advance'?'at_advance_assignment':null;
    if(!operation)return;
    setActionId(job.id);setError('');setNotice('');
    try {
      const args=operation==='at_respond_assignment'?
        {p_assignment_id:job.id,p_accept:kind==='offer'}:
        {p_assignment_id:job.id,p_next_status:next};
      const {error:e}=await supabase.rpc(operation,args);
      if(e)throw e;
      setNotice('The server accepted your request. Your assignments are refreshing.');
      await refresh();
    }catch(e){setError(e?.message||'Could not complete the assignment action.');}
    finally{setActionId('');}
  }

  function locate(){
    if(!navigator.geolocation){setLocation({error:'This browser does not support location.'});return;}
    setLocating(true);setLocation(null);
    navigator.geolocation.getCurrentPosition(result=>{
      const p=result.coords;
      if(validLocalPosition(p))setLocation({latitude:p.latitude,longitude:p.longitude,accuracy:p.accuracy});
      else setLocation({error:'Location reading was invalid.'});
      setLocating(false);
    },e=>{setLocation({error:e?.message||'Location permission was not granted.'});setLocating(false);},
    {enableHighAccuracy:true,timeout:15000,maximumAge:10000});
  }

  async function signOut(){
    await supabase?.auth.signOut();
    setUser(null);
    setJobs([]);
  }

  if(!configured)return <PageShell online={online}><div className="driver-access">
    <LockKeyhole size={30}/><h1>Staging connection not configured</h1>
    <p>Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY for a verified staging project in Vercel preview settings. Never use a service-role key.</p>
  </div></PageShell>;
  if(authLoading)return <PageShell online={online}><div className="driver-access">Checking your secure session…</div></PageShell>;
  if(!user)return <PageShell online={online}><Login onLogin={signIn} loading={busyLogin} message={loginMessage}/></PageShell>;
  const selected=memberships.find(m=>m.organization_id===organizationId);
  return <PageShell online={online} user={user} onSignOut={signOut}>
    {!selected?<div className="driver-access"><UserRound size={32}/>
      <h1>Driver access pending</h1>
      <p>Your account must have an approved Driver membership before assignments are visible. Contact your dispatch administrator.</p>
      {error&&<p role="alert">{error}</p>}
      <button className="driver-secondary" type="button" onClick={signOut}>Sign out</button>
    </div>:
      <DriverDashboard user={user} membership={selected} memberships={memberships}
        onMembershipChange={setOrganizationId} profile={profile} jobs={jobs}
        loading={loading} error={error} notice={notice} onRefresh={refresh}
        onAction={action} actionId={actionId} location={location}
        locating={locating} onLocate={locate}/>}
  </PageShell>;
}
