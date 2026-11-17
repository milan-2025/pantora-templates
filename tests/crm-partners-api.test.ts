import { beforeAll, describe, expect, it, vi } from "vitest";
import { addUser, as, fake, loadRoute, mockDb, signup, type Sess } from "./apiHarness";

vi.mock("@/lib/cms/queries", () => ({ getPayloadClient: mockDb }));

let A: Sess, B: Sess, agent: Sess, p1: Sess, p2: Sess;
let projA = "", unitId = "", partnerId = "", p2Id = "";

beforeAll(async () => {
  await loadRoute();
  A = await signup("Partner Realty", "o@pr.in");
  B = await signup("Rival Co", "o@rival.in");
  agent = await addUser(A, "Agent One", "ag@pr.in", "agent");
  // partners need real estate mode
  expect((await as(A).post("user_save", { name: "P", email: "p0@pr.in", role: "partner", password: "password123" })).status).toBe(403);
  await as(A).post("mode_set", { mode: "realestate" });
  p1 = await addUser(A, "Anil Broker", "anil@br.in", "partner", { rate: 2 });
  p2 = await addUser(A, "Binu Broker", "binu@br.in", "partner");
  const users = (await as(A).get("users_list")).json as any[];
  partnerId = users.find((u) => u.email === "anil@br.in").id;
  p2Id = users.find((u) => u.email === "binu@br.in").id;
  projA = (await as(A).post("project_save", { name: "Sunrise", commissionPct: 1 })).json.id;
  unitId = (await as(A).post("unit_save", { project: projA, no: "A-101", price: 8500000 })).json.id;
});

describe("partner role", () => {
  it("is created with a rate and does not count as a sales seat or get leads assigned", async () => {
    expect((await as(A).get("users_list")).json.find((u: any) => u.id === partnerId)).toMatchObject({ role: "partner", rate: 2 });
    for (let i = 0; i < 6; i++) await as(p2).post("leads_add", { name: "L" + i, phone: `98000000${10 + i}` });
    const owners = (await as(A).get("leads")).json.map((l: any) => l.owner);
    expect(owners).toHaveLength(6);
    expect(owners.every((o: string) => o && !o.includes("Broker"))).toBe(true);
  });
  it("can only use the partner endpoints", async () => {
    for (const r of ["users_list", "sa_list", "partners_list", "visits_list", "unit_hold", "unit_status", "project_save", "commission_update", "leads_delete", "settings_set"]) {
      expect((await as(p1).post(r, {})).status, r).toBe(403);
    }
  });
  it("sees projects and units but not who holds them or the commission rate", async () => {
    expect((await as(p1).get("projects_list")).json[0].commissionPct).toBeUndefined();
    expect((await as(A).get("projects_list")).json[0].commissionPct).toBe(1);
    await as(agent).post("unit_hold", { id: unitId });
    const u = (await as(p1).get("units_list")).json[0];
    expect(u.status).toBe("soft_hold");
    expect(u.heldBy).toBeUndefined();
    expect(u.leadName).toBeUndefined();
    await as(A).post("unit_release", { id: unitId });
  });
});

describe("registering customers", () => {
  let leadId = "";
  it("a partner registers a buyer, which is attributed to them and assigned to the sales team", async () => {
    const r = await as(p1).post("leads_add", { name: "Priya", phone: "99887 76655", status: "Won", owner: "Anil Broker", budget: "1Cr", partnerId: partnerId });
    expect(r.status).toBe(200);
    leadId = r.json.id;
    const l = (await as(p1).get("leads")).json;
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ name: "Priya", status: "New", source: "Channel partner", partner: "Anil Broker", budget: "1Cr" });
    expect(l[0].owner).not.toBe("Anil Broker");
  });
  it("first registration wins: duplicates are refused for partners", async () => {
    expect((await as(p2).post("leads_add", { name: "Priya again", phone: "9988776655" })).status).toBe(409);
    expect((await as(p1).post("leads_add", { name: "Priya", phone: "9988776655" })).status).toBe(409);
    expect((await as(p2).post("leads_add", { name: "X", phone: "123" })).status).toBe(400);
  });
  it("partners see only their own leads; other partners and companies see none", async () => {
    expect((await as(p2).get("leads")).json.every((l: any) => l.partner === "Binu Broker")).toBe(true);
    expect((await as(p2).get("leads")).json.some((l: any) => l.name === "Priya")).toBe(false);
    await as(B).post("mode_set", { mode: "realestate" });
    expect((await as(B).get("leads")).json).toEqual([]);
  });
  it("a partner can fix contact details but cannot change stage, owner or attribution", async () => {
    await as(p1).post("leads_update", { name: "Priya S", status: "Won", owner: "Anil Broker", partnerId: p2Id, partner: "x", email: "p@x.in" }, `&id=${leadId}`);
    const l = (await as(p1).get("leads")).json[0];
    expect(l).toMatchObject({ name: "Priya S", email: "p@x.in", status: "New", partner: "Anil Broker" });
    expect(l.owner).not.toBe("Anil Broker");
    expect((await as(p2).post("leads_update", { name: "hack" }, `&id=${leadId}`)).status).toBe(403);
    expect((await as(p1).post("leads_delete", {}, `&id=${leadId}`)).status).toBe(403);
  });
  it("only an admin can change a lead's partner", async () => {
    await as(agent).post("leads_update", { partnerId: p2Id }, `&id=${leadId}`);
    expect(fake.collection("crm_leads").docs.find((d: any) => d._id === leadId)!.data.partnerId).toBe(partnerId);
    await as(A).post("leads_update", { partnerId: p2Id }, `&id=${leadId}`);
    expect(fake.collection("crm_leads").docs.find((d: any) => d._id === leadId)!.data).toMatchObject({ partnerId: p2Id, partner: "Binu Broker" });
    await as(A).post("leads_update", { partnerId: partnerId }, `&id=${leadId}`);
  });
  it("cannot attribute a lead to someone who is not a partner of this company", async () => {
    const bad = await as(A).post("leads_add", { name: "Z", phone: "9000011111", partnerId: "nope" });
    expect(fake.collection("crm_leads").docs.find((d: any) => d._id === bad.json.id)!.data.partnerId).toBeUndefined();
  });

  describe("commissions", () => {
    let cid = "";
    it("booking a partner's lead creates a pending commission using the partner's own rate", async () => {
      expect((await as(A).post("unit_status", { id: unitId, status: "booked", leadId })).status).toBe(200);
      const r = (await as(A).get("commissions_list")).json;
      expect(r.items).toHaveLength(1);
      expect(r.items[0]).toMatchObject({ partner: "Anil Broker", leadName: "Priya S", unit: "A-101", rate: 2, amount: 170000, saleValue: 8500000, status: "pending" });
      expect(r.totals).toMatchObject({ pending: 170000, due: 170000, paid: 0 });
      cid = r.items[0].id;
    });
    it("marking sold does not create a second commission", async () => {
      await as(A).post("unit_status", { id: unitId, status: "sold" });
      expect((await as(A).get("commissions_list")).json.items).toHaveLength(1);
    });
    it("partners see only their own commissions; agents and others cannot", async () => {
      expect((await as(p1).get("commissions_list")).json.items).toHaveLength(1);
      expect((await as(p2).get("commissions_list")).json.items).toEqual([]);
      expect((await as(B).get("commissions_list")).json.items).toEqual([]);
      expect((await as(agent).post("commission_update", { id: cid, status: "paid" })).status).toBe(403);
      expect((await as(B).post("commission_update", { id: cid, status: "paid" })).status).toBe(404);
    });
    it("admin approves, pays and can adjust the amount", async () => {
      expect((await as(A).post("commission_update", { id: cid, status: "approved", amount: 150000, note: "negotiated" })).status).toBe(200);
      expect((await as(A).post("commission_update", { id: cid, status: "paid" })).status).toBe(200);
      const it = (await as(A).get("commissions_list")).json.items[0];
      expect(it).toMatchObject({ status: "paid", amount: 150000, note: "negotiated" });
      expect(it.paidAt).toBeTruthy();
      expect((await as(A).post("commission_update", { id: cid, amount: 1 })).status).toBe(409); // paid: reopen first
      expect((await as(A).post("commission_update", { id: cid, status: "cancelled" })).status).toBe(409);
      expect((await as(A).post("commission_update", { id: cid, status: "bogus" })).status).toBe(409);
    });
    it("releasing a booked unit keeps a paid commission, but cancels an unpaid one", async () => {
      await as(A).post("unit_status", { id: unitId, status: "available" });
      expect((await as(A).get("commissions_list")).json.items[0].status).toBe("paid");
      // second deal on another unit, unpaid
      const u2 = (await as(A).post("unit_save", { project: projA, no: "A-102", price: 5000000 })).json.id;
      await as(A).post("unit_status", { id: u2, status: "booked", leadId });
      const items = (await as(A).get("commissions_list")).json.items;
      expect(items.find((i: any) => i.unit === "A-102")).toMatchObject({ amount: 100000, status: "pending" });
      await as(A).post("unit_status", { id: u2, status: "available" });
      expect((await as(A).get("commissions_list", "&status=cancelled")).json.items.map((i: any) => i.unit)).toEqual(["A-102"]);
      expect((await as(A).get("commissions_list")).json.totals).toMatchObject({ paid: 150000, due: 0 });
    });
    it("falls back to the project rate when the partner has none, and skips when there is no rate", async () => {
      const lead2 = (await as(p2).post("leads_add", { name: "Rohit", phone: "9555500001" })).json.id;
      const u3 = (await as(A).post("unit_save", { project: projA, no: "A-103", price: 4000000 })).json.id;
      await as(A).post("unit_status", { id: u3, status: "booked", leadId: lead2 });
      expect((await as(A).get("commissions_list")).json.items.find((i: any) => i.unit === "A-103")).toMatchObject({ partner: "Binu Broker", rate: 1, amount: 40000 });
      const p0 = (await as(A).post("project_save", { name: "No Rate" })).json.id;
      const u4 = (await as(A).post("unit_save", { project: p0, no: "Z-1", price: 4000000 })).json.id;
      await as(A).post("unit_status", { id: u4, status: "booked", leadId: lead2 });
      expect((await as(A).get("commissions_list")).json.items.some((i: any) => i.unit === "Z-1")).toBe(false);
    });
    it("shows partner totals to the admin", async () => {
      const ps = (await as(A).get("partners_list")).json;
      const anil = ps.find((p: any) => p.name === "Anil Broker");
      expect(anil).toMatchObject({ leads: 1, rate: 2, commission: { paid: 150000, due: 0 } });
      expect(ps.find((p: any) => p.name === "Binu Broker").leads).toBe(7);
    });
  });
});
