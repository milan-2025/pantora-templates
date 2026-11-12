import { describe, expect, it } from "vitest";
import { buildReport, reached } from "../lib/crm/reports";

const DAY = 864e5, NOW = Date.UTC(2026, 10, 12);
const visit = (done: boolean, outcome?: string) => ({ id: "v" + Math.random(), type: "Site visit", at: "2026-11-10T10:00", done, outcome });
const leads = [
  { id: "l1", created: NOW - 2 * DAY, status: "Booked", source: "99acres", owner: "Asha", project: "Sunrise", appts: [visit(true, "interested")] },
  { id: "l2", created: NOW - 3 * DAY, status: "Site visit done", source: "99acres", owner: "Asha", appts: [visit(true, "thinking")] },
  { id: "l3", created: NOW - 4 * DAY, status: "New", source: "Meta", owner: "Ravi", partnerId: "p1", partner: "Anil" },
  { id: "l4", created: NOW - 5 * DAY, status: "Lost", source: "Meta", owner: "Ravi", appts: [visit(true, "not_interested")] },
  { id: "l5", created: NOW - 40 * DAY, status: "Won", source: "Referral", owner: "", partnerId: "p1", partner: "Anil", project: "sunrise" },
  { id: "l6", created: NOW - 1 * DAY, status: "Site visit scheduled", source: "", appts: [visit(false)] },
];
const units = [
  { project: "P1", status: "booked", price: 8000000, leadId: "l1" }, { project: "P1", status: "available", price: 9000000 },
  { project: "P1", status: "soft_hold", price: 1 }, { project: "P1", status: "sold", price: 5000000, leadId: "l5" }, { project: "P1", status: "booked", price: 2000000 },
];
const projects = [{ id: "P1", name: "Sunrise", views: 120, enquiries: 9 }];
const commissions = [
  { partnerId: "p1", status: "pending", amount: 100, created: NOW - 2 * DAY }, { partnerId: "p1", status: "paid", amount: 400, created: NOW - 50 * DAY },
  { partnerId: "p1", status: "cancelled", amount: 999, created: NOW - 2 * DAY },
];

describe("reached", () => {
  it("uses the stage and visits, and does not count no-shows", () => {
    expect(reached({ id: "a", status: "New" })).toBe(0);
    expect(reached({ id: "a", status: "New", appts: [visit(false)] })).toBe(3);
    expect(reached({ id: "a", status: "Contacted", appts: [visit(true, "interested")] })).toBe(4);
    expect(reached({ id: "a", status: "Contacted", appts: [visit(true, "no_show")] })).toBe(3);
    expect(reached({ id: "a", status: "Lost", appts: [visit(true, "interested")] })).toBe(4);
    expect(reached({ id: "a", status: "Won" })).toBe(8);
    expect(reached({ id: "a", status: "Some custom stage" })).toBe(0);
  });
});

describe("buildReport (last 30 days)", () => {
  const r = buildReport({ leads, units, projects, commissions, from: NOW - 30 * DAY, to: NOW });
  it("only follows leads received in the period", () => {
    expect(r.totals.leads).toBe(5); // l5 is 40 days old
  });
  it("totals: visits, bookings, conversion and sold value", () => {
    expect(r.totals).toMatchObject({ visitsDone: 3, booked: 1, lost: 1, conversion: 20, soldValue: 8000000, commissionDue: 100, fromPartners: 1 });
  });
  it("builds a funnel that never increases down the stages", () => {
    expect(r.funnel.map((f) => f.count)).toEqual([5, 4, 4, 3, 1, 1]);
  });
  it("breaks leads down by source, with a bucket for blanks", () => {
    expect(r.sources.find((s) => s.name === "99acres")).toMatchObject({ leads: 2, visits: 2, booked: 1, conversion: 50, value: 8000000 });
    expect(r.sources.find((s) => s.name === "Meta")).toMatchObject({ leads: 2, booked: 0 });
    expect(r.sources.some((s) => s.name === "Unknown")).toBe(true);
  });
  it("ranks agents and keeps unassigned leads visible", () => {
    expect(r.agents[0]).toMatchObject({ name: "Asha", leads: 2, booked: 1 });
    expect(r.agents.find((a) => a.name === "Unassigned")!.leads).toBe(1);
  });
  it("summarises inventory and project demand", () => {
    expect(r.projects[0]).toEqual({ id: "P1", name: "Sunrise", total: 5, available: 1, held: 1, booked: 2, sold: 1, soldValue: 15000000, leads: 1, views: 120, enquiries: 9 });
  });
  it("shows partner results with commission in the period, ignoring cancelled", () => {
    expect(r.partners).toEqual([{ id: "p1", name: "Anil", leads: 1, booked: 0, conversion: 0, value: 0, due: 100, paid: 0 }]);
  });
  it("counts booked units that cannot be tied to a lead in this period", () => {
    expect(r.unlinkedSold).toBe(2); // l5 (outside the period) and one booking with no lead
  });
});

describe("all time and empty data", () => {
  it("includes everything when there is no date range", () => {
    const r = buildReport({ leads, units, projects, commissions });
    expect(r.totals.leads).toBe(6);
    expect(r.partners[0]).toMatchObject({ leads: 2, booked: 1, paid: 400, due: 100, value: 5000000 });
    expect(r.projects[0].leads).toBe(2); // project names match without regard to case
  });
  it("handles a company with no data", () => {
    const r = buildReport({ leads: [], units: [], projects: [], commissions: [], from: 0, to: 1 });
    expect(r.totals).toMatchObject({ leads: 0, booked: 0, conversion: 0, soldValue: 0 });
    expect(r.funnel.every((f) => f.count === 0 && f.pct === 0)).toBe(true);
    expect(r.sources).toEqual([]);
  });
});
