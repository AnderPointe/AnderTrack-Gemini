import { createClient } from '@supabase/supabase-js';
import { publicSupabaseConfig } from './security/public-config.js';

const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured=publicSupabaseConfig(url,key);

// Do not use service_role or secret keys in this public web app.
export const supabase=configured?createClient(url,key,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},
}):null;
