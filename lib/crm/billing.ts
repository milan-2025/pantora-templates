/**
 * LeadFlow CRM billing: a company admin picks Starter or Growth for 1, 3, 6 or 12 months, pays with Razorpay
 * inside the CRM, and the plan switches on by itself (no manual step). Used by app/api/crm/route.ts
 * (billing, billing_checkout, billing_verify) and by the Razorpay webhook, which confirms the payment even if
 * the buyer closes the tab.
 *
 * Prices are per company per month (not per user). Paying again extends the plan from its current end date,
 * so renewing early never loses days. Same prices for LeadFlow CRM and LeadFlow for Real Estate.
 */
import { getPayloadClient } from "@/lib/cms/queries";
import { sendWithBrevo } from "@/lib/brevo";

export const CRM_PRICES = {
  starter: { name: "Starter", perMonth: 249, users: 3, leads: 2000 },
  growth: { name: "Growth", perMonth: 449, users: 10, leads: 10000 },
} as const;
export type PaidPlan = keyof typeof CRM_PRICES;
export const BILLING_MONTHS = [1, 3, 6, 12] as const;

export class BillingError extends Error {}

/** What a plan costs for a number of months (₹, whole rupees). Rejects anything not on the price list. */
export function quoteCrm(plan: unknown, months: unknown): { plan: PaidPlan; months: number; total: number; name: string } {
  if (typeof plan !== "string" || !(plan in CRM_PRICES)) throw new BillingError("Pick Starter or Growth");
  const m = Number(months);
  if (!(BILLING_MONTHS as readonly number[]).includes(m)) throw new BillingError("Pick 1, 3, 6 or 12 months");
  const p = CRM_PRICES[plan as PaidPlan];
  return { plan: plan as PaidPlan, months: m, total: p.perMonth * m, name: p.name };
}

/** The new end date: `months` calendar months after today, or after the current paid end date if that is later. */
export function extendUntil(current: number | null | undefined, months: number, now = Date.now()): number {
  const from = new Date(Math.max(now, Number(current) || 0));
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  // 31 Jan + 1 month would roll over to early March; stop at the end of the target month instead.
  if (d.getDate() !== from.getDate()) d.setDate(0);
  return d.getTime();
}

type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function wsCollection() {
  const db = (await getPayloadClient()).db.connection.db as Doc;
  return { ws: db.collection("crm_workspaces"), users: db.collection("crm_users") };
}

const fmtDate = (t: number) => new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

/**
 * Switches the plan on for the company that owns this Razorpay order. Safe to call twice (from the app and
 * the webhook): the second call finds the order already applied and changes nothing.
 */
export async function markCrmPaid(orderId: string, paymentId?: string): Promise<{ found: boolean; alreadyPaid?: boolean }> {
  if (!orderId) return { found: false };
  const c = await wsCollection();
  const w = await c.ws.findOne({ "billing.orderId": orderId });
  if (!w) return { found: false };
  const b = w.billing as { orderId: string; plan: PaidPlan; months: number; amount: number; by?: string };
  if ((w.paidOrders ?? []).includes(orderId)) return { found: true, alreadyPaid: true };
  const plan = CRM_PRICES[b.plan];
  if (!plan) {
    console.error("[crm] paid order with unknown plan", orderId);
    return { found: true };
  }
  const current = w.plan === "starter" || w.plan === "growth" ? w.validUntil : null;
  const validUntil = extendUntil(current, b.months);
  // The condition makes the update itself the guard against two confirmations racing each other.
  const res = await c.ws.updateOne(
    { _id: w._id, paidOrders: { $ne: orderId } },
    {
      $set: { plan: b.plan, validUntil, status: "active" },
      $push: { paidOrders: orderId, payments: { orderId, paymentId: paymentId ?? "", plan: b.plan, months: b.months, amount: b.amount, at: Date.now(), until: validUntil } },
    },
  );
  if (!(res.modifiedCount ?? res.matchedCount)) return { found: true, alreadyPaid: true };
  const owner = b.by ? await c.users.findOne({ _id: b.by }) : await c.users.findOne({ ws: w._id, role: "admin" });
  if (owner?.email) {
    await sendWithBrevo({
      to: [{ email: owner.email, name: owner.name }],
      subject: `LeadFlow ${plan.name} is active`,
      html: `<p>Hi ${String(owner.name || "").split(" ")[0] || "there"},</p><p>Thank you! <b>${plan.name}</b> is now active for <b>${String(w.name || "your company")}</b> until <b>${fmtDate(validUntil)}</b>.</p><p>Amount paid: ₹${b.amount.toLocaleString("en-IN")} for ${b.months} month${b.months === 1 ? "" : "s"}${paymentId ? ` (payment ${paymentId})` : ""}.</p><p><a href="${(process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")}/CRM/">Open LeadFlow</a></p>`,
      text: `${plan.name} is active until ${fmtDate(validUntil)}. Amount paid: ₹${b.amount} for ${b.months} month(s).`,
    }).catch((e) => console.error("[crm] receipt email", e));
  }
  return { found: true, alreadyPaid: false };
}
