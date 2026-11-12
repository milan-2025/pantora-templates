import { describe, expect, it } from "vitest";
import {
  canRelease, canTransition, cleanUnit, expandRange, expiredHoldFilter, holdFilter, holdHours,
  modeOf, releaseUpdate, unitStats, RE_STAGES,
} from "../lib/crm/realestate";

describe("mode", () => {
  it("defaults to general; only an exact realestate value turns it on", () => {
    expect(modeOf(null)).toBe("general");
    expect(modeOf({})).toBe("general");
    expect(modeOf({ mode: "RealEstate" })).toBe("general");
    expect(modeOf({ mode: "realestate" })).toBe("realestate");
  });
  it("keeps every normal stage and adds site-visit/booking stages before Won", () => {
    const k = Object.keys(RE_STAGES);
    for (const s of ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"]) expect(k).toContain(s);
    expect(k.indexOf("Site visit scheduled")).toBeLessThan(k.indexOf("Won"));
    expect(k.indexOf("Booked")).toBeLessThan(k.indexOf("Won"));
  });
});

describe("cleanUnit", () => {
  it("requires a unit number", () => expect(cleanUnit({ tower: "A" }).ok).toBe(false));
  it("cleans numbers, accepts rupee formatting and alternative headers", () => {
    const r = cleanUnit({ "unit no": " A-101 ", floor: "1", area: "1,250", price: "₹ 85,00,000", bhk: "2BHK" });
    expect(r.ok && r.unit).toEqual({ no: "A-101", tower: "", floor: 1, bhk: "2BHK", area: 1250, price: 8500000 });
  });
  it("turns negative or junk numbers into null instead of storing them", () => {
    const r = cleanUnit({ no: "1", price: "-5", area: "abc" });
    expect(r.ok && r.unit.price).toBeNull();
    expect(r.ok && r.unit.area).toBeNull();
  });
});

describe("expandRange", () => {
  it("expands inclusive ranges with a prefix", () => expect(expandRange(101, 103, "A-")).toEqual(["A-101", "A-102", "A-103"]));
  it("rejects bad or huge ranges", () => {
    expect(expandRange(5, 1)).toEqual([]);
    expect(expandRange(1, 5000)).toEqual([]);
    expect(expandRange(1.5, 3)).toEqual([]);
  });
});

describe("status transitions", () => {
  it("agents can only place a soft hold on an available unit", () => {
    expect(canTransition("available", "soft_hold", false)).toBe(true);
    expect(canTransition("available", "booked", false)).toBe(false);
    expect(canTransition("soft_hold", "available", false)).toBe(false);
    expect(canTransition("booked", "soft_hold", false)).toBe(false);
  });
  it("admins can move units around, but a sold unit can only be reopened", () => {
    expect(canTransition("available", "booked", true)).toBe(true);
    expect(canTransition("booked", "sold", true)).toBe(true);
    expect(canTransition("sold", "booked", true)).toBe(false);
    expect(canTransition("sold", "available", true)).toBe(true);
    expect(canTransition("available", "available", true)).toBe(false);
  });
  it("agents release only their own soft holds; admins release any hold", () => {
    const u = { status: "soft_hold", heldBy: "Ravi" };
    expect(canRelease(u, { name: "Ravi", admin: false })).toBe(true);
    expect(canRelease(u, { name: "Sita", admin: false })).toBe(false);
    expect(canRelease(u, { name: "Sita", admin: true })).toBe(true);
    expect(canRelease({ status: "hard_hold", heldBy: "Ravi" }, { name: "Ravi", admin: false })).toBe(false);
    expect(canRelease({ status: "booked" }, { name: "x", admin: true })).toBe(false);
  });
});

describe("holds", () => {
  it("scopes expiry and hold queries to one workspace", () => {
    expect(expiredHoldFilter("w1", 1000)).toEqual({ ws: "w1", status: "soft_hold", heldUntil: { $lte: 1000 } });
    expect(holdFilter("w1", "u1")).toEqual({ _id: "u1", ws: "w1", status: "available" });
  });
  it("release clears all hold data", () => {
    const u = releaseUpdate();
    expect(u.$set.status).toBe("available");
    expect(Object.keys(u.$unset).sort()).toEqual(["heldBy", "heldUntil", "leadId", "leadName"]);
  });
  it("falls back to a sane hold length", () => {
    expect(holdHours(24)).toBe(24);
    expect(holdHours(0)).toBe(48);
    expect(holdHours("abc")).toBe(48);
    expect(holdHours(99999)).toBe(48);
  });
});

describe("unitStats", () => {
  it("counts statuses and the value of booked and sold units", () => {
    const s = unitStats([
      { status: "available", price: 10 }, { status: "booked", price: 20 }, { status: "sold", price: 30 }, { status: "soft_hold" },
    ]);
    expect(s).toMatchObject({ total: 4, available: 1, booked: 1, sold: 1, soft_hold: 1, soldValue: 50 });
  });
});
