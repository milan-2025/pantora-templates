/*
 * LeadFlow CRM offline worker (scope /CRM/).
 * - Every CRM screen is saved on the device when it installs, so the installed app opens with no internet.
 * - Data (api.php GETs): network first; the last good answer is kept on this device and used offline.
 * - Changes made offline (leads, visits, unit status…) wait in an outbox here and are sent, in order, as soon as
 *   the connection is back. A lead added offline gets a temporary id, swapped for the real one when it syncs.
 *   The saved lead list is updated straight away, so the app shows offline changes at once.
 * - Signing out wipes the saved data and any unsent changes.
 * Bump VERSION when CRM pages change so phones fetch the new ones.
 */
const VERSION = "crm-v4";
const SHELL = VERSION + "-shell";
const DATA = "crm-data";
const PAGES = ["index.html", "properties.html", "partners.html", "reports.html", "visits.html", "admin.html", "login.html", "signup.html"];
const FILES = PAGES.concat(["shim.js", "offline.js", "re.css", "manifest.json", "icon-192.png", "icon-512.png"]);
const BASE = new URL("./", self.location).pathname; // "/CRM/"

// Changes that can wait for the connection. Everything else (uploads, sign-in, user admin, imports) needs internet.
const QUEUEABLE = new Set(["leads_add", "leads_update", "leads_delete", "settings_set", "visit_save", "visit_done", "visit_delete", "unit_status", "unit_hold", "unit_release", "commission_update"]);

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES.map((f) => BASE + f))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("crm-") && k.endsWith("-shell") && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

/* ---------- tiny IndexedDB outbox ---------- */
function db() {
  return new Promise((ok, bad) => {
    const r = indexedDB.open("crm-offline", 1);
    r.onupgradeneeded = () => { r.result.createObjectStore("outbox", { keyPath: "seq", autoIncrement: true }); r.result.createObjectStore("meta"); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => bad(r.error);
  });
}
async function store(name, mode, fn) {
  const d = await db();
  return new Promise((ok, bad) => {
    const t = d.transaction(name, mode), s = t.objectStore(name);
    const req = fn(s);
    t.oncomplete = () => { d.close(); ok(req && req.result); };
    t.onerror = () => { d.close(); bad(t.error); };
  });
}
const outbox = () => store("outbox", "readonly", (s) => s.getAll());
const meta = (k) => store("meta", "readonly", (s) => s.get(k));
const setMeta = (k, v) => store("meta", "readwrite", (s) => s.put(v, k));

/* ---------- helpers ---------- */
const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: { "content-type": "application/json" } });
const timeout = (ms) => new Promise((_, bad) => setTimeout(() => bad(new Error("timeout")), ms));
const route = (url) => url.searchParams.get("r") || "";
/** Cache key for a data request: the same question asked at another minute is the same answer offline. */
function dataKey(url) {
  const u = new URL(url);
  u.searchParams.delete("now");
  u.searchParams.delete("_");
  u.searchParams.sort();
  return u.toString();
}
async function tell(msg) {
  for (const c of await self.clients.matchAll({ type: "window" })) c.postMessage(msg);
}
async function status() {
  const box = await outbox();
  const failed = (await meta("failed")) || [];
  await tell({ type: "crm-queue", pending: box.length, failed });
}

/* ---------- reads ---------- */
async function read(req, url) {
  const c = await caches.open(DATA);
  const key = dataKey(url);
  await flush(); // send waiting changes first, so fresh data includes them
  try {
    const res = await Promise.race([fetch(req), timeout(6000)]);
    if (res.ok) c.put(key, res.clone());
    if (res.status === 401) await wipe();
    return res;
  } catch (e) {
    const hit = await c.match(key);
    if (hit) { const h = new Headers(hit.headers); h.set("x-offline", "1"); return new Response(await hit.blob(), { status: 200, headers: h }); }
    return json({ error: "You're offline and this hasn't been opened on this device yet." }, 503);
  }
}

/* ---------- writes ---------- */
async function write(req, url) {
  const r = route(url);
  const body = await req.clone().text();
  if (r === "logout") { await wipe(); return fetch(req).catch(() => json({ ok: 1 })); }
  // While older changes are still waiting, send this one after them so they stay in order.
  const waiting = (await outbox()).length > 0;
  if (!waiting) {
    try {
      const res = await fetch(req);
      return res;
    } catch (e) { /* offline: queue it below */ }
  } else {
    await flush();
    if (!(await outbox()).length) { try { return await fetch(req); } catch (e) { /* queue */ } }
  }
  if (!QUEUEABLE.has(r)) return json({ error: "You're offline. This needs an internet connection." }, 503);
  let newVisit = false;
  if (r === "visit_save") { try { newVisit = !JSON.parse(body || "{}").id; } catch (e) { newVisit = false; } }
  const tmp = r === "leads_add" || newVisit ? "tmp_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) : "";
  await store("outbox", "readwrite", (s) => s.add({ url: url.toString(), body, tmp, at: Date.now() }));
  await patchLeads(r, url, body, tmp);
  try { await self.registration.sync.register("crm-sync"); } catch (e) { /* not supported: the page asks us to flush when online */ }
  status();
  return json(tmp ? { id: tmp, queued: true } : { ok: 1, queued: true });
}

/** Show offline lead changes straight away by editing the saved lead list. */
async function patchLeads(r, url, body, tmp) {
  if (!r.startsWith("leads_")) return;
  const c = await caches.open(DATA);
  const key = dataKey(new URL(BASE + "api.php?r=leads", self.location));
  const hit = await c.match(key);
  if (!hit) return;
  let list = await hit.json().catch(() => null);
  if (!Array.isArray(list)) return;
  let d = {};
  try { d = JSON.parse(body || "{}"); } catch (e) { d = {}; }
  const id = url.searchParams.get("id");
  if (r === "leads_add") list = [Object.assign({ created: Date.now(), notes: [] }, d, { id: tmp })].concat(list);
  else if (r === "leads_update") list = list.map((l) => (l.id === id ? Object.assign({}, l, d) : l));
  else if (r === "leads_delete") list = list.filter((l) => l.id !== id);
  await c.put(key, json(list));
}

let flushing = null;
/** Sends waiting changes in order. Stops at the first network failure; a change the server refuses is dropped and reported. */
function flush() {
  if (flushing) return flushing;
  flushing = (async () => {
    const ids = (await meta("ids")) || {};
    let sent = 0;
    for (const item of await outbox()) {
      let u = item.url, b = item.body;
      for (const [t, real] of Object.entries(ids)) { u = u.split(t).join(real); b = b.split(t).join(real); }
      let res;
      try { res = await fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: b, credentials: "same-origin" }); }
      catch (e) { break; }
      if (res.status === 401) break; // signed out: keep the changes until they sign in again
      if (res.ok && item.tmp) { const j = await res.clone().json().catch(() => ({})); if (j.id) { ids[item.tmp] = j.id; await setMeta("ids", ids); } }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const failed = (await meta("failed")) || [];
        failed.push({ what: new URL(u).searchParams.get("r"), error: j.error || "Error " + res.status, at: item.at });
        await setMeta("failed", failed.slice(-20));
      }
      await store("outbox", "readwrite", (s) => s.delete(item.seq));
      sent++;
    }
    if (!(await outbox()).length) await setMeta("ids", {});
    if (sent) { await status(); await tell({ type: "crm-synced", sent }); }
  })().finally(() => { flushing = null; });
  return flushing;
}

async function wipe() {
  await caches.delete(DATA);
  await store("outbox", "readwrite", (s) => s.clear());
  await setMeta("ids", {});
  await setMeta("failed", []);
}

/* ---------- routing ---------- */
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (url.pathname === BASE + "api.php") {
    const r = route(url);
    if (r === "sheet" || r === "webhook" || r === "enquiry" || r === "login" || r === "signup") return; // straight to the server
    e.respondWith(req.method === "GET" ? read(req, url) : write(req, url));
    return;
  }
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const c = await caches.open(SHELL);
      let page = url.pathname.slice(BASE.length) || "index.html";
      if (PAGES.indexOf(page) < 0) page = "index.html";
      try {
        const res = await Promise.race([fetch(req), timeout(4000)]);
        if (res.ok && !res.redirected) c.put(BASE + page, res.clone());
        return res;
      } catch (err) {
        return (await c.match(BASE + page)) || (await c.match(BASE + "index.html")) || new Response("<h1>You're offline</h1><p>Open LeadFlow once with internet on this device, and it will open offline after that.</p>", { status: 503, headers: { "content-type": "text/html; charset=utf-8" } });
      }
    })());
    return;
  }
  // CRM files: from the device, refreshed in the background.
  e.respondWith((async () => {
    const c = await caches.open(SHELL);
    const hit = await c.match(req, { ignoreSearch: true });
    const fresh = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
    return hit || (await fresh) || Response.error();
  })());
});

self.addEventListener("sync", (e) => { if (e.tag === "crm-sync") e.waitUntil(flush()); });
self.addEventListener("message", (e) => {
  const t = e.data && e.data.type;
  if (t === "flush") e.waitUntil(flush().then(status));
  else if (t === "status") e.waitUntil(status());
  else if (t === "clear-failed") e.waitUntil(setMeta("failed", []).then(status));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: "window" }).then((c) => (c.length ? c[0].focus() : clients.openWindow("./index.html"))));
});
