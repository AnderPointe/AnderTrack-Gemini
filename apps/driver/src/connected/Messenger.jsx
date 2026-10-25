import React,{useEffect,useMemo,useRef,useState} from 'react';
import {MessageCircle,Send,RefreshCw} from 'lucide-react';
import {CONNECTED_STAGING,createOperations} from './operations.js';
import './connected.css';

export default function Messenger({client,organizationId,driverUserId,currentUserId,title='Dispatch messages',demo=false}){
  const api=useMemo(()=>createOperations(client),[client]);
  const [messages,setMessages]=useState([]),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sync,setSync]=useState('Connecting');
  const identity=useRef('');identity.current=`${organizationId}:${driverUserId}:${currentUserId}:${demo}`;const generation=useRef(0),retry=useRef(null);
  useEffect(()=>{
    setMessages(demo?[{id:'sample',body:'Welcome to the messaging preview. Live conversations require a staging sign-in.',sender_user_id:'dispatch',created_at:new Date().toISOString()}]:[]);setDraft('');setError('');retry.current=null;generation.current++;
    if(demo||!CONNECTED_STAGING||!client||!organizationId||!driverUserId||!currentUserId)return;
    let active=true,timer;const scope=identity.current;
    async function refresh(){const request=++generation.current;try{const rows=await api.messages(organizationId,driverUserId);if(active&&scope===identity.current&&request===generation.current){setMessages(rows);setError('');}}catch(e){if(active&&scope===identity.current)setError(e.message);}}
    const reload=()=>{clearTimeout(timer);timer=setTimeout(refresh,100);};refresh();
    const channel=client.channel(`messages:${organizationId}:${driverUserId}:${crypto.randomUUID()}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'at_dispatch_messages',filter:`driver_user_id=eq.${driverUserId}`},reload).subscribe(status=>{if(active){setSync(status==='SUBSCRIBED'?'Connected':'Refreshing every 5 seconds');if(status==='SUBSCRIBED')reload();}});
    const poll=setInterval(()=>{if(document.visibilityState==='visible')refresh();},5000);window.addEventListener('online',reload);
    return()=>{active=false;generation.current++;clearTimeout(timer);clearInterval(poll);window.removeEventListener('online',reload);client.removeChannel(channel);};
  },[api,client,organizationId,driverUserId,currentUserId,demo]);
  async function send(e){e.preventDefault();if(busy||!draft.trim())return;const scope=identity.current,text=draft.trim();setBusy(true);setError('');
    const nonce=retry.current?.body===text?retry.current.nonce:crypto.randomUUID();retry.current={body:text,nonce};
    try{if(demo){setMessages(previous=>[...previous,{id:nonce,body:text,sender_user_id:currentUserId,created_at:new Date().toISOString()}]);setDraft('');return;}
      const row=await api.send(organizationId,driverUserId,text,nonce);if(scope!==identity.current)return;generation.current++;setMessages(previous=>previous.some(m=>m.id===row.id)?previous:[...previous,row]);setDraft('');retry.current=null;
    }catch(e){if(scope===identity.current)setError(e.message);}finally{setBusy(false);}
  }
  return <section className="connected-messenger" aria-label={title}><header><div><MessageCircle size={19}/><h2>{title}</h2></div><small>{demo?'Local demo':sync}</small></header>
    <p className="connected-muted">{demo?'Demo messages stay in this tab.':'Private driver ↔ dispatch thread. Showing the latest 100 messages.'}</p>
    {error&&<p className="connected-error" role="alert">{error} Your draft is kept for retry.</p>}
    <div className="connected-messages" role="log" aria-live="polite" aria-relevant="additions">{!messages.length?<p className="connected-muted">No messages yet. Start a conversation with dispatch.</p>:messages.map(m=><article key={m.id} className={m.sender_user_id===currentUserId?'mine':''}><small>{m.sender_user_id===currentUserId?'You':m.sender_user_id===driverUserId?'Driver':'Dispatch'}</small><p>{m.body}</p><time dateTime={m.created_at}>{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</time></article>)}</div>
    <form onSubmit={send}><label htmlFor="dispatch-message">Message</label><textarea id="dispatch-message" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={2000} rows={3} placeholder={currentUserId===driverUserId?'Message dispatch…':'Message driver…'} disabled={!demo&&(!driverUserId||!CONNECTED_STAGING)}/><div><small>{draft.length}/2000</small><button disabled={busy||!draft.trim()||(!demo&&(!driverUserId||!CONNECTED_STAGING))}>{busy?<RefreshCw size={17}/>:<Send size={17}/>} {busy?'Sending…':'Send'}</button></div></form>
  </section>;
}
