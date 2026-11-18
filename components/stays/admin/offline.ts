/**
 * Offline listings on the admin's own device (IndexedDB + Cache API).
 * Only guest-safe data is stored (the server's offline bundle has no addresses, host details, landing prices,
 * margins or notes), so even a lost phone exposes nothing private. Edits made offline wait in a queue and are
 * sent with the values they started from, so the server can detect conflicting changes.
 */
export type OfflineListing = {
  id: string; code: string; slug: string; title: string; shortDescription: string; description: string; place: string; propertyType: string;
  rooms: Record<string, unknown>; amenities: string[]; features: string[]; price: { weekday: number | null; weekend: number | null };
  availability: string; cover: string | null; thumbs: string[]; updatedAt: number; savedAt: number;
};
export type QueuedEdit = {
  id: string; propertyId: string; code: string; fields: Record<string, unknown>; base: Record<string, unknown>;
  status: "pending" | "synced" | "failed" | "conflict"; error?: string; conflicts?: { field: string; server: unknown; mine: unknown }[]; at: number;
};

const DB = "stays-offline";
const IMG_CACHE = "stays-offline-img";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains("listings")) db.createObjectStore("listings", { keyPath: "id" });
      if (!db.objectStoreNames.contains("queue")) db.createObjectStore("queue", { keyPath: "id" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => { resolve(req ? (req.result as T) : (undefined as T)); db.close(); };
    t.onerror = () => { reject(t.error); db.close(); };
  });
}

export const listListings = () => tx<OfflineListing[]>("listings", "readonly", (s) => s.getAll());
export const listQueue = () => tx<QueuedEdit[]>("queue", "readonly", (s) => s.getAll());
export const getMeta = (k: string) => tx<unknown>("meta", "readonly", (s) => s.get(k));
const setMeta = (k: string, v: unknown) => tx("meta", "readwrite", (s) => s.put(v, k));

async function cacheImages(urls: string[]) {
  if (!("caches" in window)) return;
  const c = await caches.open(IMG_CACHE);
  await Promise.all(urls.filter(Boolean).map(async (u) => {
    try {
      if (await c.match(u)) return;
      const r = await fetch(u, { mode: "cors" });
      if (r.ok) await c.put(u, r);
    } catch { /* skip images that can't be fetched */ }
  }));
}

/** Download (or refresh) these properties for offline use. */
export async function saveOffline(ids: string[]) {
  if (!ids.length) return 0;
  const res = await fetch(`/api/stays/admin?a=offline&ids=${ids.map(encodeURIComponent).join(",")}`, { credentials: "same-origin", cache: "no-store" });
  if (!res.ok) throw new Error(res.status === 401 ? "Please sign in again" : "Couldn't download the listings");
  const list = (await res.json()) as Omit<OfflineListing, "savedAt">[];
  const now = Date.now();
  await tx("listings", "readwrite", (s) => { for (const l of list) s.put({ ...l, savedAt: now }); });
  await cacheImages(list.flatMap((l) => [l.cover || "", ...l.thumbs]));
  await setMeta("lastSync", now);
  return list.length;
}

export async function removeOffline(id: string) {
  const l = (await listListings()).find((x) => x.id === id);
  await tx("listings", "readwrite", (s) => s.delete(id));
  if (l && "caches" in window) {
    const c = await caches.open(IMG_CACHE);
    await Promise.all([l.cover, ...l.thumbs].filter(Boolean).map((u) => c.delete(u as string)));
  }
}

/** Edit a saved listing offline: changes the local copy and queues the change for the server. */
export async function queueEdit(l: OfflineListing, fields: Record<string, unknown>) {
  const base: Record<string, unknown> = {};
  const cur: Record<string, unknown> = { title: l.title, shortDescription: l.shortDescription, description: l.description, availability: l.availability, listingWeekday: l.price.weekday, listingWeekend: l.price.weekend };
  const queue = await listQueue();
  // If an earlier edit to this property is still waiting, keep its starting point (what the server last had).
  const prev = queue.find((q) => q.propertyId === l.id && q.status !== "synced");
  for (const k of Object.keys(fields)) base[k] = prev && k in prev.base ? prev.base[k] : cur[k];
  const edit: QueuedEdit = { id: prev?.id || `${l.id}-${Date.now()}`, propertyId: l.id, code: l.code, fields: { ...(prev?.fields || {}), ...fields }, base: { ...(prev?.base || {}), ...base }, status: "pending", at: Date.now() };
  const next: OfflineListing = {
    ...l,
    title: (fields.title as string) ?? l.title, shortDescription: (fields.shortDescription as string) ?? l.shortDescription, description: (fields.description as string) ?? l.description,
    availability: (fields.availability as string) ?? l.availability,
    price: { weekday: "listingWeekday" in fields ? (fields.listingWeekday as number | null) : l.price.weekday, weekend: "listingWeekend" in fields ? (fields.listingWeekend as number | null) : l.price.weekend },
  };
  await tx("listings", "readwrite", (s) => s.put(next));
  await tx("queue", "readwrite", (s) => s.put(edit));
  try { const reg = await navigator.serviceWorker?.ready; await (reg as unknown as { sync?: { register: (t: string) => Promise<void> } })?.sync?.register("stays-sync"); } catch { /* background sync not supported */ }
  return edit;
}

/** Send waiting edits. `force` overwrites the server's newer value for conflicting edits. */
export async function syncQueue(opts: { force?: string[] } = {}) {
  if (!navigator.onLine) return { sent: 0, failed: 0, conflicts: 0 };
  const queue = (await listQueue()).filter((q) => q.status !== "synced");
  let sent = 0, failed = 0, conflicts = 0;
  for (const q of queue) {
    if (q.status === "conflict" && !opts.force?.includes(q.id)) { conflicts++; continue; }
    try {
      const r = await fetch("/api/stays/admin?a=offline_sync", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: q.propertyId, fields: q.fields, base: q.base, force: opts.force?.includes(q.id) }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 409) { await tx("queue", "readwrite", (s) => s.put({ ...q, status: "conflict", conflicts: j.conflicts, error: "Changed elsewhere meanwhile" })); conflicts++; continue; }
      if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
      await tx("queue", "readwrite", (s) => s.put({ ...q, status: "synced", error: undefined, conflicts: undefined }));
      sent++;
    } catch (e) {
      await tx("queue", "readwrite", (s) => s.put({ ...q, status: "failed", error: (e as Error).message }));
      failed++;
    }
  }
  if (sent) {
    const ids = [...new Set(queue.filter((q) => q.status !== "conflict").map((q) => q.propertyId))];
    try { await saveOffline(ids); } catch { /* refresh later */ }
  }
  return { sent, failed, conflicts };
}

/** Drop a queued edit (keep the server's version). */
export async function discardEdit(id: string) {
  const q = (await listQueue()).find((x) => x.id === id);
  await tx("queue", "readwrite", (s) => s.delete(id));
  if (q) { try { await saveOffline([q.propertyId]); } catch { /* offline */ } }
}
export const clearSynced = async () => { for (const q of await listQueue()) if (q.status === "synced") await tx("queue", "readwrite", (s) => s.delete(q.id)); };

/** Remove everything this app stored on the device. */
export async function clearDevice() {
  await new Promise<void>((resolve) => { const r = indexedDB.deleteDatabase(DB); r.onsuccess = r.onerror = r.onblocked = () => resolve(); });
  if ("caches" in window) for (const k of await caches.keys()) if (k.startsWith("stays-")) await caches.delete(k);
  const regs = (await navigator.serviceWorker?.getRegistrations?.()) || [];
  for (const r of regs) if (r.scope.includes("/stays/admin")) await r.unregister();
}

export async function storageUsage() {
  try { const e = await navigator.storage?.estimate?.(); return e ? { used: e.usage || 0, quota: e.quota || 0 } : null; } catch { return null; }
}

/** Register the admin-only service worker (scope /stays/admin, so public pages never get one). */
export async function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/stays/admin-sw.js", { scope: "/stays/admin" });
    try { await (navigator.storage as unknown as { persist?: () => Promise<boolean> })?.persist?.(); } catch { /* optional */ }
  } catch (e) { console.warn("[stays] service worker", e); }
}
