/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Stays: property changes shared by the admin and host APIs (server only).
 * Role checks happen in the route files; these functions assume the caller is allowed to touch the property.
 */
import "server-only";
import { v2 as cloudinary } from "cloudinary";
import type { Settings } from "./constants";
import { MAX_MEDIA } from "./constants";
import { cleanPrefix } from "./core";
import { inFolder, maxBytes, validDeliveryUrl, folderFor, IMAGE_FORMATS, VIDEO_FORMATS, type MediaItem, type MediaType } from "./media";
import type { AdminInput, HostInput } from "./property";
import { str } from "./property";
import { approxFor, audit, bustCards, diffFor, nextCode, rid, type Actor, type C } from "./server";
import type { StoredProperty } from "./views";

export const now = () => Date.now();

/** A brand-new property with every field present (so views never meet undefined). */
export function blankProperty(id: string, code: string, ownership: "own" | "host", hostId: string | null, s: Settings): StoredProperty {
  const t = now();
  return {
    _id: id, code, ownership, hostId,
    title: "", shortDescription: "", description: "", propertyType: "", category: "",
    status: "draft", visibility: s.defaultVisibility || "public", availability: "available", featured: false, showPrice: s.defaultShowPrice !== false,
    location: { address: "", society: "", street: "", locality: "", city: "", state: "", pin: "", country: "India", lat: null, lng: null, mapsUrl: "", showSociety: s.showSocietyPublicly !== false },
    approx: null, rooms: {}, amenities: [], features: [], policies: {},
    pricing: { landing: { weekday: null, weekend: null }, listing: { weekday: null, weekend: null } },
    private: { airbnbUrl: "", adminNotes: "", ownerName: "", hostNotes: "" },
    media: [], coverId: null, hostChanges: null, publishRequested: false, review: null, archived: false,
    createdAt: t, updatedAt: t,
  };
}

export async function createProperty(c: C, s: Settings, actor: Actor, ownership: "own" | "host", hostId: string | null) {
  const prefix = ownership === "own" ? cleanPrefix(s.ownPrefix, "LAC") : cleanPrefix(s.hostPrefix, "HST");
  const code = await nextCode(c, prefix);
  const p = blankProperty(rid(), code, ownership, hostId, s);
  await c.properties.insertOne(p);
  await audit(c, actor, "create", p, [], { ownership });
  return p;
}

/** Host-entered fields applied to a property (used for direct host edits and when the admin accepts host changes). */
export function withHostInput(p: StoredProperty, h: HostInput): StoredProperty {
  return {
    ...p,
    title: h.title, shortDescription: h.shortDescription, description: h.description, propertyType: h.propertyType, category: h.category,
    location: { ...h.location, showSociety: p.location?.showSociety !== false },
    rooms: h.rooms, amenities: h.amenities, features: h.features, policies: h.policies,
    pricing: { ...p.pricing, landing: h.landing },
    private: { ...p.private, airbnbUrl: h.airbnbUrl, hostNotes: h.hostNotes },
  };
}

export function withAdminInput(p: StoredProperty, a: AdminInput): StoredProperty {
  return {
    ...p,
    ownership: a.ownership, hostId: a.ownership === "host" ? a.hostId || null : null,
    title: a.title, shortDescription: a.shortDescription, description: a.description, propertyType: a.propertyType, category: a.category,
    visibility: a.visibility, availability: a.availability, featured: a.featured, showPrice: a.showPrice,
    location: { ...a.location, showSociety: a.showSociety },
    rooms: a.rooms, amenities: a.amenities, features: a.features, policies: a.policies,
    pricing: a.pricing,
    private: { ...p.private, airbnbUrl: a.airbnbUrl, adminNotes: a.adminNotes, ownerName: a.ownerName },
  };
}

/** Saves a new version of a property: recomputes the public position, logs audited changes, clears the public cache. */
export async function store(c: C, actor: Actor, before: StoredProperty, after: StoredProperty, action = "update", extra: Record<string, unknown> = {}) {
  const locMoved = before.location?.lat !== after.location?.lat || before.location?.lng !== after.location?.lng || !after.approx;
  const next: StoredProperty = {
    ...after,
    approx: locMoved ? approxFor(after._id, after.location?.lat ?? null, after.location?.lng ?? null) : after.approx,
    updatedAt: Math.max(now(), (before.updatedAt || 0) + 1),
  };
  const { _id, ...rest } = next;
  await c.properties.updateOne({ _id }, { $set: rest });
  const changes = diffFor(before, next);
  if (changes.length || action !== "update") await audit(c, actor, action, next, changes, extra);
  bustCards();
  return next;
}

// ---------- media ----------

export function cloudCfg() {
  const cfg = cloudinary.config();
  return cfg.cloud_name && cfg.api_key && cfg.api_secret ? { cloud: cfg.cloud_name as string, key: cfg.api_key as string, secret: cfg.api_secret as string } : null;
}

/** Upload signature for one property folder and one kind of file. */
export function signUpload(propertyId: string, type: MediaType) {
  const cfg = cloudCfg();
  if (!cfg) return null;
  const params = { allowed_formats: (type === "video" ? VIDEO_FORMATS : IMAGE_FORMATS).join(","), folder: folderFor(propertyId), timestamp: Math.round(now() / 1000) };
  return {
    url: `https://api.cloudinary.com/v1_1/${cfg.cloud}/${type}/upload`,
    fields: { ...params, api_key: cfg.key, signature: cloudinary.utils.api_sign_request(params, cfg.secret) },
    maxBytes: maxBytes(type),
  };
}

/** Checks Cloudinary's upload result and turns it into a media item, or returns an error message. */
export function verifiedUpload(propertyId: string, r: any, by: "admin" | "host", pending: boolean): MediaItem | string {
  const cfg = cloudCfg();
  if (!cfg) return "Uploads are not set up (CLOUDINARY_URL is missing)";
  const type: MediaType = r?.resource_type === "video" ? "video" : "image";
  const pid = String(r?.public_id || "");
  const ver = String(r?.version || "");
  if (!inFolder(pid, propertyId)) return "That file was not uploaded for this property";
  if (!/^\d{1,14}$/.test(ver)) return "Upload could not be verified";
  // Cloudinary signs public_id + version in every upload response with our secret: proves the upload is genuine.
  const expected = cloudinary.utils.api_sign_request({ public_id: pid, version: ver }, cfg.secret);
  if (String(r?.signature || "") !== expected) return "Upload could not be verified";
  if (!validDeliveryUrl(r?.secure_url, cfg.cloud, type, pid)) return "Upload could not be verified";
  const bytes = Number(r?.bytes) || null;
  if (bytes && bytes > maxBytes(type)) return `File too large (max ${Math.round(maxBytes(type) / 1048576)} MB)`;
  return {
    id: rid(6), type, publicId: pid, url: String(r.secure_url),
    width: Number(r?.width) || null, height: Number(r?.height) || null, bytes, duration: Number(r?.duration) || null,
    caption: str(r?.caption, 200), pending, removalRequested: false, by, at: now(),
  };
}

export async function destroyMedia(list: MediaItem[]) {
  if (!cloudCfg()) return;
  for (const m of list) {
    try { await cloudinary.uploader.destroy(m.publicId, { resource_type: m.type, invalidate: true }); } catch (e) { console.error("[stays] media delete", e); }
  }
}

/**
 * Media actions shared by admin and host. `role` decides what is allowed:
 * a host's new uploads to a live listing wait for approval, and on a live listing a host can only ASK for removal.
 */
export async function mediaAction(c: C, actor: Actor, p: StoredProperty, op: string, body: any): Promise<{ status: number; body: any; property?: StoredProperty }> {
  const isHost = actor.role === "host";
  const live = ["approved", "published", "inactive"].includes(p.status);
  let media = [...(p.media || [])];
  let coverId = p.coverId;
  const find = () => media.find((m) => m.id === String(body.mediaId));

  if (op === "media_sign") {
    if (media.length >= MAX_MEDIA) return { status: 400, body: { error: `A property can have up to ${MAX_MEDIA} photos and videos` } };
    const s = signUpload(p._id, body.type === "video" ? "video" : "image");
    return s ? { status: 200, body: s } : { status: 503, body: { error: "Uploads are not set up yet: add CLOUDINARY_URL in the hosting settings (see docs/stays/SETUP.md)" } };
  }
  if (op === "media_add") {
    if (media.length >= MAX_MEDIA) return { status: 400, body: { error: `A property can have up to ${MAX_MEDIA} photos and videos` } };
    const results = Array.isArray(body.uploads) ? body.uploads.slice(0, 20) : [body.upload];
    const added: MediaItem[] = [];
    for (const r of results) {
      const m = verifiedUpload(p._id, r, actor.role, isHost && live);
      if (typeof m === "string") return { status: 400, body: { error: m } };
      if (media.some((x) => x.publicId === m.publicId)) continue;
      media.push(m);
      added.push(m);
    }
    if (!coverId) coverId = media.find((m) => m.type === "image" && !m.pending)?.id || null;
  } else if (op === "media_caption") {
    const m = find();
    if (!m) return { status: 404, body: { error: "Not found" } };
    media = media.map((x) => (x.id === m.id ? { ...x, caption: str(body.caption, 200) } : x));
  } else if (op === "media_order") {
    const { reorder } = await import("./media");
    media = reorder(media, body.ids);
  } else if (op === "media_cover") {
    const m = find();
    if (!m || m.type !== "image") return { status: 400, body: { error: "Pick a photo as the cover" } };
    coverId = m.id;
  } else if (op === "media_remove") {
    const m = find();
    if (!m) return { status: 404, body: { error: "Not found" } };
    if (isHost && live && !m.pending) {
      media = media.map((x) => (x.id === m.id ? { ...x, removalRequested: true } : x));
    } else {
      media = media.filter((x) => x.id !== m.id);
      if (coverId === m.id) coverId = media.find((x) => x.type === "image" && !x.pending)?.id || null;
      await destroyMedia([m]);
    }
  } else if (op === "media_approve" && !isHost) {
    const all = body.mediaId === "all";
    media = media.map((x) => (all || x.id === String(body.mediaId) ? { ...x, pending: false } : x));
    if (!coverId) coverId = media.find((x) => x.type === "image" && !x.pending)?.id || null;
  } else if (op === "media_keep" && !isHost) {
    media = media.map((x) => (x.id === String(body.mediaId) ? { ...x, removalRequested: false } : x));
  } else {
    return { status: 400, body: { error: "Unknown action" } };
  }
  const next = await store(c, actor, p, { ...p, media, coverId }, op === "media_add" || op === "media_remove" || op === "media_approve" ? op : "update", { mediaId: body.mediaId || undefined });
  if (isHost && live && op === "media_add") {
    const { notifyAdmin } = await import("./server");
    await notifyAdmin(c, "media", `${p.code}: the host added photos/videos (waiting for your approval)`, p);
  }
  return { status: 200, body: { ok: true }, property: next };
}

// ---------- offline edits ----------

export const OFFLINE_FIELDS = ["title", "shortDescription", "description", "availability", "listingWeekday", "listingWeekend"] as const;
type OfflineField = (typeof OFFLINE_FIELDS)[number];
const readOffline = (p: StoredProperty, k: OfflineField): unknown =>
  k === "listingWeekday" ? p.pricing?.listing?.weekday ?? null : k === "listingWeekend" ? p.pricing?.listing?.weekend ?? null : (p as any)[k] ?? "";

/**
 * Applies edits made offline. Each edit carries the value the device started from (`base`); if the server's value
 * changed meanwhile to something else, that field is a conflict and nothing is applied unless `force` is set.
 */
export function offlineMerge(p: StoredProperty, fields: Record<string, unknown>, base: Record<string, unknown>, force: boolean, clean: (k: OfflineField, v: unknown) => unknown) {
  const conflicts: { field: string; server: unknown; mine: unknown }[] = [];
  const next: StoredProperty = structuredClone(p);
  for (const k of OFFLINE_FIELDS) {
    if (!(k in fields)) continue;
    const mine = clean(k, fields[k]);
    const server = readOffline(p, k);
    const was = k in base ? clean(k, base[k]) : server;
    if (JSON.stringify(server) !== JSON.stringify(was) && JSON.stringify(server) !== JSON.stringify(mine)) conflicts.push({ field: k, server, mine });
    if (k === "listingWeekday") next.pricing.listing.weekday = mine as number | null;
    else if (k === "listingWeekend") next.pricing.listing.weekend = mine as number | null;
    else (next as any)[k] = mine;
  }
  return conflicts.length && !force ? { conflicts, next: null } : { conflicts, next };
}
