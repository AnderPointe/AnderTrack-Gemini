import { createClient } from '@supabase/supabase-js';

const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured=Boolean(url && /^https:\/\//.test(url) &&
  key && !key.includes('replace_with_') && !url.includes('YOUR-STAGING-PROJECT'));

// Do not use service_role or secret keys in this public web app.
export const supabase=configured?createClient(url,key,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},
}):null;
