import { beforeAll, describe, expect, it, vi } from "vitest";
import { addUser, as, fake, loadRoute, mockDb, signup, type Sess } from "./apiHarness";

vi.mock("@/lib/cms/queries", () => ({ getPayloadClient: mockDb }));

let A: Sess, B: Sess, agent: Sess, partner: Sess;
const DAY = 864e5;

beforeAll(async () => {
  await loadRoute();
  A = await signup("Report Realty", "o@rep.in");
  B = await signup("Other Realty", "o@orep.in");
  await as(A).post("mode_set", { mode: "realestate" });
  await as(B).post("mode_set", { mode: "realestate" });
  agent = await addUser(A, "Agent One", "ag@rep.in", "agent");
  partner = await addUser(A, "Anil", "an@rep.in", "partner", { rate: 2 });
  const proj = (await as(A).post("project_save", { name: "Sunrise" })).json.id;
  const unit = (await as(A).post("unit_save", { project: proj, no: "A-1", price: 5000000 })).json.id;
  const l1 = (await as(agent).post("leads_add", { name: "Booked One", phone: "9000000001", source: "99acres", project: "Sunrise" })).json.id;
  await as(agent).post("visit_save", { leadId: l1, at: "2026-11-10T10:00" });
  const v = (await as(agent).get("visits_list", "&now=2026-11-12T10:00")).json[0];
  await as(agent).post("visit_done", { leadId: l1, id: v.id, outcome: "interested" });
  await as(A).post("unit_status", { id: unit, status: "booked", leadId: l1 });
  await as(agent).post("leads_add", { name: "Cold One", phone: "9000000002", source: "Meta" });
  await as(partner).post("leads_add", { name: "Partner One", phone: "9000000003" });
  // an old lead, outside a 30 day window
  const old = (await as(A).post("leads_add", { name: "Old One", phone: "9000000004", source: "Referral" })).json.id;
  fake.collection("crm_leads").docs.find((d: any) => d._id === old)!.created = Date.now() - 90 * DAY;
  // other company data that must never leak in
  await as(B).post("leads_add", { name: "Rival Lead", phone: "9111111111", source: "Rival Source" });
});

describe("reports API", () => {
  it("is for admins of companies in real estate mode", async () => {
    expect((await as(agent).get("report")).status).toBe(403);
    expect((await as(partner).get("report")).status).toBe(403);
    const C = await signup("Plain Co", "o@plain.in");
    expect((await as(C).get("report")).status).toBe(403); // mode off
  });
  it("covers all time by default", async () => {
    const r = (await as(A).get("report")).json;
    expect(r.totals).toMatchObject({ leads: 4, visitsDone: 1, booked: 1, soldValue: 5000000, fromPartners: 1 });
    expect(r.projects[0]).toMatchObject({ name: "Sunrise", total: 1, booked: 1, soldValue: 5000000, leads: 1 });
  });
  it("filters to a period", async () => {
    const from = Date.now() - 30 * DAY;
    const r = (await as(A).get("report", `&from=${from}&to=${Date.now() + 1000}`)).json;
    expect(r.totals.leads).toBe(3);
    expect(r.sources.some((s: any) => s.name === "Referral")).toBe(false);
    expect(r.funnel.map((f: any) => f.count)).toEqual([3, 1, 1, 1, 1, 1]);
  });
  it("ignores junk date values", async () => {
    expect((await as(A).get("report", "&from=abc&to=1;drop")).json.totals.leads).toBe(4);
  });
  it("never mixes in another company's data", async () => {
    const r = (await as(A).get("report")).json;
    expect(r.sources.some((s: any) => s.name === "Rival Source")).toBe(false);
    const rb = (await as(B).get("report")).json;
    expect(rb.totals.leads).toBe(1);
    expect(rb.sources.map((s: any) => s.name)).toEqual(["Rival Source"]);
    expect(rb.projects).toEqual([]);
  });
  it("reports partner leads and the sales team's leads", async () => {
    const r = (await as(A).get("report")).json;
    expect(r.partners).toHaveLength(1);
    expect(r.partners[0]).toMatchObject({ name: "Anil", leads: 1 });
    expect(r.agents.some((a: any) => a.name === "Agent One" && a.leads >= 2)).toBe(true);
  });
});
