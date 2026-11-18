/*
 * Stays admin service worker (scope: /stays/admin only, so guests' devices never get one).
 * - The admin page shell and Next.js static files are cached so the app opens without internet.
 * - API responses are NEVER cached here: private data only lives in memory while online.
 * - Photos saved for offline use are served from the "stays-offline-img" cache.
 * - Background sync: when connectivity returns, open admin tabs are asked to send queued edits.
 */
const SHELL = "stays-shell-v1";
const STATIC = "stays-static-v1";
const IMG = "stays-offline-img";

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title>
<style>body{font-family:system-ui,sans-serif;background:#fbf5ea;color:#3b1f4a;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center}a{color:#1f7a74}</style></head>
<body><div><h1>You're offline</h1><p>Open the stays dashboard once while online on this device, and it will work offline after that.</p><p><a href="/stays/admin">Try again</a></p></div></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("stays-") && ![SHELL, STATIC, IMG].includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never touch API calls (private data) — straight to the network.
  if (url.origin === location.origin && url.pathname.startsWith("/api/")) return;

  // The dashboard page itself: network first, fall back to the last good copy.
  if (req.mode === "navigate" && url.origin === location.origin && url.pathname.startsWith("/stays/admin")) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok && !res.redirected) (await caches.open(SHELL)).put("/stays/admin", res.clone());
        return res;
      } catch {
        return (await (await caches.open(SHELL)).match("/stays/admin")) || new Response(OFFLINE_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
      }
    })());
    return;
  }

  // Versioned Next.js files never change: cache first.
  if (url.origin === location.origin && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/stays/icon"))) {
    e.respondWith((async () => {
      const c = await caches.open(STATIC);
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    })());
    return;
  }

  // Photos saved for offline use.
  if (url.hostname === "res.cloudinary.com") {
    e.respondWith((async () => {
      const hit = await (await caches.open(IMG)).match(req.url);
      if (hit) return hit;
      try { return await fetch(req); } catch { return new Response("", { status: 504 }); }
    })());
  }
});

self.addEventListener("sync", (e) => {
  if (e.tag !== "stays-sync") return;
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: "window" });
    for (const c of list) c.postMessage({ type: "stays-sync" });
  })());
});
