/* =============================================
   BASTIÓN — Service Worker v1.0
   PWA offline cache + Push notifications
============================================= */

const CACHE_NAME = 'bastion-v1-naranja-musgo';
const PRECACHE = [
  './',
  './index.html',
  './mapa.html',
  './dashboard.html',
  './registro.html'
];

/* ── Instalación: precachear páginas principales ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(PRECACHE.filter(Boolean)))
      .then(() => self.skipWaiting())
  );
});

/* ── Activación: limpiar caches viejos ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: network-first, fallback a cache ── */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

/* ── Push: mostrar notificación de promo cercana ── */
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  const title   = data.title   || '¡Bastión — Promo cerca de ti!';
  const body    = data.body    || 'Hay una promoción activa a menos de 300 m.';
  const icon    = data.icon    || './icon-192.png';
  const tag     = data.tag     || 'bastion-promo';
  const url     = data.url     || './index.html';

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: icon,
      tag,
      renotify: true,
      vibrate: [120, 60, 120],
      data: { url }
    })
  );
});

/* ── Clic en notificación: abrir la app ── */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './index.html';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('index.html') && 'focus' in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});

/* ── Mensaje desde la app: notificación local de proximidad ── */
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'PROMO_CERCA') {
    self.registration.showNotification(`¡Bastión · ${e.data.negocio}!`, {
      body: e.data.promo + ' — A solo ' + e.data.dist,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: 'bastion-geo-' + e.data.id,
      renotify: false,
      vibrate: [100, 50, 100],
      data: { url: './index.html' }
    });
  }
});
