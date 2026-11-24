/* eslint-disable @typescript-eslint/no-explicit-any -- loose test doubles */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/cms/queries", async () => {
  const m = await import("./plannerFakePayload");
  return { getPayloadClient: m.getPayloadClient };
});

import { fakePayload } from "./plannerFakePayload";
import { presign } from "@/lib/photos/s3";
import { afterPayment, checkRoom, cleanAlbums, cleanUpload, mergePlans, orderBase, GB } from "@/lib/photos/core";

// The shared fake has no pagination: false / page support; the photo code uses both.
const baseFind = fakePayload.find.bind(fakePayload);
fakePayload.find = async (a: any) => {
  const all = await baseFind({ ...a, limit: 1e9 });
  if (a.pagination === false) return { ...all, hasNextPage: false };
  const limit = a.limit ?? 10, page = a.page ?? 1;
  return { docs: all.docs.slice((page - 1) * limit, page * limit), totalDocs: all.totalDocs, hasNextPage: all.docs.length > page * limit };
};

process.env.PAYLOAD_SECRET = "test-secret";
process.env.PHOTOS_LOCAL_DIR = mkdtempSync(path.join(tmpdir(), "photos-"));
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost";
process.env.CRON_SECRET = "cron";

const plans = mergePlans(null);
const plan = (id: string) => plans.find((p) => p.id === id)!;

describe("S3 signatures", () => {
  it("matches AWS's published example", () => {
    const u = presign({ method: "GET", host: "examplebucket.s3.amazonaws.com", path: "/test.txt", region: "us-east-1", keyId: "AKIAIOSFODNN7EXAMPLE", secret: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", expires: 86400, now: new Date("2013-05-24T00:00:00Z") });
    expect(u).toContain("X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404");
  });
  it("signs the upload size so bigger files are refused", () => {
    const u = presign({ method: "PUT", host: "x.r2.cloudflarestorage.com", path: "/b/g/1/k/d.jpg", region: "auto", keyId: "k", secret: "s", expires: 60, headers: { "content-length": "10", "content-type": "image/jpeg" } });
    expect(u).toContain("X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost");
  });
});

describe("plan rules", () => {
  it("videos only on plans with video space; originals only on Royal", () => {
    expect(() => cleanUpload({ kind: "video", type: "video/mp4", v: 100, t: 10 }, plan("basic"), ["wedding"])).toThrow(/Premium and Royal/);
    expect(cleanUpload({ kind: "video", type: "video/mp4", v: 100, t: 10 }, plan("premium"), ["wedding"]).v).toBe(100);
    expect(() => cleanUpload({ kind: "photo", d: 10, t: 10, o: 50 }, plan("premium"), ["wedding"])).toThrow(/Royal/);
    expect(cleanUpload({ kind: "photo", d: 10, t: 10, o: 50 }, plan("royal"), ["wedding"]).o).toBe(50);
  });
  it("unknown albums fall back to the first one", () => {
    expect(cleanUpload({ kind: "photo", d: 10, t: 10, album: "nope" }, plan("free"), ["haldi", "wedding"]).album).toBe("haldi");
  });
  it("stops at the photo limit and the video limit", () => {
    const one = cleanUpload({ kind: "photo", d: 1, t: 1 }, plan("free"), ["a"]);
    expect(() => checkRoom(plan("free"), { photos: 300, videoBytes: 0 }, [one])).toThrow(/full/);
    expect(() => checkRoom(plan("free"), { photos: 299, videoBytes: 0 }, [one, one])).toThrow(/room for 1 more photo/);
    const vid = cleanUpload({ kind: "video", type: "video/mp4", v: 2 * GB, t: 1 }, plan("premium"), ["a"]);
    expect(() => checkRoom(plan("premium"), { photos: 0, videoBytes: 4 * GB }, [vid])).toThrow(/video space/);
  });
  it("upgrades pay the difference; renewals need a paid plan", () => {
    expect(orderBase(plans, 399, { plan: "free", paymentStatus: "unpaid" }, "premium").base).toBe(2999);
    expect(orderBase(plans, 399, { plan: "basic", paymentStatus: "paid" }, "premium").base).toBe(1700);
    expect(() => orderBase(plans, 399, { plan: "royal", paymentStatus: "paid" }, "premium")).toThrow(/higher/);
    expect(() => orderBase(plans, 399, { plan: "free", paymentStatus: "unpaid" }, "renew")).toThrow();
    expect(orderBase(plans, 399, { plan: "basic", paymentStatus: "paid" }, "renew").base).toBe(399);
  });
  it("paying never shortens how long a gallery stays online", () => {
    const now = new Date("2027-01-01T00:00:00Z");
    expect(afterPayment(plans, { plan: "free", paymentStatus: "unpaid", expiresAt: "2027-01-20T00:00:00Z" }, "basic", now).expiresAt).toBe("2028-01-01T00:00:00.000Z");
    expect(afterPayment(plans, { plan: "royal", paymentStatus: "paid", expiresAt: "2031-06-01T00:00:00.000Z" }, "renew", now).expiresAt).toBe("2032-06-01T00:00:00.000Z");
    expect(afterPayment(plans, { plan: "royal", paymentStatus: "paid", expiresAt: "2027-03-01T00:00:00.000Z" }, "renew", now).expiresAt).toBe("2028-03-01T00:00:00.000Z");
  });
  it("albums are cleaned and never empty", () => {
    expect(cleanAlbums([{ name: " Haldi " }, { id: "x", name: "Sangeet" }, { name: "" }])).toEqual([{ id: "haldi", name: "Haldi" }, { id: "x", name: "Sangeet" }]);
    expect(() => cleanAlbums([])).toThrow(/at least one/);
  });
});

/* ---------------- the API, end to end (local file storage, mock payments) ---------------- */

let route: any;
let ip = 0;
async function call(p: string, opts: { method?: string; body?: unknown; token?: string; pass?: string; raw?: ArrayBuffer; url?: string; auth?: string } = {}) {
  const url = opts.url ?? `http://localhost/api/photos/${p}`;
  const headers: Record<string, string> = { "x-forwarded-for": `10.9.0.${++ip % 250}`, "content-type": "application/json" };
  if (opts.token) headers["x-edit-token"] = opts.token;
  if (opts.pass) headers["x-gallery-pass"] = opts.pass;
  if (opts.auth) headers.authorization = opts.auth;
  const method = opts.method ?? (opts.body !== undefined ? "POST" : "GET");
  const req = new NextRequest(url, { method, headers, body: opts.raw ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined) });
  const pathParts = new URL(url).pathname.replace("/api/photos/", "").split("/");
  const res: Response = await route[method](req, { params: Promise.resolve({ path: pathParts }) });
  const text = await res.text();
  let json: any = {};
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
}

/** Does what the browser does: asks for upload links, PUTs the bytes, then confirms. */
async function upload(slug: string, token: string, files: any[], guest?: { name: string; pass?: string }) {
  const start = guest
    ? await call(`public/${slug}/upload`, { body: { name: guest.name, files }, pass: guest.pass })
    : await call(`manage/${slug}/upload`, { body: { files }, token });
  if (start.status !== 200) return start;
  for (const [k, it] of start.json.items.entries()) {
    for (const put of it.puts) {
      const size = files[k][put.part];
      const r = await call("", { method: "PUT", url: put.url, raw: new Uint8Array(size).buffer });
      expect(r.status).toBe(200);
    }
  }
  const ids = start.json.items.map((i: any) => i.id);
  return guest
    ? call(`public/${slug}/done`, { body: { ids, ticket: start.json.ticket }, pass: guest.pass })
    : call(`manage/${slug}/done`, { body: { ids }, token });
}

describe("photo galleries API", () => {
  let slug = "", token = "";
  beforeAll(async () => {
    route = await import("@/app/api/photos/[...path]/route");
  });

  it("creates a free gallery and opens the dashboard with its key only", async () => {
    const r = await call("create", { body: { names: "Aditi & Kabir", email: "Aditi@Example.com" } });
    expect(r.status).toBe(200);
    ({ slug, token } = r.json);
    expect(slug).toMatch(/^aditi-kabir-[a-f0-9]{4}$/);
    expect((await call(`manage/${slug}`)).status).toBe(403);
    expect((await call(`manage/${slug}`, { token: "x".repeat(32) })).status).toBe(403);
    const m = await call(`manage/${slug}`, { token });
    expect(m.json.plan.id).toBe("free");
    expect(m.json.gallery.albums.map((a: any) => a.id)).toContain("wedding");
  });

  it("uploads photos, shows them to guests, and sets the first as cover", async () => {
    const r = await upload(slug, token, [{ kind: "photo", name: "a.jpg", album: "haldi", d: 2000, t: 300, w: 2560, h: 1707 }, { kind: "photo", name: "b.jpg", album: "wedding", d: 1500, t: 200 }]);
    expect(r.json.done).toHaveLength(2);
    const pub = await call(`public/${slug}`);
    expect(pub.json.albums).toEqual([{ id: "haldi", name: "Haldi", n: 1 }, { id: "wedding", name: "Wedding", n: 1 }]);
    expect(pub.json.items[0].d).toMatch(/^\/api\/photos\/local\/g\//);
    expect(pub.json.cover).toBeTruthy();
    expect(pub.json.branding).toBe(true);
    const file = await call("", { url: "http://localhost" + pub.json.items[0].d });
    expect(file.status).toBe(200);
  });

  it("refuses a file that isn't the size that was signed", async () => {
    const start = await call(`manage/${slug}/upload`, { body: { files: [{ kind: "photo", d: 100, t: 10 }] }, token });
    const put = start.json.items[0].puts[0];
    expect((await call("", { method: "PUT", url: put.url, raw: new Uint8Array(5).buffer })).status).toBe(400);
    const done = await call(`manage/${slug}/done`, { body: { ids: [start.json.items[0].id] }, token });
    expect(done.json.failed).toHaveLength(1);
  });

  it("free and basic galleries can't take videos or guest uploads", async () => {
    const v = await call(`manage/${slug}/upload`, { body: { files: [{ kind: "video", type: "video/mp4", v: 1000, t: 10 }] }, token });
    expect(v.status).toBe(400);
    expect(v.json.error).toMatch(/Premium and Royal/);
    expect((await call(`manage/${slug}/settings`, { body: { guestUploads: true }, token })).status).toBe(400);
    const g = await upload(slug, "", [{ kind: "photo", d: 10, t: 10 }], { name: "Riya" });
    expect(g.status).toBe(403);
  });

  it("pays for Premium (mock gateway), then videos and guest uploads work", async () => {
    const q = await call(`manage/${slug}/quote`, { body: { plan: "premium" }, token });
    expect(q.json.total).toBe(2999);
    const o = await call(`manage/${slug}/checkout`, { body: { plan: "premium" }, token });
    expect(o.json.provider).toBe("mock");
    expect((await call(`manage/${slug}/verify`, { body: {}, token })).json.ok).toBe(true);
    const m = await call(`manage/${slug}`, { token });
    expect(m.json.plan.id).toBe("premium");
    expect(m.json.gallery.paid).toBe(true);
    expect(new Date(m.json.gallery.expiresAt).getTime()).toBeGreaterThan(Date.now() + 700 * 864e5);
    // Upgrading to Royal now costs the difference.
    expect((await call(`manage/${slug}/quote`, { body: { plan: "royal" }, token })).json.total).toBe(3000);

    const v = await upload(slug, token, [{ kind: "video", name: "film.mp4", type: "video/mp4", v: 5000, t: 100, dur: 300 }]);
    expect(v.json.done).toHaveLength(1);

    expect((await call(`manage/${slug}/settings`, { body: { guestUploads: true }, token })).status).toBe(200);
    const g = await upload(slug, "", [{ kind: "photo", name: "selfie.jpg", d: 50, t: 10 }], { name: "Riya" });
    expect(g.json.done).toHaveLength(1);
    // Waits for the couple's OK.
    let pub = await call(`public/${slug}?album=guests`);
    expect(pub.json.albums.find((a: any) => a.id === "guests")).toBeUndefined();
    await call(`manage/${slug}/items`, { body: { action: "approve", ids: g.json.done }, token });
    pub = await call(`public/${slug}?album=guests`);
    expect(pub.json.items[0].g).toBe("Riya");
    expect(pub.json.branding).toBe(false);
  });

  it("a ticket for some uploads can't confirm other ones", async () => {
    const start = await call(`public/${slug}/upload`, { body: { name: "Sam", files: [{ kind: "photo", d: 5, t: 5 }] } });
    const r = await call(`public/${slug}/done`, { body: { ids: ["999"], ticket: start.json.ticket } });
    expect(r.status).toBe(403);
  });

  it("a PIN hides the gallery until it's typed", async () => {
    await call(`manage/${slug}/settings`, { body: { pin: "4321" }, token });
    expect((await call(`public/${slug}`)).json.needPin).toBe(true);
    expect((await call(`public/${slug}/pin`, { body: { pin: "1111" } })).status).toBe(401);
    const { pass } = (await call(`public/${slug}/pin`, { body: { pin: "4321" } })).json;
    expect((await call(`public/${slug}`, { pass })).json.items.length).toBeGreaterThan(0);
    // Changing the PIN signs everyone out.
    await call(`manage/${slug}/settings`, { body: { pin: "9999" }, token });
    expect((await call(`public/${slug}`, { pass })).json.needPin).toBe(true);
    await call(`manage/${slug}/settings`, { body: { pin: "" }, token });
  });

  it("albums with photos can't be removed; hiding and deleting work", async () => {
    const m = await call(`manage/${slug}`, { token });
    const keep = m.json.gallery.albums.filter((a: any) => a.id !== "haldi");
    expect((await call(`manage/${slug}/settings`, { body: { albums: keep }, token })).status).toBe(400);
    const haldi = m.json.items.filter((i: any) => i.a === "haldi"); // a photo, and the video (no album given, so the first)
    const ids = haldi.map((i: any) => i.i);
    expect(ids).toHaveLength(2);
    await call(`manage/${slug}/items`, { body: { action: "hide", ids }, token });
    expect((await call(`public/${slug}`)).json.albums.find((a: any) => a.id === "haldi")).toBeUndefined();
    await call(`manage/${slug}/items`, { body: { action: "delete", ids }, token });
    expect((await call(`manage/${slug}/settings`, { body: { albums: keep }, token })).status).toBe(200);
    expect((await call("", { url: "http://localhost" + haldi[0].t })).status).toBe(404);
  });

  it("signs in by email code", async () => {
    const s = await call("auth/start", { body: { email: "aditi@example.com" } });
    const v = await call("auth/verify", { body: { email: "aditi@example.com", code: s.json.devCode } });
    expect(v.json.galleries[0]).toMatchObject({ slug, token });
    expect((await call("auth/verify", { body: { email: "aditi@example.com", code: s.json.devCode } })).status).toBe(401);
  });

  it("daily job: hides expired galleries, then deletes their files after the grace period", async () => {
    expect((await call("cron")).status).toBe(401);
    const g = fakePayload.db["photo-galleries"].find((d: any) => d.slug === slug);
    g.expiresAt = new Date(Date.now() - 864e5).toISOString();
    let r = await call("cron", { auth: "Bearer cron" });
    expect(r.json.expired).toBe(1);
    expect((await call(`public/${slug}`)).json.expired).toBe(true);
    g.expiresAt = new Date(Date.now() - 61 * 864e5).toISOString();
    r = await call("cron", { auth: "Bearer cron" });
    expect(r.json.purged).toBe(1);
    expect(fakePayload.db["photo-items"].filter((d: any) => d.gallery === g.id)).toHaveLength(0);
    expect((await call(`public/${slug}`)).status).toBe(404);
  });
});
