/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Stays admin API. Only the site's administrators (the Payload /admin login) get past the first check.
 *   GET  ?a=overview | properties | property&id= | hosts | host&id= | enquiries | pricing | audit | notifications | settings | shares&id= | offline&ids=
 *   POST ?a=property_create | property_save | property_action | property_duplicate | property_archive | property_delete | property_verify | bulk
 *          | host_changes | media_* | host_save | host_invite | share_create | share_revoke | enquiry_save | enquiry_update | enquiry_delete
 *          | settings_save | amenity_add | amenity_delete | notifications_read | offline_sync | maps_resolve
 */
import { NextRequest, NextResponse } from "next/server";
import { AMENITY_CATEGORIES, ENQUIRY_STATUSES, ENQUIRY_TYPES, VISIBILITIES, AVAILABILITY, type Settings } from "@/lib/stays/constants";
import { cleanDate, cleanGuests, cleanMoney, cleanPrefix, coordsFromMapsUrl, margins, slugify, waNumber } from "@/lib/stays/core";
import { cleanAdminInput, cleanHostInput, missingForReview, str, text } from "@/lib/stays/property";
import { NEEDS_REASON, stampsFor, transition } from "@/lib/stays/workflow";
import { createProperty, destroyMedia, mediaAction, offlineMerge, OFFLINE_FIELDS, store, withAdminInput, withHostInput } from "@/lib/stays/actions";
import {
  adminFrom, amenityDefs, audit, bustCards, dbs, getSettings, nextHostCode, rid, sameOrigin, tokenHash, type Actor, type C,
} from "@/lib/stays/server";
import { adminProperty, offlineBundle, type StoredProperty } from "@/lib/stays/views";

export const dynamic = "force-dynamic";

const json = (v: unknown, status = 200) => NextResponse.json(v, { status, headers: { "cache-control": "no-store, private" } });
const siteUrl = (req: NextRequest) => process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;

async function hostsById(c: C, ids: (string | null)[]) {
  const list = await c.hosts.find({ _id: { $in: [...new Set(ids.filter(Boolean))] } }).toArray();
  return new Map<string, any>(list.map((h: any) => [h._id, h]));
}

/** Short row for tables, grid and the private map. */
function row(p: StoredProperty, h: any) {
  const v = adminProperty(p, h);
  const cover = v.media.find((m: any) => m.id === p.coverId && m.type === "image") || v.media.find((m: any) => m.type === "image");
  return {
    id: v.id, code: v.code, slug: v.slug, title: v.title, ownership: v.ownership, host: v.host ? { id: v.host.id, name: v.host.name, phone: v.host.phone } : null,
    status: v.status, statusLabel: v.statusLabel, visibility: v.visibility, availability: v.availability, featured: v.featured, showPrice: v.showPrice,
    city: p.location?.city || "", locality: p.location?.locality || "", society: p.location?.society || "",
    lat: p.location?.lat ?? null, lng: p.location?.lng ?? null,
    propertyType: p.propertyType, bedrooms: p.rooms?.bedrooms ?? null, bathrooms: p.rooms?.bathrooms ?? null, beds: p.rooms?.beds ?? null, maxGuests: p.rooms?.maxGuests ?? null,
    amenities: p.amenities || [], features: p.features || [],
    pricing: p.pricing, margins: v.margins, cover: cover ? cover.thumb : null, mediaCount: (p.media || []).length,
    pendingMedia: (p.media || []).filter((m) => m.pending || m.removalRequested).length,
    hostChanges: !!p.hostChanges, publishRequested: !!p.publishRequested, archived: !!p.archived,
    createdAt: p.createdAt, updatedAt: p.updatedAt, lastVerifiedAt: p.lastVerifiedAt ?? null,
  };
}

async function fullProperty(c: C, p: StoredProperty) {
  const h = p.hostId ? await c.hosts.findOne({ _id: p.hostId }) : null;
  const shares = await c.shares.find({ propertyId: p._id }).sort({ createdAt: -1 }).toArray();
  const history = await c.audit.find({ propertyId: p._id }).sort({ at: -1 }).limit(50).toArray();
  return { ...adminProperty(p, h), shares, history };
}

export async function GET(req: NextRequest) {
  const actor = await adminFrom(req);
  if (!actor) return json({ error: "Administrator sign-in required" }, 401);
  const a = req.nextUrl.searchParams.get("a") || "";
  const c = await dbs();
  const q = req.nextUrl.searchParams;

  if (a === "settings") return json({ settings: await getSettings(c), amenities: (await c.amenities.find({}).sort({ category: 1, label: 1 }).toArray()).map((x: any) => ({ key: x._id, label: x.label, category: x.category, custom: !!x.custom })), me: { name: actor.name, email: actor.email } });

  if (a === "overview") {
    const ps: StoredProperty[] = await c.properties.find({}).toArray();
    const live = ps.filter((p) => !p.archived);
    const count = (f: (p: StoredProperty) => boolean) => live.filter(f).length;
    const hosts = await c.hosts.countDocuments({});
    const recentEnq = await c.enquiries.find({}).sort({ createdAt: -1 }).limit(8).toArray();
    const hmap = await hostsById(c, live.map((p) => p.hostId));
    const since = Date.now() - 30 * 864e5;
    const enq30 = await c.enquiries.countDocuments({ createdAt: { $gt: since } });
    return json({
      counts: {
        total: live.length, own: count((p) => p.ownership === "own"), host: count((p) => p.ownership === "host"),
        published: count((p) => p.status === "published"), publicLive: count((p) => p.status === "published" && p.visibility === "public"),
        unlisted: count((p) => p.visibility === "unlisted"), private: count((p) => p.visibility === "private"),
        pending: count((p) => p.status === "submitted" || p.status === "under_review"),
        inactive: count((p) => p.status === "inactive"), archived: ps.length - live.length,
        hostChanges: count((p) => !!p.hostChanges || (p.media || []).some((m) => m.pending || m.removalRequested)),
        publishRequests: count((p) => !!p.publishRequested),
        missingPrices: count((p) => margins(p.pricing).missing),
        hosts, enquiries30: enq30,
      },
      recentSubmissions: live.filter((p) => p.submittedAt).sort((x, y) => (y.submittedAt || 0) - (x.submittedAt || 0)).slice(0, 6).map((p) => row(p, hmap.get(p.hostId || ""))),
      recentUpdates: [...live].sort((x, y) => y.updatedAt - x.updatedAt).slice(0, 6).map((p) => row(p, hmap.get(p.hostId || ""))),
      recentEnquiries: recentEnq,
      notifications: await c.notifications.find({ read: false }).sort({ at: -1 }).limit(20).toArray(),
    });
  }
  if (a === "properties" || a === "pricing") {
    const archived = q.get("archived") === "1";
    const ps: StoredProperty[] = await c.properties.find(archived ? { archived: true } : { archived: { $ne: true } }).sort({ updatedAt: -1 }).toArray();
    const hmap = await hostsById(c, ps.map((p) => p.hostId));
    return json(ps.map((p) => row(p, hmap.get(p.hostId || ""))));
  }
  if (a === "property") {
    const p = await c.properties.findOne({ _id: String(q.get("id") || "") });
    return p ? json(await fullProperty(c, p)) : json({ error: "Not found" }, 404);
  }
  if (a === "hosts") {
    const hosts = await c.hosts.find({}).sort({ createdAt: -1 }).toArray();
    const ps: StoredProperty[] = await c.properties.find({ hostId: { $ne: null } }, { projection: { hostId: 1, status: 1, archived: 1 } }).toArray();
    return json(hosts.map((h: any) => {
      const mine = ps.filter((p) => p.hostId === h._id && !p.archived);
      return {
        id: h._id, hostCode: h.hostCode, name: h.name, ownerName: h.ownerName || "", email: h.email || "", phone: h.phone || "", whatsapp: h.whatsapp || "",
        payout: h.payout || "", notes: h.notes || "", status: h.status, hasLogin: !!h.passwordHash, invited: !!h.inviteHash && h.inviteExpires > Date.now(),
        createdAt: h.createdAt, lastLoginAt: h.lastLoginAt || null,
        total: mine.length, approved: mine.filter((p) => ["approved", "published"].includes(p.status)).length,
        pending: mine.filter((p) => ["submitted", "under_review"].includes(p.status)).length,
      };
    }));
  }
  if (a === "enquiries") {
    const list = await c.enquiries.find({}).sort({ createdAt: -1 }).limit(1000).toArray();
    return json(list);
  }
  if (a === "audit") {
    const filter = q.get("id") ? { propertyId: q.get("id") } : {};
    return json(await c.audit.find(filter).sort({ at: -1 }).limit(300).toArray());
  }
  if (a === "notifications") return json(await c.notifications.find({}).sort({ at: -1 }).limit(100).toArray());
  if (a === "shares") return json(await c.shares.find({ propertyId: String(q.get("id") || "") }).sort({ createdAt: -1 }).toArray());
  if (a === "offline") {
    // Guest-safe data only: what the admin's phone keeps for offline use.
    const ids = String(q.get("ids") || "").split(",").filter(Boolean).slice(0, 200);
    const ps: StoredProperty[] = await c.properties.find({ _id: { $in: ids } }).toArray();
    const am = await amenityDefs(c);
    return json(ps.map((p) => offlineBundle(p, am)));
  }
  return json({ error: "Unknown request" }, 400);
}

/** Admin input → property changes, checking the chosen host exists. */
async function applyAdmin(c: C, p: StoredProperty, b: any) {
  const keys = new Set((await amenityDefs(c)).map((x) => x.key));
  const input = cleanAdminInput(b, keys);
  if (input.ownership === "host") {
    if (!input.hostId || !(await c.hosts.findOne({ _id: input.hostId }))) return { error: "Choose the host this property belongs to" };
  }
  return { next: withAdminInput(p, input) };
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: "Forbidden" }, 403);
  const actor = await adminFrom(req);
  if (!actor) return json({ error: "Administrator sign-in required" }, 401);
  const a = req.nextUrl.searchParams.get("a") || "";
  const b: any = await req.json().catch(() => ({}));
  const c = await dbs();
  const s = await getSettings(c);

  // ----- settings -----
  if (a === "settings_save") return json(await saveSettings(c, actor, s, b));
  if (a === "amenity_add") {
    const label = str(b.label, 60);
    const category = (AMENITY_CATEGORIES as readonly string[]).includes(b.category) ? b.category : "Other";
    if (!label) return json({ error: "Enter the amenity name" }, 400);
    let key = slugify(label).replace(/-/g, "_").slice(0, 40) || rid(4);
    if (await c.amenities.findOne({ _id: key })) {
      const ex = await c.amenities.findOne({ _id: key });
      if (ex.label.toLowerCase() === label.toLowerCase()) return json({ error: "That amenity already exists" }, 409);
      key = `${key}_${rid(3).toLowerCase()}`;
    }
    await c.amenities.insertOne({ _id: key, key, label, category, custom: true, createdAt: Date.now() });
    return json({ key, label, category, custom: true });
  }
  if (a === "amenity_delete") {
    const am = await c.amenities.findOne({ _id: String(b.key || "") });
    if (!am) return json({ error: "Not found" }, 404);
    const used = await c.properties.countDocuments({ amenities: am._id });
    if (used) return json({ error: `Used by ${used} propert${used === 1 ? "y" : "ies"}; remove it from them first` }, 409);
    await c.amenities.deleteOne({ _id: am._id });
    return json({ ok: true });
  }
  if (a === "notifications_read") {
    await c.notifications.updateMany(b.id ? { _id: String(b.id) } : { read: false }, { $set: { read: true } });
    return json({ ok: true });
  }
  if (a === "maps_resolve") {
    // Short Google Maps links (maps.app.goo.gl) don't contain coordinates; follow the redirect to find them.
    const url = String(b.url || "");
    const direct = coordsFromMapsUrl(url);
    if (direct) return json(direct);
    let u: URL;
    try { u = new URL(url); } catch { return json({ error: "Not a link" }, 400); }
    if (u.protocol !== "https:" || !["maps.app.goo.gl", "goo.gl"].includes(u.hostname)) return json({ error: "Paste a Google Maps link" }, 400);
    try {
      let next = u.toString();
      for (let i = 0; i < 4; i++) {
        const r = await fetch(next, { redirect: "manual", signal: AbortSignal.timeout(5000) });
        const loc = r.headers.get("location");
        if (!loc) break;
        next = new URL(loc, next).toString();
        const got = coordsFromMapsUrl(next);
        if (got) return json(got);
        if (!/^https:\/\/([a-z0-9-]+\.)*(google\.[a-z.]+|goo\.gl)\//.test(next)) break;
      }
    } catch { /* fall through */ }
    return json({ error: "Couldn't read the location from that link. Open it, then copy the address bar link (it contains @lat,lng), or tap the map to place the pin." }, 422);
  }

  // ----- hosts -----
  if (a === "host_save") {
    const name = str(b.name, 80);
    if (!name) return json({ error: "Enter the host's name" }, 400);
    const e = String(b.email || "").trim().toLowerCase().slice(0, 160);
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return json({ error: "That email doesn't look right" }, 400);
    const status = ["active", "suspended", "left"].includes(b.status) ? b.status : "active";
    const fields = {
      name, ownerName: str(b.ownerName, 80), phone: String(b.phone || "").replace(/[^\d+]/g, "").slice(0, 16), whatsapp: String(b.whatsapp || "").replace(/[^\d+]/g, "").slice(0, 16),
      payout: text(b.payout, 600), notes: text(b.notes, 4000), status, updatedAt: Date.now(),
    };
    if (b.id) {
      const h = await c.hosts.findOne({ _id: String(b.id) });
      if (!h) return json({ error: "Not found" }, 404);
      if (e && (await c.hosts.findOne({ email: e, _id: { $ne: h._id } }))) return json({ error: "Another host already uses this email" }, 409);
      const set: any = { ...fields, ...(e ? { email: e } : {}) };
      if (status !== "active" && h.status === "active") set.sv = (h.sv || 0) + 1; // signs them out everywhere
      await c.hosts.updateOne({ _id: h._id }, e ? { $set: set } : { $set: set, $unset: { email: "" } });
      await audit(c, actor, "host_update", null, [], { hostId: h._id });
      return json({ id: h._id });
    }
    if (e && (await c.hosts.findOne({ email: e }))) return json({ error: "A host with this email already exists" }, 409);
    const h = { _id: rid(), hostCode: await nextHostCode(c), ...fields, ...(e ? { email: e } : {}), sv: 0, createdAt: Date.now(), source: "admin" };
    await c.hosts.insertOne(h);
    await audit(c, actor, "host_create", null, [], { hostId: h._id });
    return json({ id: h._id, hostCode: h.hostCode });
  }
  if (a === "host_invite") {
    const h = await c.hosts.findOne({ _id: String(b.id || "") });
    if (!h) return json({ error: "Not found" }, 404);
    const token = rid(24);
    await c.hosts.updateOne({ _id: h._id }, { $set: { inviteHash: tokenHash(token), inviteExpires: Date.now() + 14 * 864e5 } });
    return json({ link: `${siteUrl(req)}/stays/host?invite=${token}`, expiresInDays: 14 });
  }

  // ----- enquiries -----
  if (a === "enquiry_save") {
    const p = b.propertyId ? await c.properties.findOne({ _id: String(b.propertyId) }) : null;
    const g = cleanGuests(b);
    const doc = {
      kind: "manual", type: (ENQUIRY_TYPES as readonly string[]).includes(b.type) ? b.type : "general",
      propertyId: p?._id || null, code: p?.code || null, title: p?.title || "",
      checkIn: cleanDate(b.checkIn), checkOut: cleanDate(b.checkOut), adults: b.adults ? g.adults : null, children: b.children ? g.children : null, guests: b.guests || b.adults ? g.guests : null,
      guestName: str(b.guestName, 80), guestPhone: String(b.guestPhone || "").replace(/[^\d+]/g, "").slice(0, 16), channel: str(b.channel, 40) || "WhatsApp",
      source: str(b.source, 200), status: (ENQUIRY_STATUSES as readonly string[]).includes(b.status) ? b.status : "new", notes: text(b.notes, 4000), updatedAt: Date.now(),
    };
    if (b.id) {
      const r = await c.enquiries.updateOne({ _id: String(b.id) }, { $set: doc });
      return r.matchedCount ? json({ id: b.id }) : json({ error: "Not found" }, 404);
    }
    const id = rid();
    await c.enquiries.insertOne({ _id: id, ...doc, createdAt: Date.now(), createdBy: actor.name });
    return json({ id });
  }
  if (a === "enquiry_update") {
    const set: any = { updatedAt: Date.now() };
    if (b.status !== undefined) { if (!(ENQUIRY_STATUSES as readonly string[]).includes(b.status)) return json({ error: "Unknown status" }, 400); set.status = b.status; }
    if (b.notes !== undefined) set.notes = text(b.notes, 4000);
    const r = await c.enquiries.updateOne({ _id: String(b.id || "") }, { $set: set });
    return r.matchedCount ? json({ ok: true }) : json({ error: "Not found" }, 404);
  }
  if (a === "enquiry_delete") {
    await c.enquiries.deleteOne({ _id: String(b.id || "") });
    return json({ ok: true });
  }

  // ----- properties -----
  if (a === "property_create") {
    const ownership = b.ownership === "host" ? "host" : "own";
    if (ownership === "host" && !(b.hostId && (await c.hosts.findOne({ _id: String(b.hostId) })))) return json({ error: "Choose the host this property belongs to" }, 400);
    const p = await createProperty(c, s, actor, ownership, ownership === "host" ? String(b.hostId) : null);
    const r = await applyAdmin(c, p, { ...b, ownership, visibility: b.visibility || s.defaultVisibility, showPrice: b.showPrice ?? s.defaultShowPrice, showSociety: b.showSociety ?? s.showSocietyPublicly });
    if ("error" in r) return json({ error: r.error }, 400);
    return json(await fullProperty(c, await store(c, actor, p, r.next!)));
  }
  if (a === "bulk") {
    const ids: string[] = (Array.isArray(b.ids) ? b.ids : []).map(String).slice(0, 500);
    const op = String(b.op || "");
    const done: string[] = [], failed: { id: string; error: string }[] = [];
    for (const id of ids) {
      const p: StoredProperty | null = await c.properties.findOne({ _id: id });
      if (!p) { failed.push({ id, error: "Not found" }); continue; }
      let next: StoredProperty | null = null;
      if (["publish", "unpublish", "deactivate", "approve", "reactivate"].includes(op)) {
        const t = transition("admin", op, p.status);
        if (!t.ok) { failed.push({ id, error: `${p.code}: ${t.error}` }); continue; }
        if (op === "publish" && missingForReview(p).length) { failed.push({ id, error: `${p.code}: fill in ${missingForReview(p).join(", ")}` }); continue; }
        next = { ...p, status: t.to!, ...stampsFor(t.to, Date.now()), ...(op === "publish" ? { publishRequested: false } : {}) };
      } else if (op === "feature" || op === "unfeature") next = { ...p, featured: op === "feature" };
      else if (op === "archive" || op === "unarchive") next = { ...p, archived: op === "archive" };
      else if (op.startsWith("visibility:") && (VISIBILITIES as readonly string[]).includes(op.slice(11))) next = { ...p, visibility: op.slice(11) as StoredProperty["visibility"] };
      else if (op.startsWith("availability:") && (AVAILABILITY as readonly string[]).includes(op.slice(13))) next = { ...p, availability: op.slice(13) as StoredProperty["availability"] };
      else if (op === "show_price" || op === "hide_price") next = { ...p, showPrice: op === "show_price" };
      else { failed.push({ id, error: "Unknown bulk action" }); continue; }
      await store(c, actor, p, next, `bulk:${op}`);
      done.push(id);
    }
    return json({ done, failed });
  }

  const p: StoredProperty | null = await c.properties.findOne({ _id: String(b.id || "") });
  if (!p) return json({ error: "Not found" }, 404);

  if (a === "property_save") {
    if (b.updatedAt && Number(b.updatedAt) !== p.updatedAt && !b.force) {
      return json({ error: "This property was changed elsewhere (maybe by its host) since you opened it. Reload to see the latest, or save again to overwrite.", conflict: true }, 409);
    }
    const r = await applyAdmin(c, p, b);
    if ("error" in r) return json({ error: r.error }, 400);
    return json(await fullProperty(c, await store(c, actor, p, r.next!)));
  }
  if (a === "property_action") {
    const action = String(b.action || "");
    const t = transition("admin", action, p.status);
    if (!t.ok) return json({ error: t.error }, 400);
    const reason = text(b.reason, 1000);
    if (NEEDS_REASON.includes(action as never) && !reason) return json({ error: "Please write a reason for the host" }, 400);
    if (action === "publish") {
      const miss = missingForReview(p);
      if (miss.length) return json({ error: `Fill in before publishing: ${miss.join(", ")}` }, 400);
    }
    const next = await store(c, actor, p, {
      ...p, status: t.to!, ...stampsFor(t.to, Date.now()),
      review: NEEDS_REASON.includes(action as never) ? { reason, at: Date.now(), action } : action === "approve" || action === "publish" ? null : p.review,
      publishRequested: action === "publish" ? false : p.publishRequested,
    }, action, reason ? { reason } : {});
    return json(await fullProperty(c, next));
  }
  if (a === "property_verify") return json(await fullProperty(c, await store(c, actor, p, { ...p, lastVerifiedAt: Date.now() }, "verify")));
  if (a === "host_changes") {
    if (!p.hostChanges) return json({ error: "No changes waiting" }, 400);
    if (b.decision === "apply") {
      const keys = new Set((await amenityDefs(c)).map((x) => x.key));
      const next = withHostInput(p, cleanHostInput(p.hostChanges.data, keys));
      return json(await fullProperty(c, await store(c, actor, p, { ...next, hostChanges: null }, "host_changes_applied")));
    }
    const reason = text(b.reason, 1000);
    return json(await fullProperty(c, await store(c, actor, p, { ...p, hostChanges: null, review: reason ? { reason, at: Date.now(), action: "changes_declined" } : p.review }, "host_changes_discarded", reason ? { reason } : {})));
  }
  if (a === "property_duplicate") {
    const copy = await createProperty(c, s, actor, p.ownership, p.hostId);
    const dup: StoredProperty = {
      ...structuredClone(p), _id: copy._id, code: copy.code, title: `${p.title} (copy)`.slice(0, 120), status: "draft", media: [], coverId: null,
      hostChanges: null, publishRequested: false, review: null, archived: false, createdAt: copy.createdAt, updatedAt: copy.updatedAt,
      approvedAt: undefined, publishedAt: undefined, submittedAt: undefined, lastVerifiedAt: undefined,
    };
    return json(await fullProperty(c, await store(c, actor, copy, dup, "duplicate", { from: p.code })));
  }
  if (a === "property_archive") return json(await fullProperty(c, await store(c, actor, p, { ...p, archived: b.archived !== false }, b.archived === false ? "unarchive" : "archive")));
  if (a === "property_delete") {
    if (String(b.confirm || "") !== p.code) return json({ error: `Type ${p.code} to confirm` }, 400);
    await destroyMedia(p.media || []);
    await c.properties.deleteOne({ _id: p._id });
    await c.shares.updateMany({ propertyId: p._id }, { $set: { revoked: true, revokedAt: Date.now() } });
    await audit(c, actor, "delete", p, [], { title: p.title });
    bustCards();
    return json({ ok: true });
  }
  if (a.startsWith("media_")) {
    const r = await mediaAction(c, actor, p, a, b);
    return json(r.property ? { ...r.body, property: await fullProperty(c, r.property) } : r.body, r.status);
  }
  if (a === "share_create") {
    if (p.visibility === "private") return json({ error: "Private properties can't be shared. Make it public or unlisted first." }, 400);
    const sh = { _id: rid(16), propertyId: p._id, code: p.code, showPrice: b.showPrice !== false, label: str(b.label, 80), createdAt: Date.now(), createdBy: actor.name, revoked: false, views: 0 };
    await c.shares.insertOne(sh);
    await audit(c, actor, "share_create", p, [], { shareId: sh._id, showPrice: sh.showPrice });
    return json({ ...sh, url: `${siteUrl(req)}/stay/s/${sh._id}` });
  }
  if (a === "share_revoke") {
    const r = await c.shares.updateOne({ _id: String(b.shareId || ""), propertyId: p._id }, { $set: { revoked: true, revokedAt: Date.now() } });
    if (!r.matchedCount) return json({ error: "Not found" }, 404);
    await audit(c, actor, "share_revoke", p, [], { shareId: b.shareId });
    return json({ ok: true });
  }
  if (a === "offline_sync") {
    const clean = (k: string, v: unknown) =>
      k === "listingWeekday" || k === "listingWeekend" ? cleanMoney(v) : k === "availability" ? ((AVAILABILITY as readonly string[]).includes(String(v)) ? v : "available") : k === "description" ? text(v, 6000) : k === "title" ? str(v, 120) : str(v, 300);
    const fields = Object.fromEntries(Object.entries(b.fields || {}).filter(([k]) => (OFFLINE_FIELDS as readonly string[]).includes(k)));
    const r = offlineMerge(p, fields, b.base || {}, !!b.force, clean as never);
    if (!r.next) return json({ conflict: true, conflicts: r.conflicts, updatedAt: p.updatedAt }, 409);
    const next = await store(c, actor, p, r.next, "offline_sync");
    return json({ ok: true, updatedAt: next.updatedAt });
  }
  return json({ error: "Unknown request" }, 400);
}

async function saveSettings(c: C, actor: Actor, cur: Settings, b: any) {
  const lines = (v: unknown, max: number) => (Array.isArray(v) ? v : String(v ?? "").split("\n")).map((x) => str(x, 40)).filter(Boolean).filter((x, i, arr) => arr.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i).slice(0, max);
  const tpl = (k: keyof Settings["templates"]) => text(b.templates?.[k], 1500) || cur.templates[k];
  const numOr = (v: unknown, fb: number, min: number, max: number) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? n : fb; };
  const tile = str(b.map?.tileUrl, 300);
  const next: Settings = {
    ...cur,
    siteName: str(b.siteName, 60) || cur.siteName,
    tagline: str(b.tagline, 160),
    logoUrl: /^https:\/\//.test(String(b.logoUrl || "")) ? str(b.logoUrl, 400) : "",
    contactNumber: String(b.contactNumber ?? cur.contactNumber).replace(/[^\d+ ]/g, "").slice(0, 20),
    whatsappNumber: waNumber(b.whatsappNumber) ? String(b.whatsappNumber).replace(/[^\d+]/g, "").slice(0, 16) : cur.whatsappNumber,
    templates: { simple: tpl("simple"), dates: tpl("dates"), location: tpl("location"), general: tpl("general") },
    currency: "INR",
    defaultVisibility: (VISIBILITIES as readonly string[]).includes(b.defaultVisibility) ? b.defaultVisibility : cur.defaultVisibility,
    defaultShowPrice: b.defaultShowPrice !== false,
    ownPrefix: cleanPrefix(b.ownPrefix, cur.ownPrefix),
    hostPrefix: cleanPrefix(b.hostPrefix, cur.hostPrefix),
    propertyTypes: lines(b.propertyTypes, 40).length ? lines(b.propertyTypes, 40) : cur.propertyTypes,
    categories: lines(b.categories, 40),
    features: lines(b.features, 60),
    showSocietyPublicly: b.showSocietyPublicly !== false,
    map: {
      tileUrl: /^https:\/\/[^\s"'<>]+\{z\}[^\s"'<>]*\{x\}[^\s"'<>]*\{y\}/.test(tile) ? tile : cur.map.tileUrl,
      attribution: str(b.map?.attribution, 200) || cur.map.attribution,
      defaultLat: numOr(b.map?.defaultLat, cur.map.defaultLat, -90, 90),
      defaultLng: numOr(b.map?.defaultLng, cur.map.defaultLng, -180, 180),
      defaultZoom: numOr(b.map?.defaultZoom, cur.map.defaultZoom, 3, 18),
    },
    seo: { title: str(b.seo?.title, 80) || cur.seo.title, description: str(b.seo?.description, 200) || cur.seo.description, ogImage: /^https:\/\//.test(String(b.seo?.ogImage || "")) ? str(b.seo?.ogImage, 400) : "" },
    adminEmail: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(b.adminEmail || "").trim()) ? String(b.adminEmail).trim().toLowerCase() : "",
  };
  if (!waNumber(b.whatsappNumber) && b.whatsappNumber !== undefined) return { error: "Enter a valid WhatsApp number (10-digit mobile, or with country code)", settings: cur };
  await c.settings.replaceOne({ _id: "main" }, { _id: "main", ...next }, { upsert: true });
  const changed = (Object.keys(next) as (keyof Settings)[]).filter((k) => JSON.stringify(next[k]) !== JSON.stringify(cur[k]));
  if (changed.length) await audit(c, actor, "settings", null, changed.map((k) => ({ field: `settings.${k}`, from: k === "templates" ? "…" : cur[k], to: k === "templates" ? "…" : next[k] })));
  bustCards();
  return { settings: next };
}

