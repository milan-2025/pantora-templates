import "server-only";
import { createHash, randomBytes, randomInt } from "crypto";
import type { Payload } from "payload";
import { sendWithBrevo } from "@/lib/brevo";
import { applyPromo, findAffiliate } from "@/lib/pricing";
import { codesMatch, hashCode, makeToken, readToken } from "@/lib/planner/core";
import {
  DEFAULT_MILESTONES, DEFAULT_MONEYBACK, WorkoutError, applyOps, bestStreak, countOnTime, firstName, istDate, levelOf, moneyBackProgress,
  newMilestones, normEmail, shiftDay, streakOf, validEmail, waNumber, weekStart, weekXp, xpOf, isComplete, isLogged, targetsOf,
  type Milestone, type MoneyBackTier, type Row, type WOp, type WState,
} from "./core";
import { makeVapidKeys, sendPush, validSub, type PushSub, type VapidKeys } from "./push";

export { WorkoutError };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Payload documents are read loosely here
type Doc = Record<string, any>;

const secret = () => `${process.env.PAYLOAD_SECRET || "dev-secret-change-me"}:workout`;
const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const P = "workout-profiles" as const, M = "workout-memberships" as const, PL = "workout-plans" as const, G = "workout-groups" as const;
const F = "workout-feed" as const, PH = "workout-photos" as const, CL = "workout-claims" as const, LG = "workout-logins" as const;

export const SESSION_DAYS = 120;
const CODE_MINUTES = 15;

/* ---------- settings ---------- */

export type Settings = {
  freeDays: number; groupMax: number; groupsPerPerson: number; waAfterDays: number; buddyOn: boolean;
  milestones: Milestone[]; moneyBackOn: boolean; moneyBackRule: "logged" | "completed"; moneyBackTiers: MoneyBackTier[]; moneyBackTerms: string;
  refOn: boolean; refFriendOff: number; refReward: "days" | "seat"; refAmount: number; refMax: number;
  offerText: string; whatsappNumber: string; whatsappMessage: string; promoCodes: Doc[]; vapidPublic: string; vapidPrivate: string;
};

let cache: { at: number; s: Settings } | null = null;
export const clearSettingsCache = () => { cache = null; };

export async function getSettings(payload: Payload): Promise<Settings> {
  if (cache && Date.now() - cache.at < 30_000) return cache.s;
  const g = ((await payload.findGlobal({ slug: "workout-settings", depth: 0, overrideAccess: true }).catch(() => null)) ?? {}) as Doc;
  const n = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const s: Settings = {
    freeDays: n(g.freeDays, 14), groupMax: n(g.groupMax, 10), groupsPerPerson: n(g.groupsPerPerson, 5), waAfterDays: n(g.waAfterDays, 7),
    buddyOn: g.buddyOn !== false,
    milestones: (Array.isArray(g.milestones) && g.milestones.length ? g.milestones : DEFAULT_MILESTONES).map((m: Doc) => ({
      key: String(m.key), title: String(m.title ?? ""), kind: m.kind === "total" ? "total" : "streak", days: n(m.days, 7), reward: m.reward ?? "badge",
      amount: n(m.amount, 0), code: m.code ?? "", note: m.note ?? "", active: m.active !== false,
    })),
    moneyBackOn: g.moneyBackOn !== false, moneyBackRule: g.moneyBackRule === "completed" ? "completed" : "logged",
    moneyBackTiers: (Array.isArray(g.moneyBackTiers) && g.moneyBackTiers.length ? g.moneyBackTiers : DEFAULT_MONEYBACK).map((t: Doc) => ({ days: n(t.days, 365), percent: n(t.percent, 0), months: n(t.months, 0) })),
    moneyBackTerms: g.moneyBackTerms ?? "",
    refOn: g.refOn !== false, refFriendOff: n(g.refFriendOff, 100), refReward: g.refReward === "seat" ? "seat" : "days", refAmount: n(g.refAmount, 30), refMax: n(g.refMax, 12),
    offerText: g.offerText ?? "", whatsappNumber: g.whatsappNumber ?? "", whatsappMessage: g.whatsappMessage ?? "", promoCodes: g.promoCodes ?? [],
    vapidPublic: g.vapidPublic ?? "", vapidPrivate: g.vapidPrivate ?? "",
  };
  cache = { at: Date.now(), s };
  return s;
}

/** Push keys are made once and kept in the settings, so nothing has to be set up by hand. */
export async function vapidKeys(payload: Payload): Promise<VapidKeys> {
  const s = await getSettings(payload);
  if (s.vapidPublic && s.vapidPrivate) return { publicKey: s.vapidPublic, privateJwk: s.vapidPrivate };
  const k = makeVapidKeys();
  await payload.updateGlobal({ slug: "workout-settings", data: { vapidPublic: k.publicKey, vapidPrivate: k.privateJwk } as never, overrideAccess: true });
  clearSettingsCache();
  return k;
}

/* ---------- plans ---------- */

export type PlanView = { id: string; planId: string; name: string; price: number; durationDays: number; seats: number; photosPerWeek: number; isFree: boolean; active: boolean; tagline: string; badge: string; features: string[] };

export const DEFAULT_WORKOUT_PLANS = [
  { name: "Free challenge", planId: "free", isFree: true, active: false, price: 0, durationDays: 14, seats: 0, photosPerWeek: 1, sortOrder: 0, tagline: "One 14-day challenge, free", badge: "", features: [{ text: "Any of the 6 challenges" }, { text: "Workout player, streaks and gifts" }, { text: "Join friends' groups" }] },
  {
    name: "Basic", planId: "basic", isFree: false, active: true, price: 999, durationDays: 365, seats: 3, photosPerWeek: 1, sortOrder: 10, tagline: "A whole year, for you + 3", badge: "",
    features: [{ text: "Unlimited challenges, 14 to 100 days" }, { text: "Add 3 friends or family free" }, { text: "Groups and a random accountability buddy" }, { text: "1 progress photo a week" }, { text: "Money-back promise" }],
  },
  {
    name: "Pro", planId: "pro", isFree: false, active: true, price: 1999, durationDays: 365, seats: 7, photosPerWeek: 5, sortOrder: 20, tagline: "For the whole family or gym gang", badge: "Best value",
    features: [{ text: "Everything in Basic" }, { text: "Add 7 friends or family free" }, { text: "5 progress photos a week" }, { text: "Money-back promise" }],
  },
];

const toPlan = (d: Doc): PlanView => ({
  id: String(d.id), planId: d.planId, name: d.name, price: Math.max(0, Math.round(d.price ?? 0)), durationDays: d.durationDays ?? 365, seats: d.seats ?? 0,
  photosPerWeek: d.photosPerWeek ?? 1, isFree: Boolean(d.isFree), active: d.active !== false, tagline: d.tagline ?? "", badge: d.badge ?? "",
  features: (d.features ?? []).map((f: Doc) => f.text).filter(Boolean),
});

export async function getPlans(payload: Payload): Promise<PlanView[]> {
  const find = () => payload.find({ collection: PL, limit: 50, depth: 0, sort: "sortOrder", overrideAccess: true });
  let res = await find();
  if (res.totalDocs === 0) {
    for (const p of DEFAULT_WORKOUT_PLANS) await payload.create({ collection: PL, data: p as never, overrideAccess: true }).catch(() => null);
    res = await find();
  }
  return res.docs.map((d) => toPlan(d as Doc));
}
const relId = (v: unknown) => (v && typeof v === "object" ? String((v as Doc).id ?? "") : v ? String(v) : "");
async function planById(payload: Payload, id: unknown) {
  const plans = await getPlans(payload);
  return plans.find((p) => p.id === relId(id) || p.planId === id) ?? null;
}
const freePlanOf = (plans: PlanView[]) => plans.find((p) => p.isFree) ?? { ...toPlan({ ...DEFAULT_WORKOUT_PLANS[0], id: "free" }) };

/* ---------- sign-in ---------- */

const shell = (body: string) =>
  `<!doctype html><html><body style="margin:0;background:#0F1420;font-family:Arial,Helvetica,sans-serif;color:#1d2433"><div style="max-width:520px;margin:0 auto;padding:32px 20px"><div style="background:#fff;border-radius:24px;padding:28px">${body}</div><p style="text-align:center;font-size:12px;color:#8892a6">Pandora Workout · Show up. Watch it add up.</p></div></body></html>`;
const button = (href: string, text: string) => `<a href="${href}" style="display:inline-block;padding:12px 22px;background:#FF5A36;color:#fff;border-radius:999px;text-decoration:none;font-weight:700">${text}</a>`;

export async function startLogin(payload: Payload, raw: unknown) {
  const email = normEmail(raw);
  if (!validEmail(email)) throw new WorkoutError("Please enter a valid email");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await payload.delete({ collection: LG, where: { email: { equals: email } }, overrideAccess: true }).catch(() => null);
  await payload.create({ collection: LG, data: { email, codeHash: hashCode(secret(), email, code), expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000).toISOString(), attempts: 0 } as never, overrideAccess: true });
  await sendWithBrevo({
    to: [{ email }],
    subject: `${code} is your Pandora Workout code`,
    html: shell(`<h2 style="margin:0 0 8px">Your sign-in code</h2><p>Type this code in the app:</p><p style="font-size:34px;letter-spacing:8px;font-weight:700;color:#FF5A36;margin:14px 0">${code}</p><p style="font-size:13px;color:#666">It works for ${CODE_MINUTES} minutes.</p>`),
    text: `Your Pandora Workout code is ${code}. It works for ${CODE_MINUTES} minutes.`,
  });
  return { email, devCode: process.env.BREVO_API_KEY || process.env.NODE_ENV === "production" ? undefined : code };
}

export async function verifyLogin(payload: Payload, raw: unknown, rawCode: unknown) {
  const email = normEmail(raw);
  const code = String(rawCode ?? "").replace(/\D/g, "");
  const row = (await payload.find({ collection: LG, where: { email: { equals: email } }, limit: 1, sort: "-createdAt", depth: 0, overrideAccess: true })).docs[0] as Doc | undefined;
  if (!row || new Date(row.expiresAt).getTime() < Date.now()) throw new WorkoutError("That code has expired. Ask for a new one.", 401);
  if ((row.attempts ?? 0) >= 5) throw new WorkoutError("Too many wrong tries. Ask for a new code.", 429);
  if (code.length !== 6 || !codesMatch(row.codeHash, hashCode(secret(), email, code))) {
    await payload.update({ collection: LG, id: row.id, data: { attempts: (row.attempts ?? 0) + 1 } as never, overrideAccess: true });
    throw new WorkoutError("That code isn't right. Check the latest email, or ask for a new code.", 401);
  }
  await payload.delete({ collection: LG, where: { email: { equals: email } }, overrideAccess: true });
  return { email, token: makeToken(secret(), email, SESSION_DAYS * 864e5) };
}

export function emailOf(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  const s = readToken(secret(), h.startsWith("Bearer ") ? h.slice(7) : null);
  return s && validEmail(s) ? s : null;
}
export const tokenFor = (email: string) => makeToken(secret(), email, SESSION_DAYS * 864e5);

/* ---------- people ---------- */

const REF_ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newRefCode = () => Array.from({ length: 6 }, () => REF_ALPHA[randomInt(0, REF_ALPHA.length)]).join("");

export async function findProfile(payload: Payload, email: string) {
  return ((await payload.find({ collection: P, where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as Doc | undefined) ?? null;
}

export async function getOrCreateProfile(payload: Payload, email: string, extra: { ref?: unknown; source?: unknown } = {}) {
  const found = await findProfile(payload, email);
  if (found) return found;
  const ref = typeof extra.ref === "string" ? extra.ref.trim().toUpperCase().slice(0, 12) : "";
  for (let i = 0; i < 5; i++) {
    try {
      return (await payload.create({
        collection: P,
        data: { email, refCode: newRefCode(), referredBy: ref, source: typeof extra.source === "string" ? extra.source.slice(0, 120) : "", state: {}, rev: 0, logged: [], completed: [], buddyStatus: "none", lastActivityAt: new Date().toISOString() } as never,
        overrideAccess: true,
      })) as Doc;
    } catch (e) {
      const again = await findProfile(payload, email); // created by a parallel request
      if (again) return again;
      if (i === 4) throw e;
    }
  }
  throw new WorkoutError("Could not create your account");
}

/* ---------- access ---------- */

export type Access = {
  kind: "owner" | "member" | "free"; status: "active" | "expired" | "suspended" | "new"; isPaid: boolean; canLog: boolean;
  plan: PlanView; expiresAt: string | null; daysLeft: number | null; photosPerWeek: number; seats: number; membership: Doc | null; ownerEmail: string;
};

const isLive = (m: Doc | null | undefined, now = Date.now()) => Boolean(m && m.status !== "suspended" && m.expiresAt && new Date(m.expiresAt).getTime() > now);
const left = (iso: string | null, now = Date.now()) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 864e5)) : null);

export async function ownedMembership(payload: Payload, email: string) {
  return ((await payload.find({ collection: M, where: { ownerEmail: { equals: email } }, sort: "-expiresAt", limit: 1, depth: 0, overrideAccess: true })).docs[0] as Doc | undefined) ?? null;
}
async function sharedMembership(payload: Payload, email: string) {
  const res = await payload.find({ collection: M, where: { "members.email": { equals: email } }, sort: "-expiresAt", limit: 5, depth: 0, overrideAccess: true });
  return (res.docs as Doc[]).find((m) => isLive(m)) ?? null;
}

export async function accessOf(payload: Payload, profile: Doc, now = Date.now()): Promise<Access> {
  const email = profile.email as string;
  const plans = await getPlans(payload);
  const s = await getSettings(payload);
  const owned = await ownedMembership(payload, email);
  const shared = isLive(owned, now) ? null : await sharedMembership(payload, email);
  const photos = (m: Doc | null, plan: PlanView) => (typeof profile.photosOverride === "number" ? profile.photosOverride : typeof m?.photosOverride === "number" ? m.photosOverride : plan.photosPerWeek);
  const paid = (m: Doc, kind: "owner" | "member"): Access => {
    const plan = plans.find((p) => p.id === relId(m.plan)) ?? plans.find((p) => !p.isFree) ?? freePlanOf(plans);
    const status = m.status === "suspended" ? "suspended" : isLive(m, now) ? "active" : "expired";
    return {
      kind, status, isPaid: status === "active", canLog: status === "active", plan, expiresAt: m.expiresAt ?? null, daysLeft: left(m.expiresAt ?? null, now),
      photosPerWeek: photos(m, plan), seats: (typeof m.seatsOverride === "number" ? m.seatsOverride : plan.seats) + (m.extraSeats ?? 0), membership: m, ownerEmail: m.ownerEmail,
    };
  };
  if (owned && isLive(owned, now)) return paid(owned, "owner");
  if (shared) return paid(shared, "member");
  const free = freePlanOf(plans);
  const freeDays = (typeof profile.freeDaysOverride === "number" ? profile.freeDaysOverride : s.freeDays || free.durationDays) + (profile.bonusDays ?? 0);
  if (owned) {
    // Bought before, now ended: read-only until renewed.
    const a = paid(owned, "owner");
    return { ...a, canLog: false };
  }
  if (!profile.freeStart) return { kind: "free", status: "new", isPaid: false, canLog: true, plan: free, expiresAt: null, daysLeft: freeDays, photosPerWeek: photos(null, free), seats: 0, membership: null, ownerEmail: email };
  const end = new Date(new Date(profile.freeStart).getTime() + freeDays * 864e5).toISOString();
  const live = new Date(end).getTime() > now;
  return { kind: "free", status: live ? "active" : "expired", isPaid: false, canLog: live, plan: free, expiresAt: end, daysLeft: left(end, now), photosPerWeek: photos(null, free), seats: 0, membership: null, ownerEmail: email };
}

/* ---------- data & sync ---------- */

/** Ops allowed while read-only (plan ended): only personal details and app preferences. */
const READ_ONLY_OK = (op: WOp) => "k" in op && (op.k === "profile" || op.k === "prefs");

export async function saveState(payload: Payload, email: string, ops: WOp[], now = Date.now()) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const profile = await getOrCreateProfile(payload, email);
    const access = await accessOf(payload, profile, now);
    if (!access.canLog && !ops.every(READ_ONLY_OK)) {
      throw new WorkoutError(access.kind === "free" ? "Your free challenge has ended. Pick a plan to keep going." : "Your plan has ended. Renew to keep logging.", 402, { reason: "expired" });
    }
    const before = (profile.state ?? {}) as WState;
    const after = applyOps(before, ops);
    const on = countOnTime({ logged: profile.logged ?? [], completed: profile.completed ?? [] }, after, now);
    const rev = (profile.rev ?? 0) + 1;
    const ch = (after.challenge ?? {}) as Doc;
    const prof = (after.profile ?? {}) as Doc;
    const today = istDate(now);
    const frozen = new Set((after.days ?? []).filter((r) => r.fz).map((r) => r.id));
    const data: Doc = {
      state: after, rev, logged: on.logged, completed: on.completed, lastActivityAt: new Date(now).toISOString(),
      program: typeof ch.program === "string" ? `${ch.program} · ${ch.length ?? ""} days` : profile.program ?? "",
      streak: streakOf(new Set(on.completed), frozen, today),
    };
    if (typeof prof.name === "string" && prof.name.trim()) data.name = prof.name.trim().slice(0, 60);
    if (typeof prof.phone === "string") data.phone = waNumber(prof.phone);
    if (typeof prof.reminderHour === "number" && prof.reminderHour >= 0 && prof.reminderHour <= 23) data.reminderHour = prof.reminderHour;
    else if (prof.reminderHour === null) data.reminderHour = null;
    if (access.kind === "free" && !profile.freeStart && (ch.program || (after.days ?? []).some((r) => isLogged(r)))) data.freeStart = new Date(now).toISOString();
    const lock = profile.rev == null ? { rev: { exists: false } } : { rev: { equals: profile.rev } };
    const res = await payload.update({ collection: P, where: { and: [{ id: { equals: profile.id } }, lock] }, data: data as never, depth: 0, overrideAccess: true });
    if (!res.docs.length) continue;
    const gifts = await grantMilestones(payload, { ...profile, ...data }, access, now);
    return { rev, gifts };
  }
  throw new WorkoutError("Lots of changes at once. Please try again.", 409);
}

/** Gives any milestone gifts just reached. Safe to call again: each gift is given once (by key). */
export async function grantMilestones(payload: Payload, profile: Doc, access: Access, now = Date.now()) {
  const s = await getSettings(payload);
  const given = ((profile.rewards ?? []) as Doc[]).map((r) => r.key);
  const fresh = newMilestones(profile.completed ?? [], given, s.milestones, istDate(now));
  if (!fresh.length) return [];
  const rewards = [...((profile.rewards ?? []) as Doc[]).map(({ id: _id, ...r }) => r)];
  const upd: Doc = {};
  let addDays = 0, addSeats = 0;
  for (const m of fresh) {
    rewards.push({ key: m.key, title: m.title, note: m.note ?? "", reward: m.reward, amount: m.amount ?? 0, code: m.reward === "coupon" ? m.code ?? "" : "", at: new Date(now).toISOString() });
    if (m.reward === "freeze") upd.bonusFreezes = (upd.bonusFreezes ?? profile.bonusFreezes ?? 0) + (m.amount || 1);
    if (m.reward === "days") addDays += m.amount ?? 0;
    if (m.reward === "seat") addSeats += m.amount || 1;
  }
  upd.rewards = rewards;
  if (addDays && access.kind === "owner" && access.membership) await extendMembership(payload, access.membership, addDays);
  else if (addDays) upd.bonusDays = (profile.bonusDays ?? 0) + addDays;
  if (addSeats && access.kind === "owner" && access.membership) {
    await payload.update({ collection: M, id: access.membership.id, data: { extraSeats: (access.membership.extraSeats ?? 0) + addSeats } as never, overrideAccess: true });
  } else if (addSeats) upd.bonusSeats = (profile.bonusSeats ?? 0) + addSeats;
  await payload.update({ collection: P, id: profile.id, data: upd as never, overrideAccess: true });
  return fresh.map((m) => ({ key: m.key, title: m.title, note: m.note, reward: m.reward, amount: m.amount, code: m.reward === "coupon" ? m.code : "" }));
}

async function extendMembership(payload: Payload, m: Doc, days: number) {
  const from = Math.max(Date.now(), m.expiresAt ? new Date(m.expiresAt).getTime() : 0);
  const expiresAt = new Date(from + days * 864e5).toISOString();
  await payload.update({ collection: M, id: m.id, data: { expiresAt } as never, overrideAccess: true });
  return expiresAt;
}

/* ---------- what the app needs on open ---------- */

export async function me(payload: Payload, email: string, now = Date.now()) {
  const profile = await getOrCreateProfile(payload, email);
  const [access, s, plans] = await Promise.all([accessOf(payload, profile, now), getSettings(payload), getPlans(payload)]);
  const today = istDate(now);
  const completed = new Set<string>(profile.completed ?? []);
  const m = access.membership;
  const termStart = m?.termStart ? istDate(new Date(m.termStart)) : m?.paidAt ? istDate(new Date(m.paidAt)) : null;
  const termEnd = termStart ? shiftDay(termStart, 364) : null;
  const counting = s.moneyBackRule === "completed" ? profile.completed ?? [] : profile.logged ?? [];
  const mb = access.kind === "owner" && termStart && termEnd ? moneyBackProgress(counting, termStart, termEnd, s.moneyBackTiers) : null;
  const claim = access.kind === "owner" && m ? ((await payload.find({ collection: CL, where: { membership: { equals: m.id } }, sort: "-createdAt", limit: 1, depth: 0, overrideAccess: true })).docs[0] as Doc | undefined) : undefined;
  const groups = await myGroups(payload, email);
  const buddy = profile.buddyStatus === "matched" && profile.buddyEmail ? await findProfile(payload, profile.buddyEmail) : null;
  return {
    email, name: profile.name ?? "", phone: profile.phone ?? "", rev: profile.rev ?? 0,
    access: {
      kind: access.kind, status: access.status, isPaid: access.isPaid, canLog: access.canLog, plan: { id: access.plan.id, planId: access.plan.planId, name: access.plan.name, price: access.plan.price },
      expiresAt: access.expiresAt, daysLeft: access.daysLeft, photosPerWeek: access.photosPerWeek, seats: access.seats, ownerEmail: access.ownerEmail,
      members: access.kind === "owner" && m ? (m.members ?? []).map((x: Doc) => ({ email: x.email, name: x.name ?? "", addedAt: x.addedAt ?? null })) : [],
    },
    plans: plans.filter((p) => !p.isFree && p.active),
    onTime: { completed: completed.size, logged: (profile.logged ?? []).length, streak: streakOf(completed, new Set(), today), best: bestStreak(completed, new Set()) },
    gifts: ((profile.rewards ?? []) as Doc[]).map((r) => ({ key: r.key, title: r.title, note: r.note, reward: r.reward, amount: r.amount, code: r.code, at: r.at })),
    milestones: s.milestones.filter((x) => x.active !== false).map((x) => ({ key: x.key, title: x.title, kind: x.kind, days: x.days, reward: x.reward, amount: x.amount, note: x.note })),
    bonus: { freezes: profile.bonusFreezes ?? 0, days: profile.bonusDays ?? 0, seats: profile.bonusSeats ?? 0 },
    moneyBack: s.moneyBackOn ? {
      tiers: s.moneyBackTiers, rule: s.moneyBackRule, terms: s.moneyBackTerms, eligible: access.kind === "owner" && Boolean(m?.paidAt),
      termStart, termEnd, counted: mb?.counted ?? 0, reached: mb?.reached ?? null, next: mb?.next ?? null,
      claim: claim ? { status: claim.status, choice: claim.choice, percent: claim.percent, months: claim.months, note: claim.status === "rejected" ? claim.adminNote ?? "" : "", at: claim.createdAt } : null,
    } : null,
    referral: s.refOn ? { code: profile.refCode, link: `${siteUrl()}/workout?ref=${profile.refCode}`, friendOff: s.refFriendOff, reward: s.refReward, amount: s.refAmount, count: profile.refCount ?? 0, max: s.refMax } : null,
    groups,
    buddy: {
      on: s.buddyOn, status: profile.buddyStatus ?? "none", since: profile.buddySince ?? null,
      name: buddy ? firstName(buddy.name, buddy.email) : "", streak: buddy?.streak ?? 0,
    },
    limits: { groupMax: s.groupMax, groupsPerPerson: s.groupsPerPerson, waAfterDays: s.waAfterDays, freeDays: s.freeDays },
    offerText: s.offerText, whatsapp: s.whatsappNumber ? { number: s.whatsappNumber, message: s.whatsappMessage } : null,
    vapid: s.vapidPublic || (await vapidKeys(payload)).publicKey,
    refCodeUsed: profile.referredBy ?? "",
  };
}

export async function getState(payload: Payload, email: string, since: number) {
  const profile = await getOrCreateProfile(payload, email);
  const rev = profile.rev ?? 0;
  return since === rev ? { rev } : { rev, state: profile.state ?? {} };
}

/* ---------- friends & family on a plan ---------- */

export async function addMember(payload: Payload, ownerEmail: string, rawEmail: unknown, rawName: unknown) {
  const owner = await getOrCreateProfile(payload, ownerEmail);
  const a = await accessOf(payload, owner);
  if (a.kind !== "owner" || !a.isPaid || !a.membership) throw new WorkoutError("Buy a plan to add friends and family to it", 402, { reason: "upgrade" });
  const email = normEmail(rawEmail);
  if (!validEmail(email)) throw new WorkoutError("Please enter a valid email");
  if (email === ownerEmail) throw new WorkoutError("That's your own email");
  const list = (a.membership.members ?? []) as Doc[];
  if (list.some((x) => x.email === email)) throw new WorkoutError("They're already on your plan");
  if (list.length >= a.seats) throw new WorkoutError(`Your ${a.plan.name} plan has ${a.seats} place${a.seats === 1 ? "" : "s"} for friends and family. Upgrade or earn more by referring friends.`, 402, { reason: "seats" });
  const other = await ownedMembership(payload, email);
  if (isLive(other)) throw new WorkoutError("They already have their own plan");
  const name = String(rawName ?? "").trim().slice(0, 40);
  const members = [...list.map(({ id: _id, ...x }) => x), { email, name, addedAt: new Date().toISOString() }];
  await payload.update({ collection: M, id: a.membership.id, data: { members } as never, overrideAccess: true });
  const who = firstName(owner.name, ownerEmail);
  await sendWithBrevo({
    to: [{ email }],
    subject: `${who} added you to their Pandora Workout plan 💪`,
    html: shell(`<h2 style="margin:0 0 8px">You're in${name ? `, ${esc(name)}` : ""}!</h2><p><b>${esc(who)}</b> shared their workout plan with you. Pick a challenge, follow the daily plan and keep each other going.</p><p>${button(`${siteUrl()}/workout`, "Open the app")}</p><p style="font-size:13px;color:#666">Sign in with ${esc(email)}. We'll email you a code, no password needed. It's free for you for as long as their plan runs.</p>`),
  }).catch((e) => console.error("[workout-member-email]", e));
  return members;
}

export async function removeMember(payload: Payload, ownerEmail: string, rawEmail: unknown) {
  const m = await ownedMembership(payload, ownerEmail);
  if (!m) throw new WorkoutError("No plan found", 404);
  const email = normEmail(rawEmail);
  const members = ((m.members ?? []) as Doc[]).filter((x) => x.email !== email).map(({ id: _id, ...x }) => x);
  await payload.update({ collection: M, id: m.id, data: { members } as never, overrideAccess: true });
  return members;
}

/* ---------- groups ---------- */

const GROUP_ALPHA = "abcdefghjkmnpqrstuvwxyz23456789";
const newGroupCode = () => Array.from({ length: 8 }, () => GROUP_ALPHA[randomInt(0, GROUP_ALPHA.length)]).join("");

export async function myGroups(payload: Payload, email: string) {
  const res = await payload.find({ collection: G, where: { "members.email": { equals: email } }, limit: 30, depth: 0, sort: "-createdAt", overrideAccess: true });
  return (res.docs as Doc[]).map((g) => ({ code: g.code, name: g.name, mode: g.mode, program: g.program ?? "", length: g.length ?? null, start: g.start ?? "", people: (g.members ?? []).length, owner: g.ownerEmail === email }));
}

async function groupByCode(payload: Payload, code: unknown) {
  const c = String(code ?? "").trim().toLowerCase();
  if (!/^[a-z0-9]{6,12}$/.test(c)) throw new WorkoutError("That group link isn't right", 404);
  const g = (await payload.find({ collection: G, where: { code: { equals: c } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as Doc | undefined;
  if (!g) throw new WorkoutError("That group doesn't exist any more", 404);
  return g;
}

export async function createGroup(payload: Payload, email: string, b: Doc) {
  const profile = await getOrCreateProfile(payload, email);
  const s = await getSettings(payload);
  const mine = await myGroups(payload, email);
  if (mine.length >= s.groupsPerPerson) throw new WorkoutError(`You can be in ${s.groupsPerPerson} groups at a time. Leave one to start another.`);
  const name = String(b.name ?? "").trim().slice(0, 50) || `${firstName(profile.name, email)}'s crew`;
  const mode = b.mode === "log" ? "log" : "together";
  const start = typeof b.start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.start) ? b.start : istDate();
  const length = Math.min(100, Math.max(14, Math.round(Number(b.length) || 30)));
  const program = typeof b.program === "string" ? b.program.slice(0, 30) : "";
  for (let i = 0; i < 5; i++) {
    try {
      const g = await payload.create({
        collection: G,
        data: { name, code: newGroupCode(), ownerEmail: email, mode, start, length: mode === "together" ? length : null, program: mode === "together" ? program : "", members: [{ email, name: firstName(profile.name, email), joinedAt: new Date().toISOString() }] } as never,
        overrideAccess: true,
      });
      return { code: (g as Doc).code };
    } catch (e) {
      if (i === 4) throw e;
    }
  }
  throw new WorkoutError("Could not create the group");
}

export async function groupPreview(payload: Payload, code: unknown) {
  const g = await groupByCode(payload, code);
  const owner = await findProfile(payload, g.ownerEmail);
  return { code: g.code, name: g.name, mode: g.mode, program: g.program ?? "", length: g.length ?? null, start: g.start ?? "", people: (g.members ?? []).length, by: firstName(owner?.name, g.ownerEmail) };
}

export async function joinGroup(payload: Payload, email: string, code: unknown) {
  const profile = await getOrCreateProfile(payload, email);
  const g = await groupByCode(payload, code);
  const s = await getSettings(payload);
  const list = (g.members ?? []) as Doc[];
  if (list.some((x) => x.email === email)) return { code: g.code, already: true };
  const max = typeof g.maxOverride === "number" ? g.maxOverride : s.groupMax;
  if (list.length >= max) throw new WorkoutError(`This group is full (${max} people).`);
  const mine = await myGroups(payload, email);
  if (mine.length >= s.groupsPerPerson) throw new WorkoutError(`You can be in ${s.groupsPerPerson} groups at a time. Leave one first.`);
  const members = [...list.map(({ id: _id, ...x }) => x), { email, name: firstName(profile.name, email), joinedAt: new Date().toISOString() }];
  const res = await payload.update({ collection: G, where: { and: [{ id: { equals: g.id } }, { updatedAt: { equals: g.updatedAt } }] }, data: { members } as never, overrideAccess: true });
  if (!res.docs.length) return joinGroup(payload, email, code);
  await post(payload, { kind: "event", groupCode: g.code, fromEmail: email, fromName: firstName(profile.name, email), text: "joined the group 👋" });
  return { code: g.code, already: false };
}

export async function leaveGroup(payload: Payload, email: string, code: unknown) {
  const g = await groupByCode(payload, code);
  const members = ((g.members ?? []) as Doc[]).filter((x) => x.email !== email).map(({ id: _id, ...x }) => x);
  if (!members.length) { await payload.delete({ collection: G, where: { id: { equals: g.id } }, overrideAccess: true }); return { deleted: true }; }
  const ownerEmail = g.ownerEmail === email ? members[0].email : g.ownerEmail;
  await payload.update({ collection: G, id: g.id, data: { members, ownerEmail } as never, overrideAccess: true });
  return { deleted: false };
}

/** Today's tick, streak and this week's points for one person, as their friends see it. */
function publicStatus(p: Doc | null, email: string, now = Date.now()) {
  const st = (p?.state ?? {}) as WState;
  const t = targetsOf(st);
  const today = istDate(now);
  const row = (st.days ?? []).find((r) => r.id === today);
  const ch = (st.challenge ?? {}) as Doc;
  const xp = xpOf(st).total;
  return {
    email, name: firstName(p?.name, email), streak: p?.streak ?? 0, todayDone: isComplete(row, t), todayLogged: isLogged(row), workedOut: Boolean(row?.w),
    weekXp: weekXp(st, weekStart(today)), level: levelOf(xp).level, program: ch.program ?? "", day: ch.start && today >= ch.start ? Math.round((Date.parse(today) - Date.parse(ch.start)) / 864e5) + 1 : null,
  };
}

export async function groupView(payload: Payload, email: string, code: unknown) {
  const g = await groupByCode(payload, code);
  if (!((g.members ?? []) as Doc[]).some((x) => x.email === email)) throw new WorkoutError("You're not in this group", 403);
  const emails = ((g.members ?? []) as Doc[]).map((x) => x.email as string);
  const profiles = await payload.find({ collection: P, where: { email: { in: emails } }, limit: 100, depth: 0, overrideAccess: true });
  const by = new Map((profiles.docs as Doc[]).map((p) => [p.email, p]));
  const people = emails.map((e) => publicStatus(by.get(e) ?? null, e)).sort((a, b) => b.weekXp - a.weekXp);
  const feed = await payload.find({ collection: F, where: { groupCode: { equals: g.code } }, sort: "-createdAt", limit: 60, depth: 0, overrideAccess: true });
  return {
    code: g.code, name: g.name, mode: g.mode, program: g.program ?? "", length: g.length ?? null, start: g.start ?? "", owner: g.ownerEmail === email,
    link: `${siteUrl()}/workout?join=${g.code}`, people,
    feed: (feed.docs as Doc[]).map((f) => ({ id: String(f.id), kind: f.kind, from: f.fromName, fromMe: f.fromEmail === email, to: f.toEmail ? firstName(by.get(f.toEmail)?.name, f.toEmail) : "", toMe: f.toEmail === email, text: f.text, at: f.createdAt })),
  };
}

export const PRESETS: Record<string, string> = {
  go: "💪 You got this!", fire: "🔥 Keep that streak alive!", proud: "🎉 So proud of you!", done: "✅ Done with mine. Your turn!",
  where: "👀 Haven't seen your workout today…", rest: "😴 Rest day for me today", clean: "🥗 Eating clean today", water: "💧 Drink some water!",
  together: "🤝 Let's do it together tomorrow", tired: "😮‍💨 Tough one today, but I showed up",
};

async function post(payload: Payload, f: { kind: string; groupCode?: string; toEmail?: string; fromEmail: string; fromName: string; text: string }) {
  await payload.create({ collection: F, data: f as never, overrideAccess: true });
  if (f.toEmail) void notify(payload, [f.toEmail]).catch(() => null);
  else if (f.groupCode && f.kind !== "event") {
    const g = (await payload.find({ collection: G, where: { code: { equals: f.groupCode } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as Doc | undefined;
    if (g) void notify(payload, ((g.members ?? []) as Doc[]).map((x) => x.email).filter((e: string) => e !== f.fromEmail)).catch(() => null);
  }
}

export async function groupPost(payload: Payload, email: string, code: unknown, b: Doc) {
  const g = await groupByCode(payload, code);
  const members = (g.members ?? []) as Doc[];
  const meRow = members.find((x) => x.email === email);
  if (!meRow) throw new WorkoutError("You're not in this group", 403);
  const profile = await findProfile(payload, email);
  const to = typeof b.to === "string" ? normEmail(b.to) : "";
  if (to && !members.some((x) => x.email === to)) throw new WorkoutError("They're not in this group");
  const kind = b.kind === "nudge" ? "nudge" : b.kind === "cheer" ? "cheer" : "msg";
  let text = typeof b.preset === "string" && PRESETS[b.preset] ? PRESETS[b.preset] : String(b.text ?? "").trim().replace(/\s+/g, " ").slice(0, 160);
  if (kind === "cheer" && !text) text = "👏 cheered you on";
  if (kind === "nudge" && !text) text = "👉 nudged you to work out today";
  if (!text) throw new WorkoutError("Type a message");
  await post(payload, { kind, groupCode: g.code, toEmail: to || undefined, fromEmail: email, fromName: firstName(profile?.name, email), text });
  return { ok: true };
}

/* ---------- random accountability buddy ---------- */

const pairCode = (a: string, b: string) => "b-" + createHash("sha1").update([a, b].sort().join("|")).digest("hex").slice(0, 14);

export async function requestBuddy(payload: Payload, email: string) {
  const s = await getSettings(payload);
  if (!s.buddyOn) throw new WorkoutError("Buddy matching is paused right now");
  const me = await getOrCreateProfile(payload, email);
  const a = await accessOf(payload, me);
  if (!a.isPaid) throw new WorkoutError("A random buddy comes with a paid plan (or a friend's plan)", 402, { reason: "upgrade" });
  if (me.buddyStatus === "matched") throw new WorkoutError("You already have a buddy");
  const blocked: string[] = Array.isArray(me.buddyBlocked) ? me.buddyBlocked : [];
  const waiting = await payload.find({ collection: P, where: { and: [{ buddyStatus: { equals: "waiting" } }, { email: { not_equals: email } }] }, sort: "buddyWaitingSince", limit: 30, depth: 0, overrideAccess: true });
  const now = new Date().toISOString();
  for (const other of waiting.docs as Doc[]) {
    if (blocked.includes(other.email) || (Array.isArray(other.buddyBlocked) && other.buddyBlocked.includes(email))) continue;
    const oa = await accessOf(payload, other);
    if (!oa.isPaid) continue;
    const res = await payload.update({ collection: P, where: { and: [{ id: { equals: other.id } }, { buddyStatus: { equals: "waiting" } }] }, data: { buddyStatus: "matched", buddyEmail: email, buddySince: now, buddyShareWa: false } as never, depth: 0, overrideAccess: true });
    if (!res.docs.length) continue;
    await payload.update({ collection: P, id: me.id, data: { buddyStatus: "matched", buddyEmail: other.email, buddySince: now, buddyShareWa: false, buddyWaitingSince: null } as never, overrideAccess: true });
    await post(payload, { kind: "event", groupCode: pairCode(email, other.email), fromEmail: email, fromName: firstName(me.name, email), text: "matched with you as accountability buddies 🤝" });
    void notify(payload, [other.email]).catch(() => null);
    return { status: "matched" };
  }
  await payload.update({ collection: P, id: me.id, data: { buddyStatus: "waiting", buddyWaitingSince: now } as never, overrideAccess: true });
  return { status: "waiting" };
}

export async function buddyView(payload: Payload, email: string) {
  const me = await getOrCreateProfile(payload, email);
  const s = await getSettings(payload);
  if (me.buddyStatus !== "matched" || !me.buddyEmail) return { status: me.buddyStatus ?? "none" };
  const other = await findProfile(payload, me.buddyEmail);
  if (!other) return { status: "none" };
  const days = me.buddySince ? Math.floor((Date.now() - new Date(me.buddySince).getTime()) / 864e5) : 0;
  const both = Boolean(me.buddyShareWa && other.buddyShareWa);
  const code = pairCode(email, other.email);
  const feed = await payload.find({ collection: F, where: { groupCode: { equals: code } }, sort: "-createdAt", limit: 40, depth: 0, overrideAccess: true });
  return {
    status: "matched", since: me.buddySince, days, buddy: publicStatus(other, other.email), me: publicStatus(me, email),
    wa: { after: s.waAfterDays, canAsk: days >= s.waAfterDays, mine: Boolean(me.buddyShareWa), theirs: Boolean(other.buddyShareWa), number: both ? other.phone || "" : "", myNumberSet: Boolean(me.phone) },
    feed: (feed.docs as Doc[]).map((f) => ({ id: String(f.id), kind: f.kind, fromMe: f.fromEmail === email, from: f.fromName, text: f.text, at: f.createdAt })),
    presets: PRESETS,
  };
}

export async function buddyAction(payload: Payload, email: string, b: Doc) {
  const me = await getOrCreateProfile(payload, email);
  const action = String(b.action ?? "");
  if (action === "cancel") {
    if (me.buddyStatus === "waiting") await payload.update({ collection: P, id: me.id, data: { buddyStatus: "none", buddyWaitingSince: null } as never, overrideAccess: true });
    return { status: "none" };
  }
  if (me.buddyStatus !== "matched" || !me.buddyEmail) throw new WorkoutError("You don't have a buddy yet");
  const other = await findProfile(payload, me.buddyEmail);
  if (action === "end" || action === "report") {
    const blockMe = [...new Set([...(Array.isArray(me.buddyBlocked) ? me.buddyBlocked : []), me.buddyEmail])];
    await payload.update({ collection: P, id: me.id, data: { buddyStatus: "none", buddyEmail: "", buddySince: null, buddyShareWa: false, buddyBlocked: blockMe } as never, overrideAccess: true });
    if (other && other.buddyEmail === email) {
      const blockThem = [...new Set([...(Array.isArray(other.buddyBlocked) ? other.buddyBlocked : []), email])];
      await payload.update({ collection: P, id: other.id, data: { buddyStatus: "none", buddyEmail: "", buddySince: null, buddyShareWa: false, buddyBlocked: blockThem, ...(action === "report" ? { reports: (other.reports ?? 0) + 1 } : {}) } as never, overrideAccess: true });
    }
    return { status: "none" };
  }
  if (action === "share") {
    const s = await getSettings(payload);
    const days = me.buddySince ? Math.floor((Date.now() - new Date(me.buddySince).getTime()) / 864e5) : 0;
    if (b.on && days < s.waAfterDays) throw new WorkoutError(`You can swap WhatsApp numbers after ${s.waAfterDays} days together`);
    const phone = waNumber(b.phone ?? me.phone);
    if (b.on && !phone) throw new WorkoutError("Add your WhatsApp number first");
    await payload.update({ collection: P, id: me.id, data: { buddyShareWa: Boolean(b.on), ...(phone ? { phone } : {}) } as never, overrideAccess: true });
    if (b.on && other) await post(payload, { kind: "event", groupCode: pairCode(email, other.email), fromEmail: email, fromName: firstName(me.name, email), text: "is happy to swap WhatsApp numbers 📱" });
    return { ok: true };
  }
  if (action === "send") {
    const preset = typeof b.preset === "string" ? b.preset : "";
    if (!PRESETS[preset]) throw new WorkoutError("Pick a message");
    await post(payload, { kind: preset === "where" ? "nudge" : "cheer", groupCode: pairCode(email, me.buddyEmail), toEmail: me.buddyEmail, fromEmail: email, fromName: firstName(me.name, email), text: PRESETS[preset] });
    return { ok: true };
  }
  throw new WorkoutError("Unknown action");
}

/* ---------- inbox & push ---------- */

/** Messages for this person since a time: cheers, nudges and group chat (not their own). */
export async function inbox(payload: Payload, email: string, since: string) {
  const me = await findProfile(payload, email);
  const codes = (await myGroups(payload, email)).map((g) => g.code);
  if (me?.buddyEmail) codes.push(pairCode(email, me.buddyEmail));
  const after = since && !Number.isNaN(Date.parse(since)) ? since : new Date(Date.now() - 7 * 864e5).toISOString();
  const res = await payload.find({
    collection: F,
    where: { and: [{ createdAt: { greater_than: after } }, { fromEmail: { not_equals: email } }, { or: [{ toEmail: { equals: email } }, { groupCode: { in: codes.length ? codes : ["-"] } }] }] },
    sort: "-createdAt", limit: 30, depth: 0, overrideAccess: true,
  });
  return (res.docs as Doc[]).map((f) => ({ id: String(f.id), kind: f.kind, from: f.fromName, text: f.text, toMe: f.toEmail === email, group: f.groupCode?.startsWith("b-") ? "buddy" : f.groupCode, at: f.createdAt }));
}

export async function subscribePush(payload: Payload, email: string, sub: unknown, hour: unknown) {
  const p = await getOrCreateProfile(payload, email);
  const list: PushSub[] = (Array.isArray(p.push) ? p.push : []).filter(validSub);
  if (sub !== null) {
    if (!validSub(sub)) throw new WorkoutError("That notification setup isn't supported");
    if (!list.some((x) => x.endpoint === sub.endpoint)) list.push({ endpoint: sub.endpoint, at: new Date().toISOString() });
  }
  const data: Doc = { push: sub === null ? [] : list.slice(-5) };
  if (typeof hour === "number" && hour >= 0 && hour <= 23) data.reminderHour = Math.round(hour);
  await payload.update({ collection: P, id: p.id, data: data as never, overrideAccess: true });
  return { ok: true };
}

async function notify(payload: Payload, emails: string[]) {
  if (!emails.length) return;
  const keys = await vapidKeys(payload);
  const res = await payload.find({ collection: P, where: { email: { in: emails.slice(0, 50) } }, limit: 50, depth: 0, overrideAccess: true, select: { push: true } });
  for (const p of res.docs as Doc[]) {
    const subs: PushSub[] = (Array.isArray(p.push) ? p.push : []).filter(validSub);
    if (!subs.length) continue;
    const alive: PushSub[] = [];
    for (const s of subs) if (await sendPush(keys, s)) alive.push(s);
    if (alive.length !== subs.length) await payload.update({ collection: P, id: p.id, data: { push: alive } as never, overrideAccess: true });
  }
}

/** Hourly: a reminder push to people whose reminder hour is now and who haven't logged today. */
export async function sendReminders(payload: Payload, now = Date.now()) {
  const hour = new Date(now + 5.5 * 3600_000).getUTCHours();
  const today = istDate(now);
  const res = await payload.find({ collection: P, where: { reminderHour: { equals: hour } }, limit: 2000, depth: 0, overrideAccess: true, select: { email: true, push: true, state: true } });
  const due = (res.docs as Doc[]).filter((p) => Array.isArray(p.push) && p.push.length && !isLogged(((p.state ?? {}) as WState).days?.find((r: Row) => r.id === today)));
  await notify(payload, due.map((p) => p.email));
  return { checked: res.docs.length, sent: due.length, hour };
}

/* ---------- progress photos ---------- */

export async function photoQuota(payload: Payload, email: string, now = Date.now()) {
  const p = await getOrCreateProfile(payload, email);
  const a = await accessOf(payload, p, now);
  const week = weekStart(istDate(now));
  const used = (await payload.count({ collection: PH, where: { and: [{ email: { equals: email } }, { week: { equals: week } }] }, overrideAccess: true })).totalDocs;
  return { week, used, allowed: a.photosPerWeek, left: Math.max(0, a.photosPerWeek - used), canLog: a.canLog, plan: a.plan.name };
}

type Cloud = { config: () => { cloud_name?: string; api_key?: string; api_secret?: string }; utils: { api_sign_request: (p: Doc, s: string) => string }; url: (id: string, o: Doc) => string; uploader?: { destroy: (id: string, o: Doc) => Promise<unknown> } };
async function cloud(): Promise<Cloud> {
  const { v2 } = await import("cloudinary");
  return v2 as unknown as Cloud;
}

/** Reserves this week's photo slot and signs a direct, private upload to Cloudinary. The slot stays used even if deleted. */
export async function signPhoto(payload: Payload, email: string, day: unknown) {
  const q = await photoQuota(payload, email);
  if (!q.canLog) throw new WorkoutError("Your plan has ended. Renew to add photos.", 402, { reason: "expired" });
  if (q.left <= 0) throw new WorkoutError(q.allowed === 0 ? "Progress photos aren't on your plan." : `You've added ${q.used} photo${q.used === 1 ? "" : "s"} this week (your ${q.plan} plan allows ${q.allowed}). New photos open on Monday.`, 402, { reason: "photos" });
  const c = await cloud();
  const cfg = c.config();
  if (!cfg.cloud_name || !cfg.api_key || !cfg.api_secret) throw new WorkoutError("Photo uploads aren't set up yet", 503);
  const owner = createHash("sha1").update(email).digest("hex").slice(0, 12);
  const publicId = `workout/${owner}/${randomBytes(12).toString("hex")}`;
  const doc = await payload.create({ collection: PH, data: { email, week: q.week, day: typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : istDate(), status: "pending", publicId } as never, overrideAccess: true });
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { allowed_formats: "jpg,jpeg,png,webp,heic", public_id: publicId, timestamp, type: "authenticated" };
  return {
    id: String((doc as Doc).id), url: `https://api.cloudinary.com/v1_1/${cfg.cloud_name}/image/upload`,
    fields: { ...params, api_key: cfg.api_key, signature: c.utils.api_sign_request(params, cfg.api_secret) },
  };
}

export async function confirmPhoto(payload: Payload, email: string, id: unknown) {
  const d = (await payload.findByID({ collection: PH, id: String(id), depth: 0, overrideAccess: true }).catch(() => null)) as Doc | null;
  if (!d || d.email !== email) throw new WorkoutError("Photo not found", 404);
  await payload.update({ collection: PH, id: d.id, data: { status: "ready" } as never, overrideAccess: true });
  return { ok: true };
}

export async function listPhotos(payload: Payload, email: string) {
  const res = await payload.find({ collection: PH, where: { and: [{ email: { equals: email } }, { status: { equals: "ready" } }] }, sort: "-createdAt", limit: 400, depth: 0, overrideAccess: true });
  const c = await cloud();
  const has = Boolean(c.config().cloud_name);
  const q = await photoQuota(payload, email);
  return {
    quota: q,
    photos: (res.docs as Doc[]).map((d) => ({
      id: String(d.id), day: d.day, week: d.week, note: d.note ?? "",
      url: has ? c.url(d.publicId, { type: "authenticated", sign_url: true, secure: true, width: 900, crop: "limit", quality: "auto", fetch_format: "auto" }) : "",
      thumb: has ? c.url(d.publicId, { type: "authenticated", sign_url: true, secure: true, width: 240, height: 320, crop: "fill", gravity: "auto", quality: "auto", fetch_format: "auto" }) : "",
    })),
  };
}

export async function deletePhoto(payload: Payload, email: string, id: unknown) {
  const d = (await payload.findByID({ collection: PH, id: String(id), depth: 0, overrideAccess: true }).catch(() => null)) as Doc | null;
  if (!d || d.email !== email) throw new WorkoutError("Photo not found", 404);
  const c = await cloud();
  await c.uploader?.destroy(d.publicId, { type: "authenticated", invalidate: true }).catch((e) => console.error("[workout-photo-delete]", e));
  // Keep the row (as "deleted") so the week's slot stays used: unused or deleted photos don't roll over.
  await payload.update({ collection: PH, id: d.id, data: { status: "pending", note: "deleted" } as never, overrideAccess: true });
  return { ok: true };
}

/* ---------- money-back ---------- */

export async function claimMoneyBack(payload: Payload, email: string, choice: unknown) {
  const s = await getSettings(payload);
  if (!s.moneyBackOn) throw new WorkoutError("Money-back isn't available right now");
  const data = await me(payload, email);
  const mb = data.moneyBack;
  if (!mb || !mb.eligible || data.access.kind !== "owner") throw new WorkoutError("Only the person who bought the plan can claim", 403);
  if (!mb.reached) throw new WorkoutError(`Keep going! ${mb.next ? `${mb.next.days - mb.counted} more days to go.` : ""}`);
  if (mb.claim && mb.claim.status !== "rejected") throw new WorkoutError("You've already claimed for this year");
  const m = await ownedMembership(payload, email);
  if (!m) throw new WorkoutError("No plan found", 404);
  const ch = choice === "extend" ? "extend" : "refund";
  if (ch === "extend" && !mb.reached.months) throw new WorkoutError("Free months aren't offered for this level");
  if (ch === "refund" && !mb.reached.percent) throw new WorkoutError("Money back isn't offered for this level");
  await payload.create({
    collection: CL,
    data: {
      email, membership: m.id, counted: mb.counted, choice: ch, percent: ch === "refund" ? mb.reached.percent : 0, months: ch === "extend" ? mb.reached.months : 0,
      refundAmount: ch === "refund" ? Math.round(((m.amount ?? 0) * mb.reached.percent) / 100) : 0, termStart: mb.termStart, termEnd: mb.termEnd, paymentId: m.paymentId ?? "", status: "pending",
    } as never,
    overrideAccess: true,
  });
  await sendWithBrevo({
    to: [{ email }],
    subject: "We got your money-back claim 🏆",
    html: shell(`<h2 style="margin:0 0 8px">What a year!</h2><p>You logged <b>${mb.counted} days</b>. We've received your claim for <b>${ch === "refund" ? `${mb.reached.percent}% of your payment back` : `${mb.reached.months} free months`}</b> and will confirm within 7 working days.</p>`),
  }).catch(() => null);
  return { ok: true };
}

/* ---------- payments ---------- */

export async function quote(payload: Payload, email: string, planKey: unknown, rawCoupon: unknown, rawRef: unknown) {
  const plan = await planById(payload, planKey);
  if (!plan || plan.isFree || !plan.active || plan.price < 1) throw new WorkoutError("Please pick a plan");
  const s = await getSettings(payload);
  const coupon = typeof rawCoupon === "string" && rawCoupon.trim() ? rawCoupon.trim().toUpperCase().slice(0, 30) : "";
  if (coupon) {
    const own = s.promoCodes.find((c) => String(c.code ?? "").toUpperCase() === coupon);
    if (own) {
      if (!own.active || (own.validUntil && new Date(own.validUntil).getTime() < Date.now())) throw new WorkoutError("That code has expired");
      const total = Math.max(1, plan.price - Math.max(0, Math.round(Number(own.amountOff) || 0)));
      return { plan, total, discount: plan.price - total, coupon, ref: "" };
    }
    const affiliate = await findAffiliate(payload, coupon);
    if (!affiliate) throw new WorkoutError("That code isn't valid");
    const q = applyPromo(plan.price, affiliate);
    return { plan, total: q.total, discount: q.discount, coupon, ref: "" };
  }
  const ref = typeof rawRef === "string" ? rawRef.trim().toUpperCase().slice(0, 12) : "";
  if (s.refOn && ref && s.refFriendOff > 0) {
    const referrer = (await payload.find({ collection: P, where: { refCode: { equals: ref } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as Doc | undefined;
    if (referrer && referrer.email !== email) {
      const total = Math.max(1, plan.price - s.refFriendOff);
      return { plan, total, discount: plan.price - total, coupon: "", ref };
    }
  }
  return { plan, total: plan.price, discount: 0, coupon: "", ref: "" };
}

export async function markWorkoutPaid(payload: Payload, orderId: string, paymentId?: string) {
  const profile = (await payload.find({ collection: P, where: { or: [{ orderId: { equals: orderId } }, { orderId: { equals: `done:${orderId}` } }] }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as Doc | undefined;
  if (!profile) return { found: false as const };
  if (profile.orderId !== orderId) return { found: true as const, alreadyPaid: true };
  const order = (profile.order ?? {}) as Doc;
  // Marks the order used in the same write that checks it, so the checkout page and the webhook can't both apply it.
  const claimed = await payload.update({ collection: P, where: { and: [{ id: { equals: profile.id } }, { orderId: { equals: orderId } }] }, data: { orderId: `done:${orderId}`, order: { ...order, paid: true, paymentId: paymentId ?? "" } } as never, depth: 0, overrideAccess: true });
  if (!claimed.docs.length) return { found: true as const, alreadyPaid: true };
  const plan = await planById(payload, order.plan);
  if (!plan) return { found: true as const, alreadyPaid: false, error: "plan missing" };
  const email = profile.email as string;
  const now = Date.now();
  const existing = await ownedMembership(payload, email);
  const bonusDays = profile.bonusDays ?? 0, bonusSeats = profile.bonusSeats ?? 0;
  const sameRenew = existing && isLive(existing, now) && relId(existing.plan) === plan.id;
  const start = sameRenew ? new Date(existing.expiresAt).getTime() : now;
  const expiresAt = new Date(start + (plan.durationDays + bonusDays) * 864e5).toISOString();
  const data = {
    ownerEmail: email, plan: plan.id, status: "active", expiresAt, paidAt: new Date(now).toISOString(), amount: order.amount ?? plan.price, termStart: new Date(start).toISOString(),
    promoCode: order.coupon ?? "", orderId, paymentId: paymentId ?? "", orderPlan: plan.id, orderAmount: order.amount ?? plan.price, orderPaid: true, orderRef: order.ref ?? "",
    ...(order.ref && !existing?.referredBy ? { referredBy: order.ref } : {}),
  };
  let m: Doc;
  if (existing) m = (await payload.update({ collection: M, id: existing.id, data: { ...data, extraSeats: (existing.extraSeats ?? 0) + bonusSeats } as never, overrideAccess: true })) as Doc;
  else m = (await payload.create({ collection: M, data: { ...data, members: [], extraSeats: bonusSeats } as never, overrideAccess: true })) as Doc;
  if (bonusDays || bonusSeats) await payload.update({ collection: P, id: profile.id, data: { bonusDays: 0, bonusSeats: 0 } as never, overrideAccess: true });
  // Someone using this person's plan as a friend now has their own: take them off the friend's plan.
  const shared = await payload.find({ collection: M, where: { "members.email": { equals: email } }, limit: 5, depth: 0, overrideAccess: true });
  for (const x of shared.docs as Doc[]) await payload.update({ collection: M, id: x.id, data: { members: ((x.members ?? []) as Doc[]).filter((y) => y.email !== email).map(({ id: _id, ...y }) => y) } as never, overrideAccess: true });
  if (m.referredBy && !m.referralRewarded) await rewardReferrer(payload, m);
  await sendWithBrevo({
    to: [{ email }],
    subject: `Your ${plan.name} plan is active 💪`,
    html: shell(`<h2 style="margin:0 0 8px">You're all set!</h2><p>Your <b>${esc(plan.name)}</b> plan runs until <b>${new Date(expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</b>.</p>${plan.seats ? `<p>Add up to ${plan.seats} friends or family from <b>Friends</b> in the app. They use it free on your plan.</p>` : ""}<p>${button(`${siteUrl()}/workout`, "Open the app")}</p>`),
  }).catch((e) => console.error("[workout-paid-email]", e));
  return { found: true as const, alreadyPaid: false };
}

async function rewardReferrer(payload: Payload, m: Doc) {
  const s = await getSettings(payload);
  await payload.update({ collection: M, id: m.id, data: { referralRewarded: true } as never, overrideAccess: true });
  const ref = (await payload.find({ collection: P, where: { refCode: { equals: m.referredBy } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as Doc | undefined;
  if (!ref || ref.email === m.ownerEmail || !s.refOn) return;
  if (s.refMax && (ref.refCount ?? 0) >= s.refMax) return;
  const theirs = await ownedMembership(payload, ref.email);
  const live = isLive(theirs);
  const upd: Doc = { refCount: (ref.refCount ?? 0) + 1 };
  if (s.refReward === "seat") {
    if (live) await payload.update({ collection: M, id: theirs!.id, data: { extraSeats: (theirs!.extraSeats ?? 0) + (s.refAmount || 1) } as never, overrideAccess: true });
    else upd.bonusSeats = (ref.bonusSeats ?? 0) + (s.refAmount || 1);
  } else if (live) await extendMembership(payload, theirs!, s.refAmount);
  else upd.bonusDays = (ref.bonusDays ?? 0) + s.refAmount;
  await payload.update({ collection: P, id: ref.id, data: upd as never, overrideAccess: true });
  const what = s.refReward === "seat" ? `${s.refAmount || 1} more friend seat${(s.refAmount || 1) === 1 ? "" : "s"}` : `${s.refAmount} free days`;
  await sendWithBrevo({ to: [{ email: ref.email }], subject: `Your friend joined. You got ${what} 🎁`, html: shell(`<h2 style="margin:0 0 8px">Thanks for sharing!</h2><p>Someone joined Pandora Workout with your link, so you've got <b>${what}</b>.</p><p>${button(`${siteUrl()}/workout`, "Open the app")}</p>`) }).catch(() => null);
}
