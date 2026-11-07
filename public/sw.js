const cacheName='show-up-shell-9';
const shell=['/','/style.css','/workspace.css','/app.js','/motion.js','/experience.js','/sculpture.js','/experience.css','/data.js','/cloud.js','/config.js','/icon.svg','/horizon.svg','/manifest.webmanifest','/icon-192.png','/icon-512.png','/icon-maskable.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(shell)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('show-up-shell-')&&key!==cacheName).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request, url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==location.origin||!shell.includes(url.pathname)) return;
  event.respondWith(fetch(request).then(response=>{
    if(response.ok && !url.search) {
      const copy=response.clone();
      event.waitUntil(caches.open(cacheName).then(cache=>cache.put(url.pathname,copy)).catch(()=>{}));
    }
    return response;
  }).catch(()=>caches.match(url.pathname)));
});
