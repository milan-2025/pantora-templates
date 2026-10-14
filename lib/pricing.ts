import type { Payload } from "payload";
import type { Affiliate, Product } from "@/payload-types";

/**
 * The single source of truth for what a customer pays. Always runs on the server.
 * An offer either ends for everyone at a fixed date, or ends for each visitor a set number of
 * minutes after their first visit (see lib/offerWindow.ts). After that, checkout charges the regular price.
 */
export type OfferState = {
  active: boolean;
  regularPrice: number;
  /** Price before any promo code (the offer price while the offer is active). */
  price: number;
  /** When the offer ends for this visitor. Null for a first-time visitor whose timer hasn't started yet. */
  endsAt: string | null;
  showCountdown: boolean;
};

export type OfferContext = {
  /** When this visitor's personal timer started (from the signed cookie), if it has. */
  visitorStart?: number | null;
  now?: Date;
};

export async function getOfferState(_payload: Payload, product: Product, ctx: OfferContext = {}): Promise<OfferState> {
  const o = product.offer ?? {};
  const now = ctx.now ?? new Date();
  const regularPrice = product.price;
  const base: OfferState = {
    active: false,
    regularPrice,
    price: regularPrice,
    endsAt: null,
    showCountdown: Boolean(o.showCountdown),
  };

  const configured = o.enabled && o.price != null && o.price < regularPrice;
  if (!configured) return base;

  let endsAt: Date | null = null;
  if (o.mode === "endDate") {
    endsAt = o.endsAt ? new Date(o.endsAt) : null;
  } else if (ctx.visitorStart) {
    endsAt = new Date(ctx.visitorStart + (o.visitorMinutes ?? 15) * 60_000);
  } // else: a first-time visitor; their timer starts when the product page loads

  if (endsAt && endsAt <= now) return { ...base, endsAt: endsAt.toISOString() };
  return { ...base, active: true, price: o.price!, endsAt: endsAt?.toISOString() ?? null };
}

export type Quote = {
  offer: OfferState;
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
  const total = Math.max(0, listPrice - discount);
  const commission = affiliate ? Math.round((total * (affiliate.commissionPercent ?? 0)) / 100) : 0;

  return { offer, listPrice, discount, total, affiliate, promoCode: affiliate ? code : null, codeError, commission };
}
