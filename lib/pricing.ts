import type { Payload } from "payload";
import type { Affiliate, Product } from "@/payload-types";

/**
 * The single source of truth for what a customer pays. Always runs on the server.
 * The offer is real: it ends at its end date or when `cap` offer sales are reached.
 */
export type OfferState = {
  active: boolean;
  regularPrice: number;
  /** Price before any promo code (the offer price while the offer is active). */
  price: number;
  endsAt: string | null;
  cap: number | null;
  sold: number;
  showCountdown: boolean;
  showStock: boolean;
};

export async function countOfferSales(payload: Payload, productId: number) {
  const res = await payload.count({
    collection: "orders",
    where: { product: { equals: productId }, paymentStatus: { equals: "paid" }, offerApplied: { equals: true } },
  });
  return res.totalDocs;
}

export async function getOfferState(payload: Payload, product: Product, now = new Date()): Promise<OfferState> {
  const o = product.offer ?? {};
  const regularPrice = product.price;
  const cap = o.cap ?? null;
  const base: OfferState = {
    active: false,
    regularPrice,
    price: regularPrice,
    endsAt: o.endsAt ?? null,
    cap,
    sold: 0,
    showCountdown: Boolean(o.showCountdown),
    showStock: Boolean(o.showStock),
  };

  const configured = o.enabled && o.price != null && o.price < regularPrice;
  if (!configured) return base;
  if (o.endsAt && new Date(o.endsAt) <= now) return base;

  const sold = cap ? await countOfferSales(payload, product.id) : 0;
  if (cap && sold >= cap) return { ...base, sold };

  return { ...base, active: true, price: o.price!, sold };
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

export async function getQuote(payload: Payload, product: Product, rawCode?: string | null): Promise<Quote> {
  const offer = await getOfferState(payload, product);
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
