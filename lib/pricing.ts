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

/** An active affiliate by promo code (case-insensitive), or null. */
export async function findAffiliate(payload: Payload, rawCode: string | null | undefined): Promise<Affiliate | null> {
  const code = rawCode?.trim().toUpperCase();
  if (!code || !/^[A-Z0-9_-]{3,30}$/.test(code)) return null;
  const res = await payload.find({
    collection: "affiliates",
    where: { code: { equals: code }, active: { equals: true } },
    limit: 1,
    depth: 0,
  });
  return res.docs[0] ?? null;
}

/** The promo-code discount on an amount, exactly as checkout charges it. */
export function applyPromo(amount: number, affiliate: Affiliate | null) {
  const discount = affiliate ? Math.round((amount * (affiliate.discountPercent ?? 0)) / 100) : 0;
  // Razorpay can't take payments under ₹1, so even a 99% discount leaves at least ₹1 to pay.
  const total = Math.max(amount > 0 ? 1 : 0, amount - discount);
  return { discount: amount - total, total };
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

  const affiliate = code ? await findAffiliate(payload, code) : null;
  const codeError = code && !affiliate ? "This code isn't valid" : null;

  // Only upsells from this product's own admin list are accepted; prices always come from there.
  const availableUpsells = getUpsellOptions(product);
  const wanted = new Set(upsellIds.map(String));
  const addOns = availableUpsells.filter((u) => wanted.has(u.id)).map(({ id, name, price }) => ({ id, name, price }));
  const subtotal = listPrice + addOns.reduce((sum, a) => sum + a.price, 0);

  // A promo code discounts the whole order (main product + add-ons).
  const { discount, total } = applyPromo(subtotal, affiliate);
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
    codeError,
    commission,
  };
}
