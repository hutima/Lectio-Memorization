/* Lectio service worker — app-shell + font caching. Scripture text is cached in localStorage by the app (ESV capped at 500 verses per terms), never here. */
const CACHE = 'lectio-shell-v5';
const ASSETS = [
  './',
  './index.html',
  './Lectio.dc.html',
  './manifest.json',
  './support.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png'
];

self.addEventListener('install', (e) => {
  // No skipWaiting() here: a new worker stays in "waiting" so the app can show its
  // "update available" prompt and activate on the user's command (see 'skip-waiting').
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'clear-cache') {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  } else if (e.data === 'skip-waiting') {
    // The app's update prompt was accepted: activate now and take over (clients.claim
    // in 'activate' fires controllerchange, which the app uses to reload once).
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Never intercept Bible text services — always live so usage/terms are honored and text stays fresh.
  if (url.hostname.includes('api.esv.org') || url.hostname.includes('bible-api.com') || url.hostname.includes('bolls.life')) return;

  // Same-origin app shell (HTML / support.js / manifest / icons): network-first so code updates always land,
  // falling back to cache when offline.
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request).then((resp) => {
        if (resp && resp.status === 200) {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy).catch(() => {}));
        }
        return resp;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cross-origin (Google Fonts): cache-first, refresh in background.
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const net = fetch(e.request).then((resp) => {
        if (resp && resp.status === 200) {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy).catch(() => {}));
        }
        return resp;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
