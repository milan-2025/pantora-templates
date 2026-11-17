/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Stays: database access, migrations, settings, sign-in and audit log (server only).
 *
 * Data lives in the site's existing MongoDB (through Payload's connection), in its own collections, all prefixed
 * `stay_`. Nothing here touches the shop, CRM, planner or Payload collections.
 */
import "server-only";
import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { getPayloadClient } from "@/lib/cms/queries";
import { DEFAULT_AMENITIES, DEFAULT_SETTINGS, type Settings } from "./constants";
import { approxCoords, cleanPrefix, formatCode, validLat, validLng } from "./core";
import { auditDiff } from "./property";
import { isListed, publicCard, type AmenityDef, type PublicCard, type StoredProperty } from "./views";

const E = process.env;
export const rid = (bytes = 9) => crypto.randomBytes(bytes).toString("base64url");
const same = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// ---------- collections ----------

export async function dbs() {
  const db = (await getPayloadClient()).db.connection.db as any;
  const c = {
    properties: db.collection("stay_properties"),
    hosts: db.collection("stay_hosts"),
    shares: db.collection("stay_shares"),
    enquiries: db.collection("stay_enquiries"),
    amenities: db.collection("stay_amenities"),
    settings: db.collection("stay_settings"),
    counters: db.collection("stay_counters"),
    audit: db.collection("stay_audit"),
    notifications: db.collection("stay_notifications"),
    migrations: db.collection("stay_migrations"),
  };
  await migrate(c);
  return c;
}
export type C = Awaited<ReturnType<typeof dbs>>;

// ---------- migrations ----------
// MongoDB has no fixed table structure, so "migrations" here create indexes and starting data, and reshape stored
// documents when the format changes. Each runs once per database, in order, and is recorded in stay_migrations.
// Add new steps at the end; never edit or reorder a step that has already shipped.

type Step = { id: string; up: (c: Omit<C, never>) => Promise<void> };
const STEPS: Step[] = [
  {
    id: "001-indexes",
    up: async (c) => {
      await c.properties.createIndex({ code: 1 }, { unique: true });
      await c.properties.createIndex({ status: 1, visibility: 1 });
      await c.properties.createIndex({ hostId: 1 });
      await c.hosts.createIndex({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });
      await c.hosts.createIndex({ hostCode: 1 }, { unique: true });
      await c.shares.createIndex({ propertyId: 1 });
      await c.enquiries.createIndex({ createdAt: -1 });
      await c.enquiries.createIndex({ propertyId: 1 });
      await c.audit.createIndex({ propertyId: 1, at: -1 });
    },
  },
  {
    id: "002-default-amenities",
    up: async (c) => {
      for (const a of DEFAULT_AMENITIES) {
        if (!(await c.amenities.findOne({ _id: a.key }))) await c.amenities.insertOne({ _id: a.key, ...a, custom: false, createdAt: Date.now() });
      }
    },
  },
];

let migrated: Promise<void> | null = null;
async function migrate(c: any) {
  if (!migrated) {
    migrated = (async () => {
      for (const s of STEPS) {
        if (await c.migrations.findOne({ _id: s.id })) continue;
        await s.up(c);
        await c.migrations.insertOne({ _id: s.id, at: Date.now() }).catch(() => {}); // another server may have recorded it first
      }
    })().catch((e) => {
      migrated = null;
      throw e;
    });
  }
  return migrated;
}
/** Tests only: run migrations again on a fresh database. */
export const resetForTests = () => { migrated = null; cardCache = null; };

// ---------- settings ----------

export async function getSettings(c: C): Promise<Settings> {
  const s = (await c.settings.findOne({ _id: "main" })) || {};
  const { _id, ...rest } = s;
  void _id;
  return {
    ...DEFAULT_SETTINGS,
    ...rest,
    templates: { ...DEFAULT_SETTINGS.templates, ...(rest.templates || {}) },
    map: { ...DEFAULT_SETTINGS.map, ...(rest.map || {}) },
    seo: { ...DEFAULT_SETTINGS.seo, ...(rest.seo || {}) },
  };
}

/** What guests' browsers may know about the settings (no admin email etc.). */
export const publicSettings = (s: Settings) => ({
  siteName: s.siteName, tagline: s.tagline, logoUrl: s.logoUrl, contactNumber: s.contactNumber, whatsappNumber: s.whatsappNumber,
  templates: s.templates, currency: s.currency, propertyTypes: s.propertyTypes, categories: s.categories, features: s.features,
  map: s.map, seo: s.seo,
});

export async function amenityDefs(c: C): Promise<AmenityDef[]> {
  return (await c.amenities.find({}).sort({ category: 1, label: 1 }).toArray()).map((a: any) => ({ key: a._id, label: a.label, category: a.category }));
}

// ---------- IDs ----------

/** Next permanent ID for a prefix. Atomic ($inc), never reused, even after deletion. */
export async function nextCode(c: C, prefix: string): Promise<string> {
  const p = cleanPrefix(prefix, "STY");
  let r: any = await c.counters.findOneAndUpdate({ _id: p }, { $inc: { seq: 1 } }, { returnDocument: "after" });
  if (r && "value" in r && !("seq" in r)) r = r.value;
  if (!r) {
    try { await c.counters.insertOne({ _id: p, seq: 0 }); } catch { /* created by someone else meanwhile */ }
    r = await c.counters.findOneAndUpdate({ _id: p }, { $inc: { seq: 1 } }, { returnDocument: "after" });
    if (r && "value" in r && !("seq" in r)) r = r.value;
  }
  let code = formatCode(p, r.seq);
  // Belt and braces: if a code is somehow taken (e.g. data copied in by hand), keep counting.
  while (await c.properties.findOne({ code }, { projection: { _id: 1 } })) {
    const r2: any = await c.counters.findOneAndUpdate({ _id: p }, { $inc: { seq: 1 } }, { returnDocument: "after" });
    code = formatCode(p, (r2?.value ?? r2).seq);
  }
  return code;
}

export async function nextHostCode(c: C) {
  let r: any = await c.counters.findOneAndUpdate({ _id: "host" }, { $inc: { seq: 1 } }, { returnDocument: "after" });
  if (r && "value" in r && !("seq" in r)) r = r.value;
  if (!r) {
    try { await c.counters.insertOne({ _id: "host", seq: 1 }); } catch { /* raced */ }
    r = await c.counters.findOne({ _id: "host" });
  }
  return `H-${String(r.seq).padStart(4, "0")}`;
}

// ---------- public positions ----------

const secret = () => E.PAYLOAD_SECRET || "dev-secret-change-me";
/** Approximate public position (see approxCoords). Null when the exact position is unknown. */
export function approxFor(id: string, lat: number | null, lng: number | null) {
  if (!validLat(lat) || !validLng(lng)) return null;
  const seed = crypto.createHmac("sha256", `${secret()}:stay-approx`).update(id).digest();
  return approxCoords(lat as number, lng as number, seed);
}

// ---------- public listing cache ----------

let cardCache: { at: number; cards: PublicCard[] } | null = null;
export const bustCards = () => { cardCache = null; };

/** All publicly listed properties as guest-safe cards. Cached for 30 s per server; any admin change clears it. */
export async function listedCards(c: C): Promise<PublicCard[]> {
  if (cardCache && Date.now() - cardCache.at < 30_000) return cardCache.cards;
  const docs: StoredProperty[] = await c.properties.find({ status: "published", visibility: "public", archived: { $ne: true } }).toArray();
  const cards = docs.filter(isListed).map((p) => publicCard(p, p.showPrice !== false));
  cardCache = { at: Date.now(), cards };
  return cards;
}

// ---------- sign-in: administrator ----------

export type Actor = { role: "admin"; id: string; name: string; email: string } | { role: "host"; id: string; name: string; email: string; host: any };

/** The site's Payload admin users are the stays administrators (same login as /admin). */
export async function adminFrom(req: Request): Promise<Actor | null> {
  try {
    const payload: any = await getPayloadClient();
    const { user } = await payload.auth({ headers: req.headers });
    if (!user || (user.collection && user.collection !== "users")) return null;
    return { role: "admin", id: String(user.id), name: user.name || user.email, email: user.email };
  } catch {
    return null;
  }
}

// ---------- sign-in: hosts (email + password, own cookie) ----------

export const HOST_COOKIE = "stay_host";
export const hashPassword = (pw: string) => {
  const s = crypto.randomBytes(16).toString("hex");
  return `scrypt$${s}$${crypto.scryptSync(pw, s, 64).toString("hex")}`;
};
export const checkPassword = (pw: string, h: string) => {
  const [, s, x] = String(h || "").split("$");
  return !!s && !!x && same(crypto.scryptSync(pw, s, 64).toString("hex"), x);
};
const sign = (p: string) => crypto.createHmac("sha256", `${secret()}:stay-host`).update(p).digest("base64url");
/** Session token: host id + session version (bumped on password change / suspension, which signs out every device). */
export const hostToken = (h: { _id: string; sv?: number }) => {
  const p = Buffer.from(JSON.stringify({ id: h._id, v: h.sv || 0, exp: Date.now() + 30 * 864e5 })).toString("base64url");
  return `${p}.${sign(p)}`;
};
export async function hostFrom(req: NextRequest, c: C): Promise<Actor | null> {
  const [p, s] = (req.cookies.get(HOST_COOKIE)?.value || "").split(".");
  if (!p || !s || !same(s, sign(p))) return null;
  let t: any;
  try { t = JSON.parse(Buffer.from(p, "base64url").toString()); } catch { return null; }
  if (!t || t.exp < Date.now()) return null;
  const h = await c.hosts.findOne({ _id: String(t.id) });
  if (!h || h.status !== "active" || (h.sv || 0) !== t.v) return null;
  return { role: "host", id: h._id, name: h.name, email: h.email || "", host: h };
}
export const hostCookie = (value: string, maxAge = 30 * 86400) => ({
  name: HOST_COOKIE, value, httpOnly: true, sameSite: "lax" as const, secure: E.NODE_ENV === "production", path: "/", maxAge,
});

/** Invite / password-reset tokens: only a hash is stored, so a database leak can't be used to sign in. */
export const tokenHash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

// ---------- audit + notifications ----------

export async function audit(c: C, actor: Actor | { role: "system"; id: string; name: string }, action: string, p: { _id: string; code: string } | null, changes: { field: string; from: unknown; to: unknown }[] = [], extra: Record<string, unknown> = {}) {
  await c.audit.insertOne({ _id: rid(), at: Date.now(), actor: { role: actor.role, id: actor.id, name: actor.name }, action, propertyId: p?._id || null, code: p?.code || null, changes, ...extra });
}
export const diffFor = auditDiff;

export async function notifyAdmin(c: C, kind: string, text: string, p?: { _id: string; code: string; title: string }) {
  await c.notifications.insertOne({ _id: rid(), at: Date.now(), kind, text, propertyId: p?._id || null, code: p?.code || null, read: false });
  try {
    const s = await getSettings(c);
    const to = s.adminEmail || E.CONTACT_TO_EMAIL || E.EMAIL_FROM_ADDRESS;
    if (!to) return;
    const { sendWithBrevo } = await import("@/lib/brevo");
    const site = E.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const esc = (x: string) => x.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
    await sendWithBrevo({
      to: [{ email: to }],
      subject: `[Stays] ${text}`,
      html: `<p>${esc(text)}</p><p><a href="${site}/stays/admin${p ? `#/property/${p._id}` : ""}">Open the stays dashboard</a></p>`,
    });
  } catch (e) {
    console.error("[stays] notify email", e);
  }
}

/** Requests that change data must come from this site (blocks cross-site form posts). Missing Origin is allowed (non-browser clients). */
export function sameOrigin(req: Request) {
  const o = req.headers.get("origin");
  if (!o) return true;
  try {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    return new URL(o).host === host;
  } catch {
    return false;
  }
}
