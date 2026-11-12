const CACHE='framelab-r11-v01-18-portrait';const FILES=['./','./index.html','./style.css','./context-ui.js','./task-board.js','./image-layout.js','./context-ui.css?v=portrait-1','./app.js','./interactions.js','./ps-system.js','./pikado-host.js',...Array.from({length:8},(_,i)=>`./assets/photo-${i}.jpg`)];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('framelab-r11-v01-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method==='GET'&&new URL(e.request.url).origin===location.origin)e.respondWith(fetch(e.request).then(response=>{if(response.ok){let copy=response.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)))}return response}).catch(()=>caches.match(e.request)))});



