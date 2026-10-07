// Minimal service worker: makes the app installable. Network-first, no data caching
// (salary data must never be served stale or stored by the worker).
const SHELL = 'nnmkp-shell-v1';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(['./', 'index.html', 'config.js', 'manifest.webmanifest'])).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // Supabase, fonts, CDN: straight to network
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone();
    caches.open(SHELL).then(c => c.put(e.request, copy)).catch(() => {});
    return r;
  }).catch(() => caches.match(e.request).then(m => m || caches.match('./'))));
});
