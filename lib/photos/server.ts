import "server-only";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";
import type { Payload } from "payload";
import { sendWithBrevo } from "@/lib/brevo";
import { codesMatch, hashCode, normEmail, validEmail } from "@/lib/planner/core";
import { quoteWithCode } from "@/lib/pricing";
import { bunnyDelete, bunnyEmbedUrl, bunnyEnabled, bunnyFetch, bunnyFind, bunnyStatus } from "@/lib/photos/bunny";
import {
  DEFAULT_ALBUMS, GUEST_ALBUM, MAX, PhotosError, VIDEO_TYPES, afterPayment, checkRoom, cleanAlbums, cleanUpload, graceDays, isOnline, orderBase, slugify,
  type Album, type CleanUpload,
} from "@/lib/photos/core";
import { getPhotoPlans, planOf } from "@/lib/photos/plans";
import { deleteObjects, objectSize, publicUrl, readUrl, uploadUrl } from "@/lib/photos/s3";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Payload docs are read field by field
type Doc = Record<string, any>;

const G = "photo-galleries" as const;
const I = "photo-items" as const;
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const secret = (what: string) => `${process.env.PAYLOAD_SECRET || "dev-secret-change-me"}:photos-${what}`;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const rand = (n: number) => randomBytes(n).toString("hex");
const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export const manageLink = (g: Doc) => `${siteUrl()}/p/${g.slug}/manage#k=${g.editToken}`;
export const guestLink = (g: Doc) => `${siteUrl()}/p/${g.slug}`;
const albumsOf = (g: Doc): Album[] => (Array.isArray(g.albums) && g.albums.length ? (g.albums as Album[]) : DEFAULT_ALBUMS);

/* ---------------- finding and authorising ---------------- */

export async function findGallery(payload: Payload, slug: string) {
  const r = await payload.find({ collection: G, where: { slug: { equals: String(slug).toLowerCase() } }, limit: 1, depth: 0, overrideAccess: true });
  return (r.docs[0] as Doc | undefined) ?? null;
}

/** The gallery, if the request carries its private key (header x-edit-token). */
export async function authorize(req: Request, payload: Payload, slug: string) {
  const g = await findGallery(payload, slug);
  const given = Buffer.from(req.headers.get("x-edit-token") ?? "");
  const real = Buffer.from(g?.editToken ?? "");
  if (!g || real.length === 0 || given.length !== real.length || !timingSafeEqual(given, real)) throw new PhotosError("This link isn't valid any more. Open the link from your email, or sign in with your email.", 403);
  return g;
}

/* ---------------- creating a gallery ---------------- */

export async function createGallery(payload: Payload, b: Doc) {
  const names = str(b.names, 80);
  const email = normEmail(b.email);
  if (names.length < 2) throw new PhotosError("Please enter your names, e.g. Aditi & Kabir");
  if (!validEmail(email)) throw new PhotosError("Please enter a valid email");
  const cfg = await getPhotoPlans(payload);
  const free = planOf(cfg, "free");
  const base = slugify(names) || "wedding";
  let slug = `${base}-${rand(2)}`;
  while (await findGallery(payload, slug)) slug = `${base}-${rand(3)}`;
  const date = b.weddingDate && !Number.isNaN(Date.parse(b.weddingDate)) ? new Date(b.weddingDate).toISOString() : undefined;
  const g = (await payload.create({
    collection: G,
    data: {
      names,
      slug,
      contactEmail: email,
      phone: String(b.phone ?? "").replace(/[^\d+]/g, "").slice(0, 16),
      ...(date ? { weddingDate: date } : {}),
      plan: "free",
      paymentStatus: "unpaid",
      state: "active",
      expiresAt: new Date(Date.now() + free.freeDays * 864e5).toISOString(),
      albums: DEFAULT_ALBUMS,
      editToken: rand(16),
      allowDownload: true,
      guestUploads: false,
      source: str(b.source, 60),
      inviteSlug: str(b.inviteSlug, 80),
    } as never,
    overrideAccess: true,
  })) as Doc;
  await sendWelcome(g).catch((e) => console.error("[photos] welcome email", e));
  return { slug: g.slug, token: g.editToken };
}

/* ---------------- usage ---------------- */

async function usage(payload: Payload, galleryId: string) {
  const r = await payload.find({ collection: I, where: { gallery: { equals: galleryId } }, pagination: false, depth: 0, overrideAccess: true, select: { kind: true, bytes: true, status: true } as never });
  let photos = 0, videos = 0, bytes = 0, videoBytes = 0;
  for (const d of r.docs as Doc[]) {
    if (d.kind === "video") {
      videos++;
      videoBytes += d.bytes ?? 0;
    } else photos++;
    bytes += d.bytes ?? 0;
  }
  return { photos, videos, bytes, videoBytes };
}

async function saveCounts(payload: Payload, galleryId: string) {
  const u = await usage(payload, galleryId);
  await payload.update({
    collection: G,
    id: galleryId,
    data: { photoCount: u.photos, videoCount: u.videos, storageMb: Math.round(u.bytes / 1024 ** 2), videoMb: Math.round(u.videoBytes / 1024 ** 2) } as never,
    overrideAccess: true,
    depth: 0,
  });
  return u;
}

/* ---------------- what the couple sees ---------------- */

type ItemOut = { i: string; k: string; a: string; s: string; t: string; d?: string; o?: string; v?: string; e?: string; w?: number; h?: number; n?: string; g?: string; by?: string; b?: number; dur?: number };

function itemOut(d: Doc, opts: { originals: boolean; full: boolean }): ItemOut {
  const f = (d.files ?? {}) as Record<string, { key: string }>;
  const out: ItemOut = { i: String(d.id), k: d.kind, a: d.album ?? "", s: d.status, t: f.t ? publicUrl(f.t.key) : "" };
  if (f.d) out.d = publicUrl(f.d.key);
  if (f.v) out.v = publicUrl(f.v.key);
  if (f.o && opts.originals) out.o = publicUrl(f.o.key);
  if (d.bunnyGuid && d.bunnyState === "ready") out.e = bunnyEmbedUrl(d.bunnyGuid);
  if (d.width) out.w = d.width;
  if (d.height) out.h = d.height;
  if (d.duration) out.dur = d.duration;
  if (d.guestName) out.g = d.guestName;
  if (opts.full) {
    out.n = d.name;
    out.by = d.by;
    out.b = d.bytes;
  }
  return out;
}

const sortItems = "takenAt";

/** Everything the dashboard needs. Also checks on videos that are with Bunny. */
export async function manageView(payload: Payload, g: Doc) {
  const cfg = await getPhotoPlans(payload);
  const plan = planOf(cfg, g.plan);
  const items = (await payload.find({ collection: I, where: { gallery: { equals: g.id }, status: { not_equals: "pending" } }, pagination: false, depth: 0, sort: sortItems, overrideAccess: true })).docs as Doc[];
  await refreshBunny(payload, items.filter((d) => d.bunnyState === "sent").slice(0, 4)).catch((e) => console.error("[photos] bunny refresh", e));
  const u = await usage(payload, String(g.id));
  return {
    gallery: {
      names: g.names,
      slug: g.slug,
      link: guestLink(g),
      email: g.contactEmail ?? "",
      phone: g.phone ?? "",
      weddingDate: g.weddingDate ?? null,
      message: g.message ?? "",
      albums: albumsOf(g),
      cover: g.cover ?? "",
      hasPin: Boolean(g.pinHash),
      guestUploads: Boolean(g.guestUploads) && plan.guestUploads,
      allowDownload: g.allowDownload !== false,
      plan: plan.id,
      paid: g.paymentStatus === "paid",
      expiresAt: g.expiresAt ?? null,
      online: isOnline(g),
      inviteSlug: g.inviteSlug ?? "",
    },
    plan,
    plans: cfg.plans,
    renewalPrice: cfg.renewalPrice,
    usage: { photos: u.photos, videos: u.videos, videoBytes: u.videoBytes, bytes: u.bytes },
    bunny: bunnyEnabled(),
    items: items.map((d) => itemOut(d, { originals: true, full: true })),
  };
}

/** Settings the couple can change. */
export async function saveSettings(payload: Payload, g: Doc, b: Doc) {
  const cfg = await getPhotoPlans(payload);
  const plan = planOf(cfg, g.plan);
  const data: Doc = {};
  if (b.names !== undefined) {
    const n = str(b.names, 80);
    if (n.length < 2) throw new PhotosError("Please enter your names");
    data.names = n;
  }
  if (b.message !== undefined) data.message = str(b.message, 600);
  if (b.albums !== undefined) {
    const albums = cleanAlbums(b.albums);
    // An album that still has photos can't be removed: move or delete them first.
    const gone = albumsOf(g).filter((a) => !albums.some((x) => x.id === a.id)).map((a) => a.id);
    if (gone.length) {
      const left = await payload.count({ collection: I, where: { gallery: { equals: g.id }, album: { in: gone }, status: { not_equals: "pending" } }, overrideAccess: true });
      if (left.totalDocs > 0) throw new PhotosError("Move or delete the photos in an album before removing it.");
    }
    data.albums = albums;
  }
  if (b.cover !== undefined) data.cover = str(b.cover, 40);
  if (b.pin !== undefined) {
    const pin = String(b.pin ?? "").replace(/\D/g, "");
    if (pin && (pin.length < 4 || pin.length > 8)) throw new PhotosError("Use a 4 to 8 digit PIN");
    data.pinHash = pin ? pinHash(String(g.id), pin) : "";
  }
  if (b.guestUploads !== undefined) {
    if (b.guestUploads && !plan.guestUploads) throw new PhotosError("Guest uploads are part of the Premium and Royal plans");
    data.guestUploads = Boolean(b.guestUploads);
    if (data.guestUploads) {
      const albums = (data.albums as Album[] | undefined) ?? albumsOf(g);
      if (!albums.some((a) => a.id === GUEST_ALBUM.id)) data.albums = [...albums, GUEST_ALBUM];
    }
  }
  if (b.allowDownload !== undefined) data.allowDownload = Boolean(b.allowDownload);
  if (b.weddingDate !== undefined) data.weddingDate = b.weddingDate && !Number.isNaN(Date.parse(b.weddingDate)) ? new Date(b.weddingDate).toISOString() : null;
  if (b.phone !== undefined) data.phone = String(b.phone ?? "").replace(/[^\d+]/g, "").slice(0, 16);
  if (b.inviteSlug !== undefined) data.inviteSlug = slugify(b.inviteSlug).slice(0, 80);
  await payload.update({ collection: G, id: g.id, data: data as never, overrideAccess: true, depth: 0 });
  return { ok: true };
}

/* ---------------- uploads ---------------- */

const keyFor = (base: string, part: string, ext = "jpg") => `${base}/${part}.${ext}`;

/**
 * Step 1 of an upload: checks the plan has room, makes a record for each file ("uploading") and hands back signed links.
 * The browser then PUTs each file straight to storage, and calls finishUploads.
 */
export async function startUploads(payload: Payload, g: Doc, list: unknown, guest?: { name: string }) {
  if (!isOnline(g)) throw new PhotosError("This gallery has expired. Renew it to add photos.", 402);
  const cfg = await getPhotoPlans(payload);
  const plan = planOf(cfg, g.plan);
  if (guest && !(g.guestUploads && plan.guestUploads)) throw new PhotosError("The couple hasn't turned on guest uploads", 403);
  const arr = Array.isArray(list) ? list : [];
  const cap = guest ? MAX.guestPerRequest : MAX.perRequest;
  if (!arr.length) throw new PhotosError("Nothing to upload");
  if (arr.length > cap) throw new PhotosError(`Send at most ${cap} files at a time`);
  const albums = albumsOf(g).map((a) => a.id);
  const clean: CleanUpload[] = arr.map((r) => cleanUpload(guest ? { ...(r as object), album: GUEST_ALBUM.id } : r, plan, guest ? [GUEST_ALBUM.id] : albums, Boolean(guest)));
  const u = await usage(payload, String(g.id));
  checkRoom(plan, u, clean);

  const out: { id: string; puts: { part: string; url: string; type: string }[] }[] = [];
  for (const c of clean) {
    const base = `g/${g.id}/${rand(10)}`;
    const files: Record<string, { key: string; size: number; type: string }> = { t: { key: keyFor(base, "t"), size: c.t, type: "image/jpeg" } };
    if (c.kind === "video") files.v = { key: keyFor(base, "v", VIDEO_TYPES[c.type!]), size: c.v!, type: c.type! };
    else {
      files.d = { key: keyFor(base, "d"), size: c.d!, type: "image/jpeg" };
      if (c.o) files.o = { key: keyFor(base, "o"), size: c.o, type: "image/jpeg" };
    }
    const bytes = Object.values(files).reduce((s, f) => s + f.size, 0);
    const doc = (await payload.create({
      collection: I,
      data: {
        gallery: g.id,
        kind: c.kind,
        album: guest ? GUEST_ALBUM.id : c.album,
        status: "pending",
        by: guest ? "guest" : "couple",
        name: c.name,
        ...(guest ? { guestName: guest.name } : {}),
        base,
        files,
        width: c.w,
        height: c.h,
        bytes,
        ...(c.dur ? { duration: c.dur } : {}),
        ...(c.takenAt ? { takenAt: c.takenAt } : {}),
      } as never,
      overrideAccess: true,
      depth: 0,
    })) as Doc;
    out.push({ id: String(doc.id), puts: Object.entries(files).map(([part, f]) => ({ part, url: uploadUrl(f.key, f.size, f.type), type: f.type })) });
  }
  return { items: out, ...(guest ? { ticket: guestTicket(String(g.id), out.map((o) => o.id)) } : {}) };
}

const guestTicket = (gid: string, ids: string[]) => createHmac("sha256", secret("guest")).update(`${gid}:${[...ids].sort().join(",")}`).digest("hex");

/** Step 2: checks the files arrived (and are the size we signed), then shows them. Guest photos wait for the couple's OK. */
export async function finishUploads(payload: Payload, g: Doc, rawIds: unknown, guestTicketGiven?: string) {
  const ids = (Array.isArray(rawIds) ? rawIds : []).map(String).slice(0, MAX.perRequest);
  if (guestTicketGiven !== undefined) {
    const want = guestTicket(String(g.id), ids);
    if (want.length !== String(guestTicketGiven).length || !timingSafeEqual(Buffer.from(want), Buffer.from(String(guestTicketGiven)))) throw new PhotosError("Not allowed", 403);
  }
  const docs = (await payload.find({ collection: I, where: { gallery: { equals: g.id }, id: { in: ids }, status: { equals: "pending" } }, pagination: false, depth: 0, overrideAccess: true })).docs as Doc[];
  const cfg = await getPhotoPlans(payload);
  const plan = planOf(cfg, g.plan);
  const done: string[] = [], failed: string[] = [];
  for (const d of docs) {
    const files = Object.values((d.files ?? {}) as Record<string, { key: string; size: number }>);
    const sizes = await Promise.all(files.map((f) => objectSize(f.key)));
    if (sizes.some((s, i) => s === null || s !== files[i].size)) {
      failed.push(String(d.id));
      continue;
    }
    // The album may have been removed while this file was uploading.
    const album = albumsOf(g).some((a) => a.id === d.album) ? d.album : (albumsOf(g)[0]?.id ?? d.album);
    await payload.update({ collection: I, id: d.id, data: { status: d.by === "guest" ? "review" : "ready", album } as never, overrideAccess: true, depth: 0 });
    done.push(String(d.id));
    // Optional smoother playback for Premium/Royal videos.
    if (d.kind === "video" && bunnyEnabled() && plan.videoGb > 0 && d.files?.v?.key) {
      try {
        await bunnyFetch(readUrl(d.files.v.key), String(d.id));
        await payload.update({ collection: I, id: d.id, data: { bunnyState: "sent" } as never, overrideAccess: true, depth: 0 });
      } catch (e) {
        console.error("[photos] bunny fetch", e);
      }
    }
  }
  await saveCounts(payload, String(g.id));
  if (!g.cover && done.length) {
    const first = docs.find((d) => d.kind === "photo" && done.includes(String(d.id)) && d.by !== "guest");
    if (first) await payload.update({ collection: G, id: g.id, data: { cover: String(first.id) } as never, overrideAccess: true, depth: 0 });
  }
  return { done, failed };
}

async function removeItems(payload: Payload, docs: Doc[]) {
  const keys = docs.flatMap((d) => Object.values((d.files ?? {}) as Record<string, { key: string }>).map((f) => f.key));
  await deleteObjects(keys);
  for (const d of docs) if (d.bunnyGuid) await bunnyDelete(d.bunnyGuid);
  if (docs.length) await payload.delete({ collection: I, where: { id: { in: docs.map((d) => d.id) } }, overrideAccess: true });
}

/** Delete, move to another album, approve or hide/show photos. */
export async function itemAction(payload: Payload, g: Doc, b: Doc) {
  const ids = (Array.isArray(b.ids) ? b.ids : []).map(String).slice(0, 2000);
  if (!ids.length) throw new PhotosError("Choose some photos first");
  const where = { gallery: { equals: g.id }, id: { in: ids } };
  if (b.action === "delete") {
    const docs = (await payload.find({ collection: I, where, pagination: false, depth: 0, overrideAccess: true })).docs as Doc[];
    await removeItems(payload, docs);
    if (g.cover && ids.includes(String(g.cover))) await payload.update({ collection: G, id: g.id, data: { cover: "" } as never, overrideAccess: true, depth: 0 });
    await saveCounts(payload, String(g.id));
    return { ok: true, deleted: docs.length };
  }
  const set: Doc =
    b.action === "move" ? (albumsOf(g).some((a) => a.id === b.album) ? { album: b.album } : (() => { throw new PhotosError("Choose an album"); })())
    : b.action === "approve" || b.action === "show" ? { status: "ready" }
    : b.action === "hide" ? { status: "hidden" }
    : (() => { throw new PhotosError("Unknown action"); })();
  await payload.update({ collection: I, where: { ...where, status: { not_equals: "pending" } }, data: set as never, overrideAccess: true, depth: 0 });
  return { ok: true };
}

/** Bunny tells us its id only via search, and when encoding is done only when asked. */
async function refreshBunny(payload: Payload, docs: Doc[]) {
  if (!bunnyEnabled()) return;
  for (const d of docs) {
    const guid = d.bunnyGuid || (await bunnyFind(String(d.id)));
    if (!guid) continue;
    const st = await bunnyStatus(guid);
    const next = st === "ready" ? "ready" : st === "failed" ? "failed" : "sent";
    if (guid !== d.bunnyGuid || next !== d.bunnyState) {
      await payload.update({ collection: I, id: d.id, data: { bunnyGuid: guid, bunnyState: next } as never, overrideAccess: true, depth: 0 });
      d.bunnyGuid = guid;
      d.bunnyState = next;
    }
  }
}

/* ---------------- what guests see ---------------- */

const pinHash = (gid: string, pin: string) => createHash("sha256").update(`${secret("pin")}:${gid}:${pin}`).digest("hex");
/** What a guest's browser keeps after typing the PIN. Changes when the couple changes the PIN. */
const passFor = (g: Doc) => createHmac("sha256", secret("pass")).update(`${g.id}:${g.pinHash}`).digest("hex").slice(0, 40);

export function checkPin(g: Doc, pin: unknown) {
  if (!g.pinHash) return { pass: "" };
  const want = Buffer.from(String(g.pinHash));
  const got = Buffer.from(pinHash(String(g.id), String(pin ?? "").replace(/\D/g, "")));
  if (want.length !== got.length || !timingSafeEqual(want, got)) throw new PhotosError("That PIN isn't right", 401);
  return { pass: passFor(g) };
}

export const passOk = (g: Doc, given: string | null) => !g.pinHash || (given !== null && given.length === 40 && timingSafeEqual(Buffer.from(given), Buffer.from(passFor(g))));

export const PAGE = 300;

/** The gallery for guests: one album at a time, PAGE photos per call. */
export async function publicView(payload: Payload, g: Doc, opts: { pass: string | null; album?: string | null; page?: number }) {
  const head = { names: g.names, slug: g.slug };
  if (!isOnline(g)) return { ...head, expired: true };
  if (!passOk(g, opts.pass)) return { ...head, needPin: true };
  const cfg = await getPhotoPlans(payload);
  const plan = planOf(cfg, g.plan);
  const counts = await Promise.all(
    albumsOf(g).map(async (a) => ({ ...a, n: (await payload.count({ collection: I, where: { gallery: { equals: g.id }, album: { equals: a.id }, status: { equals: "ready" } }, overrideAccess: true })).totalDocs })),
  );
  const albums = counts.filter((a) => a.n > 0);
  const album = albums.find((a) => a.id === opts.album)?.id ?? albums[0]?.id ?? null;
  const page = Math.max(1, Math.min(1000, Math.round(Number(opts.page) || 1)));
  const res = album
    ? await payload.find({ collection: I, where: { gallery: { equals: g.id }, album: { equals: album }, status: { equals: "ready" } }, limit: PAGE, page, sort: sortItems, depth: 0, overrideAccess: true })
    : { docs: [], hasNextPage: false };
  const docs = res.docs as Doc[];
  await refreshBunny(payload, docs.filter((d) => d.bunnyState === "sent").slice(0, 2)).catch(() => null);
  let cover: string | null = null;
  if (g.cover) {
    const c = (await payload.find({ collection: I, where: { id: { equals: g.cover }, gallery: { equals: g.id } }, limit: 1, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] }))).docs[0] as Doc | undefined;
    if (c?.files?.d) cover = publicUrl(c.files.d.key);
  }
  const download = g.allowDownload !== false;
  return {
    ...head,
    message: g.message ?? "",
    weddingDate: g.weddingDate ?? null,
    cover,
    albums: albums.map((a) => ({ id: a.id, name: a.name, n: a.n })),
    album,
    page,
    more: Boolean(res.hasNextPage),
    download,
    guestUploads: Boolean(g.guestUploads) && plan.guestUploads && isOnline(g),
    branding: g.paymentStatus !== "paid",
    items: docs.map((d) => {
      const o = itemOut(d, { originals: download && plan.originals, full: false });
      if (!download) delete o.o;
      return o;
    }),
  };
}

/* ---------------- payments ---------------- */

export async function quote(payload: Payload, g: Doc, want: string, coupon?: string) {
  const cfg = await getPhotoPlans(payload);
  const { base, full, name } = orderBase(cfg.plans, cfg.renewalPrice, g, want);
  if (!coupon) return { total: base, discount: 0, name };
  const q = await quoteWithCode(payload, coupon, { kind: "photos", plan: want, name: want === "renew" ? "renewals" : `the ${name} plan` }, base, full);
  if (q.error) throw new PhotosError(q.error);
  return { total: q.total, discount: q.discount, name, label: q.label };
}

/** Marks a gallery paid once Razorpay confirms the order. Safe to call twice (verify + webhook). */
export async function markPhotosPaid(payload: Payload, orderId: string, paymentId?: string) {
  const found = await payload.find({ collection: G, where: { orderId: { equals: orderId } }, limit: 1, depth: 0, overrideAccess: true });
  const g = found.docs[0] as Doc | undefined;
  if (!g) return { found: false as const };
  if (g.lastPaidOrder === orderId) return { found: true as const, alreadyPaid: true };
  const cfg = await getPhotoPlans(payload);
  const bought = String(g.orderPlan ?? "basic");
  const next = afterPayment(cfg.plans, g, bought);
  const plan = planOf(cfg, next.plan);
  await payload.update({
    collection: G,
    id: g.id,
    data: {
      plan: next.plan,
      expiresAt: next.expiresAt,
      paymentStatus: "paid",
      state: "active",
      paidAt: new Date().toISOString(),
      lastPaidOrder: orderId,
      reminderSentAt: null,
      ...(plan.guestUploads ? {} : { guestUploads: false }),
      ...(paymentId ? { paymentId } : {}),
    } as never,
    overrideAccess: true,
    depth: 0,
  });
  await sendPaid({ ...g, plan: next.plan, expiresAt: next.expiresAt }, plan.name, bought === "renew").catch((e) => console.error("[photos] paid email", e));
  return { found: true as const, alreadyPaid: false };
}

/* ---------------- Shaadi pack ---------------- */

/**
 * Shaadi pack paid in the wedding planner: the couple's gallery goes onto the pack's photo plan. Uses the gallery
 * already linked to the planner, else the newest gallery on the owner's email, else makes one. A gallery already on
 * the same or a bigger paid plan only keeps the later end date. Emails the couple their private dashboard link.
 */
export async function grantPackGallery(
  payload: Payload,
  o: { email: string; names: string; weddingDate?: string; inviteSlug?: string; slug?: string | null; planId: string; note: string },
) {
  const cfg = await getPhotoPlans(payload);
  const plan = cfg.plans.find((p) => p.id === o.planId && p.price > 0) ?? planOf(cfg, "premium");
  const email = normEmail(o.email);
  let g = o.slug ? await findGallery(payload, o.slug) : null;
  if (!g && validEmail(email)) {
    const r = await payload.find({ collection: G, where: { contactEmail: { equals: email } }, sort: "-createdAt", limit: 1, depth: 0, overrideAccess: true });
    g = (r.docs[0] as Doc | undefined) ?? null;
  }
  if (!g) {
    const names = str(o.names, 80) || "Our wedding";
    const base = slugify(names) || "wedding";
    let slug = `${base}-${rand(2)}`;
    while (await findGallery(payload, slug)) slug = `${base}-${rand(3)}`;
    const date = o.weddingDate && !Number.isNaN(Date.parse(o.weddingDate)) ? new Date(o.weddingDate).toISOString() : undefined;
    g = (await payload.create({
      collection: G,
      data: {
        names, slug, contactEmail: email, ...(date ? { weddingDate: date } : {}),
        plan: "free", paymentStatus: "unpaid", state: "active", expiresAt: new Date().toISOString(),
        albums: DEFAULT_ALBUMS, editToken: rand(16), allowDownload: true, guestUploads: false,
        source: "shaadi-pack", inviteSlug: str(o.inviteSlug, 80),
      } as never,
      overrideAccess: true,
    })) as Doc;
  }
  const rank = (id?: string | null) => cfg.plans.findIndex((p) => p.id === id);
  const keepPlan = g.paymentStatus === "paid" && rank(g.plan) > rank(plan.id);
  const next = afterPayment(cfg.plans, g, plan.id);
  const data = {
    plan: keepPlan ? g.plan : next.plan,
    expiresAt: next.expiresAt,
    paymentStatus: "paid",
    state: "active",
    paidAt: new Date().toISOString(),
    reminderSentAt: null,
    ...(g.inviteSlug || !o.inviteSlug ? {} : { inviteSlug: str(o.inviteSlug, 80) }),
    manualNote: [g.manualNote, o.note].filter(Boolean).join(" · "),
  };
  const done = (await payload.update({ collection: G, id: g.id, data: data as never, overrideAccess: true, depth: 0 })) as Doc;
  await sendPaid(done, planOf(cfg, done.plan).name, false).catch((e) => console.error("[photos] pack email", e));
  return done;
}

/* ---------------- sign in with email (lost link) ---------------- */

const CODE_MINUTES = 15;

/** Emails a 6-digit code if this email owns a gallery. Answers the same either way. */
export async function startAccess(payload: Payload, rawEmail: unknown) {
  const email = normEmail(rawEmail);
  if (!validEmail(email)) throw new PhotosError("Please enter a valid email");
  const mine = (await payload.find({ collection: G, where: { contactEmail: { equals: email } }, limit: 20, depth: 0, overrideAccess: true, sort: "-createdAt" })).docs as Doc[];
  if (!mine.length) return { ok: true };
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const k = `photos:*:${email}`;
  await payload.delete({ collection: "planner-logins", where: { email: { equals: k } }, overrideAccess: true }).catch(() => null);
  await payload.create({ collection: "planner-logins", data: { email: k, codeHash: hashCode(secret("code"), k, code), expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000).toISOString(), attempts: 0 } as never, overrideAccess: true });
  await sendWithBrevo({
    to: [{ email }],
    subject: `${code} is your code for your wedding photo gallery`,
    html: shell(`<h2 style="margin:0 0 8px;color:#3B1F4A">Open your gallery</h2><p>Type this code to open your wedding photo gallery:</p>
      <p style="font-size:34px;letter-spacing:8px;font-weight:700;color:#3B1F4A;margin:14px 0">${code}</p>
      <p style="font-size:13px;color:#666">It works for ${CODE_MINUTES} minutes. Didn't ask for it? You can ignore this email.</p>`),
    text: `Your code is ${code}. It works for ${CODE_MINUTES} minutes.`,
  });
  return { ok: true, ...(process.env.BREVO_API_KEY || process.env.NODE_ENV === "production" ? {} : { devCode: code }) };
}

/** Checks the code and returns the owner's galleries with their private keys. */
export async function verifyAccess(payload: Payload, rawEmail: unknown, rawCode: unknown) {
  const email = normEmail(rawEmail), code = String(rawCode ?? "").replace(/\D/g, "");
  const k = `photos:*:${email}`;
  const row = (await payload.find({ collection: "planner-logins", where: { email: { equals: k } }, limit: 1, sort: "-createdAt", depth: 0, overrideAccess: true })).docs[0] as Doc | undefined;
  if (!row || new Date(row.expiresAt).getTime() < Date.now()) throw new PhotosError("That code has expired. Ask for a new one.", 401);
  if ((row.attempts ?? 0) >= 5) throw new PhotosError("Too many wrong tries. Ask for a new code.", 429);
  if (code.length !== 6 || !codesMatch(row.codeHash, hashCode(secret("code"), k, code))) {
    await payload.update({ collection: "planner-logins", id: row.id, data: { attempts: (row.attempts ?? 0) + 1 } as never, overrideAccess: true });
    throw new PhotosError("That code isn't right. Check the latest email, or ask for a new code.", 401);
  }
  await payload.delete({ collection: "planner-logins", where: { email: { equals: k } }, overrideAccess: true });
  const mine = (await payload.find({ collection: G, where: { contactEmail: { equals: email } }, limit: 20, depth: 0, overrideAccess: true, sort: "-createdAt" })).docs as Doc[];
  return { galleries: mine.map((g) => ({ names: g.names, slug: g.slug, token: g.editToken, plan: g.plan })) };
}

/* ---------------- daily clean-up ---------------- */

/** Deletes every file of a gallery and its records (the gallery record stays, marked "files deleted"). */
export async function purgeGalleryFiles(payload: Payload, galleryId: string) {
  for (;;) {
    const docs = (await payload.find({ collection: I, where: { gallery: { equals: galleryId } }, limit: 200, depth: 0, overrideAccess: true })).docs as Doc[];
    if (!docs.length) break;
    await removeItems(payload, docs);
  }
}

/**
 * Run once a day (GET /api/photos/cron with Authorization: Bearer CRON_SECRET):
 * expiry reminders, hiding expired galleries, deleting files after the grace period, and clearing uploads that never finished.
 */
export async function dailyCron(payload: Payload, now = new Date()) {
  const cfg = await getPhotoPlans(payload);
  const out = { reminded: 0, expired: 0, purged: 0, stale: 0 };
  const soon = new Date(now.getTime() + cfg.reminderDays * 864e5).toISOString();

  const remind = (await payload.find({ collection: G, where: { state: { equals: "active" }, expiresAt: { less_than: soon, greater_than: now.toISOString() }, reminderSentAt: { exists: false } }, limit: 200, depth: 0, overrideAccess: true })).docs as Doc[];
  for (const g of remind) {
    await sendReminder(g, cfg.renewalPrice).catch((e) => console.error("[photos] reminder", e));
    await payload.update({ collection: G, id: g.id, data: { reminderSentAt: now.toISOString() } as never, overrideAccess: true, depth: 0 });
    out.reminded++;
  }

  const exp = await payload.update({ collection: G, where: { state: { equals: "active" }, expiresAt: { less_than: now.toISOString() } }, data: { state: "expired" } as never, overrideAccess: true, depth: 0 });
  out.expired = exp.docs.length;

  const old = (await payload.find({ collection: G, where: { state: { equals: "expired" } }, limit: 100, depth: 0, overrideAccess: true })).docs as Doc[];
  for (const g of old) {
    const end = new Date(g.expiresAt ?? now).getTime() + graceDays(g.paymentStatus) * 864e5;
    if (end > now.getTime()) continue;
    await purgeGalleryFiles(payload, String(g.id));
    await payload.update({ collection: G, id: g.id, data: { state: "purged", purgedAt: now.toISOString(), photoCount: 0, videoCount: 0, storageMb: 0, videoMb: 0, cover: "" } as never, overrideAccess: true, depth: 0 });
    out.purged++;
  }

  const stale = (await payload.find({ collection: I, where: { status: { equals: "pending" }, createdAt: { less_than: new Date(now.getTime() - 12 * 3600e3).toISOString() } }, limit: 500, depth: 0, overrideAccess: true })).docs as Doc[];
  await removeItems(payload, stale);
  out.stale = stale.length;
  return out;
}

/* ---------------- emails ---------------- */

const shell = (inner: string) =>
  `<!doctype html><html><body style="margin:0;background:#FBF5EA;font-family:Arial,Helvetica,sans-serif;color:#2A2A2A"><div style="max-width:520px;margin:0 auto;padding:32px 20px"><div style="background:#FFFDF8;border:1px solid #EBE2EF;border-radius:24px;padding:28px">${inner}</div></div></body></html>`;
const button = (href: string, text: string) => `<p><a href="${href}" style="display:inline-block;padding:12px 20px;background:#7a1424;color:#fff;border-radius:999px;text-decoration:none;font-weight:600">${text}</a></p>`;

async function sendWelcome(g: Doc) {
  if (!g.contactEmail) return;
  await sendWithBrevo({
    to: [{ email: g.contactEmail }],
    subject: "Your wedding photo gallery is ready 📸",
    html: shell(`<h2 style="margin:0 0 8px">Congratulations, ${esc(g.names)}!</h2>
      <p>Your gallery is ready. Add photos from your dashboard:</p>${button(manageLink(g), "Open my dashboard")}
      <p>Keep this email: the button above is your private link. Anyone with it can change your gallery.</p>
      <p>Guests will open: <a href="${guestLink(g)}">${guestLink(g)}</a></p>`),
  });
}

async function sendPaid(g: Doc, planName: string, renewal: boolean) {
  if (!g.contactEmail) return;
  const until = new Date(g.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  await sendWithBrevo({
    to: [{ email: g.contactEmail }],
    subject: renewal ? "Your wedding gallery is renewed" : `Your ${planName} wedding gallery is active`,
    html: shell(`<h2 style="margin:0 0 8px">Thank you!</h2>
      <p>${renewal ? "Your gallery stays online" : `Your gallery is now on the ${esc(planName)} plan and stays online`} until <b>${until}</b>.</p>
      ${button(manageLink(g), "Open my dashboard")}<p>Share with guests: <a href="${guestLink(g)}">${guestLink(g)}</a></p>`),
  });
}

async function sendReminder(g: Doc, renewalPrice: number) {
  if (!g.contactEmail) return;
  const until = new Date(g.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const paid = g.paymentStatus === "paid";
  await sendWithBrevo({
    to: [{ email: g.contactEmail }],
    subject: "Your wedding photo gallery goes offline soon",
    html: shell(`<h2 style="margin:0 0 8px">Keep your memories online</h2>
      <p>Your gallery (${esc(g.names)}) goes offline on <b>${until}</b>. ${
        paid ? `Keep it for another year for ₹${renewalPrice.toLocaleString("en-IN")}.` : "Choose a plan to keep it and add all your photos."
      }</p>
      <p>After it goes offline we keep your photos for ${graceDays(g.paymentStatus)} more days, then delete them for good.</p>
      ${button(manageLink(g), paid ? "Renew my gallery" : "Choose a plan")}`),
  });
}
