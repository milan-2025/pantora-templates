import "server-only";
import { randomBytes, timingSafeEqual } from "crypto";
import type { Payload } from "payload";
import { sendWithBrevo } from "@/lib/brevo";
import { applyPromo, findAffiliate } from "@/lib/pricing";
import type { Invite } from "@/payload-types";

/** Wedding invite plans. Prices are in rupees, incl. GST, and always come from here (never from the browser). */
export const INVITE_PLANS = {
  basic: { name: "Basic", price: 799 },
  premium: { name: "Premium", price: 1999 },
  royal: { name: "Royal", price: 3999 },
} as const;
export type PlanId = keyof typeof INVITE_PLANS;
export const PLAN_IDS = Object.keys(INVITE_PLANS) as [PlanId, ...PlanId[]];

const RESERVED = new Set(["admin", "api", "demo", "test", "shaadi", "wedding", "studio"]);
export const isReservedSlug = (s: string) => RESERVED.has(s);
export const slugify = (s: unknown) =>
  String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
export const randomSuffix = () => randomBytes(2).toString("hex");
export const newToken = () => randomBytes(16).toString("hex");

export type InviteState = Record<string, unknown>;

/** The design the editor sends, minus things the browser must not decide (payment state, local-only files). */
export function cleanState(input: unknown): InviteState | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const o = { ...(input as InviteState) };
  for (const k of ["paid", "plan", "au", "fin", "code"]) delete o[k];
  // Vercel rejects request bodies over 4.5 MB anyway; keep well under it.
  if (JSON.stringify(o).length > 3_000_000) return null;
  return o;
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

/** Price for a plan after an optional promo/affiliate code (the same codes the shop uses). */
export async function quoteFor(payload: Payload, plan: PlanId, coupon?: string) {
  const base = INVITE_PLANS[plan].price;
  if (!coupon) return { total: base, discount: 0 };
  const affiliate = await findAffiliate(payload, coupon);
  if (!affiliate) return { total: base, discount: 0, error: "That code isn’t valid" };
  return applyPromo(base, affiliate);
}

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function sendInviteLiveEmail(invite: Invite) {
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
      <p style="font-size:13px;color:#666">Your plan is valid for 12 months.</p></div></div></body></html>`,
  });
}

/**
 * Marks an invite paid once its Razorpay order is confirmed, and emails the couple.
 * Safe to call more than once (the verify route and Razorpay's webhook both call it).
 */
export async function markInvitePaid(payload: Payload, orderId: string, paymentId?: string) {
  const found = await payload.find({ collection: "invites", where: { orderId: { equals: orderId } }, limit: 1, depth: 0, overrideAccess: true });
  const existing = found.docs[0];
  if (!existing) return { found: false as const };
  if (existing.paymentStatus === "paid") return { found: true as const, alreadyPaid: true };

  const expires = new Date();
  expires.setMonth(expires.getMonth() + 12);
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
  await sendInviteLiveEmail(invite).catch((e) => console.error("[invite-email]", e));
  return { found: true as const, alreadyPaid: false };
}
