import { beforeAll, describe, expect, it, vi } from "vitest";
import { addUser, as, fake, loadRoute, mockDb, NOW, signup, type Sess } from "./apiHarness";

vi.mock("@/lib/cms/queries", () => ({ getPayloadClient: mockDb }));

let A: Sess, agent: Sess, other: Sess, B: Sess;
let leadId = "", otherLeadId = "";

beforeAll(async () => {
  await loadRoute();
  A = await signup("Visit Realty", "o@visit.in");
  B = await signup("Other Co", "o@other.in");
  await as(A).post("mode_set", { mode: "realestate" });
  agent = await addUser(A, "Agent One", "a1@visit.in", "agent");
  other = await addUser(A, "Agent Two", "a2@visit.in", "agent");
  leadId = (await as(agent).post("leads_add", { name: "Ravi", phone: "9876543210", status: "Contacted" })).json.id;
  otherLeadId = (await as(other).post("leads_add", { name: "Sita", phone: "9123456780", status: "New" })).json.id;
});

const visits = async (s: Sess) => (await as(s).get("visits_list", `&now=${encodeURIComponent(NOW)}`)).json as any[];

describe("site visits API", () => {
  it("is locked when real estate mode is off", async () => {
    expect((await as(B).get("visits_list", `&now=${NOW}`)).status).toBe(403);
  });
  it("needs the agent's local time", async () => {
    expect((await as(A).get("visits_list")).status).toBe(400);
  });
  it("schedules a visit, moves the lead to Site visit scheduled and lists it", async () => {
    const r = await as(agent).post("visit_save", { leadId, at: "2026-11-12T16:00", project: "Sunrise", unit: "A-101", note: "with family" });
    expect(r.status).toBe(200);
    const list = await visits(agent);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ leadName: "Ravi", project: "Sunrise", bucket: "today", leadStatus: "Site visit scheduled" });
  });
  it("rejects bad times", async () => {
    expect((await as(agent).post("visit_save", { leadId, at: "soon" })).status).toBe(400);
  });
  it("agents only see and change their own leads' visits; admins see all", async () => {
    expect(await visits(other)).toEqual([]);
    expect((await as(other).post("visit_save", { leadId, at: "2026-11-13T10:00" })).status).toBe(404);
    await as(other).post("visit_save", { leadId: otherLeadId, at: "2026-11-14T10:00" });
    expect((await visits(A)).map((v) => v.leadName).sort()).toEqual(["Ravi", "Sita"]);
    expect((await visits(agent)).map((v) => v.leadName)).toEqual(["Ravi"]);
  });
  it("other companies cannot touch these leads", async () => {
    await as(B).post("mode_set", { mode: "realestate" });
    expect((await visits(B))).toEqual([]);
    expect((await as(B).post("visit_save", { leadId, at: "2026-11-13T10:00" })).status).toBe(404);
    expect((await as(B).post("visit_done", { leadId, id: "x", outcome: "interested" })).status).toBe(404);
  });
  it("completing a visit records the outcome, moves the stage and adds a note", async () => {
    const v = (await visits(agent))[0];
    expect((await as(agent).post("visit_done", { leadId, id: v.id, outcome: "meh" })).status).toBe(400);
    expect((await as(agent).post("visit_done", { leadId, id: v.id, outcome: "interested", feedback: "Loved the view" })).status).toBe(200);
    const lead = (await as(agent).get("leads")).json.find((l: any) => l.id === leadId);
    expect(lead.status).toBe("Site visit done");
    expect(lead.notes[0].x).toBe("Site visit (Sunrise A-101): interested. Loved the view");
    expect((await visits(agent))[0]).toMatchObject({ done: true, outcome: "interested", bucket: "done" });
  });
  it("a no-show keeps the stage and can be rescheduled", async () => {
    const id2 = (await as(other).get("visits_list", `&now=${NOW}`)).json[0].id;
    await as(other).post("visit_done", { leadId: otherLeadId, id: id2, outcome: "no_show" });
    expect((await as(other).get("leads")).json[0].status).toBe("Site visit scheduled");
    expect((await as(other).post("visit_save", { leadId: otherLeadId, id: id2, at: "2026-11-20T10:00" })).status).toBe(200);
    expect((await visits(other))[0]).toMatchObject({ done: false, bucket: "upcoming", at: "2026-11-20T10:00" });
    expect((await visits(other))[0].outcome).toBeUndefined();
  });
  it("never moves a lead backwards when a visit is scheduled", async () => {
    await as(agent).post("leads_update", { status: "Negotiation" }, `&id=${leadId}`);
    await as(agent).post("visit_save", { leadId, at: "2026-11-25T10:00" });
    expect((await as(agent).get("leads")).json.find((l: any) => l.id === leadId).status).toBe("Negotiation");
  });
  it("deletes a visit but not other appointments", async () => {
    await as(agent).post("leads_update", { appts: [...(fake.collection("crm_leads").docs.find((d: any) => d._id === leadId)!.data.appts), { id: "m1", at: "2026-11-30T10:00", type: "Meeting" }] }, `&id=${leadId}`);
    const v = (await visits(agent)).find((x) => !x.done)!;
    await as(agent).post("visit_delete", { leadId, id: v.id });
    const appts = fake.collection("crm_leads").docs.find((d: any) => d._id === leadId)!.data.appts;
    expect(appts.some((a: any) => a.id === "m1")).toBe(true);
    expect(appts.some((a: any) => a.id === v.id)).toBe(false);
  });
});
