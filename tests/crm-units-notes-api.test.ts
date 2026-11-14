import { beforeAll, describe, expect, it, vi } from "vitest";
import { addUser, as, fake, loadRoute, mockDb, signup, type Sess } from "./apiHarness";

vi.mock("@/lib/cms/queries", () => ({ getPayloadClient: mockDb }));

let A: Sess, B: Sess, agent: Sess, partner: Sess, G: Sess;
let p1 = "", p2 = "", pB = "", uB = "";
const lead = (id: string) => fake.collection("crm_leads").docs.find((d: any) => d._id === id)!.data;
const units = async (s: Sess, q = "") => (await as(s).get("units_list", q)).json as any[];

beforeAll(async () => {
  await loadRoute();
  A = await signup("Unit Realty", "o@unit.in");
  B = await signup("Unit Rival", "o@unitrival.in");
  G = await signup("Plain Notes", "o@plainnotes.in"); // stays a normal CRM
  for (const s of [A, B]) await as(s).post("mode_set", { mode: "realestate" });
  agent = await addUser(A, "Agent One", "ag@unit.in", "agent");
  partner = await addUser(A, "Anil", "an@unit.in", "partner");
  p1 = (await as(A).post("project_save", { name: "Sunrise" })).json.id;
  p2 = (await as(A).post("project_save", { name: "Green" })).json.id;
  pB = (await as(B).post("project_save", { name: "Rival" })).json.id;
  uB = (await as(B).post("unit_save", { project: pB, no: "R-1" })).json.id;
});

describe("unit IDs", () => {
  it("are numbered per project after the Property ID", async () => {
    const a = await as(A).post("unit_save", { project: p1, no: "A-101", tower: "A" });
    expect(a.json.code).toBe("PR-001-U001");
    await as(A).post("units_import", { project: p1, rows: [{ no: "A-102" }, { no: "A-101" }, { no: "A-103" }] });
    await as(A).post("unit_save", { project: p2, no: "G-1" });
    const list = await units(A);
    expect(Object.fromEntries(list.map((u) => [u.no, u.code]))).toEqual({ "A-101": "PR-001-U001", "A-102": "PR-001-U002", "A-103": "PR-001-U003", "G-1": "PR-002-U001" });
    expect((await units(B))[0].code).toBe("PR-001-U001"); // other company has its own numbering
  });
  it("older units get IDs without reusing numbers", async () => {
    const u = fake.collection("crm_units").docs.find((d: any) => d.no === "A-102")!;
    delete u.code;
    const list = await units(A);
    expect(list.find((x) => x.no === "A-102").code).toBe("PR-001-U004");
    const codes = list.map((x) => x.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
  it("cannot be changed by editing, and a unit cannot move project", async () => {
    const u = (await units(A)).find((x) => x.no === "A-101");
    await as(A).post("unit_save", { id: u.id, project: p1, no: "A-101X", tower: "A", code: "PR-999-U999" });
    expect((await units(A)).find((x) => x.id === u.id)).toMatchObject({ no: "A-101X", code: "PR-001-U001" });
    expect((await as(A).post("unit_save", { id: u.id, project: p2, no: "A-101X" })).status).toBe(400);
    await as(A).post("unit_save", { id: u.id, project: p1, no: "A-101", tower: "A" });
  });
  it("refuses a duplicate unit number in the same project", async () => {
    expect((await as(A).post("unit_save", { project: p1, no: "A-103" })).status).toBe(400);
  });
  it("partners see unit IDs (but still not who holds a unit)", async () => {
    const u = (await units(partner))[0];
    expect(u.code).toMatch(/^PR-00\d-U\d{3}$/);
    expect(u.heldBy).toBeUndefined();
  });
});

describe("linking leads to units", () => {
  let unitId = "";
  beforeAll(async () => { unitId = (await units(A)).find((x) => x.no === "A-101").id; });

  it("links a lead to a unit, which also sets its property", async () => {
    const id = (await as(agent).post("leads_add", { name: "Ravi", phone: "9200000001", projectId: p2, unitId })).json.id;
    expect(lead(id)).toMatchObject({ unitId, unitCode: "PR-001-U001", unit: "A A-101", projectId: p1, project: "Sunrise" });
  });
  it("refuses another company's unit", async () => {
    const id = (await as(A).post("leads_add", { name: "Spy", phone: "9200000002", unitId: uB })).json.id;
    expect(lead(id).unitId || "").toBe("");
    await as(A).post("leads_update", { unitId: uB }, `&id=${id}`);
    expect(lead(id)).toMatchObject({ unitId: "", unitCode: "", unit: "" });
  });
  it("changing the property drops a unit that belongs to the old one", async () => {
    const id = (await as(agent).post("leads_add", { name: "Mover", phone: "9200000003", unitId })).json.id;
    await as(agent).post("leads_update", { projectId: p1 }, `&id=${id}`);
    expect(lead(id).unitId).toBe(unitId); // same property: unit kept
    await as(agent).post("leads_update", { projectId: p2 }, `&id=${id}`);
    expect(lead(id)).toMatchObject({ projectId: p2, unitId: "", unitCode: "" });
  });
  it("partners can pick a unit for their customer", async () => {
    const id = (await as(partner).post("leads_add", { name: "Via Partner", phone: "9200000004", unitId })).json.id;
    expect(lead(id)).toMatchObject({ unitCode: "PR-001-U001", partner: "Anil" });
  });
  it("booking a unit links the lead to it", async () => {
    const u3 = (await units(A)).find((x) => x.no === "A-103");
    const id = (await as(A).post("leads_add", { name: "Buyer", phone: "9200000005" })).json.id;
    await as(A).post("unit_status", { id: u3.id, status: "booked", leadId: id });
    expect(lead(id)).toMatchObject({ unitId: u3.id, unitCode: u3.code, unit: "A-103", status: "Booked" });
  });
  it("renaming a unit updates its leads; deleting it clears the link", async () => {
    await as(A).post("unit_save", { id: unitId, project: p1, no: "A-201", tower: "A" });
    const ravi = (await as(A).get("leads")).json.find((l: any) => l.name === "Ravi").id;
    expect(lead(ravi)).toMatchObject({ unit: "A A-201", unitCode: "PR-001-U001" });
    await as(A).post("unit_delete", { id: unitId });
    expect(lead(ravi)).toMatchObject({ unitId: "", unitCode: "" });
  });
  it("another company cannot delete a unit or clear links on our leads", async () => {
    const u = (await units(A))[0];
    const id = (await as(A).post("leads_add", { name: "Keep", phone: "9200000006", unitId: u.id })).json.id;
    await as(B).post("unit_delete", { id: u.id });
    expect(lead(id).unitId).toBe(u.id);
    expect((await units(A)).some((x) => x.id === u.id)).toBe(true);
  });
  it("deleting a project clears property and unit links on its leads", async () => {
    const id = (await as(A).post("leads_add", { name: "Green Lead", phone: "9200000007", unitId: (await units(A)).find((x) => x.project === p2).id })).json.id;
    await as(A).post("project_delete", { id: p2 });
    expect(lead(id)).toMatchObject({ projectId: "", unitId: "", unitCode: "" });
  });
});

describe("pinned notes", () => {
  it("can be added, edited and removed, in normal CRM mode too", async () => {
    const id = (await as(G).post("leads_add", { name: "Plain", phone: "9300000001", pinned: { x: " Call after 6 pm ", by: "Owner", t: 5 } })).json.id;
    expect(lead(id).pinned).toEqual({ x: "Call after 6 pm", by: "Owner", t: 5 });
    await as(G).post("leads_update", { pinned: { x: "Call after 7 pm", by: "Owner", t: 5, eby: "Owner", et: 9 } }, `&id=${id}`);
    expect(lead(id).pinned).toEqual({ x: "Call after 7 pm", by: "Owner", t: 5, eby: "Owner", et: 9 });
    await as(G).post("leads_update", { pinned: null }, `&id=${id}`);
    expect(lead(id).pinned).toBeNull();
  });
  it("are cleaned: junk is removed and text is limited", async () => {
    const id = (await as(A).post("leads_add", { name: "Pin", phone: "9300000002", pinned: { x: "z".repeat(3000), $set: { evil: 1 }, by: "A" } })).json.id;
    expect(lead(id).pinned.x).toHaveLength(2000);
    expect(lead(id).pinned.$set).toBeUndefined();
    await as(A).post("leads_update", { pinned: "just text" }, `&id=${id}`);
    expect(lead(id).pinned).toBeNull();
  });
  it("agents pin notes on their own leads only; partners cannot pin", async () => {
    const mine = (await as(agent).post("leads_add", { name: "Mine", phone: "9300000003" })).json.id;
    expect((await as(agent).post("leads_update", { pinned: { x: "Mine" } }, `&id=${mine}`)).status).toBe(200);
    expect(lead(mine).pinned.x).toBe("Mine");
    const other = (await as(A).post("leads_add", { name: "Admin's", phone: "9300000004", owner: "Someone Else" })).json.id;
    expect((await as(agent).post("leads_update", { pinned: { x: "x" } }, `&id=${other}`)).status).toBe(403);
    const pl = (await as(partner).post("leads_add", { name: "P", phone: "9300000005", pinned: { x: "partner pin" } })).json.id;
    expect(lead(pl).pinned).toBeUndefined();
    await as(partner).post("leads_update", { pinned: { x: "partner pin" } }, `&id=${pl}`);
    expect(lead(pl).pinned).toBeUndefined();
  });
  it("edited notes keep their history in the lead", async () => {
    const id = (await as(G).post("leads_add", { name: "Hist", phone: "9300000006", notes: [{ t: 1, by: "Owner", x: "first" }] })).json.id;
    await as(G).post("leads_update", { notes: [{ t: 1, by: "Owner", x: "first (fixed)", e: 2, eb: "Owner" }] }, `&id=${id}`);
    expect(lead(id).notes[0]).toEqual({ t: 1, by: "Owner", x: "first (fixed)", e: 2, eb: "Owner" });
  });
});
