import {useCallback,useEffect,useRef,useState} from 'react';
import {locationPayload} from './operations.js';

export function useDriverLocation(api,org,user,enabled){
  const [sharing,setSharing]=useState(false),[starting,setStarting]=useState(false),[error,setError]=useState(''),[position,setPosition]=useState(null);
  const watcher=useRef(null),timer=useRef(null),token=useRef(null),generation=useRef(0),lastSend=useRef(0),inflight=useRef(false),pending=useRef(null);
  const stop=useCallback(async()=>{
    generation.current++;if(pending.current){pending.current(new Error('Location sharing stopped.'));pending.current=null;}if(watcher.current!==null)navigator.geolocation?.clearWatch(watcher.current);watcher.current=null;clearInterval(timer.current);timer.current=null;
    const previous=token.current;token.current=null;inflight.current=false;setSharing(false);setStarting(false);setPosition(null);
    if(previous&&org&&enabled){try{await api.rpc('at_set_driver_online',{p_organization_id:org,p_online:false,p_session_id:previous});}catch(e){setError(`Sharing stopped on this device. Server status will expire after 60 seconds. ${e.message}`);}}
  },[api,org,enabled]);
  useEffect(()=>{
    const hidden=()=>{if(document.visibilityState==='hidden')void stop();};
    const offline=()=>{void stop();setError('Connection lost. Go online again after reconnecting.');};
    const leave=()=>{void stop();};
    document.addEventListener('visibilitychange',hidden);window.addEventListener('offline',offline);window.addEventListener('pagehide',leave);
    return()=>{document.removeEventListener('visibilitychange',hidden);window.removeEventListener('offline',offline);window.removeEventListener('pagehide',leave);void stop();};
  },[stop,user]);
  const start=useCallback(async()=>{
    if(!enabled||!org||!user)throw new Error('Sign in to a staging driver workspace first.');
    if(!navigator.geolocation)throw new Error('This device does not support location sharing.');
    if(!navigator.onLine)throw new Error('An internet connection is required.');
    await stop();setError('');setStarting(true);const scope=++generation.current;
    let sessionToken;
    try{sessionToken=await api.rpc('at_begin_driver_tracking',{p_organization_id:org});}
    catch(e){setStarting(false);setError(e.message);throw e;}
    if(scope!==generation.current)return;token.current=sessionToken;
    try{await api.rpc('at_consent_customer_tracking',{p_organization_id:org,p_session_id:sessionToken});}catch(e){await stop();setError(e.message);throw e;}
    if(scope!==generation.current)return;
    return new Promise((resolve,reject)=>{
      pending.current=reject;
      let began=false,settled=false;
      const fail=async(e)=>{if(scope!==generation.current)return;const message=e?.code===1?'Location access was denied. Enable it in your browser settings to go online.':e?.message||'Unable to obtain a fresh location.';setError(message);pending.current=null;await stop();if(!settled){settled=true;reject(new Error(message));}};
      const fix=async(p)=>{
        if(scope!==generation.current||inflight.current||(began&&Date.now()-lastSend.current<10000))return;
        inflight.current=true;
        try{
          const values=locationPayload(p,org,sessionToken);await api.rpc('at_publish_driver_location',values);
          if(scope!==generation.current)return;
          if(!began){await api.rpc('at_set_driver_online',{p_organization_id:org,p_online:true,p_session_id:sessionToken});began=true;}
          if(scope!==generation.current)return;lastSend.current=Date.now();setPosition({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,last_ping_at:new Date().toISOString()});setSharing(true);setStarting(false);setError('');if(!settled){settled=true;pending.current=null;resolve();}
        }catch(e){await fail(e);}finally{if(scope===generation.current)inflight.current=false;}
      };
      const options={enableHighAccuracy:true,maximumAge:0,timeout:20000};
      watcher.current=navigator.geolocation.watchPosition(fix,fail,options);
      timer.current=setInterval(()=>{if(scope===generation.current&&document.visibilityState==='visible')navigator.geolocation.getCurrentPosition(fix,fail,options);},20000);
    });
  },[api,org,user,enabled,stop]);
  return {sharing,starting,error,position,start,stop};
}
