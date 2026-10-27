// Public client configuration must never accept a privileged server credential.
// This is a fail-closed runtime guard, not a substitute for keeping secrets out of builds.
export function publicSupabaseConfig(url, key) {
  if (typeof url !== 'string' || typeof key !== 'string') return false;
  try {
    const endpoint = new URL(url);
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || !['','/'].includes(endpoint.pathname)) return false;
    if (endpoint.hostname.includes('YOUR-STAGING-PROJECT') || key.includes('replace_with_')) return false;
    if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) return false;
    const encoded = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(encoded)).role === 'anon';
  } catch { return false; }
}
