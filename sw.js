const CACHE_NAME = 'checklist-v2-v1';
const urlsToCache = [
  './', './index.html', './master.js', './master_con.js', 
  './manifest.json', './icon-192.png', './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(urlsToCache)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Never cache Firebase, Leaflet tiles, or auth requests
  if (e.request.url.includes('firebase') || 
      e.request.url.includes('googleapis') ||
      e.request.url.includes('arcgisonline') ||
      e.request.url.includes('gstatic')) return;
  
  // Network first, fallback to cache (always get latest version)
  e.respondWith(
    fetch(e.request).then(r => {
      if (r && r.status === 200) {
        const clone = r.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      }
      return r;
    }).catch(() => caches.match(e.request))
  );
});
