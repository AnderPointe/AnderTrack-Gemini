import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {CONNECTED_STAGING,createOperations} from './operations.js';

export function useOperations(client,org,user,isPlanner=false,enabled=true){
  const api=useMemo(()=>createOperations(client),[client]);
  const [state,setState]=useState({assignments:[],queue:[],locations:[],access:[],drivers:[]});
  const [error,setError]=useState('');const [sync,setSync]=useState('Disconnected');const [loading,setLoading]=useState(false);
  const version=useRef(0);const identity=useRef('');
  identity.current=`${org}:${user}:${isPlanner}:${enabled}`;
  const refresh=useCallback(async()=>{
    if(!CONNECTED_STAGING||!enabled||!client||!org||!user)return;
    const scope=identity.current,generation=++version.current;setLoading(true);
    try{const next=await api.snapshot(org,user,isPlanner);if(generation===version.current&&scope===identity.current){setState(next);setError('');}}
    catch(e){if(generation===version.current&&scope===identity.current)setError(e.message);}
    finally{if(generation===version.current&&scope===identity.current)setLoading(false);}
  },[api,client,org,user,isPlanner,enabled]);
  useEffect(()=>{
    version.current++;setState({assignments:[],queue:[],locations:[],access:[],drivers:[]});setError('');
    if(!CONNECTED_STAGING||!enabled||!client||!org||!user){setSync('Disconnected');return;}
    let active=true,timer;refresh();
    const changed=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(active)refresh();},200);};
    const channel=client.channel(`connected:${org}:${user}:${crypto.randomUUID()}`);
    for(const table of ['at_assignments','at_dispatch_requests','at_live_driver_locations','at_driver_service_access','at_driver_profiles'])channel.on('postgres_changes',{event:'*',schema:'public',table,filter:`organization_id=eq.${org}`},changed);
    channel.subscribe(status=>{if(active){setSync(status==='SUBSCRIBED'?'Realtime connected':'Refreshing every 5 seconds');if(status==='SUBSCRIBED')changed();}});
    const poll=setInterval(()=>{if(document.visibilityState==='visible')refresh();},5000);
    window.addEventListener('online',changed);document.addEventListener('visibilitychange',changed);
    return()=>{active=false;version.current++;clearTimeout(timer);clearInterval(poll);window.removeEventListener('online',changed);document.removeEventListener('visibilitychange',changed);client.removeChannel(channel);};
  },[client,org,user,enabled,refresh]);
  return {...state,error,sync,loading,refresh,api};
}
