import { describe, expect, it } from "vitest";
import { applyDeal, dealFor, dealLabel, isUsable, priceWithCode, type CouponCode } from "@/lib/coupons";

const code = (c: Partial<CouponCode>): CouponCode => ({ code: "TEST", ...c });

describe("coupon codes", () => {
  it("treats old codes (only a %) as a % off everything", () => {
    const c = code({ discountPercent: 20 });
    expect(dealFor(c, { kind: "shop", id: "p1" })).toMatchObject({ type: "percent", value: 20, fromDefault: true });
    expect(applyDeal(999, dealFor(c, { kind: "invite", plan: "basic" }))).toEqual({ discount: 200, total: 799 });
  });

  it("gives a flat ₹ amount off, never below ₹1", () => {
    const c = code({ discountType: "flat", discountAmount: 500 });
    expect(applyDeal(1999, dealFor(c, { kind: "planner", id: "fam" }))).toEqual({ discount: 500, total: 1499 });
    expect(applyDeal(249, dealFor(c, { kind: "shop", id: "sheet" }))).toEqual({ discount: 248, total: 1 });
  });

  it("sets a special price on one product, and other products keep the deal on everything", () => {
    const c = code({ discountPercent: 10, productDeals: [{ kind: "shop", shopProduct: "sheet", type: "price", value: 149 }] });
    expect(applyDeal(249, dealFor(c, { kind: "shop", id: "sheet" }))).toEqual({ discount: 100, total: 149 });
    expect(applyDeal(1000, dealFor(c, { kind: "shop", id: "other" }))).toEqual({ discount: 100, total: 900 });
  });

  it("works only on listed products when set to 'listed'", () => {
    const c = code({ appliesTo: "listed", discountPercent: 50, productDeals: [{ kind: "invite", invitePlan: "premium", type: "flat", value: 300 }] });
    expect(dealFor(c, { kind: "invite", plan: "basic" })).toBeNull();
    expect(dealFor(c, { kind: "shop", id: "x" })).toBeNull();
    expect(priceWithCode(c, { kind: "invite", plan: "premium" }, 1999)).toMatchObject({ total: 1699, label: "₹300 off" });
    expect(priceWithCode(c, { kind: "invite", plan: "royal", name: "the Royal plan" }, 3999).error).toBe("That code doesn’t work on the Royal plan");
  });

  it("prefers a deal for the exact plan over one for the whole group", () => {
    const c = code({
      appliesTo: "listed",
      productDeals: [
        { kind: "workout", type: "percent", value: 10 },
        { kind: "workout", workoutPlan: { id: "pro" }, type: "price", value: 1499 },
      ],
    });
    expect(dealFor(c, { kind: "workout", id: "pro" })).toMatchObject({ type: "price", value: 1499 });
    expect(dealFor(c, { kind: "workout", id: "basic" })).toMatchObject({ type: "percent", value: 10 });
  });

  it("applies a special price to an upgrade as the new full price", () => {
    // Royal ₹3,999 at a special ₹1,999; they already paid ₹799 for Basic, so they pay ₹1,200.
    expect(applyDeal(3200, { type: "price", value: 1999 }, 3999)).toEqual({ discount: 2000, total: 1200 });
    // A special price above the real price changes nothing.
    expect(applyDeal(799, { type: "price", value: 999 })).toEqual({ discount: 0, total: 799 });
  });

  it("stops working when switched off or past its end date", () => {
    expect(isUsable({ active: true, validUntil: "2020-01-01T00:00:00Z" })).toBe(false);
    expect(isUsable({ active: false })).toBe(false);
    expect(isUsable({ active: true, validUntil: null })).toBe(true);
  });

  it("describes deals in words", () => {
    expect(dealLabel({ type: "percent", value: 15 })).toBe("15% off");
    expect(dealLabel({ type: "flat", value: 1000 })).toBe("₹1,000 off");
    expect(dealLabel({ type: "price", value: 499 })).toBe("special price ₹499");
  });
});
