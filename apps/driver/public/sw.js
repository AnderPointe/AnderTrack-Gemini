const CACHE='andertrack-driver-shell-v1';
const CORE=['/','/manifest.webmanifest','/icon.svg'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE&&key.startsWith('andertrack-driver-')).map(key=>caches.delete(key)))));
  self.clients.claim();
});
// Only cache same-origin GET assets, never Supabase responses or auth redirects.
self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||url.search) return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).catch(()=>caches.match('/')));
    return;
  }
  if(!url.pathname.startsWith('/assets/')&&!CORE.includes(url.pathname))return;
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    if(response.ok) {
      const copy=response.clone();
      event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));
    }
    return response;
  })));
});
