/*
 * Stays host portal offline worker (scope /stays/host only).
 * - The portal page and its Next.js files are kept on the device, so the installed portal opens without internet.
 * - The host's own data (/api/stays/host GETs: profile, properties, one property) is kept from the last time it
 *   loaded and used offline. It's the host's own data on the host's own device; signing out deletes it.
 * - Edits to an existing property made offline are kept (latest version per property) and sent when the
 *   connection is back. Adding a property, photos, submitting for review and profile changes need internet.
 */
const SHELL = "sthost-shell-v1";
const STATIC = "sthost-static-v1";
const DATA = "sthost-data";
const PAGE = "/stays/host";
const API = "/api/stays/host";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.add(PAGE)).catch(() => null).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("sthost-") && ![SHELL, STATIC].includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: { "content-type": "application/json" } });
const timeout = (ms) => new Promise((_, bad) => setTimeout(() => bad(new Error("timeout")), ms));
const action = (url) => url.searchParams.get("a") || "";
const key = (a, id) => `${location.origin}${API}?a=${a}${id ? `&id=${id}` : ""}`;

/* pending edits, kept in the Cache API as one JSON entry: { [propertyId]: payload } */
async function pending() {
  const hit = await (await caches.open(DATA)).match("/__pending");
  return hit ? hit.json() : {};
}
async function setPending(p) {
  await (await caches.open(DATA)).put("/__pending", json(p));
  for (const c of await self.clients.matchAll({ type: "window" })) c.postMessage({ type: "stays-host-pending", count: Object.keys(p).length });
}

let flushing = null;
function flush() {
  if (flushing) return flushing;
  flushing = (async () => {
    const p = await pending();
    for (const [id, body] of Object.entries(p)) {
      let res;
      try { res = await fetch(`${API}?a=property_save`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" }); }
      catch { return; }
      if (res.status === 401) return;
      const left = await pending();
      delete left[id];
      await setPending(left);
      if (res.ok) await (await caches.open(DATA)).put(key("property", id), res.clone());
    }
  })().finally(() => { flushing = null; });
  return flushing;
}

async function read(req, url) {
  const c = await caches.open(DATA);
  const a = action(url), id = url.searchParams.get("id") || "";
  const k = key(a, id);
  if (a === "properties" || a === "property") await flush();
  try {
    const res = await Promise.race([fetch(req), timeout(6000)]);
    if (res.ok) c.put(k, res.clone());
    return res;
  } catch {
    const hit = await c.match(k);
    if (!hit) return json({ error: "You're offline, and this hasn't been opened on this device yet." }, 503);
    if (a === "property") {
      const p = (await pending())[id];
      if (p) return json({ ...(await hit.json()), ...p });
    }
    return hit;
  }
}

async function write(req, url) {
  const a = action(url);
  const body = await req.clone().text();
  if (a === "logout") { await caches.delete(DATA); return fetch(req).catch(() => json({ ok: 1 })); }
  try {
    const res = await fetch(req);
    if (res.ok && a === "property_save") {
      const d = JSON.parse(body || "{}");
      const left = await pending(); if (d.id && left[d.id]) { delete left[d.id]; await setPending(left); }
    }
    return res;
  } catch {
    if (a !== "property_save") return json({ error: "You're offline. This needs an internet connection; your other changes are kept." }, 503);
    const d = JSON.parse(body || "{}");
    if (!d.id) return json({ error: "You're offline." }, 503);
    const p = await pending();
    p[d.id] = d;
    await setPending(p);
    try { await self.registration.sync.register("stays-host-sync"); } catch { /* the page asks us to flush when online */ }
    const hit = await (await caches.open(DATA)).match(key("property", d.id));
    const base = hit ? await hit.json() : { id: d.id };
    return json({ ...base, ...d, notice: "Saved on this device. It will be sent when you're back online." });
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname === API) { e.respondWith(req.method === "GET" ? read(req, url) : write(req, url)); return; }
  if (req.method !== "GET") return;
  if (req.mode === "navigate" && url.pathname.startsWith(PAGE)) {
    e.respondWith((async () => {
      try {
        const res = await Promise.race([fetch(req), timeout(4000)]);
        if (res.ok && !res.redirected) (await caches.open(SHELL)).put(PAGE, res.clone());
        return res;
      } catch {
        return (await (await caches.open(SHELL)).match(PAGE)) || new Response("<h1>You're offline</h1><p>Open the host portal once with internet on this device, and it will open offline after that.</p>", { status: 503, headers: { "content-type": "text/html; charset=utf-8" } });
      }
    })());
    return;
  }
  // Versioned Next.js files never change, and the portal's fonts and icons: cache first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/stays/icon") || url.pathname === "/stays/host.webmanifest") {
    e.respondWith((async () => {
      const c = await caches.open(STATIC);
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    })());
  }
});

self.addEventListener("sync", (e) => { if (e.tag === "stays-host-sync") e.waitUntil(flush()); });
self.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.type === "flush") e.waitUntil(flush());
  // The page lists the files it loaded before this worker was running, so the first visit is enough to work offline.
  if (d.type === "cache" && Array.isArray(d.urls)) {
    e.waitUntil(caches.open(STATIC).then((c) => Promise.all(d.urls.filter((u) => new URL(u).pathname.startsWith("/_next/static/")).map((u) => c.match(u).then((h) => h || c.add(u).catch(() => null))))));
  }
});
