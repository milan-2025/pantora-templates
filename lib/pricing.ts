import type { Payload } from "payload";
import type { Affiliate, Product } from "@/payload-types";
import { applyDeal, dealFor, dealLabel, isUsable, type CouponCode, type CouponTarget, type Deal } from "@/lib/coupons";

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
  /** After the window has closed: when this visitor gets a fresh countdown (if the timer restarts). */
  restartsAt: string | null;
};

const UNIT_MS = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 } as const;

/**
 * How long each visitor's bonus window lasts, and how long after it closes a fresh one starts
 * (null = never restarts).
 */
export function bonusTiming(product: Product) {
  const b = product.bonus ?? {};
  const windowMs = Math.max(1, b.minutes ?? 15) * 60_000;
  const unit = UNIT_MS[(b.resetUnit as keyof typeof UNIT_MS) ?? "days"] ?? UNIT_MS.days;
  const restartMs = b.resetAfter && b.resetAfter > 0 ? b.resetAfter * unit : null;
  return { windowMs, restartMs };
}

export function getBonusState(product: Product, ctx: OfferContext = {}): BonusState | null {
  const b = product.bonus ?? {};
  if (!b.enabled || !b.title || (!b.file && !b.link)) return null;
  const now = ctx.now ?? new Date();
  if (!ctx.visitorStart) return { active: true, title: b.title, endsAt: null, restartsAt: null };
  const { windowMs, restartMs } = bonusTiming(product);
  const endsAt = new Date(ctx.visitorStart + windowMs);
  const active = endsAt > now;
  const restartsAt = !active && restartMs ? new Date(endsAt.getTime() + restartMs).toISOString() : null;
  return { active, title: b.title, endsAt: endsAt.toISOString(), restartsAt };
}

/** An upsell product offered at checkout (only ever built from the main product's admin list). */
export type UpsellOption = {
  id: string;
  name: string;
  tagline: string | null;
  image: string | null;
  /** The upsell product's own regular price, shown crossed out. */
  regularPrice: number;
  /** The special upsell price set on the main product. */
  price: number;
  pitch: string | null;
};

/** Upsells for a product: published products from its admin list, excluding itself and duplicates. */
export function getUpsellOptions(product: Product): UpsellOption[] {
  const seen = new Set<string>();
  const options: UpsellOption[] = [];
  for (const row of product.upsells ?? []) {
    const p = row.product;
    if (!p || typeof p !== "object") continue; // not populated (needs depth >= 1)
    const id = String(p.id);
    if (id === String(product.id) || seen.has(id) || p._status !== "published" || !(row.price > 0)) continue;
    seen.add(id);
    const img = p.cardImage && typeof p.cardImage === "object" ? p.cardImage.url ?? null : null;
    options.push({ id, name: p.name, tagline: p.tagline ?? null, image: img, regularPrice: p.price, price: row.price, pitch: row.pitch ?? null });
  }
  return options;
}

/** A usable coupon/affiliate code (active, not past its end date), case-insensitive, or null. */
export async function findAffiliate(payload: Payload, rawCode: string | null | undefined): Promise<Affiliate | null> {
  const code = rawCode?.trim().toUpperCase();
  if (!code || !/^[A-Z0-9_-]{3,30}$/.test(code)) return null;
  const res = await payload.find({
    collection: "affiliates",
    where: { code: { equals: code }, active: { equals: true } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const doc = res.docs[0] ?? null;
  return doc && isUsable(asCoupon(doc)) ? doc : null;
}

/** The coupon fields of an Affiliate document. */
export const asCoupon = (a: Affiliate): CouponCode => a as unknown as CouponCode;

/**
 * A code's price on one product or plan, exactly as checkout charges it.
 * `error` is set when the code doesn't exist, has ended, or doesn't cover this product.
 */
export async function quoteWithCode(
  payload: Payload,
  rawCode: string,
  target: CouponTarget,
  amount: number,
  fullPrice = amount,
): Promise<{ discount: number; total: number; deal: Deal | null; label: string; affiliate: Affiliate | null; error?: string }> {
  const affiliate = await findAffiliate(payload, rawCode);
  if (!affiliate) return { discount: 0, total: amount, deal: null, label: "", affiliate: null, error: "That code isn’t valid" };
  const deal = dealFor(asCoupon(affiliate), target);
  if (!deal) {
    const what = target.name ? ` on ${target.name}` : target.kind === "shop" ? " on this product" : " on this plan";
    return { discount: 0, total: amount, deal: null, label: "", affiliate, error: `That code doesn’t work${what}` };
  }
  const clean: Deal = { type: deal.type, value: deal.value };
  return { ...applyDeal(amount, clean, fullPrice), deal: clean, label: dealLabel(clean), affiliate };
}

export type Quote = {
  offer: OfferState;
  /** The quick-order bonus, if one is running (active = this order would include it). */
  bonus: BonusState | null;
  /** Main product price before any promo code (the offer price while the offer is active). */
  listPrice: number;
  /** Upsells this product offers, and the ones selected for this order. */
  availableUpsells: UpsellOption[];
  addOns: { id: string; name: string; price: number }[];
  /** Main product + selected add-ons, before the promo code. */
  subtotal: number;
  discount: number;
  total: number;
  affiliate: Affiliate | null;
  promoCode: string | null;
  /** The code's deal in words, e.g. "20% off" or "special price ₹499". */
  promoLabel: string;
  /** Set when a code was given but isn't valid. */
  codeError: string | null;
  commission: number;
};

export async function getQuote(
  payload: Payload,
  product: Product,
  rawCode?: string | null,
  ctx: OfferContext = {},
  upsellIds: string[] = [],
): Promise<Quote> {
  const offer = await getOfferState(payload, product, ctx);
  const listPrice = offer.price;
  const code = rawCode?.trim().toUpperCase() || null;

  let affiliate = code ? await findAffiliate(payload, code) : null;
  let codeError = code && !affiliate ? "This code isn't valid" : null;

  // Only upsells from this product's own admin list are accepted; prices always come from there.
  const availableUpsells = getUpsellOptions(product);
  const wanted = new Set(upsellIds.map(String));
  const addOns = availableUpsells.filter((u) => wanted.has(u.id)).map(({ id, name, price }) => ({ id, name, price }));
  const subtotal = listPrice + addOns.reduce((sum, a) => sum + a.price, 0);

  // The code's deal on each line: the main product, then each add-on (by its own product deal, or the
  // "deal on everything" when it is a %; a flat ₹ amount off everything is taken once, from the main product).
  let discount = 0;
  let promoLabel = "";
  if (affiliate) {
    const coupon = asCoupon(affiliate);
    const mainDeal = dealFor(coupon, { kind: "shop", id: String(product.id) });
    if (mainDeal) {
      discount += applyDeal(listPrice, mainDeal).discount; // a special price replaces the price shown now
      promoLabel = dealLabel(mainDeal);
    }
    for (const a of addOns) {
      const d = dealFor(coupon, { kind: "shop", id: a.id });
      if (!d || (d.fromDefault && d.type === "flat")) continue;
      const off = applyDeal(a.price, d).discount;
      if (off > 0 && !promoLabel) promoLabel = `${dealLabel(d)} ${a.name}`;
      discount += off;
    }
    if (!mainDeal && discount === 0) {
      codeError = `This code doesn't work on ${product.name}`;
      affiliate = null;
    }
  }
  // Razorpay can't take payments under ₹1.
  const total = Math.max(subtotal > 0 ? 1 : 0, subtotal - discount);
  discount = subtotal - total;
  const commission = affiliate ? Math.round((total * (affiliate.commissionPercent ?? 0)) / 100) : 0;

  const bonus = getBonusState(product, ctx);
  return {
    offer,
    bonus,
    listPrice,
    availableUpsells,
    addOns,
    subtotal,
    discount,
    total,
    affiliate,
    promoCode: affiliate ? code : null,
    promoLabel: affiliate ? promoLabel : "",
    codeError,
    commission,
  };
}
