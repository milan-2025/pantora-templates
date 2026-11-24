/*
 * Wedding invite editor offline worker. Registered twice from the editor: scope /shaadi and scope /i/.
 * It only acts for the couple's editor (/shaadi/create and /i/<link>/edit) and the editor's own data calls.
 * Guests' invite pages (/i/<link>, /i/<link>/<guest>) are left alone: always fresh from the server.
 * The landing page (/shaadi) is left alone too.
 * - The editor page (same for every invite) is kept on the device, so it opens with no internet.
 * - The couple's draft (/api/shaadi/mine/<link>) is kept from the last load. Autosaves made offline are kept
 *   (the latest one per invite) and sent when the connection is back; reopening offline shows them.
 * - Publishing, payments, uploads and link changes need internet.
 * - Fonts, the QR library and photos the editor already showed are kept so the design looks right offline.
 * Served from the site root because a worker may only control paths at or below its own folder.
 */
const VERSION = "shaadi-v3";
const SHELL = VERSION + "-shell";
const DATA = "shaadi-data";
const FILES = "shaadi-files";
const EDIT = "/i/__edit"; // one copy of the editor page serves every /i/<link>/edit

const NEW = "/shaadi/create";
const isEditPage = (p) => p === NEW || p === NEW + "/" || /^\/i\/[^/]+\/edit\/?$/.test(p);

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.add(NEW)).catch(() => null).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("shaadi-v") && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: { "content-type": "application/json" } });
const timeout = (ms) => new Promise((_, bad) => setTimeout(() => bad(new Error("timeout")), ms));

/* Offline autosaves: one per invite, { url, body, token, sid } kept as JSON in the Cache API. */
const pendingKey = (slug) => "/__pending/" + encodeURIComponent(slug);
async function getPending(slug) { const h = await (await caches.open(DATA)).match(pendingKey(slug)); return h ? h.json() : null; }
async function allPending() {
  const c = await caches.open(DATA);
  const out = [];
  for (const r of await c.keys()) if (new URL(r.url).pathname.startsWith("/__pending/")) out.push(await (await c.match(r)).json());
  return out;
}
async function tell(msg) { for (const c of await self.clients.matchAll({ type: "window" })) c.postMessage(msg); }

let flushing = null;
function flush() {
  if (flushing) return flushing;
  flushing = (async () => {
    const c = await caches.open(DATA);
    let sent = 0;
    for (const p of await allPending()) {
      let res;
      try { res = await fetch(p.url, { method: "PUT", headers: { "content-type": "application/json", "x-edit-token": p.token, "x-edit-session": p.sid || "" }, body: p.body }); }
      catch (e) { return; }
      // Sent, or refused for good (link gone, key changed): either way it's no longer waiting. A 409 means another
      // tab is editing right now; keep it and try again later.
      if (res.status === 409) continue;
      await c.delete(pendingKey(p.slug));
      if (res.ok) sent++;
    }
    if (sent) await tell({ type: "shaadi-synced", sent });
  })().finally(() => { flushing = null; });
  return flushing;
}

async function mine(req, url) {
  const c = await caches.open(DATA);
  const slug = decodeURIComponent(url.pathname.split("/").pop());
  const key = "/__mine/" + encodeURIComponent(slug);
  await flush();
  try {
    const res = await Promise.race([fetch(req), timeout(6000)]);
    if (res.ok) await c.put(key, res.clone());
    return res;
  } catch (e) {
    const hit = await c.match(key);
    if (!hit) return Response.error(); // like a dropped connection: the editor must not mistake it for a wrong edit key
    const data = await hit.json();
    const p = await getPending(slug);
    if (p) { try { data.state = JSON.parse(p.body).state || data.state; data.unsaved = true; } catch (er) { /* keep saved */ } }
    data.offline = true;
    return json(data);
  }
}

async function autosave(req, url) {
  const body = await req.clone().text();
  try {
    const res = await fetch(req);
    if (res.ok) { const slug = decodeURIComponent(url.pathname.split("/").pop()); await (await caches.open(DATA)).delete(pendingKey(slug)); }
    return res;
  } catch (e) {
    const slug = decodeURIComponent(url.pathname.split("/").pop());
    await (await caches.open(DATA)).put(pendingKey(slug), json({ slug, url: url.toString(), body, token: req.headers.get("x-edit-token") || "", sid: req.headers.get("x-edit-session") || "", at: Date.now() }));
    try { await self.registration.sync.register("shaadi-sync"); } catch (er) { /* the editor asks us to flush when online */ }
    return json({ ok: true, queued: true });
  }
}

async function file(req) {
  const c = await caches.open(FILES);
  const hit = await c.match(req);
  const fresh = fetch(req).then((res) => { if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await fresh) || Response.error();
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  const same = url.origin === location.origin;
  if (same && req.mode === "navigate") {
    if (!isEditPage(url.pathname)) return; // guests' invite pages: untouched
    const key = url.pathname.startsWith("/i/") ? EDIT : NEW;
    e.respondWith((async () => {
      const c = await caches.open(SHELL);
      try {
        const res = await Promise.race([fetch(req), timeout(4000)]);
        if (res.ok && !res.redirected) c.put(key, res.clone());
        return res;
      } catch (er) {
        return (await c.match(key)) || (await c.match(EDIT)) || (await c.match(NEW)) || new Response("<h1>You're offline</h1><p>Open your invite editor once with internet on this device, and it will open offline after that.</p>", { status: 503, headers: { "content-type": "text/html; charset=utf-8" } });
      }
    })());
    return;
  }
  if (same && url.pathname.startsWith("/api/shaadi/mine/") && req.method === "GET") { e.respondWith(mine(req, url)); return; }
  // The editor's start-up checks (server reachable, plan prices): the last answer works offline.
  if (same && (url.pathname === "/api/shaadi/ping" || url.pathname === "/api/shaadi/plans") && req.method === "GET") {
    e.respondWith((async () => {
      const c = await caches.open(DATA);
      try { const res = await Promise.race([fetch(req), timeout(5000)]); if (res.ok) c.put(url.pathname, res.clone()); return res; }
      catch (er) { return (await c.match(url.pathname)) || (url.pathname.endsWith("ping") ? json({ ok: true, offline: true }) : Response.error()); }
    })());
    return;
  }
  if (same && /^\/api\/shaadi\/invites\/[^/]+$/.test(url.pathname) && req.method === "PUT") { e.respondWith(autosave(req, url)); return; }
  if (req.method !== "GET") return;
  if (same && url.pathname.startsWith("/shaadi/") && !url.pathname.startsWith(NEW)) { e.respondWith(file(req)); return; }
  if (["fonts.googleapis.com", "fonts.gstatic.com", "cdnjs.cloudflare.com", "res.cloudinary.com"].includes(url.hostname)) e.respondWith(file(req));
});

self.addEventListener("sync", (e) => { if (e.tag === "shaadi-sync") e.waitUntil(flush()); });
self.addEventListener("message", (e) => { if (e.data && e.data.type === "flush") e.waitUntil(flush()); });
