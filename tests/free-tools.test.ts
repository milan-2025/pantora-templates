import { describe, it, expect } from "vitest";
import { DEFAULT_INPUT, estimateBudget, lakh } from "../lib/tools/weddingBudget";
import { DEFAULT_PROFIT, gstRate, profit, scenarios } from "../lib/tools/airbnbProfit";
import { applyDeal, dealFor } from "../lib/coupons";

describe("wedding budget calculator", () => {
  it("the default (300 guests, mid-range, big city, 4 functions) lands in the range the FAQ quotes", () => {
    const r = estimateBudget(DEFAULT_INPUT);
    expect(r.low).toBeGreaterThanOrEqual(20_00_000);
    expect(r.high).toBeLessThanOrEqual(29_00_000);
    expect(r.low).toBeLessThan(r.total);
    expect(r.high).toBeGreaterThan(r.total);
    expect(r.lines.find((l) => l.key === "buffer")!.amount).toBe(Math.round((r.total - r.lines.find((l) => l.key === "buffer")!.amount) * 0.1 / 1000) * 1000);
    // Food and venue are the biggest line
    expect([...r.lines].sort((a, b) => b.amount - a.amount)[0].key).toBe("food");
  });
  it("more guests, a metro or a grander style cost more; no functions falls back to the wedding", () => {
    const base = estimateBudget(DEFAULT_INPUT).total;
    expect(estimateBudget({ ...DEFAULT_INPUT, guests: 600 }).total).toBeGreaterThan(base);
    expect(estimateBudget({ ...DEFAULT_INPUT, city: "metro" }).total).toBeGreaterThan(base);
    expect(estimateBudget({ ...DEFAULT_INPUT, style: "grand" }).total).toBeGreaterThan(base);
    expect(estimateBudget({ ...DEFAULT_INPUT, city: "small", style: "simple" }).total).toBeLessThan(15_00_000);
    expect(estimateBudget({ ...DEFAULT_INPUT, functions: [] }).plates).toBe(300);
  });
  it("formats lakh and crore", () => {
    expect(lakh(85_000)).toBe("₹85,000");
    expect(lakh(12_40_000)).toBe("₹12.4 lakh");
    expect(lakh(25_00_000)).toBe("₹25 lakh");
    expect(lakh(1_20_00_000)).toBe("₹1.2 crore");
  });
});

describe("Airbnb profit calculator", () => {
  it("GST slabs from 22 Sep 2025", () => {
    expect([gstRate(900), gstRate(1000), gstRate(1001), gstRate(7500), gstRate(7501)]).toEqual([0, 0, 5, 5, 18]);
  });
  it("adds up: revenue − every cost = profit, and break-even occupancy gives about zero", () => {
    const r = profit(DEFAULT_PROFIT);
    expect(r.gross).toBeCloseTo(30.4 * 0.55 * 3500, 0);
    expect(r.net).toBeCloseTo(r.gross - r.lines.reduce((n, l) => n + l.amount, 0), 6);
    // The FAQ: a rented flat at these numbers leaves ~₹4,800 and breaks even near 49%; owned (no rent) leaves ~₹23,000.
    expect(Math.round(r.net / 100)).toBe(48);
    expect(Math.round(r.breakEven)).toBe(49);
    expect(Math.round(profit({ ...DEFAULT_PROFIT, rent: 0 }).net / 1000)).toBe(23);
    const atBreakEven = profit({ ...DEFAULT_PROFIT, occupancy: r.breakEven });
    expect(Math.abs(atBreakEven.net)).toBeLessThan(1);
    const owned = profit({ ...DEFAULT_PROFIT, rent: 0 });
    expect(owned.paybackMonths).toBeCloseTo(DEFAULT_PROFIT.setup / owned.net, 6);
    expect(r.net < 0 ? r.paybackMonths : 0).toBe(r.net < 0 ? null : 0);
  });
  it("GST in the rate and platform fees lower profit; direct bookings raise it", () => {
    const base = profit(DEFAULT_PROFIT).net;
    expect(profit({ ...DEFAULT_PROFIT, gstIncluded: true }).net).toBeLessThan(base);
    expect(profit({ ...DEFAULT_PROFIT, directShare: 100 }).net).toBeGreaterThan(base);
    expect(profit({ ...DEFAULT_PROFIT, occupancy: 0 }).net).toBeLessThan(0);
    const s = scenarios(DEFAULT_PROFIT);
    expect(s.map((x) => x.occupancy)).toEqual([35, 50, 65, 80]);
    expect(s[3].net).toBeGreaterThan(s[0].net);
  });
  it("costs higher than a night's rate can never break even", () => {
    const r = profit({ ...DEFAULT_PROFIT, rate: 500 });
    expect(r.breakEven).toBe(Infinity);
    expect(r.paybackMonths).toBeNull();
  });
});

describe("Shaadi pack coupons", () => {
  it("a product deal for the pack applies to the pack only", () => {
    const code = { code: "PACK1000", appliesTo: "listed", productDeals: [{ kind: "pack", type: "flat", value: 1000 }] };
    const d = dealFor(code, { kind: "pack" });
    expect(applyDeal(4999, d)).toEqual({ discount: 1000, total: 3999 });
    expect(dealFor(code, { kind: "bundle" })).toBeNull();
  });
});
