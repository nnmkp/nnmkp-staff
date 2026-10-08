// Minimal service worker: makes the app installable. Network-first, no data caching
// (salary data must never be served stale or stored by the worker).
const SHELL = 'nnmkp-shell-v2';
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

// ---- Web Push: แสดงการแจ้งเตือน + เลขบนไอคอนแอป ----
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data.json(); } catch (_) {}
  const jobs = [self.registration.showNotification(d.title || 'NNMKP Staff', {
    body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: d.tag, data: { tab: d.tab }
  })];
  if (typeof d.badge === 'number' && self.navigator && self.navigator.setAppBadge) {
    jobs.push((d.badge > 0 ? self.navigator.setAppBadge(d.badge) : self.navigator.clearAppBadge()).catch(() => {}));
  }
  e.waitUntil(Promise.all(jobs));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const tab = (e.notification.data || {}).tab || '';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    if (cs.length) { cs[0].postMessage({ tab }); return cs[0].focus(); }
    return self.clients.openWindow('./?tab=' + encodeURIComponent(tab));
  }));
});
