/**
 * Wedding photo galleries: rules with no database, so they are easy to test.
 */
import { DEFAULT_PHOTO_PLANS, PHOTO_PLAN_ORDER, type PhotoPlanId } from "@/lib/photos/planDefaults";

export type PhotoPlan = {
  id: PhotoPlanId;
  name: string;
  price: number;
  tagline: string;
  badge: string;
  maxPhotos: number;
  videoGb: number;
  months: number;
  freeDays: number;
  guestUploads: boolean;
  originals: boolean;
  features: string[];
};

export class PhotosError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export const photoPlanRank = (p?: string | null) => (p ? PHOTO_PLAN_ORDER.indexOf(p as PhotoPlanId) : -1);

/** The admin's plan rows merged over the built-in defaults (a missing or empty value falls back to the default). */
export function mergePlans(rows: Record<string, unknown>[] | null | undefined): PhotoPlan[] {
  return DEFAULT_PHOTO_PLANS.map((d) => {
    const r = (rows ?? []).find((x) => x.planId === d.planId) ?? {};
    const num = (v: unknown, fb: number, min = 0) => (typeof v === "number" && Number.isFinite(v) && v >= min ? v : fb);
    const feats = ((r.features as { text?: string }[] | undefined) ?? []).map((f) => f.text?.trim() ?? "").filter(Boolean);
    return {
      id: d.planId,
      name: (typeof r.name === "string" && r.name.trim()) || d.name,
      price: d.planId === "free" ? 0 : Math.round(num(r.price, d.price, 1)),
      tagline: typeof r.tagline === "string" ? r.tagline : d.tagline,
      badge: typeof r.badge === "string" ? r.badge : d.badge,
      maxPhotos: Math.round(num(r.maxPhotos, d.maxPhotos, 1)),
      videoGb: num(r.videoGb, d.videoGb),
      months: Math.round(num(r.months, d.months)),
      freeDays: Math.round(num(r.freeDays, d.freeDays ?? 30, 1)),
      guestUploads: typeof r.guestUploads === "boolean" ? r.guestUploads : d.guestUploads,
      originals: typeof r.originals === "boolean" ? r.originals : d.originals,
      features: feats.length ? feats : d.features.map((f) => f.text),
    };
  });
}

export const GB = 1024 ** 3;
export const MAX = {
  displayBytes: 8 * 1024 ** 2,
  thumbBytes: 1024 ** 2,
  originalBytes: 60 * 1024 ** 2,
  videoBytes: 5 * GB, // one upload; R2/S3 single uploads stop at 5 GB
  perRequest: 40,
  guestPerRequest: 20,
};

export const VIDEO_TYPES: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/x-m4v": "m4v" };

/** What a browser asks to upload: one photo (display + thumbnail [+ original]) or one video (+ thumbnail). */
export type UploadRequest = {
  kind: "photo" | "video";
  name?: string;
  album?: string;
  type?: string; // video content type
  d?: number; // display jpg bytes
  t?: number; // thumbnail jpg bytes
  o?: number; // original jpg bytes (Royal)
  v?: number; // video bytes
  w?: number;
  h?: number;
  dur?: number;
  takenAt?: number;
};

export type CleanUpload = Required<Pick<UploadRequest, "kind" | "name" | "album" | "t">> & {
  d?: number;
  o?: number;
  v?: number;
  type?: string;
  w: number;
  h: number;
  dur?: number;
  takenAt?: string;
};

const size = (v: unknown, max: number, what: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new PhotosError(`Missing size for the ${what}`);
  if (n > max) throw new PhotosError(`The ${what} is too big (most ${Math.round(max / 1024 ** 2)} MB)`);
  return n;
};

/** Checks one upload request; throws a friendly error if something's off. */
export function cleanUpload(raw: unknown, plan: PhotoPlan, albums: string[], guest = false): CleanUpload {
  const r = (raw ?? {}) as UploadRequest;
  const kind = r.kind === "video" ? "video" : "photo";
  const album = albums.includes(String(r.album)) ? String(r.album) : (albums[0] ?? "main");
  const name = String(r.name ?? "").replace(/[^\w .()+-]/g, "").slice(0, 120) || (kind === "video" ? "video" : "photo");
  const w = Math.max(0, Math.min(20000, Math.round(Number(r.w) || 0)));
  const h = Math.max(0, Math.min(20000, Math.round(Number(r.h) || 0)));
  const takenAt = Number(r.takenAt) > 946684800000 && Number(r.takenAt) < Date.now() + 864e5 ? new Date(Number(r.takenAt)).toISOString() : undefined;
  const t = size(r.t, MAX.thumbBytes, "thumbnail");
  if (kind === "video") {
    if (guest) throw new PhotosError("Guests can add photos only");
    if (plan.videoGb <= 0) throw new PhotosError("Videos are part of the Premium and Royal plans. Upgrade to add your wedding film.");
    const type = String(r.type ?? "");
    if (!VIDEO_TYPES[type]) throw new PhotosError("Please upload an MP4, MOV or WebM video");
    const dur = Number(r.dur) > 0 ? Math.round(Number(r.dur)) : undefined;
    return { kind, name, album, t, v: size(r.v, MAX.videoBytes, "video"), type, w, h, dur, takenAt };
  }
  const out: CleanUpload = { kind, name, album, t, d: size(r.d, MAX.displayBytes, "photo"), w, h, takenAt };
  if (r.o !== undefined && r.o !== null && !guest) {
    if (!plan.originals) throw new PhotosError("Full-size originals are part of the Royal plan");
    out.o = size(r.o, MAX.originalBytes, "original photo");
  }
  return out;
}

export type Usage = { photos: number; videoBytes: number };

/** Can these uploads fit in the plan? Throws with what is left if not. */
export function checkRoom(plan: PhotoPlan, used: Usage, adding: CleanUpload[]) {
  const photos = adding.filter((a) => a.kind === "photo").length;
  const video = adding.reduce((s, a) => s + (a.v ?? 0), 0);
  if (used.photos + photos > plan.maxPhotos) {
    const left = Math.max(0, plan.maxPhotos - used.photos);
    throw new PhotosError(
      left ? `Your ${plan.name} plan has room for ${left} more photo${left === 1 ? "" : "s"}. Upgrade for more.` : `Your ${plan.name} plan is full (${plan.maxPhotos.toLocaleString("en-IN")} photos). Upgrade for more room.`,
      402,
    );
  }
  if (video > 0 && used.videoBytes + video > plan.videoGb * GB) {
    const left = Math.max(0, plan.videoGb * GB - used.videoBytes);
    throw new PhotosError(`Not enough video space: ${(left / GB).toFixed(1)} GB left on your ${plan.name} plan.`, 402);
  }
}

/** Gallery albums: a short list of { id, name }. */
export type Album = { id: string; name: string };
export const DEFAULT_ALBUMS: Album[] = [
  { id: "haldi", name: "Haldi" },
  { id: "mehendi", name: "Mehendi" },
  { id: "sangeet", name: "Sangeet" },
  { id: "wedding", name: "Wedding" },
  { id: "reception", name: "Reception" },
];
export const GUEST_ALBUM: Album = { id: "guests", name: "Guests' photos" };

export function cleanAlbums(raw: unknown): Album[] {
  if (!Array.isArray(raw)) throw new PhotosError("Invalid albums");
  const seen = new Set<string>();
  const out: Album[] = [];
  for (const a of raw.slice(0, 30)) {
    const name = String((a as Album)?.name ?? "").trim().slice(0, 40);
    let id = String((a as Album)?.id ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);
    if (!name) continue;
    if (!id) id = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) || "album";
    while (seen.has(id)) id = id.slice(0, 13) + Math.floor(Math.random() * 900 + 100);
    seen.add(id);
    out.push({ id, name });
  }
  if (!out.length) throw new PhotosError("Keep at least one album");
  return out;
}

/** Is the gallery online for guests right now? */
export const isOnline = (g: { state?: string | null; expiresAt?: string | null }, now = Date.now()) =>
  (g.state ?? "active") === "active" && (!g.expiresAt || new Date(g.expiresAt).getTime() > now);

export const addMonths = (from: Date, months: number) => {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
};

/**
 * What an order costs before codes, and what it does once paid.
 * - A Free gallery buying a plan pays its price.
 * - A paid gallery buying a higher plan pays the difference.
 * - "renew" (paid galleries only) adds a year at the renewal price.
 */
export function orderBase(plans: PhotoPlan[], renewalPrice: number, current: { plan?: string | null; paymentStatus?: string | null }, want: string) {
  const paid = current.paymentStatus === "paid";
  if (want === "renew") {
    if (!paid) throw new PhotosError("Choose a plan first");
    return { base: renewalPrice, full: renewalPrice, name: "1 more year" };
  }
  const target = plans.find((p) => p.id === want && p.id !== "free");
  if (!target) throw new PhotosError("Unknown plan");
  if (!paid) return { base: target.price, full: target.price, name: target.name };
  if (photoPlanRank(current.plan) >= photoPlanRank(want)) throw new PhotosError("You already have this plan or a higher one");
  const before = plans.find((p) => p.id === current.plan)?.price ?? 0;
  return { base: Math.max(1, target.price - before), full: target.price, name: target.name };
}

/** The gallery's plan and expiry after a paid order. Never shortens how long it stays online. */
export function afterPayment(plans: PhotoPlan[], current: { plan?: string | null; paymentStatus?: string | null; expiresAt?: string | null }, bought: string, now = new Date()) {
  const curExp = current.expiresAt ? new Date(current.expiresAt) : null;
  const paid = current.paymentStatus === "paid";
  if (bought === "renew") {
    const from = curExp && curExp > now ? curExp : now;
    return { plan: current.plan ?? "basic", expiresAt: addMonths(from, 12).toISOString() };
  }
  const p = plans.find((x) => x.id === bought)!;
  const fresh = addMonths(now, p.months);
  const keep = paid && curExp && curExp > fresh ? curExp : fresh;
  return { plan: bought, expiresAt: keep.toISOString() };
}

export const slugify = (s: unknown) =>
  String(s ?? "").toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

/** Days to keep files after a gallery expires, before deleting them (gives the couple time to renew). */
export const graceDays = (paymentStatus?: string | null) => (paymentStatus === "paid" ? 60 : 7);
