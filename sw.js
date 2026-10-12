/* Ojas offline support: keeps the app files on the phone so it opens without internet.
   Bump CACHE when you upload new files so phones pick up the update. */
const CACHE = 'ojas-v1.1.0';
const FILES = ['./','./index.html','./app.js','./data-food.js','./data-exercise.js','./data-media.js','./frames/coaches/riya.jpg','./frames/coaches/kabir.jpg','./frames/coaches/anaya.jpg','./frames/coaches/vikram.jpg','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // network first for app files (so updates arrive), fall back to cache offline
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return r; }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
  } else if (url.hostname.includes('fonts.g') || url.hostname === 'raw.githubusercontent.com') {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })));
  }
});
