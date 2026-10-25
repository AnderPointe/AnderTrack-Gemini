import React,{useEffect,useId,useMemo,useRef,useState} from 'react';
import {MessageCircle,Send,RefreshCw,ArrowDown} from 'lucide-react';
import {CONNECTED_STAGING,createOperations} from './operations.js';
import {connectionLabel,draftAfterSend,mergeMessages} from './message-state.js';
import './connected.css';

export default function Messenger({client,organizationId,driverUserId,currentUserId,title='Dispatch messages',demo=false,active=true}){
  const api=useMemo(()=>createOperations(client),[client]);
  const [messages,setMessages]=useState([]),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false);
  const [sendError,setSendError]=useState(''),[syncError,setSyncError]=useState(''),[loading,setLoading]=useState(false);
  const [online,setOnline]=useState(()=>navigator.onLine),[subscribed,setSubscribed]=useState(false),[newBelow,setNewBelow]=useState(false);
  const fieldId=useId(),log=useRef(null),nearBottom=useRef(true),refreshRef=useRef(null),sending=useRef(null);
  const scope=`${organizationId}:${driverUserId}:${currentUserId}:${demo}`;
  const identity=useRef(scope);identity.current=scope;
  const generation=useRef(0),retry=useRef(null);
  const ready=Boolean(CONNECTED_STAGING&&client&&organizationId&&driverUserId&&currentUserId);
  const sync=connectionLabel({demo,ready,online,subscribed,failed:Boolean(syncError)});
  useEffect(()=>{
    const connected=()=>setOnline(true),disconnected=()=>{setOnline(false);setSubscribed(false);};
    window.addEventListener('online',connected);window.addEventListener('offline',disconnected);
    return()=>{window.removeEventListener('online',connected);window.removeEventListener('offline',disconnected);};
  },[]);
  useEffect(()=>{
    setMessages(demo?[{id:'sample',body:'Welcome to the messaging preview. Live conversations require a staging sign-in.',sender_user_id:'dispatch',created_at:new Date().toISOString()}]:[]);
    setDraft('');setSendError('');setSyncError('');setBusy(false);setLoading(false);setSubscribed(false);setNewBelow(false);
    nearBottom.current=true;retry.current=null;sending.current=null;generation.current++;
    if(demo||!ready)return;
    let active=true,timer;const thread=scope;
    async function refresh(){
      if(!navigator.onLine||!active)return;
      const request=++generation.current;setLoading(true);
      try{const rows=await api.messages(organizationId,driverUserId);if(active&&thread===identity.current&&request===generation.current){setMessages(previous=>mergeMessages(previous,rows));setSyncError('');}}
      catch(e){if(active&&thread===identity.current&&request===generation.current)setSyncError(e.message||'Messages could not be refreshed.');}
      finally{if(active&&thread===identity.current&&request===generation.current)setLoading(false);}
    }
    const reload=()=>{clearTimeout(timer);timer=setTimeout(refresh,100);};refreshRef.current=refresh;refresh();
    const channel=client.channel(`messages:${organizationId}:${driverUserId}:${crypto.randomUUID()}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'at_dispatch_messages',filter:`driver_user_id=eq.${driverUserId}`},reload).subscribe(status=>{if(active&&thread===identity.current){setSubscribed(status==='SUBSCRIBED');if(status==='SUBSCRIBED')reload();}});
    const poll=setInterval(()=>{if(document.visibilityState==='visible')refresh();},5000);
    window.addEventListener('online',reload);document.addEventListener('visibilitychange',reload);
    return()=>{active=false;generation.current++;refreshRef.current=null;clearTimeout(timer);clearInterval(poll);window.removeEventListener('online',reload);document.removeEventListener('visibilitychange',reload);client.removeChannel(channel);};
  },[api,client,organizationId,driverUserId,currentUserId,demo,ready,scope]);
  const lastMessage=messages.at(-1)?.id;
  useEffect(()=>{if(nearBottom.current&&log.current){log.current.scrollTop=log.current.scrollHeight;setNewBelow(false);}else if(lastMessage)setNewBelow(true);},[lastMessage,active]);
  function jumpToLatest(){if(log.current){log.current.scrollTop=log.current.scrollHeight;nearBottom.current=true;setNewBelow(false);}}
  async function send(e){
    e.preventDefault();if(sending.current||!draft.trim()||(!demo&&(!ready||!navigator.onLine)))return;
    const thread=identity.current,submitted=draft,text=draft.trim(),attempt=Symbol();
    sending.current=attempt;setBusy(true);setSendError('');
    const nonce=retry.current?.body===text?retry.current.nonce:crypto.randomUUID();retry.current={body:text,nonce};
    try{const row=demo?{id:nonce,body:text,sender_user_id:currentUserId,created_at:new Date().toISOString()}:await api.send(organizationId,driverUserId,text,nonce);
      if(thread!==identity.current)return;
      nearBottom.current=true;setMessages(previous=>mergeMessages(previous,[row]));setDraft(current=>draftAfterSend(current,submitted));retry.current=null;
    }catch(e){if(thread===identity.current)setSendError(e.message||'Message could not be sent.');}
    finally{if(sending.current===attempt){sending.current=null;setBusy(false);}}
  }
  return <section className="connected-messenger" aria-label={title}><header><div><MessageCircle size={19}/><h2>{title}</h2></div><small role="status">{sync}</small></header>
    <p className="connected-muted">{demo?'Demo messages stay in this tab.':'Private driver ↔ dispatch thread. Latest 100 messages; server acknowledgement does not mean the recipient has read them.'}</p>
    {syncError&&<p className="connected-error" role="alert">Messages may be out of date. {syncError}</p>}
    {sendError&&<p className="connected-error" role="alert">{sendError} Your draft is kept. Use Send to retry.</p>}
    {!demo&&ready&&<button className="connected-quiet" type="button" disabled={loading||!online} onClick={()=>refreshRef.current?.()}><RefreshCw size={14}/>{loading?'Refreshing messages…':'Refresh messages'}</button>}
    <div ref={log} className="connected-messages" role="log" aria-label="Conversation messages" aria-live="polite" aria-relevant="additions" tabIndex={0} onScroll={e=>{const el=e.currentTarget;nearBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<70;if(nearBottom.current)setNewBelow(false);}}>
      {!messages.length?<p className="connected-muted">{loading?'Loading conversation…':!demo&&!ready?'Choose a driver conversation to begin.':'No messages yet. Start a conversation.'}</p>:messages.map(m=><article key={m.id} className={m.sender_user_id===currentUserId?'mine':''}><small>{m.sender_user_id===currentUserId?'You':m.sender_user_id===driverUserId?'Driver':'Dispatch'}</small><p>{m.body}</p><time dateTime={m.created_at}>{new Date(m.created_at).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time>{m.sender_user_id===currentUserId&&<small className="connected-ack">{demo?'Demo only':'Saved to server'}</small>}</article>)}
    </div>
    {newBelow&&<button className="connected-quiet" type="button" onClick={jumpToLatest}><ArrowDown size={14}/> New messages · jump to latest</button>}
    <form onSubmit={send}><label htmlFor={fieldId}>Message</label><textarea id={fieldId} value={draft} onChange={e=>setDraft(e.target.value)} maxLength={2000} rows={3} placeholder={currentUserId===driverUserId?'Message dispatch…':'Message driver…'} disabled={!demo&&!ready}/><div><small>{draft.length}/2000</small><button disabled={busy||!draft.trim()||(!demo&&(!ready||!online))}>{busy?<RefreshCw size={17}/>:<Send size={17}/>} {busy?'Sending…':sendError?'Retry send':'Send'}</button></div></form>
  </section>;
}
