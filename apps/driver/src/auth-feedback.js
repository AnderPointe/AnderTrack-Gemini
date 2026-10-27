// Device-side UX protection, not a replacement for server-side Supabase Auth limits.
// Do not store email addresses, magic links, session tokens or secrets here.
export const AUTH_COOLDOWN_STORAGE_KEY='andertrack-driver-auth-retry-after-v1';
export const AUTH_SEND_COOLDOWN_MS=60_000;
export const AUTH_RATE_LIMIT_BACKOFF_MS=60*60*1000;

export function rateLimitReached(error){
  const code=String(error?.code||'').toLowerCase();
  const message=String(error?.message||'').toLowerCase();
  return Number(error?.status)===429 ||
    code==='over_email_send_rate_limit' ||
    code==='over_request_rate_limit' ||
    (/rate limit/.test(message)&&/email|otp|magic link|sending/.test(message));
}
export function remainingCooldownSeconds(retryAt,now=Date.now()){
  if(!Number.isFinite(retryAt)||!Number.isFinite(now))return 0;
  return Math.max(0,Math.ceil((retryAt-now)/1000));
}
export function formatCooldownSeconds(seconds){
  if(!Number.isFinite(seconds)||seconds<=0)return '0s';
  const n=Math.ceil(seconds);
  return n>=60 ? Math.ceil(n/60)+'m' : n+'s';
}
export function readCooldownUntil(storage=typeof window!=='undefined'?window.localStorage:null,now=Date.now()){
  try{
    const n=Number(storage?.getItem(AUTH_COOLDOWN_STORAGE_KEY));
    // Discard implausible timestamps, including stale or corrupted local values.
    return Number.isFinite(n)&&n>now&&n<=now+AUTH_RATE_LIMIT_BACKOFF_MS? n:0;
  }catch{return 0;}
}
export function saveCooldownUntil(value,storage=typeof window!=='undefined'?window.localStorage:null){
  try{storage?.setItem(AUTH_COOLDOWN_STORAGE_KEY,String(value));return true;}
  catch{return false;}
}
