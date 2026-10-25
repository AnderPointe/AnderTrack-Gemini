import React, { useEffect, useRef, useState } from 'react';
import { Truck, Package, CarFront, UtensilsCrossed, Trash2, Home, BriefcaseBusiness, Wallet, MessageCircle, UserRound, ArrowLeft, ArrowRight, MapPin, Check, LogOut, RefreshCw, Navigation, ShieldCheck } from 'lucide-react';
import { supabase, configured as supabaseConfigured } from '../supabase.js';
import { DRIVER_SERVICES, NEXT_ACTION, STATE_LABEL, money, nextJobState, sampleJobs } from './logic.js';
import './universal-driver.css';

const icons = { truck: Truck, package: Package, van: Truck, food: UtensilsCrossed, car: CarFront, trash: Trash2 };
const tabs = [{ id: 'home', label: 'Home', icon: Home }, { id: 'jobs', label: 'Jobs', icon: BriefcaseBusiness }, { id: 'earnings', label: 'Earnings', icon: Wallet }, { id: 'messages', label: 'Messages', icon: MessageCircle }, { id: 'account', label: 'Account', icon: UserRound }];

function Brand() { return <a className="ud-brand" href="/universal"><span aria-hidden="true"><b>A</b><i>T</i></span><div>ANDERTRACK<small>UNIVERSAL DRIVER APP</small></div></a>; }
function RoutePreview({ service }) {
  return <div className="ud-map" aria-label="Illustrative route, not live GPS">
    <svg viewBox="0 0 420 220" role="img" aria-label="Sample route illustration">
      <defs><pattern id="ud-streets" width="46" height="38" patternTransform="rotate(-18)" patternUnits="userSpaceOnUse"><path d="M 0 0 H 46 V 38 H 0 Z" fill="none" stroke="#333" strokeWidth="2"/><path d="M 23 0 V 38" stroke="#222"/></pattern></defs>
      <rect width="420" height="220" fill="#111716"/><rect width="420" height="220" fill="url(#ud-streets)"/>
      <path d="M54 168 L104 168 L104 110 L230 110 L230 63 L357 63" fill="none" stroke="#16b5ab" strokeWidth="6" strokeLinejoin="round"/>
      <circle cx="54" cy="168" r="9" fill="#14b8ad" stroke="white" strokeWidth="3"/><circle cx="357" cy="63" r="10" fill="#ff8a18" stroke="white" strokeWidth="3"/>
      <rect x="207" y="99" width="34" height="23" rx="5" fill="#ff8a18"/><circle cx="214" cy="123" r="4" fill="white"/><circle cx="235" cy="123" r="4" fill="white"/>
      <text x="25" y="198" fill="white" fontSize="12">Pickup</text><text x="312" y="40" fill="white" fontSize="12">Destination</text>
    </svg><span className="ud-map-note">{service.division} · Sample route</span>
  </div>;
}

export default function UniversalDriver() {
  const [demo, setDemo] = useState(new URLSearchParams(window.location.search).get('demo') === '1');
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('home'); const [serviceId, setServiceId] = useState('otr');
  const [online, setOnline] = useState(false); const [profiles, setProfiles] = useState([]);
  const [orgId, setOrgId] = useState(''); const [jobs, setJobs] = useState([]); const [activeId, setActiveId] = useState('');
  const scope = useRef(0);
  const liveAllowed = supabaseConfigured && import.meta.env.VITE_DRIVER_TEST_WORKSPACE === 'true' && import.meta.env.VITE_SUPABASE_URL === 'https://ofyfausfhinwgrfmapgc.supabase.co';
  const service = DRIVER_SERVICES.find(item => item.id === serviceId) || DRIVER_SERVICES[1];
  const active = jobs.find(job => job.id === activeId);
  const profile = profiles.find(item => item.organization_id === orgId);

  useEffect(() => {
    if (demo) { setJobs(sampleJobs()); setReady(true); return; }
    if (!liveAllowed) { setReady(true); return; }
    let mounted = true;
    supabase.auth.getSession().then(({ data, error: e }) => { if (mounted) { setSession(data?.session || null); setReady(true); if (e) setError(e.message); } }).catch(e => { if (mounted) { setError(e.message); setReady(true); } });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { if (mounted) { scope.current++; setSession(next); setProfiles([]); setOrgId(''); setJobs([]); setActiveId(''); setOnline(false); } });
    return () => { mounted = false; scope.current++; data.subscription.unsubscribe(); };
  }, [demo, liveAllowed]);

  useEffect(() => {
    if (demo || !session || !liveAllowed) return;
    let mounted = true;
    supabase.from('at_driver_profiles').select('organization_id,display_name').eq('user_id', session.user.id).then(({ data, error: e }) => {
      if (!mounted) return;
      if (e) setError(e.message); else { setProfiles(data || []); setOrgId(data?.[0]?.organization_id || ''); }
    }).catch(e => { if (mounted) setError(e.message); });
    return () => { mounted = false; };
  }, [demo, session, liveAllowed]);

  async function loadWorkspace() {
    if (!orgId || !session || demo) return;
    const generation = ++scope.current;
    const results = await Promise.all([
      supabase.from('at_driver_test_preferences').select('service_id,online').eq('organization_id', orgId).eq('user_id', session.user.id).maybeSingle(),
      supabase.from('at_driver_test_jobs').select('*').eq('organization_id', orgId).eq('driver_user_id', session.user.id).order('reference'),
    ]);
    if (scope.current !== generation) return;
    const e = results.find(result => result.error)?.error;
    if (e) throw e;
    setJobs(results[1].data || []);
    if (results[0].data) { setServiceId(results[0].data.service_id); setOnline(results[0].data.online); }
  }
  useEffect(() => { loadWorkspace().catch(e => setError(e.message)); return () => { scope.current++; }; }, [orgId, session?.user?.id, demo]);

  async function run(action) { setBusy(true); setError(''); setNotice(''); try { await action(); } catch (e) { setError(e.message || 'Unable to save. Please retry.'); } finally { setBusy(false); } }
  async function signIn(event) {
    event.preventDefault();
    await run(async () => { const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (e) throw e; setPassword(''); });
  }
  async function saveAvailability(nextOnline) {
    if (demo) { setOnline(nextOnline); setNotice('Preview only — nothing saved.'); return; }
    await run(async () => {
      const { error: e } = await supabase.from('at_driver_test_preferences').upsert({ organization_id: orgId, user_id: session.user.id, service_id: serviceId, online: nextOnline }, { onConflict: 'organization_id,user_id' });
      if (e) throw e; setOnline(nextOnline); setNotice('Test availability saved. This does not enable live dispatch.');
    });
  }
  async function advance(job) {
    await run(async () => {
      const status = nextJobState(job.status); if (!status) return;
      if (demo) { setJobs(previous => previous.map(item => item.id === job.id ? { ...item, status, revision: item.revision + 1 } : item)); return; }
      const { data, error: e } = await supabase.from('at_driver_test_jobs').update({ status }).eq('id', job.id).eq('revision', job.revision).select().maybeSingle();
      if (e) throw e;
      if (!data) { await loadWorkspace(); throw new Error('This job changed in another session. Review its latest status and retry.'); }
      setJobs(previous => previous.map(item => item.id === data.id ? data : item)); setNotice('Test progress saved.');
    });
  }
  function openJob(job) { setServiceId(job.service_id); setActiveId(job.id); setTab('jobs'); setNotice(''); }
  const filtered = jobs.filter(job => job.service_id === serviceId);
  const completed = jobs.filter(job => job.status === 'completed');

  return <div className="ud-page"><div className="ud-desktop-head"><Brand/><a href="/">Operations workspace <ArrowRight size={16}/></a></div>
    <main className="ud-app">
      <header className="ud-top"><Brand/><span className="ud-env">{demo ? 'VISUAL DEMO' : 'STAGING TEST'}</span></header>
      <div className="ud-banner">{demo ? 'Sample data · Changes stay in this preview' : 'Test workspace · No live bookings or payments'}</div>
      {error && <p className="ud-feedback ud-error" role="alert">{error}</p>}{notice && <p className="ud-feedback" role="status">{notice}</p>}
      {!ready ? <p className="ud-empty">Checking session…</p> : !demo && !session ? <section className="ud-login"><ShieldCheck size={36}/><h1>Your work.<br/>One driver app.</h1><p>Freight, delivery, rides, and collection services in one workspace.</p>
        {liveAllowed ? <form onSubmit={signIn}><label>Email<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required/></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required/></label><button className="ud-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in to staging'}</button><small>Use an existing staging driver account. Contact your administrator for account access or password recovery.</small></form> : <p>Database testing is available only on the configured staging preview.</p>}
        <button className="ud-secondary" onClick={() => { setDemo(true); setError(''); }}>Explore visual demo</button>
      </section> : <>
        <div className="ud-content">
          {!demo && profiles.length > 1 && <label className="ud-org">Workspace<select value={orgId} onChange={e => { setOrgId(e.target.value); setActiveId(''); setJobs([]); setOnline(false); }}>{profiles.map(p => <option key={p.organization_id} value={p.organization_id}>{p.display_name} · {p.organization_id.slice(0, 8)}</option>)}</select></label>}
          {!demo && !orgId && <p className="ud-empty">A staging driver profile is required. Ask your administrator to assign one to your account.</p>}
          {tab === 'home' && <><div className="ud-greeting"><div><p className="ud-eyebrow">DRIVER WORKSPACE</p><h1>Hello, {demo ? 'Ivan' : profile?.display_name || 'driver'}</h1><p>Choose your service</p></div><button className={'ud-toggle ' + (online ? 'on' : '')} aria-pressed={online} aria-label="Test availability" disabled={busy || (!demo && !orgId)} onClick={() => saveAvailability(!online)}><span/>{online ? 'Online' : 'Offline'}</button></div>
            <div className="ud-services">{DRIVER_SERVICES.map(item => { const Icon = icons[item.icon]; return <button key={item.id} className={'ud-service ' + (serviceId === item.id ? 'selected' : '')} aria-pressed={serviceId === item.id} onClick={() => setServiceId(item.id)}><Icon size={30}/><strong>{item.label}</strong><small>{item.subtitle}</small><ArrowRight size={16} className="ud-card-arrow"/></button>; })}</div>
            <div className="ud-summary"><div><span>Test work completed</span><strong>{completed.length} / {jobs.length} jobs</strong></div><Check size={28}/></div>
            <button className="ud-primary" onClick={() => { setActiveId(''); setTab('jobs'); }}>View {service.label} jobs <ArrowRight size={18}/></button>
          </>}
          {tab === 'jobs' && (active ? <><button className="ud-back" onClick={() => setActiveId('')}><ArrowLeft size={16}/> All jobs</button><div className="ud-job-heading"><span className="ud-eyebrow">{service.label}</span><h1>{active.reference}</h1><span className="ud-chip">{STATE_LABEL[active.status]}</span></div><RoutePreview service={service}/><section className="ud-job-sheet"><h2>{active.destination}</h2><p><MapPin size={15}/> From {active.pickup}</p><div className="ud-estimate"><span>Sample estimated pay<strong>{money(active.estimated_cents)}</strong></span><small>No payout is processed</small></div><p className="ud-detail">{active.detail}</p><div className="ud-progress">{['accepted', 'at_pickup', 'in_transit', 'completed'].map((state, index) => <div key={state} className={['offered', 'accepted', 'at_pickup', 'in_transit', 'completed'].indexOf(active.status) > index ? 'done' : ''}><span>{index + 1}</span><small>{['Accept', 'Pickup', 'Transit', 'Done'][index]}</small></div>)}</div>{NEXT_ACTION[active.status] ? <button className="ud-primary" disabled={busy} onClick={() => advance(active)}>{busy ? 'Saving…' : NEXT_ACTION[active.status]}</button> : <p className="ud-complete"><Check size={20}/> Test job complete</p>}<p className="ud-muted"><Navigation size={14}/> Route illustration only. Live navigation and GPS are not connected.</p></section></> : <><p className="ud-eyebrow">YOUR ASSIGNMENTS</p><h1>Test jobs</h1><select aria-label="Filter jobs by service" className="ud-filter" value={serviceId} onChange={e => setServiceId(e.target.value)}>{DRIVER_SERVICES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>{filtered.length ? filtered.map(job => <button className="ud-job-card" key={job.id} onClick={() => openJob(job)}><div><span className="ud-chip">{STATE_LABEL[job.status]}</span><h2>{job.reference}</h2><p>{job.pickup}</p><p>→ {job.destination}</p><strong>{money(job.estimated_cents)} <small>sample estimate</small></strong></div><ArrowRight size={20}/></button>) : <p className="ud-empty">No test jobs assigned for this service.</p>}</>)}
          {tab === 'earnings' && <><p className="ud-eyebrow">TEST ACTIVITY</p><h1>Earnings preview</h1><div className="ud-summary"><div><span>Sample value of completed test jobs</span><strong>{money(completed.reduce((sum, job) => sum + job.estimated_cents, 0))}</strong></div><Wallet size={28}/></div><p className="ud-muted">Illustrative estimates only. No funds, tips, settlements, or payouts are connected.</p>{completed.map(job => <button key={job.id} className="ud-job-card" onClick={() => openJob(job)}>{job.reference}<strong>{money(job.estimated_cents)}</strong></button>)}</>}
          {tab === 'messages' && <><p className="ud-eyebrow">DISPATCH CONNECTION</p><h1>Messages</h1><div className="ud-empty"><MessageCircle size={40}/><h2>Messaging is next</h2><p>Dispatcher and customer conversations will appear here once the messaging integration is connected.</p></div></>}
          {tab === 'account' && <><p className="ud-eyebrow">DRIVER ACCOUNT</p><h1>{demo ? 'Ivan Anderson' : profile?.display_name || 'Driver'}</h1><div className="ud-summary"><div><span>Workspace</span><strong>{demo ? 'Visual demo' : 'Andertrack Staging'}</strong></div><ShieldCheck/></div><p className="ud-muted">Service selection does not grant operating approval. Real service eligibility, vehicle checks, HOS/ELD, and payment integrations remain separate.</p>{!demo && <button className="ud-secondary" disabled={busy} onClick={() => run(async () => { const { error: e } = await supabase.auth.signOut({ scope: 'local' }); if (e) throw e; })}><LogOut size={18}/> Sign out</button>}<a className="ud-secondary" href="/">Open existing operations workspace</a></>}
        </div><nav className="ud-nav" aria-label="Driver navigation">{tabs.map(item => { const Icon = item.icon; return <button key={item.id} aria-current={tab === item.id ? 'page' : undefined} onClick={() => { setTab(item.id); setActiveId(''); setNotice(''); }}><Icon size={21}/><span>{item.label}</span></button>; })}</nav>
      </>}
      {session && !demo && orgId && <button className="ud-refresh" disabled={busy} onClick={() => run(loadWorkspace)}><RefreshCw size={13}/> Refresh staging data</button>}
    </main><p className="ud-footnote">ANDERTRACK · UNIVERSAL LOGISTICS OS · DRIVER PREVIEW</p>
  </div>;
}
