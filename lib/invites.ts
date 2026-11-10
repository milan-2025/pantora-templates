import "server-only";
import { randomBytes, timingSafeEqual } from "crypto";
import type { Payload } from "payload";
import { sendWithBrevo } from "@/lib/brevo";
import { applyPromo, findAffiliate } from "@/lib/pricing";
import type { Invite } from "@/payload-types";

import { DEFAULT_PLANS, PLAN_ORDER, type PlanId } from "@/lib/invitePlanDefaults";

export type { PlanId };
export const PLAN_IDS = [...PLAN_ORDER] as [PlanId, ...PlanId[]];
export const planRank = (p?: string | null) => (p ? PLAN_ORDER.indexOf(p as PlanId) : -1);

export type Plan = { id: PlanId; name: string; price: number; tagline: string; badge: string; features: string[] };
export type Reminders = { enabled: boolean; afterHours: number; promoCode: string; message: string };
export type PlanConfig = { plans: Plan[]; banner: string; months: number; reminders: Reminders };

/** Plans and prices: the admin-editable "Invite plans & prices" global, falling back to the built-in defaults. */
export async function getPlanConfig(payload: Payload): Promise<PlanConfig> {
  type Row = { planId?: string | null; name?: string | null; price?: number | null; tagline?: string | null; badge?: string | null; features?: { text?: string | null }[] | null };
  const doc = (await payload.findGlobal({ slug: "invite-plans", depth: 0 }).catch(() => null)) as
    | { banner?: string | null; validityMonths?: number | null; plans?: Row[] | null; reminderEnabled?: boolean | null; reminderAfterHours?: number | null; reminderPromoCode?: string | null; reminderMessage?: string | null }
    | null;
  const plans: Plan[] = DEFAULT_PLANS.map((d) => {
    const row = doc?.plans?.find((r) => r.planId === d.planId);
    const feats = (row?.features ?? []).map((f) => f.text?.trim() ?? "").filter(Boolean);
    return {
      id: d.planId,
      name: row?.name?.trim() || d.name,
      price: row?.price && row.price > 0 ? Math.round(row.price) : d.price,
      tagline: row ? (row.tagline ?? "") : d.tagline,
      badge: row ? (row.badge ?? "") : d.badge,
      features: feats.length ? feats : d.features.map((f) => f.text),
    };
  });
  return {
    plans,
    banner: doc?.banner?.trim() ?? "",
    months: doc?.validityMonths && doc.validityMonths > 0 ? doc.validityMonths : 12,
    reminders: {
      enabled: Boolean(doc?.reminderEnabled),
      afterHours: doc?.reminderAfterHours && doc.reminderAfterHours > 0 ? doc.reminderAfterHours : 24,
      promoCode: doc?.reminderPromoCode?.trim().toUpperCase() ?? "",
      message: doc?.reminderMessage?.trim() ?? "",
    },
  };
}

const RESERVED = new Set(["admin", "api", "demo", "test", "shaadi", "wedding", "studio"]);
export const isReservedSlug = (s: string) => RESERVED.has(s);
export const slugify = (s: unknown) =>
  String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
export const randomSuffix = () => randomBytes(2).toString("hex");
export const newToken = () => randomBytes(16).toString("hex");

export type InviteState = Record<string, unknown>;

export type Guest = { n: string; p: string; g: string; s?: number; r?: number };
const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/** Photos/videos may only be our own Cloudinary uploads (or small legacy inline images). */
function mediaOk(u: unknown) {
  if (typeof u !== "string") return false;
  if (u.startsWith("data:image/")) return true;
  const cloud = process.env.CLOUDINARY_URL?.split("@")[1]?.trim();
  return Boolean(cloud && u.startsWith(`https://res.cloudinary.com/${cloud}/`));
}

/** The design the editor sends, minus things the browser must not decide (payment state, local-only files). */
export function cleanState(input: unknown): InviteState | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const o = { ...(input as InviteState) };
  for (const k of ["paid", "plan", "au", "fin", "code"]) delete o[k];
  if (Array.isArray(o.ph)) o.ph = o.ph.filter(mediaOk).slice(0, 14);
  if (Array.isArray(o.gu)) {
    o.gu = (o.gu as Record<string, unknown>[]).slice(0, 600).map((g) => ({
      n: str(g.n, 80),
      p: String(g.p ?? "").replace(/[^\d+]/g, "").slice(0, 16),
      g: str(g.g, 30),
      ...(g.s ? { s: Number(g.s) || 1 } : {}),
      ...(g.r ? { r: Number(g.r) || 1 } : {}),
    })).filter((g) => g.n);
  }
  if (Array.isArray(o.grp)) o.grp = (o.grp as unknown[]).map((x) => str(x, 30)).filter(Boolean).slice(0, 12);
  // Vercel rejects request bodies over 4.5 MB anyway; keep well under it.
  if (JSON.stringify(o).length > 3_000_000) return null;
  return o;
}

/** URL-safe guest slugs; duplicate names get -2, -3 … (the editor builds the same ones). */
export function guestSlugs(gu: { n: string }[]) {
  const seen: Record<string, number> = {};
  return gu.map((g) => {
    const base = slugify(g.n) || "guest";
    seen[base] = (seen[base] ?? 0) + 1;
    return seen[base] > 1 ? `${base}-${seen[base]}` : base;
  });
}

/**
 * What guests may see: no guest list, no phone numbers, and only the events they are invited to.
 * A guest link shows that guest's events and greets them; the plain link shows events open to everyone.
 */
export function publicView(state: InviteState, guestSlug?: string | null) {
  const gu = (Array.isArray(state.gu) ? state.gu : []) as Guest[];
  const idx = guestSlug ? guestSlugs(gu).indexOf(guestSlug) : -1;
  const guest = idx >= 0 ? gu[idx] : null;
  const events = ((Array.isArray(state.ev) ? state.ev : []) as { a?: string[] }[]).filter((e) => {
    const a = Array.isArray(e.a) ? e.a : [];
    return a.length === 0 || (guest !== null && a.includes(guest.g));
  });
  const out: InviteState = { ...state, ev: events };
  for (const k of ["gu", "gl", "grp", "gst", "dom", "wm"]) delete out[k];
  if (guest) out.gst = guest.n;
  return { state: out, guest: guest ? { n: guest.n, g: guest.g } : null };
}

export const coupleNames = (st: InviteState) => `${String(st.b ?? "")} & ${String(st.g ?? "")}`.slice(0, 190);

export async function findInvite(payload: Payload, slug: string) {
  const res = await payload.find({ collection: "invites", where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true });
  return res.docs[0] ?? null;
}

export const isLive = (i: Pick<Invite, "paymentStatus" | "expiresAt"> | null | undefined) =>
  Boolean(i && i.paymentStatus === "paid" && (!i.expiresAt || new Date(i.expiresAt) > new Date()));

/** The invite, if the request carries its private edit token. */
export async function authorize(req: Request, payload: Payload, slug: string) {
  const invite = await findInvite(payload, slug);
  const given = Buffer.from(req.headers.get("x-edit-token") ?? "");
  const real = Buffer.from(invite?.editToken ?? "");
  if (!invite || real.length === 0 || given.length !== real.length || !timingSafeEqual(given, real)) return null;
  return invite;
}

/** Price for a plan after an optional promo/affiliate code. `from` = the plan the couple already paid for (upgrades pay the difference). */
export async function quoteFor(payload: Payload, plan: PlanId, coupon?: string, from?: string | null) {
  const { plans } = await getPlanConfig(payload);
  const target = plans.find((p) => p.id === plan)!;
  let base = target.price;
  if (from) {
    if (planRank(from) >= planRank(plan)) return { total: 0, discount: 0, error: "You already have this plan or a higher one" };
    base = Math.max(1, target.price - (plans.find((p) => p.id === from)?.price ?? 0));
  }
  if (!coupon) return { total: base, discount: 0, name: target.name };
  const affiliate = await findAffiliate(payload, coupon);
  if (!affiliate) return { total: base, discount: 0, name: target.name, error: "That code isn’t valid" };
  return { ...applyPromo(base, affiliate), name: target.name };
}

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function sendInviteLiveEmail(invite: Invite, months: number) {
  if (!invite.contactEmail || !invite.editToken) return;
  const live = `${siteUrl()}/i/${invite.slug}`;
  const edit = `${siteUrl()}/shaadi?edit=${invite.slug}.${invite.editToken}`;
  await sendWithBrevo({
    to: [{ email: invite.contactEmail }],
    subject: "Your wedding invite is live 💍",
    html: `<!doctype html><html><body style="margin:0;background:#FBF5EA;font-family:Arial,Helvetica,sans-serif;color:#2A2A2A"><div style="max-width:520px;margin:0 auto;padding:32px 20px"><div style="background:#FFFDF8;border:1px solid #EBE2EF;border-radius:24px;padding:28px">
      <h2 style="margin:0 0 8px">Congratulations${invite.names ? ", " + esc(invite.names) : ""}!</h2>
      <p>Your invite is live. Share this link with your guests:</p>
      <p><a href="${live}" style="font-weight:600">${live}</a></p>
      <p>Need to change something? Edit anytime, the link stays the same. Keep this private link safe, anyone with it can edit your invite:</p>
      <p><a href="${edit}" style="display:inline-block;padding:12px 20px;background:#3B1F4A;color:#fff;border-radius:999px;text-decoration:none;font-weight:600">Edit my invite</a></p>
      <p style="font-size:13px;color:#666">Your plan is valid for ${months} months.</p></div></div></body></html>`,
  });
}

/**
 * Marks an invite paid once its Razorpay order is confirmed, and emails the couple.
 * Also handles upgrades (a paid invite buying a higher plan). Safe to call more than once
 * (the verify route and Razorpay's webhook both call it).
 */
export async function markInvitePaid(payload: Payload, orderId: string, paymentId?: string) {
  const found = await payload.find({ collection: "invites", where: { orderId: { equals: orderId } }, limit: 1, depth: 0, overrideAccess: true });
  const existing = found.docs[0];
  if (!existing) return { found: false as const };

  if (existing.paymentStatus === "paid") {
    const next = existing.orderPlan;
    if (!next || planRank(next) <= planRank(existing.plan)) return { found: true as const, alreadyPaid: true };
    await payload.update({ collection: "invites", id: existing.id, data: { plan: next, ...(paymentId ? { paymentId } : {}) }, depth: 0, overrideAccess: true });
    return { found: true as const, alreadyPaid: false, upgraded: true };
  }

  const { months } = await getPlanConfig(payload);
  const expires = new Date();
  expires.setMonth(expires.getMonth() + months);
  const updated = await payload.update({
    collection: "invites",
    where: { orderId: { equals: orderId }, paymentStatus: { not_equals: "paid" } },
    data: {
      paymentStatus: "paid",
      plan: existing.orderPlan ?? "basic",
      paidAt: new Date().toISOString(),
      expiresAt: expires.toISOString(),
      ...(paymentId ? { paymentId } : {}),
    },
    depth: 0,
    overrideAccess: true,
  });
  const invite = updated.docs[0];
  if (!invite) return { found: true as const, alreadyPaid: true };
  await sendInviteLiveEmail(invite, months).catch((e) => console.error("[invite-email]", e));
  return { found: true as const, alreadyPaid: false };
}
