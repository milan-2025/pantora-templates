/* Offline support and notifications for the workout app (/workout). Built into public/workout-sw.js by
 * `npm run build-workout`, served from the site root so it may control /workout itself.
 * - The app page: network first (so updates arrive), the saved copy when there is no connection.
 * - Its icons, fonts and files: from the cache, refreshed in the background.
 * - /api/*: never cached here. The app keeps its own copy of your log and syncs when back online.
 * - Pushes carry no data: the worker asks /api/workout/inbox what's new and shows it. */
const VERSION = 'df318bbb55e0';
const CACHE = 'wk-' + VERSION;
const PAGE = '/workout';
const PAGES = ['/workout', '/workout/', '/workout/signup', '/workout/login'];
const SHELL = [PAGE, '/workout/manifest.webmanifest', '/workout/icon-192.png', '/workout/icon-512.png'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.indexOf('wk-') === 0 && k !== CACHE && k !== 'wk-auth').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
const timeout = (ms) => new Promise((_, bad) => setTimeout(() => bad(new Error('timeout')), ms));
async function page(req) {
  const c = await caches.open(CACHE);
  try {
    const res = await Promise.race([fetch(req), timeout(4000)]);
    if (res && res.ok) c.put(PAGE, res.clone());
    return res;
  } catch (err) {
    return (await c.match(PAGE)) || new Response('<h1>You are offline</h1><p>Open the app once with internet, and it will work offline after that.</p>', { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });
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
    if ((url.pathname.indexOf('/workout/') === 0 && /\.(js|png|jpg|jpeg|webp|svg|webmanifest|css)$/.test(url.pathname)) || url.pathname === '/planner/xlsx.mini.min.js') e.respondWith(asset(req));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') e.respondWith(asset(req));
});

/* ----- notifications ----- */
async function whatsNew() {
  try {
    const c = await caches.open('wk-auth'); const t = await c.match('/__wk_token'); const token = t ? await t.text() : '';
    if (!token) return null;
    const since = new Date(Date.now() - 15 * 60000).toISOString();
    const res = await fetch('/api/workout/inbox?since=' + encodeURIComponent(since), { headers: { authorization: 'Bearer ' + token } });
    if (!res.ok) return null;
    const d = await res.json();
    return d.items && d.items[0] ? d.items[0] : null;
  } catch (e) { return null; }
}
self.addEventListener('push', (e) => {
  e.waitUntil(whatsNew().then((m) => {
    const alert = m && m.kind === 'alert';
    const title = alert ? '🔥 Streak at risk' : m ? `${m.from} ${m.kind === 'nudge' ? 'nudged you 👉' : m.kind === 'event' ? '' : m.kind === 'voice' ? 'sent a voice note 🎤' : 'says'}`.trim() : 'Time to move 💪';
    const body = alert ? m.text.replace(/^🔥 /, '') : m && m.kind === 'voice' ? 'Tap to listen' : m ? m.text : 'Your streak is waiting. Today’s workout takes about 15 minutes.';
    const hash = alert ? 'today' : m ? (m.group === 'family' ? 'together/family' : 'together/inbox') : 'today';
    return self.registration.showNotification(title, { body, icon: '/workout/icon-192.png', badge: '/workout/icon-192.png', tag: alert ? 'wk-streak' : m ? 'wk-msg' : 'wk-reminder', renotify: true, data: { hash } });
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const hash = (e.notification.data && e.notification.data.hash) || 'today';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const open = list.find((w) => new URL(w.url).pathname.indexOf('/workout') === 0);
    if (open) { open.postMessage({ type: 'open', hash }); return open.focus(); }
    return self.clients.openWindow('/workout#' + hash);
  }));
});
