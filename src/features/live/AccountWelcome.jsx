import React,{useEffect,useRef,useState} from 'react';
import {supabase} from '../../lib/supabase.js';
import {signupDetails} from './auth-model.js';
import './auth-experience.css';

export default function AccountWelcome({session,onDemo,onSignOut,onWorkspace}){
  const user=session.user,identity=useRef(user.id);identity.current=user.id;
  const [account,setAccount]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loadError,setLoadError]=useState(false);
  const [name,setName]=useState(''),[kind,setKind]=useState('individual'),[company,setCompany]=useState('');
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true;setLoading(true);setAccount(null);setError('');setLoadError(false);
    setName(user.user_metadata?.display_name||user.user_metadata?.full_name||'');setKind(user.user_metadata?.account_kind==='company'?'company':'individual');setCompany(user.user_metadata?.company_name||'');
    supabase.from('at_platform_accounts').select('user_id,display_name,account_kind,company_name,organization_id').eq('user_id',user.id).maybeSingle().then(({data,error:e})=>{if(!active)return;if(e){setLoadError(true);setError('Account setup could not be loaded. Please retry.');}else setAccount(data);setLoading(false);}).catch(()=>{if(active){setLoadError(true);setError('Account setup could not be loaded. Please retry.');setLoading(false);}});
    return()=>{active=false;};
  },[user.id,retry]);
  async function save(e){e.preventDefault();if(busy)return;const scope=user.id;setBusy(true);setError('');
    try{const details=signupDetails({name,kind,company});const {data,error:e}=await supabase.rpc('at_complete_platform_signup',{p_display_name:details.display_name,p_account_kind:details.account_kind,p_company_name:details.company_name});if(e)throw e;if(scope!==identity.current)return;setAccount(data);if(data.organization_id)await onWorkspace();}
    catch(e){if(scope===identity.current)setError(e.message||'Account setup could not be completed.');}finally{if(scope===identity.current)setBusy(false);}
  }
  async function openWorkspace(){setBusy(true);setError('');try{await onWorkspace();}catch(e){setError(e.message||'Workspace could not be opened.');}finally{setBusy(false);}}
  return <div className="at-welcome"><header><a className="at-auth-brand" href="/website"><strong>ANDER<em>TRACK</em></strong></a><button className="at-auth-preview-button" style={{width:'auto',padding:'0 18px'}} onClick={onSignOut}>Sign out</button></header><main>
    <p className="at-auth-overline">YOUR ANDERTRACK ACCOUNT</p><h1>{account?`Welcome, ${account.display_name}.`:'Let’s set up your account.'}</h1><p>Signed in as {user.email}. Your company’s dispatch, drivers and locations stay inside its own workspace.</p>
    {loading?<p role="status">Loading account…</p>:loadError?<><p className="at-auth-error" role="alert">{error}</p><button className="at-auth-preview-button" onClick={()=>setRetry(value=>value+1)}>Retry account setup</button>{!name&&<p>Confirm your email before setting up your account.</p>}</>:account?<>
      {error&&<p className="at-auth-error" role="alert">{error}</p>}
      <section className="at-auth-form-wrap"><h2>{account.account_kind==='company'?account.company_name:'Individual account ready'}</h2><p>{account.organization_id?'Your new company workspace is ready. It starts empty, with you as its administrator. Existing companies and their records stay separate.':'Your account is ready. You can explore the platform now. To work with an existing company, ask its administrator to add this email. Driver access requires a separate profile and qualification review.'}</p><div className="at-welcome-actions">{account.organization_id&&<button disabled={busy} onClick={openWorkspace}>Open company workspace</button>}<button onClick={onDemo}>Explore the demo</button><a href="/hub">Request & track services</a><a href="/website">Visit website</a></div></section>
    </>:<form className="at-auth-form at-auth-form-wrap" onSubmit={save}><h2>Choose your account</h2>{error&&<p className="at-auth-error" role="alert">{error}</p>}<fieldset className="at-account-type"><legend>Account type</legend><label><input type="radio" name="onboarding-kind" checked={kind==='individual'} onChange={()=>setKind('individual')} disabled={busy}/> Individual</label><label><input type="radio" name="onboarding-kind" checked={kind==='company'} onChange={()=>setKind('company')} disabled={busy}/> Company</label></fieldset><label htmlFor="welcome-name">Your name</label><input id="welcome-name" autoComplete="name" value={name} onChange={e=>setName(e.target.value)} required minLength={2} maxLength={120} disabled={busy}/>{kind==='company'&&<><label htmlFor="welcome-company">Company name</label><input id="welcome-company" autoComplete="organization" value={company} onChange={e=>setCompany(e.target.value)} required minLength={2} maxLength={160} disabled={busy}/><p>This creates a new, separate company workspace. To join an existing company, use Individual and ask its administrator for access.</p></>}<button className="at-auth-submit" disabled={busy}>{busy?'Saving…':kind==='company'?'Create my company workspace':'Finish account setup'}</button></form>}
  </main></div>;
}
