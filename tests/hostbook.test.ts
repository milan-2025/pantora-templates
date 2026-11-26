import { describe, it, expect } from "vitest";
import {
  addMonths, buildReport, cleanRecord, fillTemplate, icalIsBlock, icalPhoneLast4, maskId, nextDue, nights, nightsIn, ownerStatement, parseIcal, planQuote, toCsv, waLink,
  type PlanLite, type Rec,
} from "@/lib/hostbook/core";
import { DEFAULT_HOSTBOOK_PLANS, FEATURE_KEYS } from "@/lib/hostbook/features";
import { dealFor } from "@/lib/coupons";

const ICS = [
  "BEGIN:VCALENDAR", "VERSION:2.0",
  "BEGIN:VEVENT", "DTEND;VALUE=DATE:20261205", "DTSTART;VALUE=DATE:20261202", "UID:abc-1@airbnb.com", "DESCRIPTION:Reservation URL: https://www.airbnb.co.in/hosting/reservations/details/HM123\\nPhone Number (Last 4 Digits): 4417", "SUMMARY:Reserved", "END:VEVENT",
  "BEGIN:VEVENT", "DTEND;VALUE=DATE:20261212", "DTSTART;VALUE=DATE:20261210", "UID:abc-2@airbnb.com", "SUMMARY:Airbnb (Not available)", "END:VEVENT",
  "BEGIN:VEVENT", "DTSTART:20261220T140000Z", "DTEND:20261220T100000Z", "UID:bad", "SUMMARY:Ends before start", "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("iCal", () => {
  it("reads Airbnb bookings and blocks", () => {
    const ev = parseIcal(ICS);
    expect(ev).toHaveLength(2);
    expect(ev[0]).toMatchObject({ uid: "abc-1@airbnb.com", start: "2026-12-02", end: "2026-12-05", summary: "Reserved" });
    expect(icalPhoneLast4(ev[0])).toBe("4417");
    expect(icalIsBlock(ev[0])).toBe(false);
    expect(icalIsBlock(ev[1])).toBe(true);
  });
  it("handles folded lines", () => {
    const ev = parseIcal("BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260101\r\nDTEND;VALUE=DATE:20260103\r\nSUMMARY:Long\r\n  name\r\nEND:VEVENT");
    expect(ev[0].summary).toBe("Long name");
  });
});

describe("dates & tasks", () => {
  it("keeps month ends sensible", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-11-15", 3)).toBe("2027-02-15");
  });
  it("moves a task to its next date", () => {
    expect(nextDue("2026-11-26", 3, "month")).toBe("2027-02-26");
    expect(nextDue("2026-11-26", 2, "week")).toBe("2026-12-10");
    expect(nextDue("2026-11-26", 1, "year")).toBe("2027-11-26");
    expect(nextDue("2026-11-26", 1, "once")).toBeNull();
  });
  it("counts nights inside a range", () => {
    const b = { start: "2026-11-29", end: "2026-12-03" };
    expect(nights(b)).toBe(4);
    expect(nightsIn(b, "2026-11-01", "2026-11-30")).toBe(2);
    expect(nightsIn(b, "2026-12-01", "2026-12-31")).toBe(2);
  });
});

describe("records", () => {
  const all = () => true;
  it("keeps only known fields and cleans them", () => {
    const r = cleanRecord("expense", { amount: "1200.555", date: "2026-11-02", category: "Cleaning", evil: "x", listingId: "../../etc" }, all);
    expect(r).toEqual({ amount: 1200.56, date: "2026-11-02", category: "Cleaning", listingId: "" });
  });
  it("drops fields of a locked feature", () => {
    const r = cleanRecord("guest", { name: "Asha", flag: "blocked", rating: 1 }, (f) => f !== "guestFlags");
    expect(r).toEqual({ name: "Asha" });
  });
  it("masks ID numbers", () => { expect(maskId("1234 5678 9012")).toBe("•••• 9012"); });
});

describe("plans", () => {
  const P = (planId: string): PlanLite => ({ ...(DEFAULT_HOSTBOOK_PLANS.find((p) => p.planId === planId) as unknown as PlanLite), id: planId });
  const now = Date.parse("2026-11-26T00:00:00Z");
  it("starting plans are cumulative and Business has everything", () => {
    const [f, s, p, b] = DEFAULT_HOSTBOOK_PLANS;
    for (const k of f.features) expect(s.features).toContain(k);
    for (const k of s.features) expect(p.features).toContain(k);
    expect(b.features.sort()).toEqual([...FEATURE_KEYS].sort());
    expect([s.price, p.price, b.price]).toEqual([999, 2499, 5999]);
  });
  it("new plan: full price plus extra listings, a year from today", () => {
    const q = planQuote({ current: P("free"), expiresAt: null, extraNow: 0, target: P("starter"), extra: 2, extraPrice: 299, now });
    expect(q).toMatchObject({ kind: "new", amount: 999 + 598 });
    expect(q.expiresAt.slice(0, 10)).toBe("2027-11-26");
  });
  it("upgrade pays only the difference and keeps the end date", () => {
    const q = planQuote({ current: P("starter"), expiresAt: "2027-06-01T00:00:00.000Z", extraNow: 1, target: P("pro"), extra: 2, extraPrice: 299, now });
    expect(q).toMatchObject({ kind: "upgrade", amount: 2499 - 999 + 299, expiresAt: "2027-06-01T00:00:00.000Z" });
  });
  it("renewal adds a year on top", () => {
    const q = planQuote({ current: P("pro"), expiresAt: "2027-01-10T00:00:00.000Z", extraNow: 0, target: P("pro"), extra: 0, extraPrice: 299, now });
    expect(q.kind).toBe("renew");
    expect(q.expiresAt.slice(0, 10)).toBe("2028-01-10");
  });
  it("coupon codes can target HostBook plans", () => {
    const code = { code: "HOST20", appliesTo: "selected", productDeals: [{ kind: "hostbook", hostbookPlan: "pro", type: "percent", value: 20 }] };
    expect(dealFor(code, { kind: "hostbook", id: "pro" })).toMatchObject({ type: "percent", value: 20 });
    expect(dealFor(code, { kind: "hostbook", id: "starter" })).toBeNull();
    expect(dealFor({ ...code, productDeals: [{ kind: "hostbook", type: "flat", value: 100 }] }, { kind: "hostbook", id: "starter" })).toMatchObject({ value: 100 });
  });
});

describe("reports", () => {
  const items: Rec[] = [
    { id: "l1", kind: "listing", name: "Pine View" },
    { id: "l2", kind: "listing", name: "Studio" },
    { id: "b1", kind: "booking", listingId: "l1", start: "2026-11-28", end: "2026-12-02", payout: 8000, source: "Airbnb", status: "confirmed", platformFee: 400 },
    { id: "b2", kind: "booking", listingId: "l2", start: "2026-11-10", end: "2026-11-12", gross: 5000, platformFee: 500, source: "Direct", status: "confirmed" },
    { id: "b3", kind: "booking", listingId: "l2", start: "2026-11-20", end: "2026-11-22", payout: 9999, status: "cancelled" },
    { id: "e1", kind: "expense", listingId: "l1", date: "2026-11-05", amount: 1000, category: "Cleaning" },
    { id: "e2", kind: "expense", listingId: "", date: "2026-11-06", amount: 600, category: "Internet" },
    { id: "i1", kind: "income", listingId: "l1", date: "2026-11-29", amount: 500, source: "Extra bed" },
  ] as Rec[];
  it("spreads a stay across months and skips cancelled ones", () => {
    const r = buildReport(items, "2026-11-01", "2026-11-30");
    // b1: 3 of 4 nights in Nov → 6000; b2: 5000 − 500 = 4500; other income 500
    expect(r.bookingIncome).toBe(10500);
    expect(r.income).toBe(11000);
    expect(r.expenses).toBe(1600);
    expect(r.profit).toBe(9400);
    expect(r.nights).toBe(5);
    expect(r.occupancy).toBe(Math.round((5 / 60) * 1000) / 10);
    expect(r.bySource[0]).toMatchObject({ name: "Airbnb", amount: 6000 });
  });
  it("splits shared expenses for one listing", () => {
    const r = buildReport(items, "2026-11-01", "2026-11-30", "l1");
    expect(r.expenses).toBe(1000 + 300);
    expect(r.income).toBe(6000 + 500);
  });
  it("owner statement", () => {
    const st = ownerStatement(items, "l1", "2026-11", 20);
    expect(st.income).toBe(6500);
    expect(st.commission).toBe(1300);
    expect(st.expenses).toBe(1000);
    expect(st.due).toBe(4200);
  });
});

describe("messages & export", () => {
  it("fills templates and leaves unknown blanks", () => {
    expect(fillTemplate("Hi {guest}, Wi-Fi {wifi}", { guest: "Riya" })).toBe("Hi Riya, Wi-Fi {wifi}");
    expect(waLink("98765 43210", "hi there")).toBe("https://wa.me/919876543210?text=hi%20there");
  });
  it("quotes CSV cells", () => { expect(toCsv([["a,b", 'say "hi"', 3]])).toBe('"a,b","say ""hi""",3'); });
});
