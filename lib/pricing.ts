import type { Payload } from "payload";
import type { Affiliate, Product } from "@/payload-types";

/**
 * The single source of truth for what a customer pays. Always runs on the server.
 * The offer price is the same for every visitor; it either has no end, or ends for everyone
 * at a fixed date (after which checkout charges the regular price).
 */
export type OfferState = {
  active: boolean;
  regularPrice: number;
  /** Price before any promo code (the offer price while the offer is active). */
  price: number;
  /** Fixed end date of the offer price, if it has one. */
  endsAt: string | null;
  showCountdown: boolean;
};

export type OfferContext = {
  /** When this visitor's quick-order bonus window started (from the signed cookie), if it has. */
  visitorStart?: number | null;
  now?: Date;
};

export async function getOfferState(_payload: Payload, product: Product, ctx: OfferContext = {}): Promise<OfferState> {
  const o = product.offer ?? {};
  const now = ctx.now ?? new Date();
  const regularPrice = product.price;
  const endsAt = o.mode === "endDate" && o.endsAt ? new Date(o.endsAt) : null;
  const base: OfferState = {
    active: false,
    regularPrice,
    price: regularPrice,
    endsAt: endsAt?.toISOString() ?? null,
    showCountdown: Boolean(o.showCountdown) && Boolean(endsAt),
  };

  const configured = o.enabled && o.price != null && o.price < regularPrice;
  if (!configured) return base;
  if (endsAt && endsAt <= now) return base;
  return { ...base, active: true, price: o.price! };
}

/**
 * Quick-order bonus: a free extra for visitors who order within N minutes of their first visit.
 * The price never changes; only whether the bonus is included.
 */
export type BonusState = {
  active: boolean;
  title: string;
  /** When this visitor's window closes. Null for a first-time visitor whose window starts on page load. */
  endsAt: string | null;
};

export function getBonusState(product: Product, ctx: OfferContext = {}): BonusState | null {
  const b = product.bonus ?? {};
  if (!b.enabled || !b.title || (!b.file && !b.link)) return null;
  const now = ctx.now ?? new Date();
  if (!ctx.visitorStart) return { active: true, title: b.title, endsAt: null };
  const endsAt = new Date(ctx.visitorStart + (b.minutes ?? 15) * 60_000);
  return { active: endsAt > now, title: b.title, endsAt: endsAt.toISOString() };
}

export type Quote = {
  offer: OfferState;
  /** The quick-order bonus, if one is running (active = this order would include it). */
  bonus: BonusState | null;
  listPrice: number;
  discount: number;
  total: number;
  affiliate: Affiliate | null;
  promoCode: string | null;
  /** Set when a code was given but isn't valid. */
  codeError: string | null;
  commission: number;
};

export async function getQuote(
  payload: Payload,
  product: Product,
  rawCode?: string | null,
  ctx: OfferContext = {},
): Promise<Quote> {
  const offer = await getOfferState(payload, product, ctx);
  const listPrice = offer.price;
  const code = rawCode?.trim().toUpperCase() || null;

  let affiliate: Affiliate | null = null;
  let codeError: string | null = null;
  if (code) {
    const res = await payload.find({
      collection: "affiliates",
      where: { code: { equals: code }, active: { equals: true } },
      limit: 1,
      depth: 0,
    });
    affiliate = res.docs[0] ?? null;
    if (!affiliate) codeError = "This code isn't valid";
  }

  const discount = affiliate ? Math.round((listPrice * (affiliate.discountPercent ?? 0)) / 100) : 0;
  // Razorpay can't take payments under ₹1, so even a 99% discount leaves at least ₹1 to pay.
  const total = Math.max(listPrice > 0 ? 1 : 0, listPrice - discount);
  const commission = affiliate ? Math.round((total * (affiliate.commissionPercent ?? 0)) / 100) : 0;

  const bonus = getBonusState(product, ctx);
  return { offer, bonus, listPrice, discount, total, affiliate, promoCode: affiliate ? code : null, codeError, commission };
}
