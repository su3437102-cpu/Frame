const CACHE='framelab-r11-workspace-6';const FILES=['./','./index.html','./style.css','./assets/fonts/latin.css','./assets/fonts/geist-latin.woff2','./assets/fonts/hedvig-letters-serif-latin.woff2','./grade-workbench.css','./context-ui.js','./task-board.js','./image-layout.js','./context-ui.css?v=portrait-1','./device-store.js','./app.js','./ai-color.js','./ai-browser.js','./interactions.js','./ps-system.js','./pikado-host.js',...Array.from({length:8},(_,i)=>`./assets/photo-${i}.jpg`)];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('framelab-r11-v01-')||k.startsWith('framelab-r11-ai-web-')||k.startsWith('framelab-r11-workspace-'))&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method==='GET'&&new URL(e.request.url).origin===location.origin)e.respondWith(fetch(e.request).then(response=>{if(response.ok){let copy=response.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)))}return response}).catch(()=>caches.match(e.request)))});



