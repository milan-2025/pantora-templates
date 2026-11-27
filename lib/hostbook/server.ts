import "server-only";
import { createHash, randomBytes, randomInt } from "crypto";
import type { Payload } from "payload";
import { sendWithBrevo } from "@/lib/brevo";
import { PasswordError, checkLogin, hasPassword, removePassword, setPassword } from "@/lib/auth/passwords";
import { getPaymentProvider } from "@/lib/payments";
import { quoteWithCode } from "@/lib/pricing";
import { codesMatch, hashCode, makeToken, readToken } from "@/lib/planner/core";
import {
  DEFAULT_HOSTBOOK_PLANS, DEFAULT_TEMPLATES, FEATURE_KEYS, KIND_PERM, KINDS, STAFF_PERMS, isFeature, isKind,
  type FeatureKey, type Kind, type StaffPerm,
} from "./features";
import { makeVapidKeys, sendPush, validSub, type PushSub, type VapidKeys } from "@/lib/workout/push";
import { EMPTY_SITE, busyNights, cleanSite, cleanSlug, datesFree, publicListing, showsOnSite, type PublicListing, type SiteSettings } from "@/lib/hostbook/site";
import {
  CHECKIN_FIELD_KEYS, DEFAULT_REQUIRED, checkEmail, checkGuest, checkId, checkPhone, isIndian, type CheckinField,
  HostBookError, addDays, cleanRecord, icalIsBlock, icalPhoneLast4, isDay, istDay, maskId, monthOf, nextDue, parseIcal, planQuote,
  type PlanLite, type Rec,
} from "./core";

export { HostBookError };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Payload and MongoDB documents are read loosely here
type Doc = Record<string, any>;

const PL = "hostbook-plans" as const, AC = "hostbook-accounts" as const, LG = "hostbook-logins" as const;
const secret = () => `${process.env.PAYLOAD_SECRET || "dev-secret-change-me"}:hostbook`;
export const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const rid = (n = 9) => randomBytes(n).toString("base64url");
const normEmail = (v: unknown) => String(v ?? "").trim().toLowerCase().slice(0, 160);
const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const relId = (v: unknown) => (v && typeof v === "object" ? String((v as Doc).id ?? "") : v ? String(v) : "");

export const SESSION_DAYS = 60;
const CODE_MINUTES = 15;
const ID_LINK_MINUTES = 10;

/* ---------- storage: one MongoDB collection for every host record ---------- */

let indexed: Promise<void> | null = null;
export async function items(payload: Payload) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (payload.db as any).connection.db.collection("hb_items");
  indexed ??= Promise.all([
    c.createIndex({ acct: 1, kind: 1 }),
    c.createIndex({ acct: 1, updatedAt: 1 }),
    c.createIndex({ checkinCode: 1 }, { sparse: true }),
    c.createIndex({ "idPhotos.deleteAt": 1 }, { sparse: true }),
  ]).then(() => undefined).catch((e) => { indexed = null; console.error("[hostbook] indexes", e); });
  await indexed;
  return c;
}
const view = (d: Doc): Rec => { const { _id, acct: _a, ...rest } = d; void _a; return { id: String(_id), ...rest } as Rec; };

/* ---------- settings & plans ---------- */

export type Settings = { extraListingPrice: number; reminderDays: number; staysPlan: string; whatsappNumber: string; offerText: string };
let settingsCache: { at: number; s: Settings } | null = null;
let plansCache: { at: number; p: PlanLite[] } | null = null;
export const clearCaches = () => { settingsCache = null; plansCache = null; };

export async function getSettings(payload: Payload): Promise<Settings> {
  if (settingsCache && Date.now() - settingsCache.at < 30_000) return settingsCache.s;
  const g = ((await payload.findGlobal({ slug: "hostbook-settings" as never, depth: 0, overrideAccess: true }).catch(() => null)) ?? {}) as Doc;
  const s: Settings = {
    extraListingPrice: typeof g.extraListingPrice === "number" ? g.extraListingPrice : 299,
    reminderDays: typeof g.reminderDays === "number" ? g.reminderDays : 14,
    staysPlan: g.staysPlan === undefined || g.staysPlan === null ? "starter" : String(g.staysPlan),
    whatsappNumber: String(g.whatsappNumber ?? ""), offerText: String(g.offerText ?? ""),
  };
  settingsCache = { at: Date.now(), s };
  return s;
}

export type Plan = PlanLite & { tagline: string; badge: string; highlights: string[] };
const toPlan = (d: Doc): Plan => ({
  id: String(d.id), planId: String(d.planId), name: String(d.name ?? ""), price: Math.max(0, Math.round(d.price ?? 0)), isFree: Boolean(d.isFree), active: d.active !== false,
  listings: Math.max(1, d.listings ?? 1), staff: Math.max(0, d.staff ?? 0), idDays: Math.max(1, d.idDays ?? 30), hostChoosesIdDays: Boolean(d.hostChoosesIdDays),
  features: (Array.isArray(d.features) ? d.features : []).filter(isFeature), sortOrder: d.sortOrder ?? 10,
  tagline: d.tagline ?? "", badge: d.badge ?? "", highlights: (d.highlights ?? []).map((h: Doc) => h.text).filter(Boolean),
});

export async function getPlans(payload: Payload): Promise<Plan[]> {
  if (plansCache && Date.now() - plansCache.at < 30_000) return plansCache.p as Plan[];
  const find = () => payload.find({ collection: PL as never, limit: 50, depth: 0, sort: "sortOrder", overrideAccess: true });
  let res = await find();
  if (res.totalDocs === 0) {
    for (const p of DEFAULT_HOSTBOOK_PLANS) await payload.create({ collection: PL as never, data: p as never, overrideAccess: true }).catch(() => null);
    res = await find();
  }
  const p = (res.docs as Doc[]).map(toPlan);
  plansCache = { at: Date.now(), p };
  return p;
}
const FALLBACK_FREE: Plan = { ...(DEFAULT_HOSTBOOK_PLANS[0] as unknown as Plan), id: "free", features: DEFAULT_HOSTBOOK_PLANS[0].features as FeatureKey[], highlights: [] };
const freeOf = (plans: Plan[]) => plans.find((p) => p.isFree) ?? FALLBACK_FREE;

export type Access = { plan: Plan; paidPlan: Plan | null; expiresAt: string | null; viaStays: boolean; listingLimit: number; staffLimit: number; idDays: number; features: FeatureKey[] };

/** The plan a host has right now: a running paid plan, else the Stays plan (for Stays hosts), else Free. Pick the dearer one. */
export async function accessOf(payload: Payload, acct: Doc): Promise<Access> {
  const [plans, s] = await Promise.all([getPlans(payload), getSettings(payload)]);
  const free = freeOf(plans);
  const own = plans.find((p) => p.id === relId(acct.plan)) ?? null;
  const running = own && (own.isFree || (acct.expiresAt && Date.parse(acct.expiresAt) > Date.now())) ? own : null;
  const stays = acct.staysHostId && s.staysPlan ? plans.find((p) => p.planId === s.staysPlan) ?? null : null;
  let plan = running ?? free;
  let viaStays = false;
  if (stays && stays.price > plan.price) { plan = stays; viaStays = true; }
  const idDays = plan.hostChoosesIdDays && acct.idDays ? Math.min(plan.idDays, Math.max(1, acct.idDays)) : plan.idDays;
  return {
    plan, paidPlan: own && !own.isFree ? own : null, expiresAt: own && !own.isFree ? acct.expiresAt ?? null : null, viaStays,
    listingLimit: plan.listings + (running && !running.isFree ? Math.max(0, acct.extraListings ?? 0) : 0), staffLimit: plan.staff, idDays, features: plan.features,
  };
}

/* ---------- sign-in (emailed code or optional password) ---------- */

const shell = (body: string) =>
  `<!doctype html><html><body style="margin:0;background:#F3EEE6;font-family:Arial,Helvetica,sans-serif;color:#1f2a2e"><div style="max-width:520px;margin:0 auto;padding:32px 20px"><div style="background:#fff;border-radius:20px;padding:28px">${body}</div><p style="text-align:center;font-size:12px;color:#7a8486">Pandora HostBook · Guest records, bookings and money for hosts</p></div></body></html>`;
const button = (href: string, text: string) => `<a href="${href}" style="display:inline-block;padding:12px 22px;background:#1F5F5B;color:#fff;border-radius:999px;text-decoration:none;font-weight:700">${text}</a>`;
const send = (to: string, subject: string, html: string, text: string) => sendWithBrevo({ to: [{ email: to }], subject, html: shell(html), text }).catch((e) => console.error("[hostbook-email]", subject, e));

export async function startLogin(payload: Payload, raw: unknown) {
  const email = normEmail(raw);
  if (!validEmail(email)) throw new HostBookError("Please enter a valid email");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await payload.delete({ collection: LG as never, where: { email: { equals: email } }, overrideAccess: true }).catch(() => null);
  await payload.create({ collection: LG as never, data: { email, codeHash: hashCode(secret(), email, code), expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000).toISOString(), attempts: 0 } as never, overrideAccess: true });
  await sendWithBrevo({
    to: [{ email }],
    subject: `${code} is your Pandora HostBook code`,
    html: shell(`<h2 style="margin:0 0 8px">Your sign-in code</h2><p>Type this code in HostBook:</p><p style="font-size:34px;letter-spacing:8px;font-weight:700;color:#1F5F5B;margin:14px 0">${code}</p><p style="font-size:13px;color:#666">It works for ${CODE_MINUTES} minutes.</p>`),
    text: `Your Pandora HostBook code is ${code}. It works for ${CODE_MINUTES} minutes.`,
  });
  return { email, devCode: process.env.BREVO_API_KEY || process.env.NODE_ENV === "production" ? undefined : code };
}

export async function verifyLogin(payload: Payload, raw: unknown, rawCode: unknown) {
  const email = normEmail(raw);
  const code = String(rawCode ?? "").replace(/\D/g, "");
  const row = (await payload.find({ collection: LG as never, where: { email: { equals: email } }, limit: 1, sort: "-createdAt", depth: 0, overrideAccess: true })).docs[0] as Doc | undefined;
  if (!row || new Date(row.expiresAt).getTime() < Date.now()) throw new HostBookError("That code has expired. Ask for a new one.", 401);
  if ((row.attempts ?? 0) >= 5) throw new HostBookError("Too many wrong tries. Ask for a new code.", 429);
  if (code.length !== 6 || !codesMatch(row.codeHash, hashCode(secret(), email, code))) {
    await payload.update({ collection: LG as never, id: row.id, data: { attempts: (row.attempts ?? 0) + 1 } as never, overrideAccess: true });
    throw new HostBookError("That code isn't right. Check the latest email, or ask for a new code.", 401);
  }
  await payload.delete({ collection: LG as never, where: { email: { equals: email } }, overrideAccess: true });
  return { email, token: tokenFor(email) };
}

const asHbError = (e: unknown) => (e instanceof PasswordError ? new HostBookError(e.message, e.status) : e);
export async function passwordLogin(payload: Payload, raw: unknown, password: unknown) {
  const email = normEmail(raw);
  if (!validEmail(email)) throw new HostBookError("Please enter a valid email");
  try { await checkLogin(payload, "hostbook", email, password); } catch (e) { throw asHbError(e); }
  return { email, token: tokenFor(email) };
}
export const hostbookHasPassword = (payload: Payload, email: string) => hasPassword(payload, "hostbook", email);
export async function setMyPassword(payload: Payload, email: string, password: unknown, remove = false) {
  let changed = false;
  try {
    if (remove) await removePassword(payload, "hostbook", email);
    else changed = (await setPassword(payload, "hostbook", email, password)).changed;
  } catch (e) { throw asHbError(e); }
  const what = remove ? "removed" : changed ? "changed" : "set";
  await send(email, `Your Pandora HostBook password was ${what}`, `<h2 style="margin:0 0 8px">Password ${what}</h2><p>The password for your HostBook sign-in (${esc(email)}) was just ${what}.</p><p style="font-size:13px;color:#666">Wasn't you? Sign in with a code, then set a new password under Settings.</p>`, `The password for your HostBook sign-in (${email}) was just ${what}.`);
  return { ok: true, hasPassword: !remove };
}

export const tokenFor = (email: string) => makeToken(secret(), email, SESSION_DAYS * 864e5);
export function emailOf(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  const s = readToken(secret(), h.startsWith("Bearer ") ? h.slice(7) : null);
  return s && validEmail(s) ? s : null;
}
/** A fresh token about once a day for people who keep using the app, so they stay signed in. */
export function refreshedToken(req: Request, email: string) {
  const h = req.headers.get("authorization") ?? "";
  const exp = Number((h.startsWith("Bearer ") ? h.slice(7) : "").split(".")[1] ?? 0);
  return exp && exp - Date.now() < (SESSION_DAYS - 1) * 864e5 ? tokenFor(email) : undefined;
}

/* ---------- accounts, staff and who is asking ---------- */

async function findAccount(payload: Payload, where: Doc) {
  return ((await payload.find({ collection: AC as never, where, limit: 1, depth: 0, overrideAccess: true })).docs[0] as Doc | undefined) ?? null;
}
export async function ownAccount(payload: Payload, email: string, create = true, extra: Doc = {}) {
  const a = await findAccount(payload, { ownerEmail: { equals: email } });
  if (a || !create) return a;
  return (await payload.create({ collection: AC as never, data: { ownerEmail: email, ...extra } as never, overrideAccess: true })) as Doc;
}
async function staffAccounts(payload: Payload, email: string) {
  return (await payload.find({ collection: AC as never, where: { "staff.email": { equals: email } }, limit: 20, depth: 0, overrideAccess: true })).docs as Doc[];
}

export type Ctx = {
  email: string; acct: Doc; role: "owner" | "staff"; perms: Set<StaffPerm>; listings: string[] | null; access: Access;
  has: (f: FeatureKey) => boolean; can: (p: StaffPerm | "owner") => boolean;
};

/** Works out which host account a signed-in person is using (their own, or one they're staff on). */
export async function ctxFor(payload: Payload, email: string, accountId?: string | null): Promise<Ctx> {
  const own = await ownAccount(payload, email, false);
  const staffOf = await staffAccounts(payload, email);
  let acct: Doc | null = null;
  if (accountId) {
    acct = own && String(own.id) === accountId ? own : staffOf.find((a) => String(a.id) === accountId) ?? null;
    // The team this device was using no longer includes them: the app drops it and loads their own.
    if (!acct) throw new HostBookError("You're no longer on this team", 403);
  }
  acct ??= own ?? staffOf[0] ?? (await ownAccount(payload, email, true));
  if (!acct) throw new HostBookError("Account not found", 404);
  const role = acct.ownerEmail === email ? "owner" : "staff";
  const me = role === "staff" ? (acct.staff ?? []).find((s: Doc) => s.email === email) : null;
  if (role === "staff" && !me) throw new HostBookError("You're no longer on this team", 403);
  const perms = new Set<StaffPerm>(role === "owner" ? STAFF_PERMS.map((p) => p.key) : (me.perms ?? []));
  const listings = role === "staff" && Array.isArray(me.listings) && me.listings.length ? me.listings.map(String) : null;
  const access = await accessOf(payload, acct);
  const feats = new Set(access.features);
  return {
    email, acct, role, perms, listings, access,
    has: (f) => feats.has(f),
    can: (p) => (p === "owner" ? role === "owner" : role === "owner" || perms.has(p)),
  };
}

export async function teams(payload: Payload, email: string) {
  const own = await ownAccount(payload, email, false);
  const staffOf = await staffAccounts(payload, email);
  return [...(own ? [own] : []), ...staffOf].map((a) => ({ id: String(a.id), name: a.business || a.ownerEmail, role: a.ownerEmail === email ? "owner" : "staff" }));
}

const accountView = (ctx: Ctx) => ({
  id: String(ctx.acct.id), business: ctx.acct.business ?? "", phone: ctx.acct.phone ?? "", city: ctx.acct.city ?? "", ownerEmail: ctx.role === "owner" ? ctx.acct.ownerEmail : "",
  logoUrl: ctx.acct.logoUrl ?? "", idDays: ctx.access.idDays, digestOn: ctx.acct.digestOn === true, extraListings: ctx.acct.extraListings ?? 0,
  checkinRequired: checkinRules(ctx.acct).required, checkinAllGuests: checkinRules(ctx.acct).all,
  staff: ctx.role === "owner" ? (ctx.acct.staff ?? []).map((s: Doc) => ({ email: s.email, name: s.name ?? "", phone: s.phone ?? "", perms: s.perms ?? [], listings: s.listings ?? [] })) : [],
  staysLinked: Boolean(ctx.acct.staysHostId),
  siteSlug: ctx.acct.siteSlug ?? "", site: { ...EMPTY_SITE, ...((ctx.acct.site as Doc) ?? {}) },
});

const planView = (p: Plan) => ({ id: p.id, planId: p.planId, name: p.name, price: p.price, isFree: p.isFree, listings: p.listings, staff: p.staff, idDays: p.idDays, hostChoosesIdDays: p.hostChoosesIdDays, features: p.features, tagline: p.tagline, badge: p.badge, highlights: p.highlights });
export async function publicPlans(payload: Payload) {
  const [plans, s] = await Promise.all([getPlans(payload), getSettings(payload)]);
  return { plans: plans.filter((p) => p.active || p.isFree).map(planView), extraListingPrice: s.extraListingPrice, offerText: s.offerText, whatsapp: s.whatsappNumber, staysPlan: s.staysPlan };
}

/* ---------- reading records ---------- */

const MONEY_FIELDS = ["payout", "platformFee", "gross", "taxes", "deposit", "depositBack", "cleaningFee"];
function canSee(ctx: Ctx, r: Doc) {
  if (!isKind(r.kind)) return false;
  const need = KIND_PERM[r.kind as Kind];
  if (r.kind === "listing") { if (ctx.listings && !ctx.listings.includes(String(r._id ?? r.id))) return false; return true; }
  if (ctx.listings && r.listingId && !ctx.listings.includes(r.listingId)) return false;
  if (r.kind === "expense" && ctx.role === "staff" && !ctx.can("money")) return r.by === ctx.email;
  if (r.kind === "template") return true;
  if (r.kind === "notice") return noticeVisible(ctx, r);
  return ctx.can(need);
}
function shape(ctx: Ctx, d: Doc): Rec {
  const r = view(d);
  if (r.kind === "guest") {
    const seeIds = ctx.can("ids");
    r.idMasked = maskId(r.idNumber);
    r.idPhotos = (r.idPhotos ?? []).map((p: Doc) => ({ side: p.side, deleteAt: p.deleteAt, publicId: seeIds ? p.publicId : "" }));
    if (!seeIds) { r.idNumber = ""; r.passport = r.passport ? maskId(r.passport) : ""; }
  }
  if (r.kind === "booking" && !ctx.can("money")) for (const f of MONEY_FIELDS) delete r[f];
  if (r.files) r.files = (r.files as Doc[]).map((f) => ({ publicId: f.publicId, name: f.name ?? "" }));
  if (r.kind === "notice") { r.read = (r.readBy ?? []).includes(ctx.email); delete r.readBy; }
  return r;
}

export async function bootstrap(payload: Payload, ctx: Ctx, since = 0) {
  const c = await items(payload);
  const q: Doc = { acct: String(ctx.acct.id) };
  if (since > 0) q.updatedAt = { $gt: since };
  const docs: Doc[] = await c.find(q).limit(50_000).toArray();
  const visible = docs.filter((d) => d.deleted || canSee(ctx, d));
  const list = visible.map((d) => (d.deleted ? { id: String(d._id), kind: d.kind, deleted: true } : shape(ctx, d)));
  const hasTemplates = docs.some((d) => d.kind === "template" && !d.deleted);
  return {
    items: since > 0 ? list : list.filter((x) => !(x as Doc).deleted),
    now: Date.now(),
    defaultTemplates: hasTemplates ? [] : DEFAULT_TEMPLATES,
  };
}

export async function meView(payload: Payload, ctx: Ctx) {
  const [s, myTeams, hasPw] = await Promise.all([getSettings(payload), teams(payload, ctx.email), hostbookHasPassword(payload, ctx.email)]);
  const a = ctx.access;
  return {
    email: ctx.email, role: ctx.role, perms: [...ctx.perms], listingsAllowed: ctx.listings, teams: myTeams, hasPassword: hasPw,
    account: accountView(ctx),
    access: { plan: planView(a.plan), paidPlan: a.paidPlan ? planView(a.paidPlan) : null, expiresAt: a.expiresAt, viaStays: a.viaStays, listingLimit: a.listingLimit, staffLimit: a.staffLimit, idDays: a.idDays, features: a.features },
    extraListingPrice: s.extraListingPrice, whatsapp: s.whatsappNumber, allFeatures: FEATURE_KEYS,
  };
}

/* ---------- writing records ---------- */

function featureFor(kind: Kind): FeatureKey | null { return KINDS[kind].feature as FeatureKey | null; }
function assertCanWrite(ctx: Ctx, kind: Kind, data: Doc, existing: Doc | null) {
  const f = featureFor(kind);
  if (f && !ctx.has(f)) throw new HostBookError("This feature isn't on your plan. Upgrade to use it.", 402, { reason: "feature", feature: f });
  const need = KIND_PERM[kind];
  if (kind === "expense" && ctx.role === "staff") {
    if (!ctx.can("expenses")) throw new HostBookError("You can't add expenses on this team", 403);
    if (existing && existing.by !== ctx.email && !ctx.can("money")) throw new HostBookError("You can only edit expenses you added", 403);
  } else if (kind === "listing" || kind === "owner" || kind === "recurring" || kind === "template") {
    if (ctx.role !== "owner") throw new HostBookError("Only the account owner can change this", 403);
  } else if (!ctx.can(need)) throw new HostBookError("You don't have access to this", 403);
  const lid = data.listingId ?? existing?.listingId;
  if (ctx.listings && lid && !ctx.listings.includes(lid)) throw new HostBookError("You don't have access to this listing", 403);
}

export async function saveRecord(payload: Payload, ctx: Ctx, kindRaw: unknown, idRaw: unknown, body: Doc) {
  if (!isKind(kindRaw) || kindRaw === "notice") throw new HostBookError("Unknown record type");
  const kind = kindRaw;
  const c = await items(payload);
  const acct = String(ctx.acct.id);
  const id = typeof idRaw === "string" && idRaw ? idRaw : "";
  const existing: Doc | null = id ? await c.findOne({ _id: id, acct, kind }) : null;
  if (id && (!existing || existing.deleted)) throw new HostBookError("Not found", 404);
  const data = cleanRecord(kind, body ?? {}, ctx.has);
  // Staff without money access can't change money fields (they don't see them either).
  if (kind === "booking" && !ctx.can("money")) for (const f of MONEY_FIELDS) delete data[f];
  assertCanWrite(ctx, kind, data, existing);
  const now = Date.now();

  if (kind === "listing" && !existing) {
    const count = await c.countDocuments({ acct, kind: "listing", deleted: { $ne: true }, archived: { $ne: true } });
    if (count >= ctx.access.listingLimit) throw new HostBookError(`Your ${ctx.access.plan.name} plan allows ${ctx.access.listingLimit} listing${ctx.access.listingLimit === 1 ? "" : "s"}. Upgrade or add extra listings.`, 402, { reason: "listings" });
  }
  if (kind === "listing" && existing?.archived && data.archived === false) {
    const count = await c.countDocuments({ acct, kind: "listing", deleted: { $ne: true }, archived: { $ne: true } });
    if (count >= ctx.access.listingLimit) throw new HostBookError("You're at your listing limit. Archive another listing or upgrade first.", 402, { reason: "listings" });
  }
  if (kind === "booking") {
    const start = data.start ?? existing?.start, end = data.end ?? existing?.end;
    if (!isDay(start) || !isDay(end) || end <= start) throw new HostBookError("Check-out must be after check-in");
    if (!(data.listingId ?? existing?.listingId)) throw new HostBookError("Pick a listing");
    if (!existing && ctx.has("checkin")) data.checkinCode = rid(8);
    if (!existing && !data.status) data.status = "confirmed";
  }
  if (kind === "task") {
    if (!data.title && !existing) throw new HostBookError("Give the task a name");
    if (!existing && !data.due) data.due = istDay();
    if (!existing && data.active === undefined) data.active = true;
  }
  if (kind === "guest" && !existing && !data.name) throw new HostBookError("Add the guest's name");
  if (kind === "guest" || kind === "booking") {
    // Same format checks as the guest check-in form, so the register stays clean.
    const nat = data.nationality ?? existing?.nationality;
    const checks: [string, { value: string; error?: string }][] = [];
    if ("phone" in data) checks.push(["phone", checkPhone(data.phone)]);
    if ("phone2" in data) checks.push(["phone2", checkPhone(data.phone2)]);
    if ("email" in data) checks.push(["email", checkEmail(data.email)]);
    if ("idNumber" in data) checks.push(["idNumber", checkId(String(data.idType ?? existing?.idType ?? "Other"), data.idNumber, { indian: isIndian(nat) })]);
    if ("passport" in data) checks.push(["passport", checkId("Passport", data.passport, { indian: isIndian(nat) })]);
    for (const [k, r] of checks) {
      if (r.error) throw new HostBookError(r.error, 400, { field: k });
      data[k] = r.value;
    }
  }
  if (kind === "listing" && !existing && !data.name) throw new HostBookError("Give the listing a name");

  if (existing) {
    await c.updateOne({ _id: id, acct }, { $set: { ...data, updatedAt: now, editedBy: ctx.email } });
    return shape(ctx, { ...existing, ...data, updatedAt: now });
  }
  const doc = { _id: rid(), acct, kind, ...data, createdAt: now, updatedAt: now, by: ctx.email };
  await c.insertOne(doc);
  return shape(ctx, doc);
}

export async function deleteRecord(payload: Payload, ctx: Ctx, idRaw: unknown) {
  const c = await items(payload);
  const acct = String(ctx.acct.id);
  const d: Doc | null = await c.findOne({ _id: String(idRaw ?? ""), acct, deleted: { $ne: true } });
  if (!d || !isKind(d.kind)) throw new HostBookError("Not found", 404);
  if (d.kind === "listing") throw new HostBookError("Listings can't be deleted, only archived (so their history stays in your reports).");
  assertCanWrite(ctx, d.kind, {}, d);
  if (d.kind === "guest" && !ctx.can("owner")) throw new HostBookError("Only the account owner can delete guests", 403);
  for (const p of [...(d.idPhotos ?? []), ...(d.files ?? [])]) await destroyFile(p.publicId);
  // Kept as a small "deleted" marker so other devices drop it on their next sync.
  await c.replaceOne({ _id: d._id, acct }, { _id: d._id, acct, kind: d.kind, deleted: true, updatedAt: Date.now() });
  return { ok: true };
}

/** Ticks off a repeating task: logs the run and moves the task to its next date (one-time tasks are closed). */
export async function completeTask(payload: Payload, ctx: Ctx, taskId: unknown, body: Doc) {
  if (!ctx.has("tasks")) throw new HostBookError("Regular tasks aren't on your plan", 402, { reason: "feature", feature: "tasks" });
  if (!ctx.can("tasks")) throw new HostBookError("You don't have access to tasks", 403);
  const c = await items(payload);
  const acct = String(ctx.acct.id);
  const t: Doc | null = await c.findOne({ _id: String(taskId ?? ""), acct, kind: "task", deleted: { $ne: true } });
  if (!t) throw new HostBookError("Task not found", 404);
  if (ctx.listings && t.listingId && !ctx.listings.includes(t.listingId)) throw new HostBookError("You don't have access to this listing", 403);
  const now = Date.now();
  const status = body.status === "skipped" ? "skipped" : "done";
  const run = { _id: rid(), acct, kind: "taskrun", taskId: t._id, listingId: t.listingId ?? "", date: istDay(), due: t.due, by: ctx.email, note: String(body.note ?? "").slice(0, 2000), status, createdAt: now, updatedAt: now };
  await c.insertOne(run);
  // From the due date (not today), so "every 3 months" stays on its schedule even when done late.
  let next = nextDue(t.due || istDay(), t.every, t.unit);
  while (next && next <= istDay()) next = nextDue(next, t.every, t.unit);
  const set = next ? { due: next, updatedAt: now, lastDone: istDay() } : { active: false, updatedAt: now, lastDone: istDay() };
  await c.updateOne({ _id: t._id, acct }, { $set: set });
  return { run: view(run), task: shape(ctx, { ...t, ...set }) };
}

export async function updateAccount(payload: Payload, ctx: Ctx, b: Doc) {
  if (ctx.role !== "owner") throw new HostBookError("Only the account owner can change this", 403);
  const data: Doc = {};
  if (typeof b.business === "string") data.business = b.business.trim().slice(0, 120);
  if (typeof b.phone === "string") data.phone = b.phone.replace(/[^\d+ ]/g, "").slice(0, 20);
  if (typeof b.city === "string") data.city = b.city.trim().slice(0, 80);
  if (typeof b.digestOn === "boolean") data.digestOn = b.digestOn;
  if (Array.isArray(b.checkinRequired)) data.checkinRequired = b.checkinRequired.filter((k: string) => (CHECKIN_FIELD_KEYS as string[]).includes(k));
  if (typeof b.checkinAllGuests === "boolean") data.checkinAllGuests = b.checkinAllGuests;
  if (b.idDays !== undefined && ctx.access.plan.hostChoosesIdDays) data.idDays = Math.min(ctx.access.plan.idDays, Math.max(1, Math.round(Number(b.idDays) || ctx.access.plan.idDays)));
  if (typeof b.logoUrl === "string" && ctx.has("branding")) data.logoUrl = /^https:\/\/[^\s"'<>]{5,500}$/.test(b.logoUrl.trim()) ? b.logoUrl.trim() : "";
  if (Array.isArray(b.staff)) {
    const seen = new Set<string>();
    const staff = b.staff.slice(0, 100).map((s: Doc) => ({
      email: normEmail(s.email), name: String(s.name ?? "").slice(0, 80), phone: String(s.phone ?? "").replace(/[^\d+ ]/g, "").slice(0, 20),
      perms: (Array.isArray(s.perms) ? s.perms : []).filter((p: string) => STAFF_PERMS.some((x) => x.key === p)),
      listings: (Array.isArray(s.listings) ? s.listings : []).map(String).filter((x: string) => /^[\w-]{1,40}$/.test(x)),
    })).filter((s: Doc) => validEmail(s.email) && s.email !== ctx.email && !seen.has(s.email) && seen.add(s.email));
    if (staff.length > ctx.access.staffLimit) throw new HostBookError(`Your ${ctx.access.plan.name} plan allows ${ctx.access.staffLimit} staff member${ctx.access.staffLimit === 1 ? "" : "s"}. Upgrade to add more.`, 402, { reason: "staff" });
    const before = new Set((ctx.acct.staff ?? []).map((s: Doc) => s.email));
    data.staff = staff;
    for (const s of staff.filter((x: Doc) => !before.has(x.email))) {
      await send(s.email, `You've been added to ${ctx.acct.business || "a host team"} on HostBook`,
        `<h2 style="margin:0 0 8px">You're on the team</h2><p>${esc(ctx.acct.business || ctx.email)} added you to their HostBook so you can see bookings and tasks.</p><p>${button(`${siteUrl()}/hostbook/app`, "Open HostBook")}</p><p style="font-size:13px;color:#666">Sign in with this email address (${esc(s.email)}). We'll send you a code.</p>`,
        `${ctx.acct.business || ctx.email} added you to their HostBook. Open ${siteUrl()}/hostbook/app and sign in with ${s.email}.`);
    }
  }
  const updated = (await payload.update({ collection: AC as never, id: ctx.acct.id, data: data as never, overrideAccess: true, depth: 0 })) as Doc;
  return { ok: true, account: accountView({ ...ctx, acct: updated }) };
}

/* ---------- files: guest IDs, receipts, damage photos (Cloudinary, authenticated delivery) ---------- */

type Cloud = {
  config: () => { cloud_name?: string; api_key?: string; api_secret?: string };
  utils: { api_sign_request: (p: Doc, s: string) => string; private_download_url: (id: string, format: string, o: Doc) => string };
  uploader: { destroy: (id: string, o: Doc) => Promise<unknown> };
};
async function cloud(): Promise<Cloud> { const { v2 } = await import("cloudinary"); return v2 as unknown as Cloud; }
async function cloudCfg() {
  const c = await cloud();
  const cfg = c.config();
  if (!cfg.cloud_name || !cfg.api_key || !cfg.api_secret) throw new HostBookError("Photo uploads aren't set up yet", 503);
  return { c, cfg };
}
const acctFolder = (acct: string) => createHash("sha1").update(`hb:${acct}`).digest("hex").slice(0, 14);
async function signUpload(publicId: string) {
  const { c, cfg } = await cloudCfg();
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { allowed_formats: "jpg,jpeg,png,webp,heic,pdf", public_id: publicId, timestamp, type: "authenticated" };
  return { publicId, url: `https://api.cloudinary.com/v1_1/${cfg.cloud_name}/image/upload`, fields: { ...params, api_key: cfg.api_key, signature: c.utils.api_sign_request(params, cfg.api_secret!) } };
}
async function destroyFile(publicId: unknown) {
  if (typeof publicId !== "string" || !publicId.startsWith("hostbook-")) return;
  try { const c = await cloud(); if (c.config().cloud_name) await c.uploader.destroy(publicId, { type: "authenticated", resource_type: "image", invalidate: true }); }
  catch (e) { console.error("[hostbook] delete file", publicId, e); }
}
/** A download link that stops working after a few minutes (Cloudinary signs the expiry). */
async function tempLink(publicId: string) {
  const { c } = await cloudCfg();
  return c.utils.private_download_url(publicId, "jpg", { type: "authenticated", resource_type: "image", expires_at: Math.floor(Date.now() / 1000) + ID_LINK_MINUTES * 60, attachment: false });
}
const idPrefix = (acct: string) => `hostbook-ids/${acctFolder(acct)}/`;
const filePrefix = (acct: string) => `hostbook-files/${acctFolder(acct)}/`;

async function ownGuest(payload: Payload, ctx: Ctx, guestId: unknown) {
  const c = await items(payload);
  const g: Doc | null = await c.findOne({ _id: String(guestId ?? ""), acct: String(ctx.acct.id), kind: "guest", deleted: { $ne: true } });
  if (!g) throw new HostBookError("Guest not found", 404);
  return { c, g };
}

export async function signIdUpload(payload: Payload, ctx: Ctx, guestId: unknown) {
  if (!ctx.can("ids") && !ctx.can("guests")) throw new HostBookError("You don't have access to guest IDs", 403);
  await ownGuest(payload, ctx, guestId);
  return signUpload(`${idPrefix(String(ctx.acct.id))}${rid(12)}`);
}
export async function addIdPhoto(payload: Payload, ctx: Ctx, guestId: unknown, publicId: unknown, side: unknown) {
  if (!ctx.can("guests")) throw new HostBookError("You don't have access to guests", 403);
  const { c, g } = await ownGuest(payload, ctx, guestId);
  const acct = String(ctx.acct.id);
  if (typeof publicId !== "string" || !publicId.startsWith(idPrefix(acct)) || !/^[\w/-]+$/.test(publicId)) throw new HostBookError("Invalid photo");
  const photo = { publicId, side: side === "back" ? "back" : side === "visa" ? "visa" : "front", deleteAt: Date.now() + ctx.access.idDays * 864e5, at: Date.now() };
  const photos = [...(g.idPhotos ?? []).filter((p: Doc) => p.publicId !== publicId), photo].slice(-6);
  await c.updateOne({ _id: g._id, acct }, { $set: { idPhotos: photos, updatedAt: Date.now() } });
  return shape(ctx, { ...g, idPhotos: photos });
}
export async function idLinks(payload: Payload, ctx: Ctx, guestId: unknown) {
  if (!ctx.can("ids")) throw new HostBookError("You don't have access to guest ID photos", 403);
  const { g } = await ownGuest(payload, ctx, guestId);
  return { minutes: ID_LINK_MINUTES, photos: await Promise.all((g.idPhotos ?? []).map(async (p: Doc) => ({ side: p.side, publicId: p.publicId, deleteAt: p.deleteAt, url: await tempLink(p.publicId) }))) };
}
export async function removeIdPhoto(payload: Payload, ctx: Ctx, guestId: unknown, publicId: unknown) {
  if (!ctx.can("ids")) throw new HostBookError("You don't have access to guest ID photos", 403);
  const { c, g } = await ownGuest(payload, ctx, guestId);
  const photos = (g.idPhotos ?? []).filter((p: Doc) => p.publicId !== publicId);
  await destroyFile(publicId);
  await c.updateOne({ _id: g._id, acct: String(ctx.acct.id) }, { $set: { idPhotos: photos, updatedAt: Date.now() } });
  return shape(ctx, { ...g, idPhotos: photos });
}

/** Receipts (expenses), damage photos and task photos. Kept until the record is deleted. */
export async function signFile(payload: Payload, ctx: Ctx, kind: unknown) {
  if (kind === "expense" && !ctx.has("receipts")) throw new HostBookError("Receipt photos aren't on your plan", 402, { reason: "feature", feature: "receipts" });
  if (kind === "damage" && !ctx.has("deposits")) throw new HostBookError("The damage log isn't on your plan", 402, { reason: "feature", feature: "deposits" });
  return signUpload(`${filePrefix(String(ctx.acct.id))}${rid(12)}`);
}
export async function attachFile(payload: Payload, ctx: Ctx, recordId: unknown, publicId: unknown, name: unknown) {
  const c = await items(payload);
  const acct = String(ctx.acct.id);
  const d: Doc | null = await c.findOne({ _id: String(recordId ?? ""), acct, deleted: { $ne: true } });
  if (!d || !["expense", "damage", "taskrun", "maint", "clean"].includes(d.kind)) throw new HostBookError("Not found", 404);
  assertCanWrite(ctx, d.kind, {}, d);
  if (typeof publicId !== "string" || !publicId.startsWith(filePrefix(acct)) || !/^[\w/-]+$/.test(publicId)) throw new HostBookError("Invalid file");
  const files = [...(d.files ?? []), { publicId, name: String(name ?? "").slice(0, 80), at: Date.now() }].slice(-10);
  await c.updateOne({ _id: d._id, acct }, { $set: { files, updatedAt: Date.now() } });
  return shape(ctx, { ...d, files });
}
export async function fileLink(payload: Payload, ctx: Ctx, recordId: unknown, publicId: unknown) {
  const c = await items(payload);
  const d: Doc | null = await c.findOne({ _id: String(recordId ?? ""), acct: String(ctx.acct.id), deleted: { $ne: true } });
  if (!d || !canSee(ctx, d) || !(d.files ?? []).some((f: Doc) => f.publicId === publicId)) throw new HostBookError("Not found", 404);
  return { url: await tempLink(String(publicId)) };
}

/* ---------- guest online check-in (public, by link) ---------- */

async function bookingByCode(payload: Payload, code: unknown) {
  const s = String(code ?? "");
  if (!/^[\w-]{6,20}$/.test(s)) throw new HostBookError("This check-in link isn't valid", 404);
  const c = await items(payload);
  const b: Doc | null = await c.findOne({ checkinCode: s, kind: "booking", deleted: { $ne: true } });
  if (!b || b.status === "cancelled") throw new HostBookError("This check-in link isn't valid any more. Please ask your host for a new one.", 404);
  if (b.end < addDays(istDay(), -2)) throw new HostBookError("This stay has ended, so the check-in link is closed.", 410);
  const acct = (await payload.findByID({ collection: AC as never, id: b.acct, depth: 0, overrideAccess: true }).catch(() => null)) as Doc | null;
  if (!acct) throw new HostBookError("This check-in link isn't valid", 404);
  const access = await accessOf(payload, acct);
  if (!access.features.includes("checkin")) throw new HostBookError("Online check-in is switched off for this host. Please share your details with them directly.", 403);
  const listing: Doc | null = await c.findOne({ _id: b.listingId, acct: b.acct, kind: "listing" });
  return { c, b, acct, access, listing };
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDay = (d: string) => (isDay(d) ? `${Number(d.slice(8))} ${MON[Number(d.slice(5, 7)) - 1]}` : d);
const checkinRules = (acct: Doc) => ({
  required: (Array.isArray(acct.checkinRequired) ? acct.checkinRequired : DEFAULT_REQUIRED).filter((k: string) => (CHECKIN_FIELD_KEYS as string[]).includes(k)) as CheckinField[],
  all: acct.checkinAllGuests === true,
});
/** Guest details as the guest may see them again on their own link: ID numbers stay masked, photos only as "uploaded". */
const guestForLink = (g: Doc) => ({
  id: String(g._id), name: g.name ?? "", phone: g.phone ?? "", email: g.email ?? "", address: g.address ?? "", city: g.city ?? "", nationality: g.nationality ?? "",
  gender: g.gender ?? "", age: g.age || "", idType: g.idType ?? "", idMasked: maskId(g.idNumber), hasId: Boolean(g.idNumber),
  passportMasked: g.passport ? maskId(g.passport) : "", passportExpiry: g.passportExpiry ?? "", visa: g.visa ?? "", visaType: g.visaType ?? "", visaExpiry: g.visaExpiry ?? "",
  arrivalInIndia: g.arrivalInIndia ?? "", arrivedFrom: g.arrivedFrom ?? "", nextDestination: g.nextDestination ?? "",
  photos: [...new Set((g.idPhotos ?? []).map((p: Doc) => p.side))],
});
const editable = (status: string) => status !== "approved";

export async function checkinView(payload: Payload, code: unknown) {
  const { c, b, acct, access, listing } = await bookingByCode(payload, code);
  const has = (f: FeatureKey) => access.features.includes(f);
  const status = b.checkinStatus || "pending";
  const ids: string[] = b.guestIds?.length ? b.guestIds : b.guestId ? [b.guestId] : [];
  const guests: Doc[] = ids.length ? await c.find({ _id: { $in: ids }, acct: b.acct, kind: "guest", deleted: { $ne: true } }).toArray() : [];
  const rules = checkinRules(acct);
  return {
    host: { name: acct.business || "Your host", logoUrl: has("branding") ? acct.logoUrl ?? "" : "" },
    listing: listing ? {
      name: listing.name ?? "", city: listing.city ?? "", rules: listing.rules ?? "", checkIn: listing.checkIn ?? "", checkOut: listing.checkOut ?? "",
      // Address, Wi-Fi and the guidebook only after details are sent, so the link alone doesn't give them away.
      ...(status === "submitted" || status === "approved" || (status === "changes" && b.checkinAt) ? { address: listing.address ?? "", mapUrl: listing.mapUrl ?? "", wifiName: listing.wifiName ?? "", wifiPass: listing.wifiPass ?? "", guidebook: has("guidebook") ? listing.guidebook ?? "" : "" } : {}),
    } : null,
    stay: { start: b.start, end: b.end, adults: b.adults || 1, children: b.children || 0 },
    status, canEdit: editable(status),
    changeRequest: status === "changes" ? { fields: b.changeRequest?.fields ?? [], note: b.changeRequest?.note ?? "" } : null,
    // Details already on file (typed by the host, or sent earlier) so the guest only fixes or adds what's missing.
    guests: guests.sort((x, y) => ids.indexOf(String(x._id)) - ids.indexOf(String(y._id))).map(guestForLink),
    required: rules.required, requiredForAll: rules.all,
    idDays: access.idDays,
    foreignFields: has("formC"),
  };
}

export async function checkinSign(payload: Payload, code: unknown) {
  const { b } = await bookingByCode(payload, code);
  if (!editable(b.checkinStatus)) throw new HostBookError("Your host has already confirmed your details.", 409);
  return signUpload(`${idPrefix(b.acct)}ci-${b._id}-${rid(10)}`);
}

export async function checkinSubmit(payload: Payload, code: unknown, body: Doc) {
  const { c, b, acct, access, listing } = await bookingByCode(payload, code);
  if (!editable(b.checkinStatus)) throw new HostBookError("Your host has already confirmed your details. Contact them to change anything.", 409);
  if (body.agree !== true) throw new HostBookError("Please tick that you agree to the house rules");
  const people = Array.isArray(body.guests) ? body.guests.slice(0, 20) : [];
  if (!people.length) throw new HostBookError("Add at least one guest");
  const has = (f: FeatureKey) => access.features.includes(f);
  const now = Date.now();
  const rules = checkinRules(acct);
  const linked: string[] = b.guestIds?.length ? b.guestIds : b.guestId ? [b.guestId] : [];
  const onFile = new Map<string, Doc>((linked.length ? await c.find({ _id: { $in: linked }, acct: b.acct, kind: "guest", deleted: { $ne: true } }).toArray() : []).map((g: Doc) => [String(g._id), g]));

  // A returning guest (same phone) is updated rather than added twice, and needn't send an ID the host already has.
  const last10 = (p: unknown) => String(p ?? "").replace(/\D/g, "").slice(-10);
  const withPhone: Doc[] | null = people.some((p: Doc) => last10(p?.phone).length === 10)
    ? await c.find({ acct: b.acct, kind: "guest", deleted: { $ne: true }, phone: { $nin: ["", null] } }).toArray() : null;
  const byPhone = (raw: unknown) => { const d = last10(raw); return d.length === 10 ? withPhone?.find((g) => last10(g.phone) === d || last10(g.phone2) === d) ?? null : null; };

  // Check everyone first, so nothing is saved when one field is wrong.
  const prepared = people.map((raw: Doc, i: number) => {
    const prev = (typeof raw?.id === "string" ? onFile.get(raw.id) ?? null : null) ?? byPhone(raw?.phone);
    const data = cleanRecord("guest", raw ?? {}, has) as Doc;
    delete data.flag; delete data.rating; delete data.notes;
    // A blank ID number on a guest already on file keeps the saved one (the link only shows it masked).
    if (prev && !String(data.idNumber ?? "").trim()) delete data.idNumber;
    if (prev && !String(data.passport ?? "").trim()) delete data.passport;
    const photos = (Array.isArray(raw?.photos) ? raw.photos : []).slice(0, 4)
      .filter((p: Doc) => typeof p?.publicId === "string" && p.publicId.startsWith(`${idPrefix(b.acct)}ci-${b._id}-`) && /^[\w/-]+$/.test(p.publicId))
      .map((p: Doc) => ({ publicId: p.publicId, side: p.side === "back" ? "back" : p.side === "visa" ? "visa" : "front", deleteAt: now + access.idDays * 864e5, at: now }));
    const errors = checkGuest({ ...data, idNumber: data.idNumber ?? "" }, {
      required: rules.required, all: rules.all, main: i === 0, photos: photos.map((p: Doc) => p.side),
      hadPhotos: prev ? (prev.idPhotos ?? []).map((p: Doc) => p.side) : [], hadId: Boolean(prev?.idNumber && prev?.idType && (!data.idType || data.idType === prev.idType)),
    });
    if (data.idNumber) data.idNumber = checkId(String(data.idType || "Other"), data.idNumber, { indian: isIndian(data.nationality) }).value;
    if (data.passport) data.passport = checkId("Passport", data.passport, { indian: isIndian(data.nationality) }).value;
    if (data.phone) data.phone = checkPhone(data.phone).value;
    if (data.email) data.email = checkEmail(data.email).value;
    return { data, photos, prev, errors };
  });
  const bad = prepared.findIndex((p: Doc) => Object.keys(p.errors).length);
  if (bad >= 0) {
    const [field, msg] = Object.entries(prepared[bad].errors)[0] as [string, string];
    throw new HostBookError(`${bad === 0 ? "Main guest" : `Guest ${bad + 1}`}: ${msg}`, 400, { guest: bad, field, errors: prepared.map((p: Doc) => p.errors) });
  }

  const ids: string[] = [];
  const foreign: string[] = [];
  const replaced: string[] = [];
  for (const { data, photos, prev } of prepared) {
    const existing = prev;
    if (existing) {
      // Only what they filled in this time, so blanks don't wipe what the host already has. A new photo of a side replaces the old one.
      const fresh = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== "" && v !== 0 && v !== null));
      const sides = new Set(photos.map((p: Doc) => p.side));
      const old = (existing.idPhotos ?? []) as Doc[];
      replaced.push(...old.filter((p) => sides.has(p.side)).map((p) => p.publicId));
      await c.updateOne({ _id: existing._id }, { $set: { ...fresh, idPhotos: [...old.filter((p) => !sides.has(p.side)), ...photos], updatedAt: now } });
      ids.push(String(existing._id));
    } else {
      const _id = rid();
      await c.insertOne({ _id, acct: b.acct, kind: "guest", ...data, idPhotos: photos, createdAt: now, updatedAt: now, by: "check-in" });
      ids.push(_id);
    }
    if (data.nationality && !isIndian(data.nationality)) foreign.push(String(data.name));
  }
  for (const id of replaced) await destroyFile(id);
  const again = Boolean(b.checkinAt);
  await c.updateOne({ _id: b._id }, { $set: { guestIds: [...new Set(ids)], guestId: ids[0], guestName: String(people[0]?.name ?? b.guestName ?? "").slice(0, 120), checkinStatus: "submitted", checkinAt: now, changeRequest: null, updatedAt: now } });
  // Foreign guests: Form C must be filed within 24 hours of arrival, so a one-time task reminds the host (once per booking).
  if (foreign.length && has("formC") && has("tasks") && !(await c.findOne({ acct: b.acct, kind: "task", formCFor: b._id }))) {
    await c.insertOne({ _id: rid(), acct: b.acct, kind: "task", formCFor: b._id, listingId: b.listingId, title: `Submit Form C: ${foreign.join(", ")}`.slice(0, 300), every: 1, unit: "once", due: b.start > istDay() ? b.start : istDay(), notes: "File within 24 hours of arrival on indianfrro.gov.in. The details are under Police & Form C → Form C.", active: true, createdAt: now, updatedAt: now, by: "check-in" });
  }
  const who = `${people[0]?.name ?? "Guest"}${people.length > 1 ? ` +${people.length - 1}` : ""}`;
  await notify(payload, String(acct.id), {
    to: "guests", link: `booking/${b._id}`,
    title: again ? `${who} updated their details` : `${who} sent their details`,
    text: `${listing?.name ?? "Your listing"} · ${shortDay(b.start)} → ${shortDay(b.end)}. Review and approve.${foreign.length && has("formC") ? " Foreign guest: Form C due within 24 hours of arrival." : ""}`,
  });
  return checkinView(payload, code);
}

/** Host asks the guest to fix or add some details: the guest's link opens the form again, with the fields marked. */
export async function requestChanges(payload: Payload, ctx: Ctx, b0: Doc) {
  if (!ctx.has("checkin")) throw new HostBookError("Online check-in isn't on your plan", 402, { reason: "feature", feature: "checkin" });
  if (!ctx.can("guests")) throw new HostBookError("You don't have access to guest details", 403);
  const c = await items(payload);
  const b: Doc | null = await c.findOne({ _id: String(b0.bookingId ?? ""), acct: String(ctx.acct.id), kind: "booking", deleted: { $ne: true } });
  if (!b) throw new HostBookError("Booking not found", 404);
  if (ctx.listings && !ctx.listings.includes(b.listingId)) throw new HostBookError("You don't have access to this listing", 403);
  const fields = (Array.isArray(b0.fields) ? b0.fields : []).filter((f: string) => ["name", "phone", "email", "address", "city", "nationality", "gender", "age", "id", "idFront", "idBack", "passport", "visa", "addGuests"].includes(f));
  const note = String(b0.note ?? "").slice(0, 500).trim();
  if (!fields.length && !note) throw new HostBookError("Pick what needs fixing, or write a note");
  const set = { checkinStatus: "changes", changeRequest: { fields, note, at: Date.now(), by: ctx.email }, checkinCode: b.checkinCode || rid(8), updatedAt: Date.now() };
  await c.updateOne({ _id: b._id }, { $set: set });
  return { item: shape(ctx, { ...b, ...set }) };
}

/* ---------- notifications (in the app, and on the phone if allowed) ---------- */

export type NoticeTo = "owner" | StaffPerm;
/** Saves a notification for the owner and the staff with `to` permission, and pings their phones. */
export async function notify(payload: Payload, acctId: string, n: { to: NoticeTo; title: string; text?: string; link?: string; key?: string }) {
  const c = await items(payload);
  const now = Date.now();
  // A notice with a key replaces the earlier one (e.g. "today" once a day), so the list doesn't fill up.
  if (n.key) await c.deleteMany({ acct: acctId, kind: "notice", key: n.key });
  await c.insertOne({ _id: rid(), acct: acctId, kind: "notice", to: n.to, title: n.title.slice(0, 160), text: (n.text ?? "").slice(0, 400), link: n.link ?? "", key: n.key ?? "", readBy: [], createdAt: now, updatedAt: now });
  const acct = (await payload.findByID({ collection: AC as never, id: acctId, depth: 0, overrideAccess: true }).catch(() => null)) as Doc | null;
  if (!acct) return;
  const emails = [acct.ownerEmail, ...(acct.staff ?? []).filter((s: Doc) => n.to !== "owner" && (s.perms ?? []).includes(n.to)).map((s: Doc) => s.email)];
  await pushTo(payload, emails).catch((e) => console.error("[hostbook-push]", e));
}

const noticeVisible = (ctx: Ctx, d: Doc) => d.to === "owner" ? ctx.role === "owner" : ctx.can(d.to);

export async function markNoticesRead(payload: Payload, ctx: Ctx, ids: unknown) {
  const c = await items(payload);
  const q: Doc = { acct: String(ctx.acct.id), kind: "notice", readBy: { $ne: ctx.email } };
  if (Array.isArray(ids)) q._id = { $in: ids.map(String).slice(0, 200) };
  const list: Doc[] = await c.find(q).toArray();
  for (const d of list.filter((x) => noticeVisible(ctx, x))) await c.updateOne({ _id: d._id }, { $set: { readBy: [...(d.readBy ?? []), ctx.email].slice(-30), updatedAt: Date.now() } });
  return { ok: true, read: list.length };
}

async function vapid(payload: Payload): Promise<VapidKeys> {
  const g = ((await payload.findGlobal({ slug: "hostbook-settings" as never, depth: 0, overrideAccess: true }).catch(() => null)) ?? {}) as Doc;
  if (g.vapidPublic && g.vapidPrivate) return { publicKey: g.vapidPublic, privateJwk: g.vapidPrivate };
  const k = makeVapidKeys();
  await payload.updateGlobal({ slug: "hostbook-settings" as never, data: { vapidPublic: k.publicKey, vapidPrivate: k.privateJwk } as never, overrideAccess: true });
  return k;
}
async function pushCol(payload: Payload) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (payload.db as any).connection.db.collection("hb_push");
}
export async function pushKey(payload: Payload) { return { publicKey: (await vapid(payload)).publicKey }; }
export async function pushSubscribe(payload: Payload, email: string, sub: unknown, off = false) {
  const col = await pushCol(payload);
  if (off) { await col.deleteMany({ email, ...(validSub(sub) ? { _id: (sub as PushSub).endpoint } : {}) }); return { ok: true, on: false }; }
  if (!validSub(sub)) throw new HostBookError("Notifications aren't supported on this browser");
  await col.deleteMany({ _id: sub.endpoint });
  await col.insertOne({ _id: sub.endpoint, email, at: Date.now() });
  return { ok: true, on: true };
}
async function pushTo(payload: Payload, emails: string[]) {
  const col = await pushCol(payload);
  const subs: Doc[] = await col.find({ email: { $in: [...new Set(emails)].slice(0, 50) } }).limit(100).toArray();
  if (!subs.length) return;
  const keys = await vapid(payload);
  for (const s of subs) if (!(await sendPush(keys, { endpoint: s._id }))) await col.deleteMany({ _id: s._id });
}
/** For the phone's background worker after a push: the newest unread notification across the person's teams. */
export async function latestNotice(payload: Payload, email: string) {
  const own = await ownAccount(payload, email, false);
  const accts = [...(own ? [own] : []), ...(await staffAccounts(payload, email))];
  const c = await items(payload);
  let best: Doc | null = null;
  for (const a of accts) {
    const ctx = await ctxFor(payload, email, String(a.id)).catch(() => null);
    if (!ctx) continue;
    const list: Doc[] = await c.find({ acct: String(a.id), kind: "notice", readBy: { $ne: email } }).sort({ createdAt: -1 }).limit(10).toArray();
    const n = list.find((d) => noticeVisible(ctx, d));
    if (n && (!best || n.createdAt > best.createdAt)) best = { ...n, acctId: String(a.id) };
  }
  return best ? { title: best.title, text: best.text, link: best.link, account: best.acctId } : null;
}

/* ---------- Airbnb / Booking.com calendar sync ---------- */

const feedsOf = (l: Doc): { url: string; source: string; label: string }[] =>
  (Array.isArray(l.ical) ? l.ical : []).filter((f: Doc) => typeof f?.url === "string" && /^https?:\/\/\S{8,1000}$/.test(f.url.trim())).slice(0, 5)
    .map((f: Doc) => ({ url: f.url.trim().replace(/^webcal:/, "https:"), source: String(f.source || (/airbnb/i.test(f.url) ? "Airbnb" : /booking\.com/i.test(f.url) ? "Booking.com" : "Other")), label: String(f.label ?? "") }));

export async function syncAccount(payload: Payload, acct: Doc, access?: Access) {
  const a = access ?? (await accessOf(payload, acct));
  if (!a.features.includes("ical")) return { listings: 0, added: 0, updated: 0, cancelled: 0, errors: [] as string[] };
  const c = await items(payload);
  const acctId = String(acct.id);
  const listings: Doc[] = await c.find({ acct: acctId, kind: "listing", deleted: { $ne: true }, archived: { $ne: true } }).toArray();
  let added = 0, updated = 0, cancelled = 0, newStays = 0;
  const errors: string[] = [];
  const today = istDay();
  for (const l of listings) {
    for (const f of feedsOf(l)) {
      let events;
      try {
        const res = await fetch(f.url, { headers: { "user-agent": "PandoraHostBook/1.0" }, signal: AbortSignal.timeout(15_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        events = parseIcal((await res.text()).slice(0, 2_000_000));
      } catch (e) { errors.push(`${l.name} (${f.source}): ${(e as Error).message}`); continue; }
      const seen = new Set<string>();
      const now = Date.now();
      for (const e of events) {
        if (e.end < addDays(today, -60)) continue;
        seen.add(e.uid);
        const block = icalIsBlock(e);
        const existing: Doc | null = await c.findOne({ acct: acctId, kind: "booking", listingId: l._id, icalUid: e.uid, deleted: { $ne: true } });
        if (existing) {
          if (existing.start !== e.start || existing.end !== e.end || existing.status === "cancelled") {
            await c.updateOne({ _id: existing._id }, { $set: { start: e.start, end: e.end, status: block ? "blocked" : existing.status === "cancelled" ? "confirmed" : existing.status, updatedAt: now } });
            updated++;
          }
          continue;
        }
        const last4 = icalPhoneLast4(e);
        await c.insertOne({
          _id: rid(), acct: acctId, kind: "booking", listingId: l._id, start: e.start, end: e.end, status: block ? "blocked" : "confirmed", source: f.source,
          guestName: block ? "" : e.summary && !/^reserved$/i.test(e.summary) ? e.summary : "", notes: last4 ? `Phone ends ${last4} (from ${f.source})` : "",
          icalUid: e.uid, icalFeed: f.url.slice(0, 300), ...(block || !a.features.includes("checkin") ? {} : { checkinCode: rid(8) }), createdAt: now, updatedAt: now, by: "sync",
        });
        added++;
        if (!block) newStays++;
      }
      // A future booking that dropped out of the feed was cancelled on the platform.
      const gone: Doc[] = await c.find({ acct: acctId, kind: "booking", listingId: l._id, icalFeed: f.url.slice(0, 300), status: { $ne: "cancelled" }, start: { $gte: today }, deleted: { $ne: true } }).toArray();
      for (const g of gone) if (!seen.has(g.icalUid)) {
        if (g.status === "blocked") await c.replaceOne({ _id: g._id }, { _id: g._id, acct: acctId, kind: "booking", deleted: true, updatedAt: now });
        else { await c.updateOne({ _id: g._id }, { $set: { status: "cancelled", updatedAt: now, notes: `${g.notes ? g.notes + "\n" : ""}Cancelled on ${f.source} (no longer in its calendar).` } }); cancelled++; }
      }
    }
  }
  if (newStays || cancelled) {
    await notify(payload, acctId, {
      to: "bookings", link: "bookings",
      title: [newStays && `${newStays} new booking${newStays === 1 ? "" : "s"} synced`, cancelled && `${cancelled} cancelled on the platform`].filter(Boolean).join(", "),
      text: "From your Airbnb / Booking.com calendars. Send check-in links to new guests.",
    });
  }
  return { listings: listings.length, added, updated, cancelled, errors };
}

export async function syncNow(payload: Payload, ctx: Ctx) {
  if (!ctx.has("ical")) throw new HostBookError("Calendar sync isn't on your plan", 402, { reason: "feature", feature: "ical" });
  if (!ctx.can("bookings")) throw new HostBookError("You don't have access to bookings", 403);
  return syncAccount(payload, ctx.acct, ctx.access);
}

/* ---------- payments ---------- */

export async function quote(payload: Payload, ctx: Ctx, planRaw: unknown, extraRaw: unknown, coupon: unknown) {
  if (ctx.role !== "owner") throw new HostBookError("Only the account owner can change the plan", 403);
  const [plans, s] = await Promise.all([getPlans(payload), getSettings(payload)]);
  const target = plans.find((p) => (p.id === planRaw || p.planId === planRaw) && !p.isFree && p.active);
  if (!target) throw new HostBookError("Pick a plan");
  const current = plans.find((p) => p.id === relId(ctx.acct.plan)) ?? null;
  if (current && !current.isFree && ctx.acct.expiresAt && Date.parse(ctx.acct.expiresAt) > Date.now() && target.price < current.price) {
    throw new HostBookError(`You're on ${current.name} until ${String(ctx.acct.expiresAt).slice(0, 10)}. You can move to a smaller plan when it ends.`);
  }
  const q = planQuote({ current, expiresAt: ctx.acct.expiresAt ?? null, extraNow: ctx.acct.extraListings ?? 0, target, extra: Number(extraRaw) || 0, extraPrice: s.extraListingPrice });
  let total = Math.max(1, q.amount), discount = 0, code = "", label = "";
  if (typeof coupon === "string" && coupon.trim()) {
    const r = await quoteWithCode(payload, coupon, { kind: "hostbook", id: target.id, name: target.name }, q.amount, target.price + q.extra * s.extraListingPrice);
    if (r.error) throw new HostBookError(r.error);
    total = r.total; discount = r.discount; code = r.affiliate?.code ?? coupon.trim().toUpperCase(); label = r.label;
  }
  return { plan: target, ...q, total, discount, code, label };
}

export async function checkout(payload: Payload, ctx: Ctx, b: Doc) {
  const q = await quote(payload, ctx, b.plan, b.extra, b.coupon);
  const order = await getPaymentProvider().createOrder({
    amount: q.total, currency: "INR", customer: { name: ctx.acct.business || ctx.email, email: ctx.email, phone: ctx.acct.phone || "", city: ctx.acct.city || "" } as never,
    description: `Pandora HostBook – ${q.plan.name} (1 year)`,
  });
  await payload.update({ collection: AC as never, id: ctx.acct.id, data: { orderId: order.orderId, order: { plan: q.plan.id, extra: q.extra, kind: q.kind, amount: q.total, coupon: q.code, expiresAt: q.expiresAt, at: new Date().toISOString() } } as never, overrideAccess: true });
  return { orderId: order.orderId, provider: order.provider, clientData: order.clientData ?? null, total: q.total };
}

export async function verifyCheckout(payload: Payload, ctx: Ctx, b: Doc) {
  const orderId = String(ctx.acct.orderId ?? "");
  if (!orderId) throw new HostBookError("No payment to confirm");
  const result = await getPaymentProvider().verify({ orderId, payload: b });
  if (!result.ok) throw new HostBookError("Payment could not be verified");
  await markHostbookPaid(payload, orderId, result.paymentId);
  return { ok: true };
}

export async function markHostbookPaid(payload: Payload, orderId: string, paymentId?: string) {
  const a = await findAccount(payload, { orderId: { equals: orderId } });
  if (!a) return { found: false as const };
  if (a.lastPaidOrder === orderId) return { found: true as const, alreadyPaid: true };
  const o = (a.order ?? {}) as Doc;
  const plans = await getPlans(payload);
  const plan = plans.find((p) => p.id === String(o.plan));
  if (!plan) { console.error("[hostbook] paid order with unknown plan", orderId); return { found: true as const, alreadyPaid: false }; }
  await payload.update({
    collection: AC as never, id: a.id, depth: 0, overrideAccess: true,
    data: { plan: plan.id, expiresAt: o.expiresAt, extraListings: Math.max(0, Number(o.extra) || 0), lastPaidOrder: orderId, reminderSentAt: null, ...(paymentId ? { paymentId } : {}) } as never,
  });
  await notify(payload, String(a.id), { to: "owner", link: "plan", title: `${plan.name} is active`, text: `Runs until ${String(o.expiresAt).slice(0, 10)}. Thank you!` });
  await send(a.ownerEmail, `HostBook ${plan.name} is active`, `<h2 style="margin:0 0 8px">Thank you! ${esc(plan.name)} is on</h2><p>Your HostBook plan runs until <b>${esc(String(o.expiresAt).slice(0, 10))}</b>. ${o.extra ? `It includes ${Number(o.extra)} extra listing${Number(o.extra) === 1 ? "" : "s"}.` : ""}</p><p>${button(`${siteUrl()}/hostbook/app`, "Open HostBook")}</p>`, `Your HostBook ${plan.name} plan is active until ${String(o.expiresAt).slice(0, 10)}.`);
  return { found: true as const, alreadyPaid: false };
}

/* ---------- Pandora Stays hosts ---------- */

/** Links a signed-in Stays host to a HostBook account for the same email, so they get the Stays plan free. */
export async function linkStaysHost(payload: Payload, host: { _id: string; email?: string; name?: string; phone?: string }) {
  const email = normEmail(host.email);
  if (!validEmail(email)) throw new HostBookError("Your Stays host profile has no email address. Add one first.");
  const a = await ownAccount(payload, email, true, { business: host.name ?? "", phone: host.phone ?? "", staysHostId: String(host._id), source: "stays" });
  if (a && a.staysHostId !== String(host._id)) await payload.update({ collection: AC as never, id: a.id, data: { staysHostId: String(host._id) } as never, overrideAccess: true });
  return { email, token: tokenFor(email) };
}

/* ---------- daily jobs ---------- */

async function allAccounts(payload: Payload) {
  const out: Doc[] = [];
  for (let page = 1; page < 200; page++) {
    const r = await payload.find({ collection: AC as never, limit: 200, page, depth: 0, overrideAccess: true });
    out.push(...(r.docs as Doc[]));
    if (!r.hasNextPage) break;
  }
  return out;
}

/**
 * Called by Hostinger cron (Bearer CRON_SECRET), every few hours:
 * calendar sync; and once a day: delete expired ID photos, add repeating expenses, cleaning checklists, task emails, plan reminders.
 */
export async function runCron(payload: Payload, opts: { daily?: boolean } = {}) {
  const c = await items(payload);
  const today = istDay();
  const out = { accounts: 0, synced: 0, idsDeleted: 0, expenses: 0, checklists: 0, digests: 0, notices: 0, reminders: 0, errors: [] as string[] };

  // ID photos past their keep date: deleted from Cloudinary; the guest's written details stay.
  const expired: Doc[] = await c.find({ kind: "guest", "idPhotos.deleteAt": { $lt: Date.now() } }).limit(2000).toArray();
  for (const g of expired) {
    const keep = (g.idPhotos ?? []).filter((p: Doc) => !(p.deleteAt < Date.now()));
    for (const p of (g.idPhotos ?? []).filter((x: Doc) => x.deleteAt < Date.now())) { await destroyFile(p.publicId); out.idsDeleted++; }
    await c.updateOne({ _id: g._id }, { $set: { idPhotos: keep, idsDeletedAt: Date.now(), updatedAt: Date.now() } });
  }

  // Notifications older than 60 days are cleared.
  await c.deleteMany({ kind: "notice", createdAt: { $lt: Date.now() - 60 * 864e5 } });

  const s = await getSettings(payload);
  for (const acct of await allAccounts(payload)) {
    out.accounts++;
    try {
      const a = await accessOf(payload, acct);
      const r = await syncAccount(payload, acct, a);
      out.synced += r.added + r.updated + r.cancelled;
      out.errors.push(...r.errors.slice(0, 3).map((e) => `${acct.ownerEmail}: ${e}`));
      const meta: Doc | null = await c.findOne({ _id: `meta:${acct.id}` });
      if (!opts.daily && meta?.lastDaily === today) continue;
      await c.updateOne({ _id: `meta:${acct.id}` }, { $set: { acct: String(acct.id), kind: "meta", lastDaily: today } }, { upsert: true });
      const id = String(acct.id);
      const now = Date.now();

      if (a.features.includes("recurring")) {
        const month = monthOf(today), day = Number(today.slice(8));
        const reps: Doc[] = await c.find({ acct: id, kind: "recurring", deleted: { $ne: true }, active: { $ne: false } }).toArray();
        for (const r of reps) {
          if (r.lastMonth === month || day < Math.min(28, Math.max(1, r.day || 1))) continue;
          await c.insertOne({ _id: rid(), acct: id, kind: "expense", date: today, listingId: r.listingId ?? "", category: r.category || "Other", amount: Number(r.amount) || 0, note: r.note || "Repeating expense", recurringId: r._id, method: "", createdAt: now, updatedAt: now, by: "auto" });
          await c.updateOne({ _id: r._id }, { $set: { lastMonth: month, updatedAt: now } });
          out.expenses++;
        }
      }
      if (a.features.includes("cleaning")) {
        const outs: Doc[] = await c.find({ acct: id, kind: "booking", end: today, status: { $nin: ["cancelled", "blocked"] }, deleted: { $ne: true } }).toArray();
        for (const b of outs) {
          if (await c.findOne({ acct: id, kind: "clean", bookingId: b._id })) continue;
          const l: Doc | null = await c.findOne({ _id: b.listingId, acct: id });
          const list = (l?.checklist?.length ? l.checklist : ["Change bed sheets & towels", "Clean bathroom", "Sweep & mop floors", "Empty bins", "Restock toiletries", "Check for damage or lost items"]) as string[];
          await c.insertOne({ _id: rid(), acct: id, kind: "clean", bookingId: b._id, listingId: b.listingId, date: today, items: list.map((text) => ({ text, done: false })), createdAt: now, updatedAt: now, by: "auto" });
          out.checklists++;
        }
      }
      {
        // The day's summary goes into the app (and to phones that allow notifications). Email only if the owner turned it on.
        const tasks: Doc[] = a.features.includes("tasks") ? await c.find({ acct: id, kind: "task", active: { $ne: false }, deleted: { $ne: true }, due: { $lte: today } }).toArray() : [];
        const ins: Doc[] = await c.find({ acct: id, kind: "booking", start: today, status: { $nin: ["cancelled", "blocked"] }, deleted: { $ne: true } }).toArray();
        const outsToday: Doc[] = await c.find({ acct: id, kind: "booking", end: today, status: { $nin: ["cancelled", "blocked"] }, deleted: { $ne: true } }).toArray();
        const low: Doc[] = a.features.includes("inventory") ? (await c.find({ acct: id, kind: "inventory", deleted: { $ne: true } }).toArray()).filter((x: Doc) => (Number(x.qty) || 0) <= (Number(x.min) || 0) && (Number(x.min) || 0) > 0) : [];
        const lmap = new Map((await c.find({ acct: id, kind: "listing" }).toArray()).map((l: Doc) => [l._id, l.name]));
        const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
        if (ins.length || outsToday.length) {
          await notify(payload, id, {
            to: "bookings", key: "today", link: "today",
            title: `Today: ${[ins.length && plural(ins.length, "check-in"), outsToday.length && plural(outsToday.length, "check-out")].filter(Boolean).join(", ")}`,
            text: [...ins.map((b) => `In: ${b.guestName || "Guest"} (${lmap.get(b.listingId) ?? ""})`), ...outsToday.map((b) => `Out: ${b.guestName || "Guest"} (${lmap.get(b.listingId) ?? ""})`)].join(" · "),
          });
          out.notices++;
        }
        if (tasks.length || low.length) {
          await notify(payload, id, {
            to: "tasks", key: "tasks-today", link: "tasks",
            title: [tasks.length && `${plural(tasks.length, "task")} due`, low.length && `${low.length} item${low.length === 1 ? "" : "s"} running low`].filter(Boolean).join(", "),
            text: [...tasks.slice(0, 6).map((x) => `${x.title}${x.due < today ? " (overdue)" : ""}`), ...low.slice(0, 4).map((x) => `Low: ${x.name}`)].join(" · "),
          });
          out.notices++;
        }
        if (acct.digestOn === true && (tasks.length || ins.length || outsToday.length || low.length)) {
          const i = ins, o = outsToday, t = tasks, lo = low;
          const li = (x: string) => `<li style="margin:4px 0">${x}</li>`;
          const html = `<h2 style="margin:0 0 8px">Today at your stays</h2>` +
            (i.length ? `<p><b>Check-ins</b></p><ul>${i.map((b) => li(`${esc(lmap.get(b.listingId) ?? "")}: ${esc(b.guestName || "Guest")}`)).join("")}</ul>` : "") +
            (o.length ? `<p><b>Check-outs</b></p><ul>${o.map((b) => li(`${esc(lmap.get(b.listingId) ?? "")}: ${esc(b.guestName || "Guest")}`)).join("")}</ul>` : "") +
            (t.length ? `<p><b>Tasks due</b></p><ul>${t.map((x) => li(`${esc(x.title)}${x.listingId ? ` · ${esc(lmap.get(x.listingId) ?? "")}` : ""}${x.due < today ? ` <span style="color:#c0392b">(overdue since ${esc(x.due)})</span>` : ""}`)).join("")}</ul>` : "") +
            (lo.length ? `<p><b>Running low</b></p><ul>${lo.map((x) => li(`${esc(x.name)}: ${Number(x.qty) || 0} left${x.listingId ? ` · ${esc(lmap.get(x.listingId) ?? "")}` : ""}`)).join("")}</ul>` : "") +
            `<p>${button(`${siteUrl()}/hostbook/app#today`, "Open HostBook")}</p><p style="font-size:12px;color:#888">You can turn this email off in HostBook → Settings.</p>`;
          await send(acct.ownerEmail, `Today: ${[i.length && plural(i.length, "check-in"), o.length && plural(o.length, "check-out"), t.length && plural(t.length, "task")].filter(Boolean).join(", ") || "stock running low"}`, html, `Today at your stays: ${i.length} check-ins, ${o.length} check-outs, ${t.length} tasks. ${siteUrl()}/hostbook/app`);
          out.digests++;
        }
      }
      if (a.paidPlan && a.expiresAt && !acct.reminderSentAt) {
        const left = Math.ceil((Date.parse(a.expiresAt) - now) / 864e5);
        if (left > 0 && left <= s.reminderDays) {
          await notify(payload, id, { to: "owner", link: "plan", title: `Your ${a.paidPlan.name} plan ends in ${left} day${left === 1 ? "" : "s"}`, text: "Renew to keep the paid features. Nothing is deleted if it ends." });
          await send(acct.ownerEmail, `Your HostBook ${a.paidPlan.name} plan ends in ${left} day${left === 1 ? "" : "s"}`, `<h2 style="margin:0 0 8px">Renew to keep everything unlocked</h2><p>Your ${esc(a.paidPlan.name)} plan ends on <b>${esc(a.expiresAt.slice(0, 10))}</b>. Your data stays safe either way; only the paid features lock.</p><p>${button(`${siteUrl()}/hostbook/app#plan`, "Renew for a year")}</p>`, `Your HostBook ${a.paidPlan.name} plan ends on ${a.expiresAt.slice(0, 10)}. Renew at ${siteUrl()}/hostbook/app`);
          await payload.update({ collection: AC as never, id: acct.id, data: { reminderSentAt: new Date().toISOString() } as never, overrideAccess: true });
          out.reminders++;
        }
      }
    } catch (e) { out.errors.push(`${acct.ownerEmail}: ${(e as Error).message}`); }
  }
  return out;
}

/* ---------- booking website (/h/<name>) ---------- */

async function cloudName(): Promise<string | undefined> {
  try { return (await cloud()).config().cloud_name || undefined; } catch { return undefined; }
}

/** The owner turns the website on or off and edits its address and details (HostBook → Website). */
export async function saveSite(payload: Payload, ctx: Ctx, b: Doc) {
  if (ctx.role !== "owner") throw new HostBookError("Only the owner can change the website", 403);
  const s = cleanSlug(b.slug);
  if ("error" in s) throw new HostBookError(s.error);
  const taken = await findAccount(payload, { and: [{ siteSlug: { equals: s.slug } }, { id: { not_equals: ctx.acct.id } }] });
  if (taken) throw new HostBookError(`pandoratemplates.com/h/${s.slug} is already taken. Try another name.`, 409);
  const site = cleanSite((b.site as Doc) ?? {}, await cloudName());
  if (site.on && !site.whatsapp) throw new HostBookError("Add the WhatsApp number guests should message");
  const updated = (await payload.update({ collection: AC as never, id: ctx.acct.id, data: { siteSlug: s.slug, site } as never, overrideAccess: true })) as Doc;
  return { ok: true, account: accountView({ ...ctx, acct: updated }) };
}

/** A signed upload for a website photo: public (guests see it), images only, in the host's own folder. */
export async function signSitePhoto(payload: Payload, ctx: Ctx) {
  if (ctx.role !== "owner") throw new HostBookError("Only the owner can change the website", 403);
  const { c, cfg } = await cloudCfg();
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { allowed_formats: "jpg,jpeg,png,webp,heic", public_id: `hostbook-site/${acctFolder(String(ctx.acct.id))}/${rid(12)}`, timestamp };
  return { url: `https://api.cloudinary.com/v1_1/${cfg.cloud_name}/image/upload`, fields: { ...params, api_key: cfg.api_key, signature: c.utils.api_sign_request(params, cfg.api_secret!) } };
}

export type PublicSite = {
  slug: string;
  site: SiteSettings;
  business: string;
  city: string;
  logoUrl: string;
  /** Business-plan hosts can hide the "Made with HostBook" line. */
  branded: boolean;
  listings: (PublicListing & { busy: string[] })[];
};

const todayIST = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

/** Everything the public site shows, or null when the address is unknown or the site is switched off. */
export async function getPublicSite(payload: Payload, slugRaw: string): Promise<PublicSite | null> {
  const s = cleanSlug(slugRaw);
  if ("error" in s) return null;
  const acct = await findAccount(payload, { siteSlug: { equals: s.slug } });
  const site = { ...EMPTY_SITE, ...((acct?.site as Doc) ?? {}) } as SiteSettings;
  if (!acct || !site.on || !site.whatsapp) return null;
  const c = await items(payload);
  const id = String(acct.id);
  const today = todayIST();
  const [listings, bookings, access, cn] = await Promise.all([
    c.find({ acct: id, kind: "listing", deleted: { $ne: true } }).toArray() as Promise<Doc[]>,
    c.find({ acct: id, kind: "booking", deleted: { $ne: true }, end: { $gt: today } }, { projection: { listingId: 1, start: 1, end: 1, status: 1 } }).toArray() as Promise<Doc[]>,
    accessOf(payload, acct),
    cloudName(),
  ]);
  const branded = access.plan.features.includes("branding");
  return {
    slug: s.slug,
    site,
    business: String(acct.business ?? ""),
    city: String(acct.city ?? ""),
    logoUrl: branded && typeof acct.logoUrl === "string" && /^https:\/\//.test(acct.logoUrl) ? acct.logoUrl : "",
    branded,
    listings: listings.filter(showsOnSite).map((l) => ({ ...publicListing(l, cn), busy: busyNights(bookings, String(l._id), today, 180) })),
  };
}

/** A guest tapped "Send enquiry": tell the host in HostBook too (the message itself goes by WhatsApp). */
export async function siteEnquiry(payload: Payload, b: Doc) {
  const site = await getPublicSite(payload, String(b.slug ?? ""));
  if (!site) throw new HostBookError("This website is not available", 404);
  const l = site.listings.find((x) => x.id === String(b.listingId ?? ""));
  if (!l) throw new HostBookError("This place is not on the website", 404);
  const start = String(b.start ?? ""), end = String(b.end ?? "");
  const dated = /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && end > start;
  const name = String(b.name ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  const guests = Math.max(0, Math.min(50, Math.round(Number(b.guests) || 0)));
  const acct = await findAccount(payload, { siteSlug: { equals: site.slug } });
  if (!acct) throw new HostBookError("This website is not available", 404);
  await notify(payload, String(acct.id), {
    to: "owner",
    link: "bookings",
    title: `Website enquiry: ${l.name}`,
    text: [name || "A guest", dated ? `${start} to ${end}${datesFree(l.busy, start, end) ? "" : " (some nights already booked)"}` : "dates not picked", guests ? `${guests} guest${guests === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ") + ". They are messaging you on WhatsApp.",
  });
  return { ok: true };
}
