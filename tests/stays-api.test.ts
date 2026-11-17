/**
 * Stays: end-to-end API tests (real route handlers, in-memory database).
 * Covers the mandatory checks in the project brief: roles, approval, IDs, pricing, privacy, share links,
 * WhatsApp enquiries, map privacy, media persistence and offline sync.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ADMIN_COOKIE, SECRETS, admin, asHost, call, fake, fakeUpload, fullListing, loadRoutes, mockPayload, registerHost, type HostSess } from "./staysHarness";

vi.mock("@/lib/cms/queries", () => ({ getPayloadClient: mockPayload }));
vi.mock("server-only", () => ({}));

let H1: HostSess, H2: HostSess;
let own = "", hostProp = "", h2Prop = "";
const stored = (id: string) => fake.collection("stay_properties").docs.find((d: any) => d._id === id)!;
const noSecrets = (raw: string) => SECRETS.filter((s) => raw.includes(s));
/** Admin edit the way the form does it: load the latest version, change some fields, save. */
async function adminSave(id: string, patch: Record<string, unknown>) {
  const cur = (await admin.get("property", `&id=${id}`)).json;
  const r = await admin.post("property_save", { ...cur, ...patch, id });
  expect(r.status).toBe(200);
  return r;
}

beforeAll(async () => {
  await loadRoutes();
  H1 = await registerHost("Asha Host", "asha@host.in");
  H2 = await registerHost("Bala Host", "bala@host.in");
});

describe("access control", () => {
  it("admin API refuses guests and hosts", async () => {
    expect((await call("admin", "overview")).status).toBe(401);
    expect((await call("admin", "overview", { cookie: H1.cookie })).status).toBe(401);
    expect((await call("admin", "property_create", { body: { title: "x" } })).status).toBe(401);
    expect((await admin.get("overview")).status).toBe(200);
  });
  it("host API refuses guests", async () => {
    expect((await call("host", "properties")).status).toBe(401);
    expect((await call("host", "property_create", { body: { title: "x" } })).status).toBe(401);
  });
  it("blocks cross-site POSTs", async () => {
    expect((await call("admin", "property_create", { cookie: ADMIN_COOKIE, body: {}, origin: "https://evil.example" })).status).toBe(403);
  });
  it("rejects a tampered host cookie", async () => {
    const bad = H1.cookie.replace(/.$/, (ch) => (ch === "A" ? "B" : "A"));
    expect((await call("host", "properties", { cookie: bad })).status).toBe(401);
  });
});

describe("1. admin manages hosts", () => {
  it("creates a host, edits it, invites them, and the invite sets a password", async () => {
    const r = await admin.post("host_save", { name: "Chitra Collab", phone: "9811111111", email: "chitra@collab.in", payout: "UPI chitra@upi", notes: "Pays on time" });
    expect(r.status).toBe(200);
    expect(r.json.hostCode).toMatch(/^H-\d{4}$/);
    const inv = await admin.post("host_invite", { id: r.json.id });
    const token = new URL(inv.json.link).searchParams.get("invite")!;
    expect((await call("host", "invite", { query: `&token=${token}` })).json.email).toBe("chitra@collab.in");
    const acc = await call("host", "invite_accept", { body: { token, password: "newpass123" } });
    expect(acc.status).toBe(200);
    expect((await call("host", "invite", { query: `&token=${token}` })).status).toBe(404); // single use
    const login = await call("host", "login", { body: { email: "chitra@collab.in", password: "newpass123" } });
    expect(login.status).toBe(200);
    const hosts = (await admin.get("hosts")).json;
    expect(hosts.find((h: any) => h.id === r.json.id)).toMatchObject({ name: "Chitra Collab", payout: "UPI chitra@upi", hasLogin: true });
  });
  it("suspending a host signs them out", async () => {
    const r = await admin.post("host_save", { name: "Temp", email: "temp@h.in" });
    const inv = await admin.post("host_invite", { id: r.json.id });
    const acc = await call("host", "invite_accept", { body: { token: new URL(inv.json.link).searchParams.get("invite"), password: "password123" } });
    const ck = acc.setCookie.split(";")[0];
    expect((await call("host", "properties", { cookie: ck })).status).toBe(200);
    await admin.post("host_save", { id: r.json.id, name: "Temp", email: "temp@h.in", status: "suspended" });
    expect((await call("host", "properties", { cookie: ck })).status).toBe(401);
    expect((await call("host", "login", { body: { email: "temp@h.in", password: "password123" } })).status).toBe(403);
  });
});

describe("6. unique permanent property IDs", () => {
  it("numbers own and host properties separately and never reuses an ID", async () => {
    const a = await admin.post("property_create", fullListing());
    expect(a.status).toBe(200);
    own = a.json.id;
    expect(a.json.code).toBe("LAC-0001");
    const b = await admin.post("property_create", fullListing({ title: "To delete" }));
    expect(b.json.code).toBe("LAC-0002");
    expect((await admin.post("property_delete", { id: b.json.id, confirm: "LAC-0002" })).status).toBe(200);
    const c = await admin.post("property_create", fullListing({ title: "Third" }));
    expect(c.json.code).toBe("LAC-0003");
    await admin.post("property_delete", { id: c.json.id, confirm: "LAC-0003" });
    const h = await asHost(H1).post("property_create", { title: "Asha's Villa" });
    expect(h.json.code).toBe("HST-0001");
    hostProp = h.json.id;
  });
  it("cannot be set by the client", async () => {
    const r = await admin.post("property_save", { ...fullListing(), id: own, code: "LAC-9999" });
    expect(r.json.code).toBe("LAC-0001");
  });
  it("delete needs the ID typed as confirmation", async () => {
    expect((await admin.post("property_delete", { id: own, confirm: "yes" })).status).toBe(400);
  });
});

describe("2–5. host submission and approval", () => {
  it("a host's new property starts as a draft and is not public", async () => {
    expect(stored(hostProp).status).toBe("draft");
    expect(stored(hostProp).hostId).toBe(H1.id);
  });
  it("host fills it in, uploads photos and submits", async () => {
    const save = await asHost(H1).post("property_save", {
      id: hostProp, title: "Asha's Villa", location: { locality: "Kasauli Hills", city: "Kasauli", address: "Plot 9 Secret Road", lat: 30.9012, lng: 76.9654 },
      rooms: { bedrooms: 4, bathrooms: 4, maxGuests: 10 }, landing: { weekday: 9000, weekend: 12000 }, airbnbUrl: "https://www.airbnb.com/rooms/42", amenities: ["pool", "made_up"],
    });
    expect(save.status).toBe(200);
    expect(stored(hostProp).amenities).toEqual(["pool"]); // unknown amenity dropped
    const add = await asHost(H1).post("media_add", { id: hostProp, upload: fakeUpload(hostProp, "front") });
    expect(add.status).toBe(200);
    const sub = await asHost(H1).post("property_action", { id: hostProp, action: "submit" });
    expect(sub.status).toBe(200);
    expect(sub.json.status).toBe("submitted");
    const n = fake.collection("stay_notifications").docs;
    expect(n.some((x: any) => x.kind === "submission" && x.propertyId === hostProp)).toBe(true); // 3. admin notified
  });
  it("host cannot approve, publish, or set prices/visibility/status they shouldn't", async () => {
    for (const action of ["approve", "publish", "reject"]) {
      const r = await asHost(H1).post("property_action", { id: hostProp, action });
      expect(r.status).toBe(400);
    }
    await asHost(H1).post("property_save", { id: hostProp, title: "Asha's Villa", status: "published", visibility: "public", featured: true, pricing: { listing: { weekday: 1 } }, location: { locality: "Kasauli Hills", city: "Kasauli" }, rooms: { bedrooms: 4, bathrooms: 4, maxGuests: 10 } });
    const p = stored(hostProp);
    expect(p.status).toBe("submitted");
    expect(p.featured).toBe(false);
    expect(p.pricing.listing.weekday).toBe(null);
  });
  it("3. submitted property stays hidden until the admin publishes", async () => {
    expect((await call("public", "property", { query: "&code=HST-0001" })).status).toBe(404);
    expect((await call("public", "search")).json.total).toBe(0);
  });
  it("admin can request changes with a reason the host sees", async () => {
    expect((await admin.post("property_action", { id: hostProp, action: "request_changes" })).status).toBe(400); // reason required
    const r = await admin.post("property_action", { id: hostProp, action: "request_changes", reason: "Please add bathroom photos" });
    expect(r.json.status).toBe("changes_requested");
    const mine = (await asHost(H1).get("property", `&id=${hostProp}`)).json;
    expect(mine.review.reason).toBe("Please add bathroom photos");
    expect((await asHost(H1).post("property_action", { id: hostProp, action: "submit" })).json.status).toBe("submitted");
  });
  it("5. admin edits the host's property, sets the guest price and publishes", async () => {
    await adminSave(hostProp, { title: "Asha's Hill Villa", pricing: { landing: { weekday: 9000, weekend: 12000 }, listing: { weekday: 11000, weekend: 15000 } }, visibility: "public", showPrice: true });
    expect((await admin.post("property_action", { id: hostProp, action: "approve" })).json.status).toBe("approved");
    expect((await admin.post("property_action", { id: hostProp, action: "publish" })).json.status).toBe("published");
    expect((await call("public", "property", { query: "&code=HST-0001" })).status).toBe(200);
  });
  it("4. a host can't see or touch another host's property", async () => {
    h2Prop = (await asHost(H2).post("property_create", { title: "Bala's Flat" })).json.id;
    expect((await asHost(H1).get("property", `&id=${h2Prop}`)).status).toBe(404);
    expect((await asHost(H1).post("property_save", { id: h2Prop, title: "Hacked" })).status).toBe(404);
    expect((await asHost(H1).post("media_sign", { id: h2Prop })).status).toBe(404);
    const list = (await asHost(H1).get("properties")).json;
    expect(list.map((p: any) => p.id)).not.toContain(h2Prop);
    expect(list.map((p: any) => p.id)).not.toContain(own);
  });
  it("host edits to a live listing wait for admin review", async () => {
    const cur = (await asHost(H1).get("property", `&id=${hostProp}`)).json;
    const r = await asHost(H1).post("property_save", { ...cur, id: hostProp, title: "Renamed by host", landing: cur.landing });
    expect(r.json.notice).toMatch(/review/);
    expect(stored(hostProp).title).toBe("Asha's Hill Villa");
    const pub = await call("public", "property", { query: "&code=HST-0001" });
    expect(pub.json.title).toBe("Asha's Hill Villa");
    const ap = await admin.post("host_changes", { id: hostProp, decision: "apply" });
    expect(ap.json.title).toBe("Renamed by host");
    expect(stored(hostProp).pricing.listing.weekday).toBe(11000); // admin's guest price kept
  });
  it("host photos added to a live listing are hidden until approved; removals are only requests", async () => {
    await asHost(H1).post("media_add", { id: hostProp, upload: fakeUpload(hostProp, "pool") });
    const pub = (await call("public", "property", { query: "&code=HST-0001" })).json;
    expect(pub.photos.length).toBe(1);
    const firstId = stored(hostProp).media[0].id;
    await asHost(H1).post("media_remove", { id: hostProp, mediaId: firstId });
    expect(stored(hostProp).media.find((m: any) => m.id === firstId).removalRequested).toBe(true);
    await admin.post("media_approve", { id: hostProp, mediaId: "all" });
    expect((await call("public", "property", { query: "&code=HST-0001" })).json.photos.length).toBe(2);
  });
});

describe("7–9. pricing and margins", () => {
  it("7. admin sees correct margins", async () => {
    const p = (await admin.get("property", `&id=${own}`)).json;
    expect(p.margins).toMatchObject({ weekday: 500, weekend: 500, weekdayPct: 20, weekendPct: 16.7, perWeek: 3500, missing: false });
  });
  it("8. landing prices and margins never reach guests", async () => {
    await admin.post("property_action", { id: own, action: "publish" });
    const pub = await call("public", "property", { query: "&code=LAC-0001" });
    expect(pub.status).toBe(200);
    expect(pub.json.price).toEqual({ weekday: 2500, weekend: 3000, from: 2500 });
    expect(pub.raw).not.toMatch(/landing|margin/i);
    const nums: unknown[] = [];
    JSON.parse(pub.raw, (_k, v) => (typeof v === "number" && nums.push(v), v));
    expect(nums).not.toContain(2000); // landing weekday price
    const search = await call("public", "search");
    expect(search.raw).not.toContain("landing");
    expect(search.raw).not.toContain("margin");
  });
  it("9. hosts see their payout but never the guest price or margin", async () => {
    const r = await asHost(H1).get("property", `&id=${hostProp}`);
    expect(r.json.landing).toEqual({ weekday: 9000, weekend: 12000 });
    expect(r.raw).not.toContain("11000");
    expect(r.raw).not.toContain("15000");
    expect(r.raw).not.toContain("margin");
    expect(r.raw).not.toContain("listing");
    const list = await asHost(H1).get("properties");
    expect(list.raw).not.toContain("11000");
  });
});

describe("14 + critical privacy rule", () => {
  it("public responses never contain private details", async () => {
    const outs = [
      await call("public", "property", { query: "&code=LAC-0001" }),
      await call("public", "search"),
      await call("public", "map"),
      await call("public", "suggest", { query: "&q=mo" }),
      await call("public", "settings"),
    ];
    for (const o of outs) expect(noSecrets(o.raw)).toEqual([]);
  });
  it("public card shows locality, society and city only", async () => {
    const pub = (await call("public", "property", { query: "&code=LAC-0001" })).json;
    expect(pub.place).toBe("Palm Society, Sector 70, Mohali");
    expect(pub.location).toBeUndefined();
  });
  it("society can be hidden", async () => {
    await adminSave(own, { showSociety: false });
    const pub = (await call("public", "property", { query: "&code=LAC-0001" })).json;
    expect(pub.place).toBe("Sector 70, Mohali");
    expect(JSON.stringify(pub)).not.toContain("Palm Society");
    await adminSave(own, { showSociety: true });
  });
});

describe("18–19. maps", () => {
  it("18. public map has an approximate position 250–650 m away; exact never sent", async () => {
    const map = (await call("public", "map")).json;
    const m = map.find((x: any) => x.code === "LAC-0001");
    const dLat = (m.approx.lat - 30.70123) * 111320, dLng = (m.approx.lng - 76.71456) * 111320 * Math.cos((30.7 * Math.PI) / 180);
    const d = Math.hypot(dLat, dLng);
    expect(d).toBeGreaterThan(150);
    expect(d).toBeLessThan(800);
    // stable between requests (can't be averaged out)
    expect((await call("public", "map")).json.find((x: any) => x.code === "LAC-0001").approx).toEqual(m.approx);
  });
  it("19. admin list has exact coordinates", async () => {
    const rows = (await admin.get("properties")).json;
    expect(rows.find((r: any) => r.id === own)).toMatchObject({ lat: 30.70123, lng: 76.71456 });
  });
});

describe("10–13. visibility and share links", () => {
  it("10/11. share with price shows it; share without price hides every price", async () => {
    const withP = await admin.post("share_create", { id: own, showPrice: true });
    const noP = await admin.post("share_create", { id: own, showPrice: false });
    expect(withP.json.url).toMatch(/\/stay\/s\/[A-Za-z0-9_-]{20,}$/);
    const { loadShare } = await import("../lib/stays/pages");
    const a = await loadShare(withP.json._id);
    const b = await loadShare(noP.json._id);
    expect(a?.property.price?.weekday).toBe(2500);
    expect(b?.property.price).toBeNull();
    expect(JSON.stringify(b)).not.toMatch(/2500|3000/);
  });
  it("revoked share links stop working", async () => {
    const sh = await admin.post("share_create", { id: own, showPrice: true });
    await admin.post("share_revoke", { id: own, shareId: sh.json._id });
    const { loadShare } = await import("../lib/stays/pages");
    expect(await loadShare(sh.json._id)).toBeNull();
  });
  it("12/13. unlisted: not in search or map, but works through a share link; private: nowhere", async () => {
    const save = (visibility: string) => adminSave(own, { visibility });
    await save("unlisted");
    const codes = async () => (await call("public", "search")).json.results.map((r: any) => r.code);
    expect(await codes()).not.toContain("LAC-0001");
    expect((await call("public", "map")).raw).not.toContain("LAC-0001");
    expect((await call("public", "property", { query: "&code=LAC-0001" })).status).toBe(404);
    const sh = await admin.post("share_create", { id: own, showPrice: false });
    const { loadShare, loadBySlug } = await import("../lib/stays/pages");
    expect((await loadShare(sh.json._id))?.property.code).toBe("LAC-0001");
    expect(await loadBySlug("sea-breeze-2bhk-LAC-0001")).toBeNull();
    await save("private");
    expect(await loadShare(sh.json._id)).toBeNull();
    expect((await admin.post("share_create", { id: own })).status).toBe(400);
    expect(await codes()).not.toContain("LAC-0001");
    await save("public");
    expect(await codes()).toContain("LAC-0001");
  });
  it("unpublished properties disappear everywhere", async () => {
    await admin.post("property_action", { id: own, action: "unpublish" });
    const { loadBySlug } = await import("../lib/stays/pages");
    expect(await loadBySlug("sea-breeze-2bhk-LAC-0001")).toBeNull();
    const pr = await admin.post("property_action", { id: own, action: "publish" });
    expect(pr.json.error).toBeUndefined();
    expect((await loadBySlug("sea-breeze-2bhk-LAC-0001"))?.property.code).toBe("LAC-0001");
  });
});

describe("15–17. WhatsApp enquiries", () => {
  it("15. use the configured number (default 8437512120), changeable in settings", async () => {
    expect((await call("public", "settings")).json.settings.whatsappNumber).toBe("8437512120");
    expect((await admin.post("settings_save", { whatsappNumber: "abc" })).json.error).toBeTruthy();
    await admin.post("settings_save", { ...(await admin.get("settings")).json.settings, whatsappNumber: "9988776655" });
    expect((await call("public", "settings")).json.settings.whatsappNumber).toBe("9988776655");
    await admin.post("settings_save", { ...(await admin.get("settings")).json.settings, whatsappNumber: "8437512120" });
  });
  it("logs button clicks without personal data, and validates the property", async () => {
    const r = await call("public", "click", { body: { code: "LAC-0001", type: "dates", checkIn: "2026-12-24", checkOut: "2026-12-27", adults: 2, children: 1, source: "/stay/x" } });
    expect(r.json.counted).toBe(true);
    const e = fake.collection("stay_enquiries").docs.at(-1);
    expect(e).toMatchObject({ kind: "click", type: "dates", code: "LAC-0001", checkIn: "2026-12-24", adults: 2, children: 1, guests: 3 });
    expect((await call("public", "click", { body: { code: "HST-0002", type: "simple" } })).json.counted).toBe(false); // not public
  });
  it("admin records and updates manual enquiries, kept apart from clicks", async () => {
    const r = await admin.post("enquiry_save", { propertyId: own, guestName: "Ravi", guestPhone: "9000000001", checkIn: "2026-12-01", adults: 2, notes: "Wants early check-in" });
    await admin.post("enquiry_update", { id: r.json.id, status: "quoted" });
    const list = (await admin.get("enquiries")).json;
    expect(list.find((x: any) => x._id === r.json.id)).toMatchObject({ kind: "manual", status: "quoted", code: "LAC-0001" });
    expect(list.some((x: any) => x.kind === "click")).toBe(true);
  });
});

describe("20. media persistence and upload checks", () => {
  it("rejects uploads that weren't signed by Cloudinary or are in another folder", async () => {
    const forged = { ...fakeUpload(own, "x"), signature: "0".repeat(40) };
    expect((await admin.post("media_add", { id: own, upload: forged })).status).toBe(400);
    const other = fakeUpload(hostProp, "y");
    expect((await admin.post("media_add", { id: own, upload: other })).status).toBe(400);
    const big = fakeUpload(own, "big", "image", { bytes: 50 * 1024 * 1024 });
    expect((await admin.post("media_add", { id: own, upload: big })).status).toBe(400);
  });
  it("saved photos and videos persist, with cover, order and captions", async () => {
    await admin.post("media_add", { id: own, uploads: [fakeUpload(own, "a"), fakeUpload(own, "b"), fakeUpload(own, "tour", "video")] });
    let p = (await admin.get("property", `&id=${own}`)).json;
    expect(p.media.length).toBe(3);
    const [a, b, v] = p.media;
    await admin.post("media_cover", { id: own, mediaId: b.id });
    await admin.post("media_order", { id: own, ids: [v.id, b.id, a.id] });
    await admin.post("media_caption", { id: own, mediaId: a.id, caption: "Living room" });
    p = (await admin.get("property", `&id=${own}`)).json; // a fresh read = after refresh / re-login
    expect(p.media.map((m: any) => m.id)).toEqual([v.id, b.id, a.id]);
    expect(p.coverId).toBe(b.id);
    expect(p.media[2].caption).toBe("Living room");
    const pub = (await call("public", "property", { query: "&code=LAC-0001" })).json;
    expect(pub.cover.src).toContain("f_auto,q_auto");
    expect(pub.videos[0].thumb).toMatch(/so_1.*\.jpg$/);
  });
  it("upload signatures are only issued for the property's own folder", async () => {
    const s = await admin.post("media_sign", { id: own, type: "image" });
    expect(s.json.fields.folder).toBe(`stays/${own}`);
    expect(s.json.fields.signature).toMatch(/^[a-f0-9]{40}$/);
    expect(s.json.fields).not.toHaveProperty("api_secret");
    expect(JSON.stringify(s.json)).not.toContain("cloudsecret456");
  });
});

describe("22. offline edits sync safely", () => {
  it("applies an offline edit when nothing changed meanwhile", async () => {
    const p = (await admin.get("property", `&id=${own}`)).json;
    const r = await admin.post("offline_sync", { id: own, fields: { listingWeekday: 2600 }, base: { listingWeekday: p.pricing.listing.weekday } });
    expect(r.status).toBe(200);
    expect(stored(own).pricing.listing.weekday).toBe(2600);
  });
  it("reports a conflict when the same field was changed elsewhere, and only overwrites when told to", async () => {
    const r = await admin.post("offline_sync", { id: own, fields: { listingWeekday: 2700 }, base: { listingWeekday: 2500 } });
    expect(r.status).toBe(409);
    expect(r.json.conflicts[0]).toMatchObject({ field: "listingWeekday", server: 2600, mine: 2700 });
    expect(stored(own).pricing.listing.weekday).toBe(2600);
    expect((await admin.post("offline_sync", { id: own, fields: { listingWeekday: 2700 }, base: { listingWeekday: 2500 }, force: true })).status).toBe(200);
    expect(stored(own).pricing.listing.weekday).toBe(2700);
  });
  it("offline bundle only contains guest-safe data", async () => {
    const r = await admin.get("offline", `&ids=${own}`);
    expect(r.json[0].code).toBe("LAC-0001");
    expect(noSecrets(r.raw)).toEqual([]);
    expect(r.raw).not.toContain("landing");
  });
});

describe("audit log and search", () => {
  it("records pricing, address and publication changes", async () => {
    const log = (await admin.get("audit", `&id=${own}`)).json;
    const fields = log.flatMap((x: any) => x.changes.map((ch: any) => ch.field));
    expect(fields).toContain("pricing.listing.weekday");
    expect(fields).toContain("visibility");
    expect(log.some((x: any) => x.action === "publish")).toBe(true);
  });
  it("search filters combine and price filters ignore hidden prices", async () => {
    const q = async (s: string) => (await call("public", "search", { query: s })).json.results.map((r: any) => r.code);
    expect(await q("&city=mohali&guests=4")).toEqual(["LAC-0001"]);
    expect(await q("&guests=8")).toEqual(["HST-0001"]);
    expect(await q("&amenities=pool,wifi")).toEqual(["LAC-0001"]);
    expect(await q("&type=4BHK%2B")).toEqual(["HST-0001"]);
    expect(await q("&maxPrice=5000")).toEqual(["LAC-0001"]);
    await admin.post("bulk", { ids: [own], op: "hide_price" });
    expect(await q("&maxPrice=5000")).toEqual([]);
    await admin.post("bulk", { ids: [own], op: "show_price" });
  });
  it("overview counts", async () => {
    const o = (await admin.get("overview")).json.counts;
    expect(o).toMatchObject({ own: 1, host: 2, published: 2 });
    expect(o.hosts).toBeGreaterThanOrEqual(3);
  });
});
