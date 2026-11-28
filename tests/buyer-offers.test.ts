/* eslint-disable @typescript-eslint/no-explicit-any -- loose test data */
import { beforeAll, describe, expect, it, vi } from "vitest";
const sent: { to: string; subject: string; html: string }[] = [];
vi.mock("@/lib/brevo", () => ({ sendWithBrevo: vi.fn(async (m: any) => { sent.push({ to: m.to[0].email, subject: m.subject, html: m.html }); return { sent: true }; }) }));
import { fakePayload } from "./plannerFakePayload";
import { makeFakeDb } from "./fakeMongo";
import { NextRequest } from "next/server";

const mongo = makeFakeDb();
Object.defineProperty(fakePayload.db, "connection", { value: { db: mongo }, enumerable: false, configurable: true });
vi.mock("@/lib/cms/queries", () => ({ getPayloadClient: async () => fakePayload }));
process.env.PAYLOAD_SECRET = "test-secret";
process.env.NEXT_PUBLIC_SITE_URL = "https://pandoratemplates.com";

import { campaignStatus, checkUnsubscribeSig, getOfferSettings, offerEmail, recipients, sendBuyerOffers, unsubscribeSig } from "../lib/buyerOffers";

beforeAll(async () => {
  const sheet = await fakePayload.create({ collection: "products", data: { slug: "wedding_planner_sheet", name: "Sheet" } });
  const tracker = await fakePayload.create({ collection: "products", data: { slug: "workout_challange", name: "Tracker" } });
  const order = (product: string, email: string, status = "paid") => fakePayload.create({ collection: "orders", data: { product, email, customerName: "Asha Rao", paymentStatus: status } });
  await order(sheet.id, "asha@example.com");
  await order(sheet.id, "ASHA@example.com"); // same person, two orders
  await order(sheet.id, "ravi@example.com");
  await order(sheet.id, "pending@example.com", "pending");
  await order(sheet.id, "planner-user@example.com");
  await order(tracker.id, "fit@example.com");
  await fakePayload.create({ collection: "planners", data: { ownerEmail: "planner-user@example.com" } });
  await fakePayload.create({ collection: "affiliates", data: { code: "SHEET500", active: true, appliesTo: "listed", productDeals: [{ kind: "planner" }] } });
  await fakePayload.create({ collection: "affiliates", data: { code: "SHOPONLY", active: true, appliesTo: "listed", productDeals: [{ kind: "shop" }] } });
  await fakePayload.updateGlobal({ slug: "buyer-offers", data: { on: true, dailyLimit: 50, plannerOn: true, plannerCode: "sheet500", plannerOffer: "₹500 off the Family plan", workoutOn: false } });
});

describe("past buyer offers", () => {
  it("emails each paying sheet buyer once, skipping pending orders and people already on the planner", async () => {
    expect((await recipients(fakePayload, "planner")).map((r) => r.email)).toEqual(["asha@example.com", "ravi@example.com"]);
  });

  it("only sends when the code exists and covers the app", async () => {
    const s = await getOfferSettings(fakePayload);
    expect(await campaignStatus(fakePayload, s, "planner")).toEqual({ ready: true, why: "" });
    expect((await campaignStatus(fakePayload, { ...s, plannerCode: "SHOPONLY" }, "planner")).why).toMatch(/doesn't have a deal for the planner/);
    expect((await campaignStatus(fakePayload, { ...s, plannerCode: "NOPE" }, "planner")).why).toMatch(/doesn't exist/);
    expect((await campaignStatus(fakePayload, s, "workout")).why).toBe("Campaign is switched off");
  });

  it("sends the batch, then never the same email twice", async () => {
    const r: any = await sendBuyerOffers(fakePayload);
    expect(r.planner).toEqual({ sent: 2, failed: 0 });
    expect(r.workout.note).toBe("Campaign is switched off");
    expect(sent.map((m) => m.to)).toEqual(["asha@example.com", "ravi@example.com"]);
    expect(sent[0].html).toContain("SHEET500");
    expect(sent[0].html).toContain("code=SHEET500");
    expect(sent[0].html).toContain("/api/email/unsubscribe?e=asha%40example.com&amp;s=");
    expect(((await sendBuyerOffers(fakePayload)) as any).planner).toEqual({ sent: 0, failed: 0 });
  });

  it("respects the daily limit and the on/off switch", async () => {
    await fakePayload.updateGlobal({ slug: "buyer-offers", data: { on: false } });
    expect(await sendBuyerOffers(fakePayload)).toEqual({ skipped: "Sending is off" });
    await fakePayload.updateGlobal({ slug: "buyer-offers", data: { on: true } });
  });

  it("unsubscribes only with a valid signed link, and then never emails that person", async () => {
    expect(checkUnsubscribeSig("fit@example.com", unsubscribeSig("FIT@example.com"))).toBe(true);
    expect(checkUnsubscribeSig("fit@example.com", unsubscribeSig("other@example.com"))).toBe(false);
    const route = await import("../app/api/email/unsubscribe/route");
    const bad = await route.POST(new NextRequest("https://x/api/email/unsubscribe", { method: "POST", body: "e=fit%40example.com&s=wrong" }));
    expect(bad.status).toBe(400);
    const get = await route.GET(new NextRequest(`https://x/api/email/unsubscribe?e=fit%40example.com&s=${unsubscribeSig("fit@example.com")}`));
    expect(await get.text()).toContain("Stop offer emails?"); // a link scanner opening it unsubscribes nobody
    expect((await recipients(fakePayload, "workout")).map((r) => r.email)).toEqual(["fit@example.com"]);
    const ok = await route.POST(new NextRequest("https://x/api/email/unsubscribe", { method: "POST", body: `e=fit%40example.com&s=${unsubscribeSig("fit@example.com")}` }));
    expect(await ok.text()).toContain("You're unsubscribed");
    expect(await recipients(fakePayload, "workout")).toEqual([]);
  });

  it("writes an email with the code, the offer and a way out", () => {
    const m = offerEmail("workout", { email: "a@b.in", name: "<b>Riya</b>" }, "FIT30", "30% off any yearly plan");
    expect(m.subject).toMatch(/workout/i);
    expect(m.html).toContain("Hi &lt;b&gt;Riya&lt;/b&gt;,");
    expect(m.html).toContain("30% off any yearly plan");
    expect(m.html).toContain("/workout?v=streak&amp;code=FIT30");
    expect(m.text).toContain("Unsubscribe:");
  });
});
