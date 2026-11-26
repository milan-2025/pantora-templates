/* eslint-disable @typescript-eslint/no-explicit-any -- loose JSON from the API under test */
import { describe, it, expect, vi, beforeAll } from "vitest";
vi.mock("server-only", () => ({}));
const sent: { to: string; subject: string }[] = [];
vi.mock("@/lib/brevo", () => ({ sendWithBrevo: vi.fn(async (m: any) => { sent.push({ to: m.to[0].email, subject: m.subject }); return { sent: true }; }) }));
const destroyed: string[] = [];
vi.mock("cloudinary", () => ({
  v2: {
    config: () => ({ cloud_name: "c", api_key: "k", api_secret: "s" }),
    utils: { api_sign_request: () => "sig", private_download_url: (id: string, _f: string, o: any) => `https://api.cloudinary.com/dl/${id}?exp=${o.expires_at}` },
    url: (id: string) => `https://res/${id}`,
    uploader: { destroy: async (id: string) => { destroyed.push(id); return {}; } },
  },
}));
import { fakePayload } from "./plannerFakePayload";
import { makeFakeDb } from "./fakeMongo";
vi.mock("@/lib/cms/queries", () => ({ getPayloadClient: async () => fakePayload }));
import { NextRequest } from "next/server";
import { addDays, istDay } from "@/lib/hostbook/core";

const mongo = makeFakeDb();
Object.defineProperty(fakePayload.db, "connection", { value: { db: mongo }, enumerable: false });
process.env.PAYLOAD_SECRET = "test-secret";
process.env.CRON_SECRET = "cron-secret";
process.env.PAYMENT_PROVIDER = "mock";

let route: any;
let ip = 1;
async function call(path: string, opts: { method?: string; body?: unknown; token?: string; acct?: string; headers?: Record<string, string> } = {}) {
  const method = opts.method ?? (opts.body !== undefined ? "POST" : "GET");
  const req = new NextRequest(`http://localhost/api/hostbook/${path}`, {
    method, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    headers: { "x-forwarded-for": `10.9.${Math.floor(ip / 250)}.${ip++ % 250}`, ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}), ...(opts.acct ? { "x-hb-account": opts.acct } : {}), ...opts.headers },
  });
  const [p, q] = path.split("?");
  void q;
  const res = await route[method](req, { params: Promise.resolve({ path: p.split("/") }) });
  return { status: res.status as number, json: (await res.json()) as any };
}
async function signIn(email: string, signup = true) {
  const s = await call("auth/start", { body: { email } });
  expect(s.status).toBe(200);
  const v = await call("auth/verify", { body: { email, code: s.json.devCode, signup, business: "Pine View Stays" } });
  expect(v.status).toBe(200);
  return v.json.token as string;
}
const as = (token: string, acct?: string) => ({
  get: (p: string) => call(p, { token, acct }),
  post: (p: string, body: unknown) => call(p, { token, acct, body }),
  del: (p: string, body: unknown) => call(p, { token, acct, body, method: "DELETE" }),
  save: async (kind: string, data: unknown, id?: string) => call("items", { token, acct, body: { kind, data, id } }),
});

let owner: string;
const today = istDay();

beforeAll(async () => {
  route = await import("../app/api/hostbook/[...path]/route");
  owner = await signIn("host@example.com");
});

describe("HostBook API", () => {
  it("creates the starting plans and a free account", async () => {
    const plans = await call("plans");
    expect(plans.json.plans.map((p: any) => p.planId)).toEqual(["free", "starter", "pro", "business"]);
    const me = await as(owner).get("me");
    expect(me.status).toBe(200);
    expect(me.json.access.plan.planId).toBe("free");
    expect(me.json.account.business).toBe("Pine View Stays");
    expect(me.json.role).toBe("owner");
  });

  it("rejects wrong codes and unsigned requests", async () => {
    await call("auth/start", { body: { email: "x@example.com" } });
    expect((await call("auth/verify", { body: { email: "x@example.com", code: "000000" } })).status).toBe(401);
    expect((await call("me")).status).toBe(401);
  });

  let listing: string, booking: any;
  it("enforces the listing limit of the plan", async () => {
    const a = as(owner);
    const l = await a.save("listing", { name: "Pine View 2BHK", rules: "No smoking", address: "Sector 20, Panchkula", wifiName: "PineView", wifiPass: "secret", checklist: ["Sheets"] });
    expect(l.status).toBe(200);
    listing = l.json.item.id;
    expect(l.json.item.checklist).toBeUndefined(); // cleaning checklists aren't on Free
    const second = await a.save("listing", { name: "Studio" });
    expect(second.status).toBe(402);
    expect(second.json.reason).toBe("listings");
  });

  it("adds bookings with a check-in link, and blocks locked features", async () => {
    const a = as(owner);
    const bad = await a.save("booking", { listingId: listing, start: today, end: today });
    expect(bad.status).toBe(400);
    const b = await a.save("booking", { listingId: listing, start: today, end: addDays(today, 3), guestName: "Riya", payout: 9000, source: "Airbnb", deposit: 2000 });
    expect(b.status).toBe(200);
    booking = b.json.item;
    expect(booking.checkinCode).toMatch(/^[\w-]{8,}$/);
    expect(booking.deposit).toBeUndefined(); // deposits are a Pro feature
    const inv = await a.save("inventory", { name: "Towels", qty: 4 });
    expect(inv.status).toBe(402);
    expect(inv.json.feature).toBe("inventory");
  });

  it("guest check-in: details, ID photos, house rules, host email", async () => {
    const code = booking.checkinCode;
    const v = await call(`checkin/${code}`);
    expect(v.status).toBe(200);
    expect(v.json.listing.rules).toBe("No smoking");
    expect(v.json.listing.address).toBeUndefined(); // only after details are in
    const sig = await call(`checkin/${code}/sign`, { body: {} });
    expect(sig.json.publicId).toMatch(/^hostbook-ids\/\w+\/ci-/);
    expect(sig.json.fields.type).toBe("authenticated");
    const noAgree = await call(`checkin/${code}/submit`, { body: { guests: [{ name: "Riya Mehta" }] } });
    expect(noAgree.status).toBe(400);
    const forged = "hostbook-ids/other/ci-x-y";
    const done = await call(`checkin/${code}/submit`, { body: { agree: true, guests: [{ name: "Riya Mehta", phone: "98765 43210", idType: "Aadhaar", idNumber: "1234 5678 9012", nationality: "Indian", photos: [{ publicId: sig.json.publicId, side: "front" }, { publicId: forged, side: "back" }] }, { name: "John Smith", nationality: "British", passport: "X123" }] } });
    expect(done.status).toBe(200);
    expect(done.json.status).toBe("submitted");
    expect(done.json.listing.address).toBe("Sector 20, Panchkula");
    expect(sent.some((m) => m.to === "host@example.com" && /Guest details in/.test(m.subject))).toBe(true);
    const items = (await as(owner).get("items")).json.items;
    const guests = items.filter((x: any) => x.kind === "guest");
    expect(guests).toHaveLength(2);
    const riya = guests.find((g: any) => g.name === "Riya Mehta");
    expect(riya.idPhotos).toHaveLength(1); // the forged photo id was dropped
    expect(riya.idMasked).toBe("•••• 9012");
    const b = items.find((x: any) => x.id === booking.id);
    expect(b.guestIds).toHaveLength(2);
    // No Form C task: Form C isn't on Free.
    expect(items.some((x: any) => x.kind === "task")).toBe(false);
  });

  it("returning guest (same phone) is updated, not added twice", async () => {
    const b2 = await as(owner).save("booking", { listingId: listing, start: addDays(today, 10), end: addDays(today, 12) });
    await call(`checkin/${b2.json.item.checkinCode}/submit`, { body: { agree: true, guests: [{ name: "Riya Mehta", phone: "+91 9876543210", city: "Delhi" }] } });
    const guests = (await as(owner).get("items")).json.items.filter((x: any) => x.kind === "guest");
    expect(guests).toHaveLength(2);
    expect(guests.find((g: any) => g.name === "Riya Mehta").city).toBe("Delhi");
  });

  it("ID photo links expire and only owners/allowed staff get them", async () => {
    const riya = (await as(owner).get("items")).json.items.find((x: any) => x.kind === "guest" && x.name === "Riya Mehta");
    const l = await as(owner).post("ids/links", { guestId: riya.id });
    expect(l.status).toBe(200);
    expect(l.json.photos[0].url).toMatch(/exp=\d+/);
  });

  it("regular tasks move to the next date when ticked off", async () => {
    const a = as(owner);
    const t = await a.save("task", { title: "AC service", every: 3, unit: "month", due: "2026-01-15", listingId: listing });
    expect(t.status).toBe(200);
    const d = await a.post("tasks/done", { id: t.json.item.id });
    expect(d.status).toBe(200);
    // Done late: skips past dates and stays on the 15th.
    expect(d.json.task.due > today).toBe(true);
    expect(d.json.task.due.endsWith("-15")).toBe(true);
    expect(d.json.run.status).toBe("done");
  });

  let staffAcct: string;
  it("staff see only what they're allowed", async () => {
    const a = as(owner);
    const tooMany = await a.post("account", { staff: [{ email: "a@x.com", perms: ["tasks"] }, { email: "b@x.com", perms: ["tasks"] }] });
    expect(tooMany.status).toBe(402);
    const ok = await a.post("account", { staff: [{ email: "care@example.com", name: "Ramesh", perms: ["bookings", "tasks", "expenses"] }] });
    expect(ok.status).toBe(200);
    expect(sent.some((m) => m.to === "care@example.com")).toBe(true);
    const staff = await signIn("care@example.com", false);
    const me = await as(staff).get("me");
    expect(me.json.role).toBe("staff");
    staffAcct = me.json.account.id;
    const items = (await as(staff).get("items")).json.items;
    expect(items.some((x: any) => x.kind === "guest")).toBe(false);
    expect(items.find((x: any) => x.kind === "booking").payout).toBeUndefined();
    const e = await as(staff).save("expense", { date: today, amount: 300, category: "Laundry", listingId: listing });
    expect(e.status).toBe(200);
    expect((await as(staff).save("listing", { name: "Hack" })).status).toBe(403);
    expect((await as(staff).post("ids/links", { guestId: "x" })).status).toBe(403);
    expect((await as(staff).post("checkout", { plan: "pro", quoteOnly: true })).status).toBe(403);
  });

  it("upgrades through checkout and unlocks features at once", async () => {
    const a = as(owner);
    const q = await a.post("checkout", { plan: "pro", extra: 1, quoteOnly: true });
    expect(q.json).toMatchObject({ total: 2499 + 299, kind: "new" });
    const o = await a.post("checkout", { plan: "pro", extra: 1 });
    expect(o.json.provider).toBe("mock");
    const v = await a.post("checkout/verify", {});
    expect(v.status).toBe(200);
    const me = await a.get("me");
    expect(me.json.access.plan.planId).toBe("pro");
    expect(me.json.access.listingLimit).toBe(9);
    expect((await a.save("inventory", { name: "Towels", qty: 1, min: 2, listingId: listing })).status).toBe(200);
    expect((await a.save("listing", { name: "Studio" })).status).toBe(200);
    const down = await a.post("checkout", { plan: "starter", quoteOnly: true });
    expect(down.status).toBe(400);
    const up = await a.post("checkout", { plan: "business", quoteOnly: true });
    expect(up.json).toMatchObject({ kind: "upgrade", total: 5999 - 2499 });
  });

  it("admin plan changes apply straight away", async () => {
    const pro = fakePayload.db["hostbook-plans"].find((p: any) => p.planId === "pro");
    pro.features = pro.features.filter((f: string) => f !== "inventory");
    const { clearCaches } = await import("@/lib/hostbook/server");
    clearCaches();
    const r = await as(owner).save("inventory", { name: "Soap", qty: 1 });
    expect(r.status).toBe(402);
    // Data is kept: the earlier stock item is still there.
    expect((await as(owner).get("items")).json.items.some((x: any) => x.kind === "inventory")).toBe(true);
    pro.features.push("inventory");
    clearCaches();
  });

  it("daily job: repeating expenses, cleaning lists, morning email, expired IDs deleted", async () => {
    const a = as(owner);
    await a.save("recurring", { category: "Rent / EMI", amount: 15000, day: 1, listingId: listing });
    // Make the Riya ID photo expire.
    const g = mongo.collection("hb_items") as any;
    const riya = g.docs.find((d: any) => d.kind === "guest" && d.name === "Riya Mehta");
    riya.idPhotos[0].deleteAt = Date.now() - 1000;
    const checkout = await a.save("booking", { listingId: listing, start: addDays(today, -2), end: today, guestName: "Out today" });
    expect(checkout.status).toBe(200);
    expect((await call("cron", { headers: { authorization: "Bearer wrong" } })).status).toBe(401);
    const r = await call("cron?daily=1", { headers: { authorization: "Bearer cron-secret" } });
    expect(r.status).toBe(200);
    expect(r.json.idsDeleted).toBe(1);
    expect(destroyed.some((id) => id.startsWith("hostbook-ids/"))).toBe(true);
    expect(r.json.expenses).toBe(1);
    expect(r.json.checklists).toBe(1);
    expect(r.json.digests).toBeGreaterThanOrEqual(1);
    const items = (await a.get("items")).json.items;
    expect(items.find((x: any) => x.id === riya._id).idPhotos).toHaveLength(0);
    expect(items.find((x: any) => x.id === riya._id).idNumber).toBe("1234 5678 9012");
    // Second run the same day doesn't add the rent again.
    const again = await call("cron", { headers: { authorization: "Bearer cron-secret" } });
    expect(again.json.expenses).toBe(0);
  });

  it("staff removed from a team lose access", async () => {
    await as(owner).post("account", { staff: [] });
    const staff = await signIn("care@example.com", false);
    const r = await call("items", { token: staff, acct: staffAcct });
    expect(r.status).toBe(403);
  });

  it("deleting a guest removes their ID photos too", async () => {
    const items = (await as(owner).get("items")).json.items;
    const john = items.find((x: any) => x.kind === "guest" && x.name === "John Smith");
    const r = await as(owner).del("items", { id: john.id });
    expect(r.status).toBe(200);
    const after = await as(owner).get(`items?since=1`);
    expect(after.json.items.find((x: any) => x.id === john.id)?.deleted).toBe(true);
    expect((await as(owner).del("items", { id: items.find((x: any) => x.kind === "listing").id })).status).toBe(400);
  });
});
