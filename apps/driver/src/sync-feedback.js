/** Pure readiness labels; never infer a successful subscription from network online alone. */
export const DRIVER_POLL_MS=30_000;
export const DRIVER_REFRESH_DEBOUNCE_MS=450;
export function normalizeRealtimeStatus(status){
  if(status==='SUBSCRIBED')return 'connected';
  if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED')return 'degraded';
  return 'connecting';
}
export function describeDriverSync(status,online){
  if(!online)return {level:'offline',label:'Offline — cached state only'};
  if(status==='connected')return {level:'live',label:'Realtime listening'};
  if(status==='degraded')return {level:'degraded',label:'Realtime interrupted · 30s refresh fallback'};
  if(status==='connecting')return {level:'pending',label:'Connecting to Realtime'};
  return {level:'pending',label:'Awaiting connection'};
}
