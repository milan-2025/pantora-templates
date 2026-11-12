import { describe, expect, it } from "vitest";
import { canChangeStatus, cleanPct, commissionAmount, effectiveRate, partnerLeadFields, partnerStats, shouldCreate, summarize } from "../lib/crm/commission";

describe("rates", () => {
  it("cleans percentages and treats blank as not set", () => {
    expect(cleanPct("2")).toBe(2);
    expect(cleanPct("1.5%")).toBe(1.5);
    expect(cleanPct("2.555")).toBe(2.56);
    for (const v of ["", null, undefined, "abc", "-1", "101"]) expect(cleanPct(v)).toBeNull();
    expect(cleanPct(0)).toBe(0);
  });
  it("partner rate overrides project rate, including an explicit 0", () => {
    expect(effectiveRate(2, 1)).toBe(2);
    expect(effectiveRate("", 1.5)).toBe(1.5);
    expect(effectiveRate(0, 3)).toBe(0);
    expect(effectiveRate(null, null)).toBe(0);
  });
});

describe("amount", () => {
  it("rounds to whole rupees", () => {
    expect(commissionAmount(8500000, 2)).toBe(170000);
    expect(commissionAmount(1234567, 1.5)).toBe(18519);
  });
  it("is zero for missing price or rate", () => {
    expect(commissionAmount(0, 2)).toBe(0);
    expect(commissionAmount(null, 2)).toBe(0);
    expect(commissionAmount(100, 0)).toBe(0);
  });
  it("is only created for partner leads with a rate and a price", () => {
    expect(shouldCreate("p1", 2, 100)).toBe(true);
    expect(shouldCreate("", 2, 100)).toBe(false);
    expect(shouldCreate("p1", 0, 100)).toBe(false);
    expect(shouldCreate("p1", 2, 0)).toBe(false);
  });
});

describe("status changes", () => {
  it("allows sensible moves only", () => {
    expect(canChangeStatus("pending", "approved")).toBe(true);
    expect(canChangeStatus("approved", "paid")).toBe(true);
    expect(canChangeStatus("pending", "paid")).toBe(true);
    expect(canChangeStatus("paid", "cancelled")).toBe(false);
    expect(canChangeStatus("paid", "pending")).toBe(false);
    expect(canChangeStatus("paid", "approved")).toBe(true);
    expect(canChangeStatus("cancelled", "paid")).toBe(false);
    expect(canChangeStatus("pending", "pending")).toBe(false);
    expect(canChangeStatus("nonsense", "paid")).toBe(false);
  });
});

describe("totals", () => {
  const list = [
    { status: "pending", amount: 100 }, { status: "approved", amount: 200 }, { status: "paid", amount: 400 }, { status: "cancelled", amount: 999 },
  ];
  it("sums by status and ignores cancelled", () => {
    expect(summarize(list)).toEqual({ pending: 100, approved: 200, paid: 400, due: 300, count: 3 });
  });
  it("builds per-partner stats", () => {
    const stats = partnerStats(
      [{ id: "p1", name: "Anil", rate: 2 }, { id: "p2", name: "Binu" }],
      [{ status: "Booked", partnerId: "p1" }, { status: "New", partnerId: "p1" }, { status: "Won", partnerId: "p2" }, { status: "New" }],
      [{ partnerId: "p1", status: "pending", amount: 50 }, { partnerId: "p2", status: "paid", amount: 70 }],
    );
    expect(stats[0]).toMatchObject({ id: "p1", leads: 2, booked: 1, rate: 2, commission: { due: 50, paid: 0 } });
    expect(stats[1]).toMatchObject({ id: "p2", leads: 1, booked: 1, rate: null, commission: { paid: 70 } });
  });
});

describe("partner field whitelist", () => {
  it("lets partners edit contact and interest fields only", () => {
    expect(partnerLeadFields({ name: " Ravi ", phone: "98", status: "Won", owner: "Me", partnerId: "x", $set: 1, budget: "1Cr" }))
      .toEqual({ name: "Ravi", phone: "98", budget: "1Cr" });
  });
});
