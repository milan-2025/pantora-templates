import "server-only";
import { randomBytes, randomInt } from "crypto";
import type { Payload, Where } from "payload";
import { sendWithBrevo } from "@/lib/brevo";
import { PasswordError, checkLogin, hasPassword, removePassword, setPassword } from "@/lib/auth/passwords";
import { quoteWithCode } from "@/lib/pricing";
import {
  LIMIT_KEYS, PlannerError, applyOps, codesMatch, counts, daysLeft, describeOps, effectiveStatus, hashCode, makeToken,
  newExpiry, normEmail, overLimit, readToken, runSheetView, validEmail,
  type Limits, type Op, type State,
} from "./core";

export { PlannerError };

const secret = () => process.env.PAYLOAD_SECRET || "dev-secret-change-me";
const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const SESSION_DAYS = 60;
const CODE_MINUTES = 15;
const SNAPSHOT_EVERY_MS = 30 * 60_000; // a restore point at most every 30 minutes of editing
const KEEP_SNAPSHOTS = 60;
const MAX_SYNC_OPS_BYTES = 300_000;

/* ---------- plans ---------- */

// Payload documents, read loosely: the planner's JSON state has no fixed TypeScript shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>;

export type PlanView = {
  id: string; planId: string; name: string; price: number; durationDays: number; collaborators: number;
  isTrial: boolean; active: boolean; tagline: string; badge: string; features: string[]; limits: Limits;
};

/** Starting plans, created the first time the planner is used. Edit them in /admin ▸ Wedding planner ▸ Planner plans. */
export const DEFAULT_PLANNER_PLANS = [
  {
    name: "Free trial", planId: "trial", isTrial: true, active: false, price: 0, durationDays: 14, collaborators: 0, sortOrder: 0,
    tagline: "Try everything for 14 days", badge: "",
    features: [{ text: "All planner screens" }, { text: "Up to 30 guests" }, { text: "Saved to the cloud" }],
    limits: { guests: 30, vendors: 25, payments: 25, hotels: 5, vehicles: 5, shopping: 20, shagun: 20, runsheet: 20 },
  },
  {
    name: "Family", planId: "family", isTrial: false, active: true, price: 1499, durationDays: 365, collaborators: 3, sortOrder: 10,
    tagline: "Everything for one wedding", badge: "Most chosen",
    features: [{ text: "Up to 500 guests" }, { text: "Unlimited vendors, payments and tasks" }, { text: "Invite 3 family members to plan with you" }, { text: "Activity log and restore" }, { text: "Valid for 1 year" }],
    limits: { guests: 500 },
  },
  {
    name: "Grand", planId: "grand", isTrial: false, active: true, price: 2999, durationDays: 365, collaborators: 10, sortOrder: 20,
    tagline: "For big families and big weddings", badge: "",
    features: [{ text: "Unlimited guests" }, { text: "Invite 10 family members or your planner" }, { text: "Everything in Family" }, { text: "Valid for 1 year" }],
    limits: {},
  },
];

const toView = (d: Doc): PlanView => {
  const limits: Limits = {};
  for (const k of LIMIT_KEYS) {
    const v = d.limits?.[k];
    limits[k] = typeof v === "number" && v >= 0 ? v : null;
  }
  return {
    id: String(d.id), planId: d.planId, name: d.name, price: Math.max(0, Math.round(d.price ?? 0)), durationDays: d.durationDays ?? 365,
    collaborators: d.collaborators ?? 0, isTrial: Boolean(d.isTrial), active: d.active !== false, tagline: d.tagline ?? "", badge: d.badge ?? "",
    features: (d.features ?? []).map((f: Doc) => f.text).filter(Boolean), limits,
  };
};

export async function getPlans(payload: Payload): Promise<PlanView[]> {
  const find = () => payload.find({ collection: "planner-plans", limit: 100, depth: 0, sort: "sortOrder", overrideAccess: true });
  let res = await find();
  if (res.totalDocs === 0) {
    for (const p of DEFAULT_PLANNER_PLANS) {
      await payload.create({ collection: "planner-plans", data: p as never, overrideAccess: true }).catch(() => null); // another request may have created it
    }
    res = await find();
  }
  return res.docs.map((d) => toView(d as Doc));
}

export async function getPlan(payload: Payload, id: unknown): Promise<PlanView | null> {
  const key = id && typeof id === "object" ? (id as Doc).id : id;
  if (!key) return null;
  const d = await payload.findByID({ collection: "planner-plans", id: String(key), depth: 0, overrideAccess: true }).catch(() => null);
  return d ? toView(d as Doc) : null;
}

export async function trialPlan(payload: Payload) {
  const plans = await getPlans(payload);
  return plans.find((p) => p.isTrial) ?? plans[0];
}

/* ---------- sign-in ---------- */

const emailShell = (body: string) =>
  `<!doctype html><html><body style="margin:0;background:#FBF5EA;font-family:Arial,Helvetica,sans-serif;color:#2A2A2A"><div style="max-width:520px;margin:0 auto;padding:32px 20px"><div style="background:#FFFDF8;border:1px solid #EBE2EF;border-radius:24px;padding:28px">${body}</div><p style="text-align:center;font-size:12px;color:#888">Pandora Templates · Open the box. Everything’s ready.</p></div></body></html>`;
const button = (href: string, text: string) =>
  `<a href="${href}" style="display:inline-block;padding:12px 22px;background:#3B1F4A;color:#fff;border-radius:999px;text-decoration:none;font-weight:600">${text}</a>`;

export async function startLogin(payload: Payload, rawEmail: unknown) {
  const email = normEmail(rawEmail);
  if (!validEmail(email)) throw new PlannerError("Please enter a valid email");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await payload.delete({ collection: "planner-logins", where: { email: { equals: email } }, overrideAccess: true }).catch(() => null);
  await payload.create({
    collection: "planner-logins",
    data: { email, codeHash: hashCode(secret(), email, code), expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000).toISOString(), attempts: 0 } as never,
    overrideAccess: true,
  });
  await sendWithBrevo({
    to: [{ email }],
    subject: `${code} is your Pandora Wedding Planner code`,
    html: emailShell(`<h2 style="margin:0 0 8px;color:#3B1F4A">Your sign-in code</h2><p>Type this code in the planner to sign in:</p>
      <p style="font-size:34px;letter-spacing:8px;font-weight:700;color:#3B1F4A;margin:14px 0">${code}</p>
      <p style="font-size:13px;color:#666">It works for ${CODE_MINUTES} minutes. If you didn't ask for it, you can ignore this email.</p>`),
    text: `Your Pandora Wedding Planner code is ${code}. It works for ${CODE_MINUTES} minutes.`,
  });
  return { email, devCode: process.env.BREVO_API_KEY || process.env.NODE_ENV === "production" ? undefined : code };
}

export async function verifyLogin(payload: Payload, rawEmail: unknown, rawCode: unknown) {
  const email = normEmail(rawEmail);
  const code = String(rawCode ?? "").replace(/\D/g, "");
  const res = await payload.find({ collection: "planner-logins", where: { email: { equals: email } }, limit: 1, sort: "-createdAt", depth: 0, overrideAccess: true });
  const row = res.docs[0] as Doc | undefined;
  const wrong = new PlannerError("That code isn't right. Check the latest email, or ask for a new code.", 401);
  if (!row || new Date(row.expiresAt).getTime() < Date.now()) throw new PlannerError("That code has expired. Ask for a new one.", 401);
  if ((row.attempts ?? 0) >= 5) throw new PlannerError("Too many wrong tries. Ask for a new code.", 429);
  if (code.length !== 6 || !codesMatch(row.codeHash, hashCode(secret(), email, code))) {
    await payload.update({ collection: "planner-logins", id: row.id, data: { attempts: (row.attempts ?? 0) + 1 } as never, overrideAccess: true });
    throw wrong;
  }
  await payload.delete({ collection: "planner-logins", where: { email: { equals: email } }, overrideAccess: true });
  return { email, token: makeToken(secret(), email, SESSION_DAYS * 864e5) };
}

/* ---------- optional password (a code always works too) ---------- */

const asPlannerError = (e: unknown) => (e instanceof PasswordError ? new PlannerError(e.message, e.status) : e);

/** Email + password sign-in, for people who have set a password in Account. */
export async function passwordLogin(payload: Payload, rawEmail: unknown, password: unknown) {
  const email = normEmail(rawEmail);
  if (!validEmail(email)) throw new PlannerError("Please enter a valid email");
  try { await checkLogin(payload, "planner", email, password); } catch (e) { throw asPlannerError(e); }
  return { email, token: makeToken(secret(), email, SESSION_DAYS * 864e5) };
}

export const plannerHasPassword = (payload: Payload, email: string) => hasPassword(payload, "planner", email);

/** Sets, changes or removes the signed-in person's password, and tells them by email. */
export async function setMyPassword(payload: Payload, email: string, password: unknown, remove = false) {
  let changed = false;
  try {
    if (remove) await removePassword(payload, "planner", email);
    else changed = (await setPassword(payload, "planner", email, password)).changed;
  } catch (e) { throw asPlannerError(e); }
  const what = remove ? "removed" : changed ? "changed" : "set";
  await sendWithBrevo({
    to: [{ email }],
    subject: `Your wedding planner password was ${what}`,
    html: emailShell(`<h2 style="margin:0 0 8px;color:#3B1F4A">Password ${what}</h2><p>The password for your Pandora Wedding Planner account (${esc(email)}) was just ${what}.</p>
      <p>${remove ? "You can still sign in any time with a code sent to this email." : "You can now sign in with this email and your password, or with a code sent to this email."}</p>
      <p style="font-size:13px;color:#666">Wasn't you? Sign in with a code at ${esc(siteUrl())}/planner/login, then set a new password in Account.</p>`),
    text: `The password for your Pandora Wedding Planner account (${email}) was just ${what}. Wasn't you? Sign in with a code and set a new password in Account.`,
  }).catch((e) => console.error("[planner-password-email]", e));
  return { ok: true, hasPassword: !remove };
}

/** A fresh session token, so people who keep using the planner stay signed in (sent back by /me about once a day). */
export function refreshedToken(req: Request, subject: string) {
  const h = req.headers.get("authorization") ?? "";
  const raw = h.startsWith("Bearer ") ? h.slice(7) : "";
  const exp = Number(raw.split(".")[1] ?? 0);
  if (subject.startsWith("support:") || !exp) return undefined;
  return exp - Date.now() < (SESSION_DAYS - 1) * 864e5 ? makeToken(secret(), subject, SESSION_DAYS * 864e5) : undefined;
}

/** The signed-in email (or "support:<plannerId>") from the request's bearer token. */
export function subjectOf(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  return readToken(secret(), h.startsWith("Bearer ") ? h.slice(7) : null);
}
export const supportToken = (plannerId: string) => makeToken(secret(), `support:${plannerId}`, 2 * 3600_000);

/* ---------- access ---------- */

export type Role = "owner" | "editor" | "viewer" | "support";

export function roleFor(p: Doc, subject: string): Role | null {
  if (subject === `support:${p.id}`) return "support";
  const email = normEmail(subject);
  if (!email || email.startsWith("support:")) return null;
  if (normEmail(p.ownerEmail) === email) return "owner";
  const c = (p.collaborators ?? []).find((x: Doc) => normEmail(x.email) === email);
  return c ? (c.role === "viewer" ? "viewer" : "editor") : null;
}

export async function openPlanner(req: Request, payload: Payload, id: string) {
  const subject = subjectOf(req);
  if (!subject) throw new PlannerError("Please sign in again", 401);
  const doc = (await payload.findByID({ collection: "planners", id, depth: 0, overrideAccess: true }).catch(() => null)) as Doc | null;
  const role = doc ? roleFor(doc, subject) : null;
  if (!doc || !role) throw new PlannerError("You don't have access to this planner", 403);
  return { doc, role, subject };
}

export async function meta(payload: Payload, doc: Doc, role: Role) {
  const plan = (await getPlan(payload, doc.plan)) ?? (await trialPlan(payload));
  const status = effectiveStatus(doc);
  const canWrite = (role === "owner" || role === "editor") && (status === "trial" || status === "active");
  return {
    id: String(doc.id),
    names: doc.names ?? "",
    owner: doc.ownerEmail,
    role,
    status,
    canWrite,
    expiresAt: doc.expiresAt ?? null,
    daysLeft: daysLeft(doc.expiresAt),
    plan: { id: plan.id, planId: plan.planId, name: plan.name, isTrial: plan.isTrial, price: plan.price, collaborators: plan.collaborators },
    limits: plan.limits,
    counts: counts(doc.state),
    collaborators: role === "owner" || role === "support" ? (doc.collaborators ?? []).map((c: Doc) => ({ email: c.email, role: c.role ?? "editor" })) : [],
    shareToken: role === "owner" || role === "editor" ? doc.shareToken || null : null,
    rev: doc.rev ?? 0,
  };
}

const myPlannersWhere = (email: string): Where => ({ or: [{ ownerEmail: { equals: email } }, { "collaborators.email": { equals: email } }] });

export async function listMine(payload: Payload, email: string) {
  const res = await payload.find({ collection: "planners", where: myPlannersWhere(email), limit: 50, depth: 0, overrideAccess: true, select: { names: true, ownerEmail: true, collaborators: true, status: true, expiresAt: true, plan: true } });
  return Promise.all(
    res.docs.map(async (d: Doc) => ({
      id: String(d.id), names: d.names || "Our wedding", role: roleFor(d, email), status: effectiveStatus(d), plan: (await getPlan(payload, d.plan))?.name ?? "",
    })),
  );
}

/** A new planner on the free trial. One per email: more weddings need a word with us (or the admin). */
export async function createPlanner(payload: Payload, email: string, state: State, source = "") {
  const owned = await payload.count({ collection: "planners", where: { ownerEmail: { equals: email } }, overrideAccess: true });
  if (owned.totalDocs > 0) throw new PlannerError("You already have a planner. Open it from the list.", 409);
  const plan = await trialPlan(payload);
  const doc = await payload.create({
    collection: "planners",
    data: {
      ownerEmail: email, plan: plan.id, status: "trial", expiresAt: new Date(Date.now() + plan.durationDays * 864e5).toISOString(),
      state, rev: 0, names: namesOf(state), guestCount: counts(state).guests, lastActivityAt: new Date().toISOString(),
      ...(source ? { source } : {}),
    } as never,
    overrideAccess: true,
  });
  return doc as Doc;
}

const namesOf = (s: State) => {
  const st = (s.settings ?? {}) as Record<string, string>;
  return st.bride || st.groom ? `${st.bride || "Bride"} & ${st.groom || "Groom"}`.slice(0, 120) : "";
};

/* ---------- saving & sync ---------- */

/**
 * Applies a batch of changes. Uses the save number as a lock: if someone else saved in between,
 * re-read and re-apply (rows merge one by one, so nobody's edit is lost).
 */
export async function savePlanner(payload: Payload, id: string, by: string, role: Role, ops: Op[], summary?: string) {
  if (role !== "owner" && role !== "editor") throw new PlannerError("You can view this planner but not change it", 403);
  for (let attempt = 0; attempt < 6; attempt++) {
    const doc = (await payload.findByID({ collection: "planners", id, depth: 0, overrideAccess: true })) as Doc;
    const status = effectiveStatus(doc);
    if (status === "expired" || status === "suspended") {
      throw new PlannerError(status === "expired" ? "Your plan has ended, so the planner is read-only. Upgrade to keep editing." : "This planner is paused. Please contact us.", 402, { reason: status });
    }
    const before = (doc.state ?? {}) as State;
    const after = applyOps(before, ops);
    const plan = (await getPlan(payload, doc.plan)) ?? (await trialPlan(payload));
    const over = overLimit(before, after, plan.limits);
    if (over) {
      throw new PlannerError(`Your ${plan.name} plan allows ${over.limit} ${over.label.toLowerCase()}. Upgrade to add more.`, 402, { reason: "limit", limit: over });
    }
    const rev = (doc.rev ?? 0) + 1;
    const now = new Date().toISOString();
    const lock: Where = { and: [{ id: { equals: doc.id } }, doc.rev == null ? { rev: { exists: false } } : { rev: { equals: doc.rev } }] };
    const res = await payload.update({
      collection: "planners", where: lock,
      data: { state: after, rev, names: namesOf(after) || doc.names, guestCount: counts(after).guests, lastActivityAt: now } as never,
      depth: 0, overrideAccess: true,
    });
    if (!res.docs.length) continue; // someone saved first: try again on top of their version

    const replace = ops.some((o) => "replace" in o);
    let snapshot: State | null = null;
    if (Object.keys(before).length) {
      const last = await payload.find({ collection: "planner-history", where: { planner: { equals: doc.id }, hasSnapshot: { equals: true } }, sort: "-createdAt", limit: 1, depth: 0, overrideAccess: true, select: { createdAt: true } });
      const lastAt = last.docs[0] ? new Date((last.docs[0] as Doc).createdAt).getTime() : 0;
      const bulkDelete = ops.filter((o) => "c" in o && o.r === null).length >= 5;
      if (replace || bulkDelete || Date.now() - lastAt > SNAPSHOT_EVERY_MS) snapshot = before;
    }
    const opsJson = JSON.stringify(ops);
    await payload.create({
      collection: "planner-history",
      data: {
        planner: doc.id, rev, by, summary: (summary || describeOps(ops) || "Changes").slice(0, 300),
        ops: opsJson.length <= MAX_SYNC_OPS_BYTES ? ops : null, snapshot, hasSnapshot: Boolean(snapshot),
      } as never,
      overrideAccess: true,
    });
    if (rev % 25 === 0) void prune(payload, doc.id, rev).catch((e) => console.error("[planner-prune]", e));
    if (doc.invite && ops.some((o) => "replace" in o || ("c" in o && (o.c === "guests" || o.c === "functions")) || ("k" in o && o.k === "settings"))) {
      // Keep the connected wedding invite in step (guest list, functions, names, date). Loaded on demand: it imports this file.
      try {
        const { syncInvite } = await import("@/lib/invitePlanner");
        await syncInvite(payload, { ...doc, state: after, rev });
      } catch (e) {
        console.error("[planner-invite-sync]", e);
      }
    }
    return { rev };
  }
  throw new PlannerError("Lots of changes at once. Please try again.", 409);
}

async function prune(payload: Payload, plannerId: string, rev: number) {
  await payload.delete({ collection: "planner-history", where: { planner: { equals: plannerId }, rev: { less_than: rev - 2000 }, hasSnapshot: { equals: false } }, overrideAccess: true });
  const old = await payload.find({ collection: "planner-history", where: { planner: { equals: plannerId }, hasSnapshot: { equals: true } }, sort: "-createdAt", limit: 500, depth: 0, overrideAccess: true, select: { rev: true } });
  const drop = old.docs.slice(KEEP_SNAPSHOTS).map((d: Doc) => d.id);
  if (drop.length) await payload.update({ collection: "planner-history", where: { id: { in: drop } }, data: { snapshot: null, hasSnapshot: false } as never, overrideAccess: true });
}

/** What another device needs to catch up from save number `since`: the changes, or the whole planner if that's simpler. */
export async function changesSince(payload: Payload, doc: Doc, since: number) {
  const rev = doc.rev ?? 0;
  if (since === rev) return { rev, changes: [] as { rev: number; by: string; ops: Op[] }[] };
  if (since >= 0 && since < rev && rev - since <= 200) {
    const res = await payload.find({ collection: "planner-history", where: { planner: { equals: doc.id }, rev: { greater_than: since } }, sort: "rev", limit: 200, depth: 0, overrideAccess: true, select: { rev: true, by: true, ops: true } });
    const rows = res.docs as Doc[];
    if (rows.length === rev - since && rows.every((r) => Array.isArray(r.ops))) return { rev, changes: rows.map((r) => ({ rev: r.rev, by: r.by, ops: r.ops })) };
  }
  return { rev, state: doc.state ?? null };
}

export async function listHistory(payload: Payload, plannerId: string) {
  const res = await payload.find({ collection: "planner-history", where: { planner: { equals: plannerId } }, sort: "-createdAt", limit: 150, depth: 0, overrideAccess: true, select: { rev: true, by: true, summary: true, hasSnapshot: true, createdAt: true } });
  return res.docs.map((d: Doc) => ({ id: String(d.id), rev: d.rev, by: d.by, summary: d.summary, at: d.createdAt, restorable: Boolean(d.hasSnapshot) }));
}

/** Puts the planner back to how it was just before the chosen save. The restore itself is logged, so it can be undone too. */
export async function restore(payload: Payload, plannerId: string, by: string, role: Role, historyId: string) {
  const h = (await payload.findByID({ collection: "planner-history", id: historyId, depth: 0, overrideAccess: true }).catch(() => null)) as Doc | null;
  const hp = h && (typeof h.planner === "object" ? h.planner?.id : h.planner);
  if (!h || String(hp) !== String(plannerId) || !h.hasSnapshot || !h.snapshot) throw new PlannerError("That restore point is no longer available", 404);
  const when = new Date(h.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  return savePlanner(payload, plannerId, by, role, [{ replace: h.snapshot }], `Restored to how it was on ${when}`);
}

/* ---------- collaborators ---------- */

export async function addCollaborator(payload: Payload, doc: Doc, rawEmail: unknown, rawRole: unknown) {
  const email = normEmail(rawEmail);
  if (!validEmail(email)) throw new PlannerError("Please enter a valid email");
  if (email === normEmail(doc.ownerEmail)) throw new PlannerError("That's the owner's own email");
  const status = effectiveStatus(doc);
  if (status === "expired" || status === "suspended") throw new PlannerError("Renew your plan to invite family members", 402, { reason: status });
  const plan = (await getPlan(payload, doc.plan)) ?? (await trialPlan(payload));
  const list = (doc.collaborators ?? []) as Doc[];
  if (list.some((c) => normEmail(c.email) === email)) throw new PlannerError("They already have access");
  if (list.length >= plan.collaborators) {
    throw new PlannerError(
      plan.collaborators === 0 ? `Inviting family members comes with a paid plan. Upgrade to plan together.` : `Your ${plan.name} plan allows ${plan.collaborators} family member${plan.collaborators === 1 ? "" : "s"}. Upgrade to invite more.`,
      402, { reason: "collaborators", limit: plan.collaborators },
    );
  }
  const role = rawRole === "viewer" ? "viewer" : "editor";
  const collaborators = [...list.map((c) => ({ email: c.email, role: c.role, addedAt: c.addedAt })), { email, role, addedAt: new Date().toISOString() }];
  await payload.update({ collection: "planners", id: doc.id, data: { collaborators } as never, overrideAccess: true });
  const who = doc.names || "a wedding";
  await sendWithBrevo({
    to: [{ email }],
    subject: `You're invited to plan ${who} 💐`,
    html: emailShell(`<h2 style="margin:0 0 8px;color:#3B1F4A">Join the wedding planner</h2>
      <p>${esc(doc.ownerEmail)} added you to the planner for <b>${esc(who)}</b>, so you can ${role === "viewer" ? "see" : "help with"} guests, budget, vendors and more.</p>
      <p>${button(`${siteUrl()}/planner`, "Open the planner")}</p>
      <p style="font-size:13px;color:#666">Sign in with this email address (${esc(email)}). We'll send you a code, no password needed.</p>`),
  }).catch((e) => console.error("[planner-invite-email]", e));
  return collaborators;
}

export async function removeCollaborator(payload: Payload, doc: Doc, rawEmail: unknown) {
  const email = normEmail(rawEmail);
  const collaborators = ((doc.collaborators ?? []) as Doc[]).filter((c) => normEmail(c.email) !== email).map((c) => ({ email: c.email, role: c.role, addedAt: c.addedAt }));
  await payload.update({ collection: "planners", id: doc.id, data: { collaborators } as never, overrideAccess: true });
  return collaborators;
}

/* ---------- run sheet link ---------- */

/** Turns the view-only run sheet link on (a new random code if there is none) or off. */
export async function setShareLink(payload: Payload, doc: Doc, role: Role, onOff: boolean) {
  if (role !== "owner" && role !== "editor") throw new PlannerError("Only the owner or an editor can share the run sheet", 403);
  const status = effectiveStatus(doc);
  if (onOff && (status === "expired" || status === "suspended")) throw new PlannerError("Renew your plan to share the run sheet", 402, { reason: status });
  const shareToken = onOff ? doc.shareToken || randomBytes(15).toString("base64url") : null;
  await payload.update({ collection: "planners", id: doc.id, data: { shareToken } as never, depth: 0, overrideAccess: true });
  return { shareToken };
}

/** The run sheet behind a link, or null when the link is off, unknown or the planner is paused. */
export async function sharedRunSheet(payload: Payload, token: string) {
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(token)) return null;
  const res = await payload.find({ collection: "planners", where: { shareToken: { equals: token } }, limit: 1, depth: 0, overrideAccess: true, select: { state: true, status: true, expiresAt: true } });
  const doc = res.docs[0] as Doc | undefined;
  if (!doc || effectiveStatus(doc) === "suspended") return null;
  return runSheetView(doc.state as State);
}

/* ---------- payments ---------- */

/** Price for a planner plan (or the Planner + Invite bundle) after an optional code. */
export async function quotePlan(payload: Payload, plan: PlanView, coupon?: string, opts: { bundle?: boolean } = {}) {
  if (!coupon) return { total: plan.price, discount: 0 };
  // Planner-only fixed ₹ codes (Admin → Planner landing page & promo codes) come first.
  const g = (await payload.findGlobal({ slug: "planner-landing" as never, depth: 0, overrideAccess: true }).catch(() => null)) as Doc | null;
  const own = (g?.promoCodes ?? []).find((c: Doc) => String(c.code ?? "").toUpperCase() === coupon.toUpperCase());
  if (own) {
    if (!own.active || (own.validUntil && new Date(own.validUntil).getTime() < Date.now())) return { total: plan.price, discount: 0, error: "That code has expired" };
    const total = Math.max(1, plan.price - Math.max(0, Math.round(Number(own.amountOff) || 0))); // Razorpay needs at least ₹1
    return { total, discount: plan.price - total };
  }
  // Coupon & affiliate codes (Admin → Shop → Coupon & affiliate codes): %, flat ₹ or a special price, per plan.
  const target = opts.bundle ? ({ kind: "bundle", name: "the Planner + Invite bundle" } as const) : ({ kind: "planner", id: plan.id, name: `the ${plan.name} plan` } as const);
  const q = await quoteWithCode(payload, coupon, target, plan.price);
  return q.error ? { total: plan.price, discount: 0, error: q.error } : { total: q.total, discount: q.discount, label: q.label };
}

/** Applies a confirmed Razorpay payment: switches the plan and extends validity. Safe to call twice (checkout page + webhook). */
export async function markPlannerPaid(payload: Payload, orderId: string, paymentId?: string) {
  const found = await payload.find({ collection: "planners", where: { orderId: { equals: orderId } }, limit: 1, depth: 0, overrideAccess: true });
  const doc = found.docs[0] as Doc | undefined;
  if (!doc) return { found: false as const };
  if (doc.orderPaid) return { found: true as const, alreadyPaid: true };
  const plan = await getPlan(payload, doc.orderPlan);
  if (!plan) return { found: true as const, alreadyPaid: false, error: "plan missing" };
  const prevPlan = typeof doc.plan === "object" ? doc.plan?.id : doc.plan;
  const expires = newExpiry({ expiresAt: doc.expiresAt, status: doc.status, plan: String(prevPlan) }, plan.id, plan.durationDays);
  const res = await payload.update({
    collection: "planners",
    where: { and: [{ orderId: { equals: orderId } }, { orderPaid: { not_equals: true } }] },
    data: { plan: plan.id, status: "paid", paidAt: new Date().toISOString(), expiresAt: expires.toISOString(), amount: doc.orderAmount, orderPaid: true, ...(paymentId ? { paymentId } : {}) } as never,
    depth: 0, overrideAccess: true,
  });
  if (!res.docs.length) return { found: true as const, alreadyPaid: true };
  let bundleNote = "";
  if (doc.orderBundle) {
    // Planner + Invite bundle: the wedding invite goes live on Premium too.
    try {
      const { grantBundleInvite, inviteUrl } = await import("@/lib/invitePlanner");
      const inv = await grantBundleInvite(payload, doc);
      bundleNote = `<p>Your <b>wedding invite</b> is live on Premium too: <a href="${inviteUrl(inv.slug)}">${inviteUrl(inv.slug)}</a>. Open it from the planner's dashboard to finish the design.</p>`;
    } catch (e) {
      console.error("[planner-bundle-invite]", e);
    }
  }
  await sendWithBrevo({
    to: [{ email: doc.ownerEmail }],
    subject: `Your ${plan.name} plan is active 🎉`,
    html: emailShell(`<h2 style="margin:0 0 8px;color:#3B1F4A">Thank you!</h2><p>Your wedding planner is now on the <b>${esc(plan.name)}</b> plan, valid until <b>${expires.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</b>.</p>
      ${plan.collaborators ? `<p>You can now invite up to ${plan.collaborators} family members from <b>Sharing</b> in the planner.</p>` : ""}${bundleNote}<p>${button(`${siteUrl()}/planner`, "Open my planner")}</p>`),
  }).catch((e) => console.error("[planner-paid-email]", e));
  return { found: true as const, alreadyPaid: false };
}
