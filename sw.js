/* Dino Egg Pop — service worker.
   Strategy:
   - same-origin HTML/JS/CSS → network-first (always get the latest code when
     online; fall back to cache offline). This is what makes deploys reach
     players without a hard refresh.
   - images → cache-first (immutable-ish, fast, offline).
   - cross-origin (CDN) → cache-first with opaque fallback.
   Bump VERSION on each release to purge old caches. */
const VERSION = 'v7';
const CACHE = `dino-${VERSION}`;

const CORE = [
  './',
  './index.html',
  './style.css',
  './src/main.js',
  './manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith('dino-') && k !== CACHE).map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin && /\.(png|jpe?g|webp|gif|svg|ico)$/i.test(url.pathname)) {
    e.respondWith(cacheFirst(req));
  } else if (sameOrigin) {
    e.respondWith(networkFirst(req));
  } else {
    e.respondWith(cacheFirst(req));
  }
});

async function cacheFirst(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
    return res;
  } catch (err) {
    return hit || Response.error();
  }
}

async function networkFirst(req) {
  const c = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) c.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = (await c.match(req)) || (await c.match('./index.html'));
    return hit || Response.error();
  }
}
