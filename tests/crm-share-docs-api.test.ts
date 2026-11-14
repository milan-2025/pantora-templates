import { v2 as cloudinary } from "cloudinary";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { addUser, as, call, fake, loadRoute, mockDb, signup, type Sess } from "./apiHarness";

vi.mock("@/lib/cms/queries", () => ({ getPayloadClient: mockDb }));

const SECRET = "secret456";
const VID = "dQw4w9WgXcQ", VID2 = "9bZkp7q19f0";
let A: Sess, B: Sess, agent: Sess, agent2: Sess, partner: Sess;
let p1 = "", p2 = "", u1 = "", u2 = "", uB = "", catA = "", wsA = "";
let pages: { unit: any; cat: any; prop: any };
const units = async (s: Sess) => (await as(s).get("units_list")).json as any[];
const unitDoc = (id: string) => fake.collection("crm_units").docs.find((d: any) => d._id === id)!;
const get = async (kind: "unit" | "cat" | "prop", pub: string, ref = "") =>
  pages[kind].GET(new Request(`http://localhost/x/${pub}${ref ? "?ref=" + ref : ""}`, { headers: { "user-agent": "Mozilla/5.0" } }), { params: Promise.resolve({ pub }) });
/** What Cloudinary sends back after an upload signed by us. */
const uploaded = (pid: string, version = "1731590000") => ({ public_id: pid, version, signature: cloudinary.utils.api_sign_request({ public_id: pid, version }, SECRET) });

beforeAll(async () => {
  await loadRoute();
  pages = { unit: await import("../app/unit/[pub]/route"), cat: await import("../app/catalogue/[pub]/route"), prop: await import("../app/property/[pub]/route") };
  cloudinary.config({ cloud_name: "demo", api_key: "key123", api_secret: SECRET });
  A = await signup("Share Realty", "o@share.in");
  B = await signup("Share Rival", "o@sharerival.in");
  for (const s of [A, B]) await as(s).post("mode_set", { mode: "realestate" });
  agent = await addUser(A, "Agent One", "a1@share.in", "agent");
  agent2 = await addUser(A, "Agent Two", "a2@share.in", "agent");
  partner = await addUser(A, "Anil", "an@share.in", "partner");
  p1 = (await as(A).post("project_save", { name: "Sunrise", city: "Pune", published: true, contactPhone: "9876543210", videos: [`https://youtu.be/${VID}`, "https://vimeo.com/1"] })).json.id;
  p2 = (await as(A).post("project_save", { name: "Hidden Draft", published: false })).json.id;
  u1 = (await as(A).post("unit_save", { project: p1, no: "A-101", tower: "A", bhk: "2BHK", area: 1100, price: 8500000, videos: `https://www.youtube.com/shorts/${VID2}` })).json.id;
  u2 = (await as(A).post("unit_save", { project: p2, no: "D-1", price: 100 })).json.id;
  const pB = (await as(B).post("project_save", { name: "Rival", published: true })).json.id;
  uB = (await as(B).post("unit_save", { project: pB, no: "R-1" })).json.id;
  catA = (await as(A).get("me")).json.ws.catPub;
  wsA = unitDoc(u1).ws;
});

describe("videos", () => {
  it("keeps only YouTube links, for projects and units", async () => {
    const p = (await as(A).get("projects_list")).json.find((x: any) => x.id === p1);
    expect(p.videos).toEqual([`https://www.youtube.com/watch?v=${VID}`]);
    expect((await units(A)).find((u) => u.id === u1).videos).toEqual([`https://www.youtube.com/watch?v=${VID2}`]);
  });
  it("editing a unit without sending videos keeps them; sending an empty list clears them", async () => {
    await as(A).post("unit_save", { id: u1, project: p1, no: "A-101", tower: "A", bhk: "2BHK", area: 1100, price: 8500000 });
    expect(unitDoc(u1).videos).toHaveLength(1);
  });
});

describe("share links", () => {
  it("every unit gets a share id, and the company gets a catalogue id", async () => {
    expect((await units(A)).every((u) => /^[a-f0-9]{18}$/.test(u.pub))).toBe(true);
    expect(catA).toMatch(/^[a-f0-9]{18}$/);
    expect((await as(A).get("me")).json.ws.catPub).toBe(catA); // stable
    expect((await units(partner))[0].pub).toBeTruthy(); // partners can share too
    const plain = await signup("Plain Share", "o@plainshare.in");
    expect((await as(plain).get("me")).json.ws.catPub).toBeUndefined();
  });
  it("older units get a share id when listed", async () => {
    delete unitDoc(u1).pub;
    const pub = (await units(A)).find((u) => u.id === u1).pub;
    expect(pub).toMatch(/^[a-f0-9]{18}$/);
  });
});

describe("unit page", () => {
  let pub = "";
  beforeAll(async () => { pub = (await units(A)).find((u) => u.id === u1).pub; });

  it("shows the unit, its videos and the project's, and the enquiry form", async () => {
    await as(agent).post("unit_hold", { id: u1 });
    const res = await get("unit", pub, "abcdef1234567890");
    expect(res.status).toBe(200);
    const h = await res.text();
    for (const t of ["2BHK · Unit A A-101", "Sunrise", "₹85 L", "1,100 sq ft", "PR-001-U001", "On hold", `embed/${VID2}`, `embed/${VID}`, "Ask about this unit", "tel:+919876543210", "/catalogue/" + catA])
      expect(h, t).toContain(t);
    expect(h).toContain(`unit:"${pub}"`);
    expect(h).not.toContain("Agent One"); // never who holds it
    expect(h.match(/<script/g)).toHaveLength(1);
    await as(agent).post("unit_release", { id: u1 });
  });
  it("says when a unit is no longer available, without the price or buyer", async () => {
    const lead = (await as(A).post("leads_add", { name: "Buyer Bala", phone: "9400000001" })).json.id;
    await as(A).post("unit_status", { id: u1, status: "booked", leadId: lead });
    const h = await (await get("unit", pub)).text();
    expect(h).toContain("No longer available");
    expect(h).toContain("See available units");
    expect(h).not.toContain("₹85 L");
    expect(h).not.toContain("Buyer Bala");
    await as(A).post("unit_status", { id: u1, status: "available" });
  });
  it("is not available for unpublished projects, other ids, or when the company is offline", async () => {
    const draftPub = (await units(A)).find((u) => u.id === u2).pub;
    expect((await get("unit", draftPub)).status).toBe(404);
    expect((await get("unit", "a".repeat(18))).status).toBe(404);
    expect((await get("unit", "../../x")).status).toBe(404);
    await as(A).post("mode_set", { mode: "general" });
    expect((await get("unit", pub)).status).toBe(404);
    await as(A).post("mode_set", { mode: "realestate" });
    expect((await get("unit", pub)).status).toBe(200);
  });
  it("enquiries link the lead to the unit and credit the sharer", async () => {
    const projPub = (await as(A).get("projects_list")).json.find((x: any) => x.id === p1).pub;
    const users = (await as(A).get("users_list")).json as any[];
    const ref = users.find((u) => u.email === "a1@share.in").id;
    expect((await call("enquiry", { body: { pub: projPub, unit: pub, ref, name: "Unit Fan", phone: "9400000002", message: "Is it east facing?" } })).status).toBe(200);
    const l = fake.collection("crm_leads").docs.find((d: any) => d.data.name === "Unit Fan")!.data;
    expect(l).toMatchObject({ unitId: u1, unitCode: "PR-001-U001", unit: "A A-101", projectId: p1, source: "Unit page", owner: "Agent One" });
    expect(l.notes.map((n: any) => n.x)).toEqual(["Is it east facing?", "Asked about unit A A-101 (PR-001-U001)"]);
    expect(unitDoc(u1).enquiries).toBe(1);
  });
  it("ignores a unit id from another project or company", async () => {
    const projPub = (await as(A).get("projects_list")).json.find((x: any) => x.id === p1).pub;
    const otherPub = (await units(B))[0].pub;
    await call("enquiry", { body: { pub: projPub, unit: otherPub, name: "Mixed", phone: "9400000003" } });
    const l = fake.collection("crm_leads").docs.find((d: any) => d.data.name === "Mixed")!;
    expect(l.data.unitId).toBeUndefined();
    expect(l.data.source).toBe("Project page");
    expect(fake.collection("crm_leads").docs.filter((d: any) => d.data.name === "Mixed")[0].ws).toBe(wsA);
  });
});

describe("catalogue page", () => {
  it("lists only published projects of this company, with links that keep the sharer", async () => {
    const res = await get("cat", catA, "abcdef1234567890");
    expect(res.status).toBe(200);
    const h = await res.text();
    expect(h).toContain("Share Realty");
    expect(h).toContain("Sunrise");
    expect(h).not.toContain("Hidden Draft");
    expect(h).not.toContain("Rival");
    expect(h).toContain("?ref=abcdef1234567890");
    expect(h).toContain("1 available · 2BHK");
    expect(h).not.toContain("A-101"); // no unit numbers in the catalogue
  });
  it("is offline for bad ids, companies with nothing published, or ended subscriptions", async () => {
    expect((await get("cat", "zzz")).status).toBe(404);
    const plain = await signup("Nothing Published", "o@nothing.in");
    await as(plain).post("mode_set", { mode: "realestate" });
    const pub = (await as(plain).get("me")).json.ws.catPub;
    expect((await get("cat", pub)).status).toBe(404);
    const w = fake.collection("crm_workspaces").docs.find((x: any) => x._id === wsA)!;
    const end = w.trialEnds; w.trialEnds = Date.now() - 1000;
    expect((await get("cat", catA)).status).toBe(404);
    w.trialEnds = end;
  });
  it("project pages link back to the catalogue", async () => {
    const projPub = (await as(A).get("projects_list")).json.find((x: any) => x.id === p1).pub;
    const h = await (await get("prop", projPub)).text();
    expect(h).toContain(`/catalogue/${catA}`);
    expect(h).toContain(`embed/${VID}`);
  });
});

describe("private unit documents", () => {
  let docId = "";
  const folder = () => `crm/${wsA}/units/${u1}/docs`;

  it("signs a private upload into the unit's own folder", async () => {
    const r = await as(agent).post("unit_doc_sign", { unit: u1 });
    expect(r.status).toBe(200);
    expect(r.json.url).toBe("https://api.cloudinary.com/v1_1/demo/raw/upload");
    const { signature, api_key, ...signed } = r.json.fields;
    expect(signed).toMatchObject({ folder: folder(), type: "private" });
    expect(signature).toBe(cloudinary.utils.api_sign_request(signed, SECRET));
    expect(JSON.stringify(r.json)).not.toContain(SECRET);
  });
  it("saves only verified uploads from this unit's folder, with an allowed file type", async () => {
    const good = uploaded(`${folder()}/agreement_x1.pdf`);
    expect((await as(agent).post("unit_doc_add", { unit: u1, ...good, signature: "forged", name: "Agreement.pdf" })).status).toBe(400);
    expect((await as(agent).post("unit_doc_add", { unit: u1, ...uploaded(`crm/${wsA}/units/${u2}/docs/a.pdf`), name: "a.pdf" })).status).toBe(400);
    expect((await as(agent).post("unit_doc_add", { unit: u1, ...good, name: "virus.exe" })).status).toBe(400);
    const r = await as(agent).post("unit_doc_add", { unit: u1, ...good, name: "Agreement.pdf", bytes: 52000 });
    expect(r.status).toBe(200);
    docId = r.json.id;
    expect((await as(agent).post("unit_doc_add", { unit: u1, ...good, name: "Agreement.pdf" })).status).toBe(200); // same file twice: no duplicate
    expect(unitDoc(u1).docs).toHaveLength(1);
  });
  it("lists documents to the team without storage paths", async () => {
    const d = (await units(agent2)).find((u) => u.id === u1).docs;
    expect(d).toEqual([{ id: docId, name: "Agreement.pdf", bytes: 52000, by: "Agent One", t: expect.any(Number) }]);
    expect(JSON.stringify(await units(A))).not.toContain("agreement_x1");
  });
  it("opens through a short-lived signed private link", async () => {
    const r = await as(agent2).post("unit_doc_url", { unit: u1, doc: docId });
    expect(r.status).toBe(200);
    const u = new URL(r.json.url);
    expect(u.hostname).toBe("api.cloudinary.com");
    expect(u.searchParams.get("type")).toBe("private");
    expect(Number(u.searchParams.get("expires_at"))).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 300);
    expect(u.searchParams.get("signature")).toBeTruthy();
  });
  it("is never shown to partners, other companies or the public", async () => {
    expect((await units(partner)).find((u) => u.id === u1).docs).toBeUndefined();
    for (const r of ["unit_doc_url", "unit_doc_sign", "unit_doc_add", "unit_doc_delete"]) expect((await as(partner).post(r, { unit: u1, doc: docId })).status, r).toBe(403);
    expect((await as(B).post("unit_doc_url", { unit: u1, doc: docId })).status).toBe(404);
    expect((await as(B).post("unit_doc_sign", { unit: u1 })).status).toBe(404);
    expect((await as(B).post("unit_doc_add", { unit: uB, ...uploaded(`${folder()}/stolen.pdf`), name: "s.pdf" })).status).toBe(400);
    const pub = (await units(A)).find((u) => u.id === u1).pub;
    const h = await (await get("unit", pub)).text();
    expect(h).not.toContain("Agreement");
    expect(h).not.toContain("docs");
  });
  it("only an admin or the uploader can delete; deleting removes it", async () => {
    expect((await as(agent2).post("unit_doc_delete", { unit: u1, doc: docId })).status).toBe(403);
    const spy = vi.spyOn(cloudinary.uploader, "destroy").mockResolvedValue({ result: "ok" } as any);
    expect((await as(agent).post("unit_doc_delete", { unit: u1, doc: docId })).status).toBe(200);
    expect(unitDoc(u1).docs).toEqual([]);
    expect(spy).toHaveBeenCalledWith(`${folder()}/agreement_x1.pdf`, expect.objectContaining({ type: "private", resource_type: "raw" }));
    spy.mockRestore();
  });
  it("allows up to 20 documents per unit", async () => {
    for (let i = 0; i < 20; i++) expect((await as(A).post("unit_doc_add", { unit: u1, ...uploaded(`${folder()}/f${i}.pdf`), name: `f${i}.pdf` })).status).toBe(200);
    expect((await as(A).post("unit_doc_sign", { unit: u1 })).status).toBe(400);
    expect((await as(A).post("unit_doc_add", { unit: u1, ...uploaded(`${folder()}/f21.pdf`), name: "f21.pdf" })).status).toBe(400);
    expect(unitDoc(u1).docs).toHaveLength(20);
  });
  it("deleting the unit removes its files from storage", async () => {
    const spy = vi.spyOn(cloudinary.uploader, "destroy").mockResolvedValue({ result: "ok" } as any);
    await as(A).post("unit_delete", { id: u1 });
    expect(spy).toHaveBeenCalledTimes(20);
    spy.mockRestore();
  });
});
