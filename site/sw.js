/* Trusted Marble Garden application-shell cache, not an untrusted bundle viewer. */
const CACHE='marblebench-ios-shell-0.2.0';const ASSETS=['./','./index.html','./main.js'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('marblebench-ios-shell-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()]))});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const u=new URL(event.request.url);if(u.origin!==self.location.origin||!u.pathname.startsWith(new URL('./',self.location.href).pathname))return;
 event.respondWith(fetch(event.request).then(response=>{if(response.ok&&response.type==='basic'){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)))}return response}).catch(()=>caches.match(event.request).then(r=>r||new Response('Offline resource unavailable',{status:503}))))});
