/**
 * Coupon & affiliate codes: which deal a code gives on which product, and what that does to the price.
 * Pure functions (no database), shared by the shop checkout, the planner, the invite maker and the workout app.
 *
 * A code either works on everything (with one % or flat ₹ deal) or only on listed products. Either way it can list
 * product deals: a %, a flat ₹ amount or a special price for one product or plan (or a whole group of them).
 * The most specific matching deal wins: a deal for that exact product, then a deal for its whole group,
 * then the "deal on everything".
 */

export type DiscountType = "percent" | "flat" | "price";
export type Deal = { type: DiscountType; value: number };

/** What is being bought. Ids are Payload document ids. */
export type CouponTarget =
  | { kind: "shop"; id: string; name?: string }
  | { kind: "planner"; id: string; name?: string }
  | { kind: "bundle"; name?: string }
  | { kind: "invite"; plan: string; name?: string }
  | { kind: "workout"; id: string; name?: string }
  | { kind: "photos"; plan: string; name?: string };

type Rel = string | { id?: string | null } | null | undefined;
export type ProductDealRow = {
  kind?: string | null;
  shopProduct?: Rel;
  plannerPlan?: Rel;
  invitePlan?: string | null;
  workoutPlan?: Rel;
  photosPlan?: string | null;
  type?: string | null;
  value?: number | null;
};

/** The fields of a code (Affiliates collection) that decide its deals. */
export type CouponCode = {
  code: string;
  appliesTo?: string | null;
  discountType?: string | null;
  discountPercent?: number | null;
  discountAmount?: number | null;
  productDeals?: ProductDealRow[] | null;
  active?: boolean | null;
  validUntil?: string | null;
};

const relId = (r: Rel) => (r && typeof r === "object" ? (r.id ?? null) : (r ?? null));
const isType = (t: unknown): t is DiscountType => t === "percent" || t === "flat" || t === "price";

/** Whether the code may be used now (active and not past its end date). */
export function isUsable(code: Pick<CouponCode, "active" | "validUntil">, now = new Date()) {
  if (code.active === false) return false;
  if (code.validUntil && new Date(code.validUntil).getTime() < now.getTime()) return false;
  return true;
}

/** The "deal on everything" (only when the code works on everything). Old codes are a plain %. */
export function defaultDeal(code: CouponCode): Deal | null {
  if ((code.appliesTo ?? "all") !== "all") return null;
  if (code.discountType === "flat") return { type: "flat", value: Math.max(0, Math.round(code.discountAmount ?? 0)) };
  return { type: "percent", value: Math.min(99, Math.max(0, code.discountPercent ?? 0)) };
}

/** How well a product-deal row matches: 2 = this exact product, 1 = its whole group, 0 = no match. */
function matchScore(row: ProductDealRow, t: CouponTarget): number {
  if (row.kind !== t.kind) return 0;
  switch (t.kind) {
    case "shop": {
      const id = relId(row.shopProduct);
      return !id ? 1 : String(id) === String(t.id) ? 2 : 0;
    }
    case "planner": {
      const id = relId(row.plannerPlan);
      return !id ? 1 : String(id) === String(t.id) ? 2 : 0;
    }
    case "workout": {
      const id = relId(row.workoutPlan);
      return !id ? 1 : String(id) === String(t.id) ? 2 : 0;
    }
    case "invite":
      return !row.invitePlan ? 1 : row.invitePlan === t.plan ? 2 : 0;
    case "photos":
      return !row.photosPlan ? 1 : row.photosPlan === t.plan ? 2 : 0;
    case "bundle":
      return 2;
  }
}

/**
 * The deal this code gives on a product, or null when the code doesn't cover it.
 * `fromDefault` is true when it comes from the "deal on everything" rather than a product deal.
 */
export function dealFor(code: CouponCode, target: CouponTarget): (Deal & { fromDefault: boolean }) | null {
  let best: { score: number; deal: Deal } | null = null;
  for (const row of code.productDeals ?? []) {
    if (!isType(row.type) || row.value == null || !(row.value >= 0)) continue;
    const score = matchScore(row, target);
    if (score > (best?.score ?? 0)) best = { score, deal: { type: row.type, value: row.value } };
  }
  if (best) return { ...best.deal, fromDefault: false };
  const d = defaultDeal(code);
  return d ? { ...d, fromDefault: true } : null;
}

/**
 * The price after a deal. Razorpay can't take payments under ₹1, so at least ₹1 is always left to pay.
 * `fullPrice` is the product's own price when `amount` is only part of it (an invite upgrade pays the
 * difference): a special price then sets the new full price, and the customer pays the rest of the difference.
 */
export function applyDeal(amount: number, deal: Deal | null, fullPrice = amount): { discount: number; total: number } {
  if (!deal || !(amount > 0)) return { discount: 0, total: Math.max(0, amount) };
  let off = 0;
  if (deal.type === "percent") off = Math.round((amount * Math.min(99, Math.max(0, deal.value))) / 100);
  else if (deal.type === "flat") off = Math.round(Math.max(0, deal.value));
  else off = Math.max(0, Math.round(fullPrice - Math.max(1, deal.value)));
  const total = Math.max(1, amount - Math.min(off, amount));
  return { discount: amount - total, total };
}

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

/** Short text for a deal, e.g. "20% off", "₹500 off", "special price ₹499". */
export function dealLabel(deal: Deal | null | undefined) {
  if (!deal) return "";
  if (deal.type === "percent") return `${deal.value}% off`;
  if (deal.type === "flat") return `${inr(deal.value)} off`;
  return `special price ${inr(deal.value)}`;
}

/**
 * The full price check for one product: the deal, the price after it, and a message when the code can't be used.
 */
export function priceWithCode(
  code: CouponCode | null,
  target: CouponTarget,
  amount: number,
  fullPrice = amount,
): { discount: number; total: number; deal: Deal | null; label: string; error?: string } {
  if (!code) return { discount: 0, total: amount, deal: null, label: "", error: "That code isn’t valid" };
  const deal = dealFor(code, target);
  if (!deal) {
    const what = target.name ? ` on ${target.name}` : target.kind === "shop" ? " on this product" : " on this plan";
    return { discount: 0, total: amount, deal: null, label: "", error: `That code doesn’t work${what}` };
  }
  const q = applyDeal(amount, deal, fullPrice);
  const clean: Deal = { type: deal.type, value: deal.value };
  return { ...q, deal: clean, label: dealLabel(clean) };
}
