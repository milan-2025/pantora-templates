/* Offline support for the wedding planner (/planner). Built into public/planner/sw.js by `npm run build-planner`.
 * - The planner page: network first (so updates arrive), the saved copy when there is no connection.
 * - Its own files, icons and fonts: served from the cache, refreshed in the background.
 * - /api/*: never cached here. The app keeps its own copy of the planner and syncs when back online. */
const VERSION = '429458bf3887';
const CACHE = 'pp-' + VERSION;
const PAGE = '/planner';
const PAGES = ['/planner', '/planner/', '/planner/signup', '/planner/login'];
const SHELL = [PAGE, '/planner/xlsx.mini.min.js', '/planner/manifest.webmanifest', '/planner/icon-192.png', '/planner/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.indexOf('pp-') === 0 && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const timeout = (ms) => new Promise((_, bad) => setTimeout(() => bad(new Error('timeout')), ms));

async function page(req) {
  const c = await caches.open(CACHE);
  try {
    // Weak signal at the venue: wait a few seconds, then use the saved copy.
    const res = await Promise.race([fetch(req), timeout(4000)]);
    if (res && res.ok) c.put(PAGE, res.clone());
    return res;
  } catch (err) {
    return (await c.match(PAGE)) || new Response('<h1>You are offline</h1><p>Open the planner once with internet, and it will work offline after that.</p>', { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
}

async function asset(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  const fresh = fetch(req).then((res) => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await fresh) || Response.error();
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.indexOf('/api/') === 0) return;
    if (req.mode === 'navigate' && PAGES.indexOf(url.pathname) >= 0) { e.respondWith(page(req)); return; }
    if (url.pathname.indexOf('/planner/') === 0 && /\.(js|png|jpg|jpeg|webp|svg|webmanifest|css)$/.test(url.pathname) && url.pathname !== '/planner/sw.js') e.respondWith(asset(req));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') e.respondWith(asset(req));
});
