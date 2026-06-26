/* Lectio service worker — app-shell + font caching, plus the bundled public-domain Bible
   text (KJV/GNT/LXX) for full offline use. ESV text is never cached here (capped at 500
   verses in localStorage by the app, per its terms). */
const CACHE = 'lectio-shell-v31';
// Bundled scripture text (data/<dir>/<id>.json) lives in its own cache so a shell-version
// bump never forces an 11MB re-download; bump DATA_CACHE only when the bundled text changes.
const DATA_CACHE = 'lectio-data-v1';
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
  e.waitUntil((async () => {
    const keys = await caches.keys();
    // Keep the current shell cache AND the bundled-text cache; drop everything older.
    await Promise.all(keys.filter((k) => k !== CACHE && k !== DATA_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
    // Then fill the offline scripture cache in the background (waitUntil keeps the worker
    // alive to finish, but the page is already controlled so the update reload isn't blocked).
    await primeData();
  })());
});

// Background-prefetch every bundled book so passages work offline even if never opened.
// Resilient: each file is added independently (allSettled) so one miss never aborts the
// rest, and already-cached files are skipped — so re-activation after a shell bump is cheap.
async function primeData() {
  try {
    const res = await fetch('data/manifest.json');
    if (!res || !res.ok) return;
    const m = await res.json();
    if (!m || !m.versions) return;
    const c = await caches.open(DATA_CACHE);
    await c.put('data/manifest.json', new Response(JSON.stringify(m), { headers: { 'Content-Type': 'application/json' } }));
    const urls = [];
    Object.keys(m.versions).forEach((k) => {
      const v = m.versions[k];
      (v.books || []).forEach((id) => urls.push('data/' + v.dir + '/' + id + '.json'));
    });
    await Promise.allSettled(urls.map(async (u) => {
      if (await c.match(u)) return;
      const r = await fetch(u);
      if (r && r.ok) await c.put(u, r);
    }));
  } catch (e) { /* offline or partial — fetch handler still caches books lazily on demand */ }
}

self.addEventListener('message', (e) => {
  if (e.data === 'clear-cache') {
    // Clears the localStorage-mirrored API cache only — leave the bundled offline text intact.
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== DATA_CACHE).map((k) => caches.delete(k))));
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

  // Bundled scripture data (data/**.json): cache-first from the persistent data cache so it
  // works offline; populate on first hit for books the background prime hasn't reached yet.
  if (url.origin === self.location.origin && url.pathname.indexOf('/data/') !== -1) {
    e.respondWith(
      caches.open(DATA_CACHE).then((c) => c.match(e.request).then((hit) =>
        hit || fetch(e.request).then((resp) => {
          if (resp && resp.status === 200) c.put(e.request, resp.clone()).catch(() => {});
          return resp;
        }).catch(() => hit)
      ))
    );
    return;
  }

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
