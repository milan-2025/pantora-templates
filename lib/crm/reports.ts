/**
 * Reports for real estate mode: pure functions over plain data (no database).
 * Cohort view: every lead RECEIVED in the chosen period is followed through to visits and bookings,
 * so conversion rates compare like with like. Inventory numbers are always "right now".
 *
 * Approximation: a lead's furthest stage is taken from its current stage and its site visits. A lead that was
 * marked Lost keeps credit only for visits it had, because the system does not store stage history.
 */

import { leadInProject } from "./property";

export type RLead = { id: string; created?: number; status?: string; source?: string; owner?: string; partnerId?: string; partner?: string; project?: string; projectId?: string; appts?: unknown };
export type RUnit = { id?: string; project: string; status: string; price?: number | null; leadId?: string };
export type RProject = { id: string; name: string; code?: string; views?: number; enquiries?: number };
export type RCommission = { partnerId: string; status: string; amount?: number; created?: number };

const RANK: Record<string, number> = {
  New: 0, Contacted: 1, Qualified: 2, "Site visit scheduled": 3, "Site visit done": 4, Proposal: 5, Negotiation: 6, Booked: 7, Won: 8,
};
const visitsOf = (l: RLead) => (Array.isArray(l.appts) ? l.appts : []).filter((a: any) => a && a.type === "Site visit");
const doneVisits = (l: RLead) => visitsOf(l).filter((a: any) => a.done && a.outcome !== "no_show").length;

/** Furthest stage reached (0 to 8), using visits as evidence too. */
export function reached(l: RLead): number {
  const byStatus = l.status && l.status in RANK ? RANK[l.status] : 0;
  const v = visitsOf(l);
  const byVisit = v.some((a: any) => a.done && a.outcome !== "no_show") ? 4 : v.length ? 3 : 0;
  return Math.max(byStatus, byVisit);
}
const isBooked = (l: RLead) => reached(l) >= 7 && l.status !== "Lost";
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const isSold = (u: RUnit) => u.status === "booked" || u.status === "sold";

export function buildReport(input: { leads: RLead[]; units: RUnit[]; projects: RProject[]; commissions: RCommission[]; from?: number | null; to?: number | null }) {
  const { from = null, to = null } = input;
  const cohort = input.leads.filter((l) => (from === null || (l.created ?? 0) >= from) && (to === null || (l.created ?? 0) <= to));
  const inCohort = new Set(cohort.map((l) => l.id));

  // booked/sold value per lead (only units linked to a lead can be attributed)
  const valueByLead = new Map<string, number>();
  for (const u of input.units) if (isSold(u) && u.leadId && u.price) valueByLead.set(u.leadId, (valueByLead.get(u.leadId) || 0) + u.price);
  const valueOf = (ls: RLead[]) => ls.reduce((a, l) => a + (valueByLead.get(l.id) || 0), 0);

  const group = (key: (l: RLead) => string) => {
    const m = new Map<string, RLead[]>();
    for (const l of cohort) { const k = key(l) || "Unknown"; (m.get(k) || m.set(k, []).get(k)!).push(l); }
    return [...m.entries()].map(([name, ls]) => {
      const booked = ls.filter(isBooked).length;
      return { name, leads: ls.length, visits: ls.reduce((a, l) => a + doneVisits(l), 0), booked, conversion: pct(booked, ls.length), value: valueOf(ls) };
    }).sort((a, b) => b.leads - a.leads || a.name.localeCompare(b.name));
  };

  const booked = cohort.filter(isBooked).length;
  const lost = cohort.filter((l) => l.status === "Lost").length;
  const visitsDone = cohort.reduce((a, l) => a + doneVisits(l), 0);
  const stage = (label: string, min: number) => ({ label, count: cohort.filter((l) => reached(l) >= min).length });
  const funnel = [{ label: "Leads received", count: cohort.length }, stage("Contacted", 1), stage("Site visit booked", 3), stage("Site visit done", 4), stage("Negotiation", 6), stage("Booked", 7)]
    .map((f) => ({ ...f, pct: pct(f.count, cohort.length) }));

  const projects = input.projects.map((p) => {
    const us = input.units.filter((u) => u.project === p.id);
    const count = (s: string[]) => us.filter((u) => s.includes(u.status)).length;
    return {
      id: p.id, code: p.code || "", name: p.name, total: us.length, available: count(["available"]), held: count(["soft_hold", "hard_hold"]),
      booked: count(["booked"]), sold: count(["sold"]),
      soldValue: us.filter(isSold).reduce((a, u) => a + (u.price || 0), 0),
      leads: cohort.filter((l) => leadInProject(l, p)).length,
      views: p.views || 0, enquiries: p.enquiries || 0,
    };
  });

  const partnerIds = [...new Set(cohort.map((l) => l.partnerId).filter(Boolean) as string[])];
  const partners = partnerIds.map((id) => {
    const ls = cohort.filter((l) => l.partnerId === id);
    const cs = input.commissions.filter((c) => c.partnerId === id && c.status !== "cancelled" && (from === null || (c.created ?? 0) >= from) && (to === null || (c.created ?? 0) <= to));
    const b = ls.filter(isBooked).length;
    return {
      id, name: ls.find((l) => l.partner)?.partner || "Partner", leads: ls.length, booked: b, conversion: pct(b, ls.length), value: valueOf(ls),
      due: cs.filter((c) => c.status === "pending" || c.status === "approved").reduce((a, c) => a + (c.amount || 0), 0),
      paid: cs.filter((c) => c.status === "paid").reduce((a, c) => a + (c.amount || 0), 0),
    };
  }).sort((a, b) => b.leads - a.leads);

  const owed = input.commissions.filter((c) => c.status === "pending" || c.status === "approved").reduce((a, c) => a + (c.amount || 0), 0);
  return {
    totals: { leads: cohort.length, visitsDone, booked, lost, conversion: pct(booked, cohort.length), soldValue: valueOf(cohort), commissionDue: owed, fromPartners: cohort.filter((l) => l.partnerId).length },
    funnel,
    sources: group((l) => (l.source || "").trim()),
    agents: group((l) => (l.owner || "").trim() || "Unassigned"),
    projects,
    partners,
    unlinkedSold: input.units.filter((u) => isSold(u) && !(u.leadId && inCohort.has(u.leadId))).length,
  };
}
