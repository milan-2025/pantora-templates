/**
 * End-to-end tests of the real CRM API handler (app/api/crm/route.ts) against an in-memory database.
 * Covers: Real estate mode switching, tenant (company) isolation, unit holds, permissions and plan limits.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { makeFakeDb } from "./fakeMongo";

const fake = makeFakeDb();
vi.mock("@/lib/cms/queries", () => ({ getPayloadClient: async () => ({ db: { connection: { db: fake } } }) }));

process.env.PAYLOAD_SECRET = "test-secret";
process.env.CRM_SUPERADMINS = "boss@platform.in";

let route: typeof import("../app/api/crm/route");
let ipN = 0;

type Sess = { cookie: string; email: string };
async function call(r: string, opts: { method?: string; body?: unknown; cookie?: string; query?: string; ip?: string } = {}) {
  const req = new NextRequest(`http://localhost/api/crm?r=${r}${opts.query || ""}`, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    headers: { "x-forwarded-for": opts.ip ?? `10.0.0.${++ipN}`, ...(opts.cookie ? { cookie: opts.cookie } : {}) },
  });
  const res = await (req.method === "POST" ? route.POST(req) : route.GET(req));
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any, setCookie: res.headers.get("set-cookie") || "" };
}
async function signup(company: string, email: string): Promise<Sess> {
  const r = await call("signup", { body: { company, name: "Owner " + company, email, password: "password123" } });
  expect(r.status).toBe(200);
  return { cookie: r.setCookie.split(";")[0], email };
}
const as = (s: Sess) => ({
  get: (r: string, query?: string) => call(r, { cookie: s.cookie, query }),
  post: (r: string, body: unknown, query?: string) => call(r, { cookie: s.cookie, body, query }),
});

let A: Sess, B: Sess;
let agentA: Sess;
let projA = "", unitA = "";

beforeAll(async () => {
  route = await import("../app/api/crm/route");
  A = await signup("Alpha Realty", "owner@alpha.in");
  B = await signup("Beta Homes", "owner@beta.in");
});

describe("mode switch", () => {
  it("starts as a normal CRM and real estate endpoints are locked", async () => {
    expect((await as(A).get("me")).json.ws.mode).toBe("general");
    for (const r of ["projects_list", "units_list"]) {
      const x = await as(A).get(r);
      expect(x.status).toBe(403);
      expect(x.json.error).toMatch(/Real estate mode is off/);
    }
    expect((await as(A).post("project_save", { name: "X" })).status).toBe(403);
  });
  it("normal CRM features keep working in general mode", async () => {
    expect((await as(A).post("leads_add", { name: "Ravi", phone: "9876543210", status: "New" })).status).toBe(200);
    expect((await as(A).get("leads")).json).toHaveLength(1);
  });
  it("only an admin can switch it, and it affects only their own company", async () => {
    await as(A).post("user_save", { name: "Agent One", email: "agent@alpha.in", role: "agent", password: "password123" });
    const login = await call("login", { body: { email: "agent@alpha.in", password: "password123" } });
    agentA = { cookie: login.setCookie.split(";")[0], email: "agent@alpha.in" };
    expect((await as(agentA).post("mode_set", { mode: "realestate" })).status).toBe(403);
    expect((await as(A).post("mode_set", { mode: "realestate" })).json.mode).toBe("realestate");
    expect((await as(A).get("me")).json.ws.mode).toBe("realestate");
    expect((await as(B).get("me")).json.ws.mode).toBe("general"); // other company unaffected
  });
  it("platform admin can set the mode for a company", async () => {
    const boss = await signup("Platform", "boss@platform.in");
    const list = (await as(boss).get("sa_list")).json as any[];
    const beta = list.find((w) => w.name === "Beta Homes");
    expect(beta.mode).toBe("general");
    await as(boss).post("sa_update", { id: beta.id, mode: "realestate" });
    expect((await as(B).get("me")).json.ws.mode).toBe("realestate");
    await as(boss).post("sa_update", { id: beta.id, mode: "general" });
    expect((await as(B).get("me")).json.ws.mode).toBe("general");
  });
  it("turning it off hides the features but keeps the data", async () => {
    const p = await as(A).post("project_save", { name: "Keep Me" });
    await as(A).post("unit_save", { project: p.json.id, no: "1" });
    await as(A).post("mode_set", { mode: "general" });
    expect((await as(A).get("units_list")).status).toBe(403);
    await as(A).post("mode_set", { mode: "realestate" });
    expect((await as(A).get("units_list")).json.some((u: any) => u.no === "1")).toBe(true);
    await as(A).post("project_delete", { id: p.json.id });
  });
});

describe("projects and units", () => {
  it("creates projects (admin only) with unique names", async () => {
    expect((await as(agentA).post("project_save", { name: "Nope" })).status).toBe(403);
    const p = await as(A).post("project_save", { name: "Sunrise Heights", city: "Pune", holdHours: 24 });
    expect(p.status).toBe(200);
    projA = p.json.id;
    expect((await as(A).post("project_save", { name: "sunrise heights" })).status).toBe(400);
  });
  it("adds units, blocks duplicates, and imports in bulk", async () => {
    const u = await as(A).post("unit_save", { project: projA, no: "A-101", tower: "A", floor: 1, bhk: "2BHK", area: "1,100", price: "₹ 85,00,000" });
    expect(u.status).toBe(200);
    unitA = u.json.id;
    expect((await as(A).post("unit_save", { project: projA, no: "A-101" })).status).toBe(400);
    const imp = await as(A).post("units_import", { project: projA, rows: [{ no: "A-101" }, { no: "A-102", price: 9000000 }, { no: "A-103" }, { tower: "x" }] });
    expect(imp.json).toEqual({ added: 2, skipped: 2, overLimit: 0 });
    const list = (await as(A).get("units_list", `&id=${projA}`)).json;
    expect(list).toHaveLength(3);
    expect(list.find((x: any) => x.no === "A-101")).toMatchObject({ area: 1100, price: 8500000, status: "available" });
  });
  it("enforces the plan unit limit", async () => {
    const big = Array.from({ length: 300 }, (_, i) => ({ no: `L-${i}` }));
    const r = await as(A).post("units_import", { project: projA, rows: big });
    expect(r.json.added + 3).toBe(200); // trial plan allows 200 units in total
    expect(r.json.overLimit).toBe(300 - r.json.added);
    expect((await as(A).post("unit_save", { project: projA, no: "OVER" })).status).toBe(403);
  });
});

describe("company isolation", () => {
  it("another company sees none of these projects or units, and cannot change them", async () => {
    await as(B).post("mode_set", { mode: "realestate" });
    expect((await as(B).get("projects_list")).json).toEqual([]);
    expect((await as(B).get("units_list")).json).toEqual([]);
    expect((await as(B).get("units_list", `&id=${projA}`)).json).toEqual([]);
    expect((await as(B).post("unit_hold", { id: unitA })).status).toBe(404);
    expect((await as(B).post("unit_status", { id: unitA, status: "sold" })).status).toBe(404);
    expect((await as(B).post("unit_release", { id: unitA })).status).toBe(404);
    expect((await as(B).post("unit_delete", { id: unitA })).status).toBe(200); // scoped delete: removes nothing
    expect((await as(B).post("unit_save", { project: projA, no: "HACK" })).status).toBe(400); // project not theirs
    expect((await as(B).post("units_import", { project: projA, rows: [{ no: "HACK" }] })).status).toBe(400);
    expect((await as(B).post("project_delete", { id: projA })).status).toBe(200); // scoped: removes nothing
    expect((await as(A).get("units_list", `&id=${projA}`)).json.length).toBeGreaterThan(3);
    expect((await as(A).get("projects_list")).json).toHaveLength(1);
  });
  it("same unit numbers are fine in different companies", async () => {
    const p = await as(B).post("project_save", { name: "Sunrise Heights" });
    expect((await as(B).post("unit_save", { project: p.json.id, no: "A-101" })).status).toBe(200);
  });
  it("cannot hold a unit for another company's lead", async () => {
    const lead = await as(B).post("leads_add", { name: "Beta lead", phone: "9000000001" });
    expect((await as(A).post("unit_hold", { id: unitA, leadId: lead.json.id })).status).toBe(404);
  });
});

describe("holds and bookings", () => {
  it("an agent can hold an available unit; a second hold is refused", async () => {
    expect((await as(agentA).post("unit_hold", { id: unitA, hours: 2 })).status).toBe(200);
    const again = await as(A).post("unit_hold", { id: unitA });
    expect(again.status).toBe(409);
    const u = (await as(A).get("units_list")).json.find((x: any) => x.id === unitA);
    expect(u).toMatchObject({ status: "soft_hold", heldBy: "Agent One" });
  });
  it("agents cannot book, sell, block or edit units", async () => {
    for (const status of ["booked", "sold", "hard_hold", "available"]) {
      expect((await as(agentA).post("unit_status", { id: unitA, status })).status).toBe(403);
    }
    expect((await as(agentA).post("unit_save", { project: projA, no: "A-101", price: 1 })).status).toBe(403);
    expect((await as(agentA).post("unit_delete", { id: unitA })).status).toBe(403);
  });
  it("only the holder or an admin can release", async () => {
    const other = (await as(A).post("user_save", { name: "Agent Two", email: "a2@alpha.in", role: "agent", password: "password123" }), await call("login", { body: { email: "a2@alpha.in", password: "password123" } }));
    const a2: Sess = { cookie: other.setCookie.split(";")[0], email: "a2@alpha.in" };
    expect((await as(a2).post("unit_release", { id: unitA })).status).toBe(403);
    expect((await as(agentA).post("unit_release", { id: unitA })).status).toBe(200);
    expect((await as(A).get("units_list")).json.find((x: any) => x.id === unitA).status).toBe("available");
  });
  it("expired holds free themselves", async () => {
    await as(agentA).post("unit_hold", { id: unitA, hours: 1 });
    const stored = fake.collection("crm_units").docs.find((d: any) => d._id === unitA)!;
    stored.heldUntil = Date.now() - 1000; // pretend the hold ran out
    const u = (await as(A).get("units_list")).json.find((x: any) => x.id === unitA);
    expect(u).toMatchObject({ status: "available", heldBy: "", leadName: "" });
    expect((await as(A).post("unit_hold", { id: unitA })).status).toBe(200); // someone else can take it now
    await as(A).post("unit_release", { id: unitA });
  });
  it("an admin books a unit for a lead, which moves the lead to Booked", async () => {
    const lead = await as(A).post("leads_add", { name: "Priya", phone: "9123456780", status: "Negotiation" });
    expect((await as(A).post("unit_status", { id: unitA, status: "booked", leadId: lead.json.id })).status).toBe(200);
    const u = (await as(A).get("units_list")).json.find((x: any) => x.id === unitA);
    expect(u).toMatchObject({ status: "booked", leadName: "Priya" });
    const l = (await as(A).get("leads")).json.find((x: any) => x.id === lead.json.id);
    expect(l).toMatchObject({ status: "Booked", unit: "A A-101" });
    // a booked unit cannot be grabbed by a hold
    expect((await as(agentA).post("unit_hold", { id: unitA })).status).toBe(409);
    // sold units can only be reopened, not re-booked
    await as(A).post("unit_status", { id: unitA, status: "sold" });
    expect((await as(A).post("unit_status", { id: unitA, status: "booked" })).status).toBe(409);
    expect((await as(A).post("unit_status", { id: unitA, status: "available" })).status).toBe(200);
  });
  it("lets an agent hold only for their own leads", async () => {
    const mineLead = await as(agentA).post("leads_add", { name: "Mine", phone: "9111111111" });
    const adminLead = await as(A).post("leads_add", { name: "Theirs", phone: "9222222222", owner: "Owner Alpha Realty" });
    const unit2 = (await as(A).get("units_list")).json.find((x: any) => x.no === "A-102").id;
    expect((await as(agentA).post("unit_hold", { id: unit2, leadId: adminLead.json.id })).status).toBe(404);
    expect((await as(agentA).post("unit_hold", { id: unit2, leadId: mineLead.json.id })).status).toBe(200);
  });
});

describe("read-only (expired trial) companies", () => {
  it("cannot change inventory or the mode, but can still read", async () => {
    fake.collection("crm_workspaces").docs.forEach((w: any) => { if (w.name === "Beta Homes") w.trialEnds = Date.now() - 1000; });
    expect((await as(B).post("unit_save", { project: "x", no: "1" })).status).toBe(402);
    expect((await as(B).post("mode_set", { mode: "general" })).status).toBe(402);
    expect((await as(B).get("units_list")).status).toBe(200);
  });
});
