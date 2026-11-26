/* Pandora HostBook service worker: keeps the app shell on the phone so it opens without internet.
   The host's records are cached by the app itself (localStorage); API calls always go to the network. */
const CACHE = "hostbook-v1";
const SHELL = ["/hostbook/app", "/hostbook-icon.svg", "/hostbook.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => null));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("hostbook-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  // The app page: network first, fall back to the saved copy when offline.
  if (req.mode === "navigate" && url.pathname.startsWith("/hostbook/app")) {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("/hostbook/app", copy)); return res; }).catch(() => caches.match("/hostbook/app")));
    return;
  }
  // Built files never change at the same address, so the saved copy is always right.
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })));
  }
});
