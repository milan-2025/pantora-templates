/**
 * LeadFlow CRM billing: prices, end dates, and the real CRM API handler paying for a plan (mock payment
 * provider, in-memory database), including the webhook confirming the same payment again.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { makeFakeDb } from "./fakeMongo";

const fake = makeFakeDb();
vi.mock("@/lib/cms/queries", () => ({ getPayloadClient: async () => ({ db: { connection: { db: fake } } }) }));
vi.mock("@/lib/brevo", () => ({ sendWithBrevo: vi.fn(async () => ({ sent: false })) }));

process.env.PAYLOAD_SECRET = "test-secret";

import { BillingError, CRM_PRICES, extendUntil, markCrmPaid, quoteCrm } from "../lib/crm/billing";

let route: typeof import("../app/api/crm/route");
let ipN = 0;
async function call(r: string, opts: { body?: unknown; cookie?: string } = {}) {
  const req = new NextRequest(`http://localhost/api/crm?r=${r}`, {
    method: opts.body !== undefined ? "POST" : "GET",
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    headers: { "x-forwarded-for": `10.9.0.${++ipN}`, ...(opts.cookie ? { cookie: opts.cookie } : {}) },
  });
  const res = await (req.method === "POST" ? route.POST(req) : route.GET(req));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any, setCookie: res.headers.get("set-cookie") || "" };
}

describe("prices and dates", () => {
  it("charges per company per month: Starter ₹249, Growth ₹449", () => {
    expect(CRM_PRICES.starter.perMonth).toBe(249);
    expect(CRM_PRICES.growth.perMonth).toBe(449);
    expect(quoteCrm("starter", 1).total).toBe(249);
    expect(quoteCrm("growth", 12).total).toBe(449 * 12);
  });
  it("refuses plans and lengths that are not on the price list", () => {
    expect(() => quoteCrm("trial", 1)).toThrow(BillingError);
    expect(() => quoteCrm("internal", 1)).toThrow(BillingError);
    expect(() => quoteCrm("starter", 2)).toThrow(BillingError);
    expect(() => quoteCrm("growth", "12; drop")).toThrow(BillingError);
  });
  it("adds calendar months from today, or from the current end date when that is later", () => {
    const now = Date.UTC(2026, 10, 27, 6);
    expect(new Date(extendUntil(null, 1, now)).toISOString().slice(0, 10)).toBe("2026-12-27");
    expect(new Date(extendUntil(Date.UTC(2027, 0, 10, 6), 3, now)).toISOString().slice(0, 10)).toBe("2027-04-10");
    expect(new Date(extendUntil(Date.UTC(2026, 0, 1), 1, now)).toISOString().slice(0, 10)).toBe("2026-12-27"); // an old end date is ignored
    expect(new Date(extendUntil(null, 1, Date.UTC(2027, 0, 31, 6))).toISOString().slice(0, 10)).toBe("2027-02-28"); // no rollover into March
  });
});

describe("paying inside the CRM", () => {
  let owner = "", agent = "";
  beforeAll(async () => {
    route = await import("../app/api/crm/route");
    const s = await call("signup", { body: { company: "Kappa Realty", name: "Owner Kappa", email: "owner@kappa.in", password: "password123" } });
    owner = s.setCookie.split(";")[0];
    await call("user_save", { cookie: owner, body: { name: "Agent K", email: "agent@kappa.in", password: "password123", role: "agent" } });
    const a = await call("login", { body: { email: "agent@kappa.in", password: "password123" } });
    agent = a.setCookie.split(";")[0];
  });

  it("shows the prices and the current trial", async () => {
    const b = await call("billing", { cookie: owner });
    expect(b.status).toBe(200);
    expect(b.json).toMatchObject({ plan: "trial", admin: true, months: [1, 3, 6, 12] });
    expect(b.json.prices.starter.perMonth).toBe(249);
  });

  it("only lets an admin pay", async () => {
    expect((await call("billing_checkout", { cookie: agent, body: { plan: "starter", months: 1 } })).status).toBe(403);
    expect((await call("billing", { cookie: agent })).json.payments).toEqual([]);
  });

  it("switches the plan on as soon as the payment is confirmed, with no manual step", async () => {
    const o = await call("billing_checkout", { cookie: owner, body: { plan: "growth", months: 3 } });
    expect(o.status).toBe(200);
    expect(o.json).toMatchObject({ provider: "mock", total: 449 * 3, plan: "growth", months: 3 });
    const v = await call("billing_verify", { cookie: owner, body: {} });
    expect(v.status).toBe(200);
    expect(v.json.plan).toBe("growth");
    const me = (await call("me", { cookie: owner })).json;
    expect(me.ws).toMatchObject({ plan: "growth", readonly: false });
    expect(me.ws.daysLeft).toBeGreaterThan(85);
    const b = (await call("billing", { cookie: owner })).json;
    expect(b.payments).toHaveLength(1);
    expect(b.payments[0]).toMatchObject({ plan: "growth", months: 3, amount: 1347 });

    // Razorpay's webhook confirming the same payment again changes nothing.
    const w = fake.collection("crm_workspaces");
    const ws = (await w.findOne({ name: "Kappa Realty" }))!;
    expect(await markCrmPaid(ws.billing.orderId, "pay_again")).toEqual({ found: true, alreadyPaid: true });
    expect((await w.findOne({ name: "Kappa Realty" }))!.payments).toHaveLength(1);
    expect(await markCrmPaid("order_unknown")).toEqual({ found: false });
  });

  it("renewing adds the months after the current end date", async () => {
    const w = fake.collection("crm_workspaces");
    const before = (await w.findOne({ name: "Kappa Realty" }))!.validUntil;
    await call("billing_checkout", { cookie: owner, body: { plan: "growth", months: 1 } });
    await call("billing_verify", { cookie: owner, body: {} });
    const after = (await w.findOne({ name: "Kappa Realty" }))!.validUntil;
    expect(new Date(after).getTime()).toBe(extendUntil(before, 1, Date.now()));
  });

  it("still lets a company pay after its trial or plan has ended (other changes stay paused)", async () => {
    const w = fake.collection("crm_workspaces");
    await w.updateOne({ name: "Kappa Realty" }, { $set: { plan: "starter", validUntil: Date.now() - 864e5 } });
    expect((await call("leads_add", { cookie: owner, body: { name: "X", phone: "9876500000" } })).status).toBe(402);
    expect((await call("billing_checkout", { cookie: owner, body: { plan: "starter", months: 1 } })).status).toBe(200);
    expect((await call("billing_verify", { cookie: owner, body: {} })).status).toBe(200);
    expect((await call("me", { cookie: owner })).json.ws).toMatchObject({ plan: "starter", readonly: false });
    expect((await call("leads_add", { cookie: owner, body: { name: "X", phone: "9876500000" } })).status).toBe(200);
  });

  it("refuses a bad plan or length", async () => {
    expect((await call("billing_checkout", { cookie: owner, body: { plan: "internal", months: 1 } })).status).toBe(400);
    expect((await call("billing_checkout", { cookie: owner, body: { plan: "starter", months: 7 } })).status).toBe(400);
  });
});
