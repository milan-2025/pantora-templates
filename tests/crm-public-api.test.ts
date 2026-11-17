import { beforeAll, describe, expect, it, vi } from "vitest";
import { addUser, as, call, fake, loadRoute, mockDb, signup, type Sess } from "./apiHarness";

vi.mock("@/lib/cms/queries", () => ({ getPayloadClient: mockDb }));

let A: Sess, B: Sess, agent: Sess, partner: Sess;
let projId = "", pub = "", agentId = "", partnerId = "", pageGET: any;

const enquire = (body: Record<string, unknown>, ip?: string) => call("enquiry", { body: { pub, ...body }, ip });
const leadsOf = (name: string) => fake.collection("crm_leads").docs.filter((d: any) => d.data.name === name);
const page = async (p = pub, ref = "", ua = "Mozilla/5.0") =>
  pageGET(new Request(`http://localhost/property/${p}${ref ? "?ref=" + ref : ""}`, { headers: { "user-agent": ua } }), { params: Promise.resolve({ pub: p }) });

beforeAll(async () => {
  await loadRoute();
  pageGET = (await import("../app/property/[pub]/route")).GET;
  A = await signup("Public Realty", "o@pub.in");
  B = await signup("Other Realty", "o@oth.in");
  await as(A).post("mode_set", { mode: "realestate" });
  agent = await addUser(A, "Agent One", "ag@pub.in", "agent");
  partner = await addUser(A, "Anil Broker", "an@pub.in", "partner", { rate: 2 });
  const users = (await as(A).get("users_list")).json as any[];
  agentId = users.find((u) => u.email === "ag@pub.in").id;
  partnerId = users.find((u) => u.email === "an@pub.in").id;
  const p = await as(A).post("project_save", {
    name: "Sunrise <b>Heights</b>", city: "Pune", locality: "Baner", reraNumber: "P123", about: "Lovely\nhomes", amenities: "Pool, Gym",
    cover: "javascript:alert(1)", contactPhone: "+91 98765 43210", published: false,
  });
  projId = p.json.id;
  await as(A).post("unit_save", { project: projId, no: "SECRET-101", bhk: "2BHK", price: 8500000 });
  await as(A).post("unit_save", { project: projId, no: "SECRET-102", bhk: "3BHK", price: 12000000 });
  const u3 = (await as(A).post("unit_save", { project: projId, no: "SECRET-103", bhk: "2BHK", price: 8000000 })).json.id;
  await as(A).post("unit_status", { id: u3, status: "booked" });
  pub = ((await as(A).get("projects_list")).json as any[]).find((x) => x.id === projId).pub;
});

describe("publishing", () => {
  it("gives every project a private-looking link id and keeps the page offline until published", async () => {
    expect(pub).toMatch(/^[a-f0-9]{18}$/);
    expect((await enquire({ name: "A", phone: "9876543210" })).status).toBe(404);
    expect((await page()).status).toBe(404);
  });
  it("older projects without a link id get one when listed", async () => {
    const doc = fake.collection("crm_projects").docs.find((d: any) => d._id === projId)!;
    delete doc.pub;
    const again = ((await as(A).get("projects_list")).json as any[]).find((x) => x.id === projId).pub;
    expect(again).toMatch(/^[a-f0-9]{18}$/);
    pub = again;
  });
  it("only admins set the page details; unsafe values are cleaned", async () => {
    expect((await as(agent).post("project_save", { id: projId, name: "x", published: true })).status).toBe(403);
    const r = await as(A).post("project_save", { id: projId, name: "Sunrise <b>Heights</b>", city: "Pune", locality: "Baner", reraNumber: "P123", about: "Lovely\nhomes", amenities: "Pool, Gym", cover: "javascript:alert(1)", contactPhone: "+91 98765 43210", published: true });
    expect(r.status).toBe(200);
    const p = ((await as(A).get("projects_list")).json as any[])[0];
    expect(p).toMatchObject({ published: true, cover: "", contactPhone: "9876543210", amenities: ["Pool", "Gym"] });
    expect(((await as(agent).get("projects_list")).json as any[])[0].about).toBeUndefined(); // team members only get what they need to share
    expect(((await as(agent).get("projects_list")).json as any[])[0].pub).toBe(pub);
  });
});

describe("public page", () => {
  it("renders a safe page with the unit mix but no unit numbers, buyers or booked units", async () => {
    const res = await page(pub, agentId);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const h = await res.text();
    expect(h).toContain("Sunrise &lt;b&gt;Heights&lt;/b&gt;");
    expect(h).not.toContain("<b>Heights</b>");
    expect(h).toContain("Baner, Pune");
    expect(h).toContain("RERA: P123");
    expect(h).toContain("Pool");
    expect(h).not.toContain("SECRET");
    expect(h).not.toContain("javascript:");
    expect(h).toContain("₹85 L"); // 2BHK from: the booked ₹80L unit is not listed
    expect(h).not.toContain("₹80 L");
    expect(h).toContain(`ref:"${agentId}"`);
  });
  it("counts views for people, not for link-preview bots", async () => {
    const views = () => fake.collection("crm_projects").docs.find((d: any) => d._id === projId)!.views || 0;
    const v0 = views();
    await page(pub, "", "WhatsApp/2.23");
    await page(pub, "", "Googlebot");
    expect(views()).toBe(v0);
    await page();
    await new Promise((r) => setTimeout(r, 5));
    expect(views()).toBe(v0 + 1);
  });
  it("404s for bad ids, other pages and unpublished projects", async () => {
    expect((await page("zzz")).status).toBe(404);
    expect((await page("a".repeat(18))).status).toBe(404);
    expect((await page("../../etc")).status).toBe(404);
  });
});

describe("enquiry form", () => {
  it("creates a lead in the right company with the project, source and message", async () => {
    const r = await enquire({ name: "Meera", phone: "+91 90000 11111", message: "2BHK please" });
    expect(r.status).toBe(200);
    const l = leadsOf("Meera");
    expect(l).toHaveLength(1);
    expect(l[0].ws).toBe(fake.collection("crm_projects").docs.find((d: any) => d._id === projId)!.ws);
    expect(l[0].data).toMatchObject({ phone: "9000011111", source: "Project page", campaign: "Sunrise <b>Heights</b>", project: "Sunrise <b>Heights</b>", status: "New" });
    expect(l[0].data.notes[0].x).toBe("2BHK please");
    expect(l[0].data.owner).not.toBe("Anil Broker");
    expect((await as(B).get("leads")).json).toEqual([]); // other company sees nothing
    expect(fake.collection("crm_projects").docs.find((d: any) => d._id === projId)!.enquiries).toBe(1);
  });
  it("assigns the lead to the agent whose link was used, and credits partners", async () => {
    await enquire({ name: "ViaAgent", phone: "9000022222", ref: agentId });
    expect(leadsOf("ViaAgent")[0].data.owner).toBe("Agent One");
    await enquire({ name: "ViaPartner", phone: "9000033333", ref: partnerId });
    const d = leadsOf("ViaPartner")[0].data;
    expect(d).toMatchObject({ partnerId, partner: "Anil Broker" });
    expect(d.owner).not.toBe("Anil Broker");
    expect((await as(partner).get("leads")).json.map((l: any) => l.name)).toContain("ViaPartner");
  });
  it("ignores a link id that belongs to another company", async () => {
    const otherUser = ((await as(B).get("users_list")).json as any[])[0].id;
    await enquire({ name: "Stranger", phone: "9000044444", ref: otherUser });
    expect(leadsOf("Stranger")[0].data.owner).not.toBe("Owner Other Realty");
    expect(leadsOf("Stranger")[0].data.partnerId).toBeUndefined();
  });
  it("does not create duplicates: repeat enquiries add a note to the existing lead", async () => {
    await enquire({ name: "Meera", phone: "9000011111", message: "Any 3BHK?" });
    expect(leadsOf("Meera")).toHaveLength(1);
    expect(leadsOf("Meera")[0].data.notes[0].x).toContain("Enquired again");
    expect(leadsOf("Meera")[0].data.notes[0].x).toContain("Any 3BHK?");
  });
  it("rejects bad input and bots without creating anything", async () => {
    const before = fake.collection("crm_leads").docs.length;
    expect((await enquire({ name: "", phone: "9000055555" })).status).toBe(400);
    expect((await enquire({ name: "X", phone: "123" })).status).toBe(400);
    expect((await call("enquiry", { body: { pub: "short", name: "X", phone: "9000055555" } })).status).toBe(404);
    const bot = await enquire({ name: "Bot", phone: "9000066666", website: "http://spam" });
    expect(bot.status).toBe(200); // bots are told it worked
    expect(fake.collection("crm_leads").docs.length).toBe(before);
  });
  it("limits how often one visitor can submit", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await enquire({ name: "Spam" + i, phone: `90000770${10 + i}` }, "203.0.113.9")).status);
    expect(codes.slice(0, 5).every((c) => c === 200)).toBe(true);
    expect(codes.slice(5)).toEqual([429, 429]);
  });
  it("stops accepting enquiries and hides the page when mode is off, the trial ends or the project is unpublished", async () => {
    const ws = fake.collection("crm_workspaces").docs.find((w: any) => w.name === "Public Realty")!;
    await as(A).post("mode_set", { mode: "general" });
    expect((await enquire({ name: "Late", phone: "9000088881" })).status).toBe(404);
    expect((await page()).status).toBe(404);
    await as(A).post("mode_set", { mode: "realestate" });
    expect((await enquire({ name: "Back", phone: "9000088882" })).status).toBe(200);
    const end = ws.trialEnds; ws.trialEnds = Date.now() - 1000;
    expect((await enquire({ name: "Expired", phone: "9000088883" })).status).toBe(404);
    expect((await page()).status).toBe(404);
    ws.trialEnds = end;
    ws.status = "suspended";
    expect((await enquire({ name: "Susp", phone: "9000088884" })).status).toBe(404);
    ws.status = "active";
    await as(A).post("project_save", { id: projId, name: "Sunrise", published: false });
    expect((await enquire({ name: "Unpub", phone: "9000088885" })).status).toBe(404);
    expect((await page()).status).toBe(404);
  });
});
