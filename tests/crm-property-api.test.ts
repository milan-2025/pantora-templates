import { v2 as cloudinary } from "cloudinary";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { addUser, as, call, fake, loadRoute, mockDb, signup, type Sess } from "./apiHarness";

vi.mock("@/lib/cms/queries", () => ({ getPayloadClient: mockDb }));

let A: Sess, B: Sess, agent: Sess, partner: Sess;
let p1 = "", p2 = "", pB = "";
const lead = (id: string) => fake.collection("crm_leads").docs.find((d: any) => d._id === id)!.data;
const projects = async (s: Sess) => (await as(s).get("projects_list")).json as any[];

beforeAll(async () => {
  await loadRoute();
  A = await signup("Prop Realty", "o@prop.in");
  B = await signup("Prop Rival", "o@rivalprop.in");
  await as(A).post("mode_set", { mode: "realestate" });
  await as(B).post("mode_set", { mode: "realestate" });
  agent = await addUser(A, "Agent One", "ag@prop.in", "agent");
  partner = await addUser(A, "Anil", "an@prop.in", "partner");
  p1 = (await as(A).post("project_save", { name: "Sunrise Heights" })).json.id;
  p2 = (await as(A).post("project_save", { name: "Green Acres" })).json.id;
  pB = (await as(B).post("project_save", { name: "Rival Towers" })).json.id;
});

describe("Property IDs", () => {
  it("are numbered per company in the order projects are created", async () => {
    const ps = await projects(A);
    expect(ps.find((p) => p.id === p1).code).toBe("PR-001");
    expect(ps.find((p) => p.id === p2).code).toBe("PR-002");
    expect((await projects(B))[0].code).toBe("PR-001"); // other company starts its own sequence
  });
  it("older projects without an ID get one, without reusing numbers", async () => {
    const old = fake.collection("crm_projects").docs.find((d: any) => d._id === p2)!;
    delete old.code;
    expect((await projects(A)).find((p) => p.id === p2).code).toBe("PR-003");
    const p4 = (await as(A).post("project_save", { name: "Fourth" })).json.id;
    expect((await projects(A)).find((p) => p.id === p4).code).toBe("PR-004");
    const codes = (await projects(A)).map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
  it("cannot be set or changed by the client", async () => {
    await as(A).post("project_save", { id: p1, name: "Sunrise Heights", code: "PR-999" });
    expect((await projects(A)).find((p) => p.id === p1).code).toBe("PR-001");
  });
});

describe("linking leads to a property", () => {
  it("links by project id and stores the project name", async () => {
    const id = (await as(agent).post("leads_add", { name: "Ravi", phone: "9100000001", projectId: p1 })).json.id;
    expect(lead(id)).toMatchObject({ projectId: p1, project: "Sunrise Heights" });
  });
  it("links a typed project name (any case) to the right project", async () => {
    const id = (await as(agent).post("leads_add", { name: "Sita", phone: "9100000002", project: "green acres" })).json.id;
    expect(lead(id)).toMatchObject({ projectId: p2, project: "Green Acres" });
  });
  it("refuses another company's project id", async () => {
    const id = (await as(A).post("leads_add", { name: "Spy", phone: "9100000003", projectId: pB })).json.id;
    expect(lead(id).projectId).toBe("");
    const id2 = (await as(B).post("leads_add", { name: "Spy2", phone: "9100000004", projectId: p1 })).json.id;
    expect(lead(id2).projectId).toBe("");
  });
  it("updates and clears the link", async () => {
    const id = (await as(agent).post("leads_add", { name: "Move", phone: "9100000005", projectId: p1 })).json.id;
    await as(agent).post("leads_update", { projectId: p2 }, `&id=${id}`);
    expect(lead(id)).toMatchObject({ projectId: p2, project: "Green Acres" });
    await as(agent).post("leads_update", { projectId: "", project: "" }, `&id=${id}`);
    expect(lead(id)).toMatchObject({ projectId: "", project: "" });
    await as(agent).post("leads_update", { projectId: pB }, `&id=${id}`);
    expect(lead(id).projectId).toBe("");
  });
  it("partners can pick a property for their customer", async () => {
    const id = (await as(partner).post("leads_add", { name: "Via Partner", phone: "9100000006", projectId: p2 })).json.id;
    expect(lead(id)).toMatchObject({ projectId: p2, project: "Green Acres", partner: "Anil" });
  });
  it("renaming a project renames it on its leads", async () => {
    await as(A).post("project_save", { id: p2, name: "Green Acres Phase 2" });
    expect(lead((await as(A).get("leads")).json.find((l: any) => l.name === "Sita").id).project).toBe("Green Acres Phase 2");
  });
  it("booking a unit links the lead to that unit's project", async () => {
    const id = (await as(A).post("leads_add", { name: "Buyer", phone: "9100000007" })).json.id;
    const u = (await as(A).post("unit_save", { project: p1, no: "A-1", price: 100 })).json.id;
    await as(A).post("unit_status", { id: u, status: "booked", leadId: id });
    expect(lead(id)).toMatchObject({ projectId: p1, project: "Sunrise Heights", status: "Booked", unit: "A-1" });
  });
  it("public page enquiries are linked to the project", async () => {
    await as(A).post("project_save", { id: p1, name: "Sunrise Heights", published: true });
    const pub = (await projects(A)).find((p) => p.id === p1).pub;
    expect((await call("enquiry", { body: { pub, name: "Web Buyer", phone: "9100000008" } })).status).toBe(200);
    const l = fake.collection("crm_leads").docs.find((d: any) => d.data.name === "Web Buyer")!;
    expect(l.data.projectId).toBe(p1);
  });
  it("in normal CRM mode the project field is just text", async () => {
    const C = await signup("Plain Prop", "o@plainprop.in");
    const id = (await as(C).post("leads_add", { name: "Plain", phone: "9100000009", project: "Anything", projectId: "x" })).json.id;
    expect(lead(id).project).toBe("Anything");
  });
  it("reports count a property's leads by its id", async () => {
    const r = (await as(A).get("report")).json;
    expect(r.projects.find((p: any) => p.id === p1)).toMatchObject({ code: "PR-001", leads: 3 }); // Ravi, Buyer, Web Buyer
  });
});

describe("photos and map link", () => {
  it("saves up to 12 safe photos and a Google Maps link; first photo becomes the cover", async () => {
    const imgs = ["https://res.cloudinary.com/demo/image/upload/a.jpg", "javascript:alert(1)", ...Array.from({ length: 15 }, (_, i) => `https://res.cloudinary.com/demo/image/upload/${i}.jpg`)];
    expect((await as(A).post("project_save", { id: p1, name: "Sunrise Heights", published: true, images: imgs, mapUrl: "https://maps.app.goo.gl/AbC" })).status).toBe(200);
    const p = (await projects(A)).find((x) => x.id === p1);
    expect(p.images).toHaveLength(12);
    expect(p.images[0]).toBe("https://res.cloudinary.com/demo/image/upload/a.jpg");
    expect(p.mapUrl).toBe("https://maps.app.goo.gl/AbC");
    expect(p.cover).toBe(p.images[0]);
  });
  it("rejects a map link that is not Google Maps", async () => {
    const r = await as(A).post("project_save", { id: p1, name: "Sunrise Heights", mapUrl: "https://evil.com/maps" });
    expect(r.status).toBe(400);
    expect(r.json.error).toMatch(/Google Maps/);
  });
  it("team members and partners see photos and the map link too", async () => {
    expect((await projects(agent)).find((x) => x.id === p1).images.length).toBe(12);
    expect((await projects(partner)).find((x) => x.id === p1).mapUrl).toBe("https://maps.app.goo.gl/AbC");
  });
  it("shows the gallery and map button on the public page", async () => {
    const { GET } = await import("../app/property/[pub]/route");
    const pub = (await projects(A)).find((p) => p.id === p1).pub;
    const h = await (await GET(new Request(`http://localhost/property/${pub}`), { params: Promise.resolve({ pub }) })).text();
    expect(h).toContain("View on Google Maps");
    expect(h).toContain("Property ID PR-001");
    expect((h.match(/<img /g) || []).length).toBe(12);
  });
});

describe("photo uploads", () => {
  it("are for admins, for their own projects, and need Cloudinary set up", async () => {
    expect((await as(agent).post("upload_sign", { project: p1 })).status).toBe(403);
    expect((await as(partner).post("upload_sign", { project: p1 })).status).toBe(403);
    expect((await as(A).post("upload_sign", { project: pB })).status).toBe(400);
    expect((await as(A).post("upload_sign", { project: p1 })).status).toBe(503);
  });
  it("signs an image-only upload into the company's own folder", async () => {
    cloudinary.config({ cloud_name: "demo", api_key: "key123", api_secret: "secret456" });
    const r = await as(A).post("upload_sign", { project: p1 });
    expect(r.status).toBe(200);
    expect(r.json.url).toBe("https://api.cloudinary.com/v1_1/demo/image/upload");
    const ws = fake.collection("crm_projects").docs.find((d: any) => d._id === p1)!.ws;
    expect(r.json.fields).toMatchObject({ api_key: "key123", folder: `crm/${ws}/projects/${p1}`, allowed_formats: "jpg,jpeg,png,webp,heic,avif" });
    expect(r.json.fields.signature).toBe(cloudinary.utils.api_sign_request({ allowed_formats: r.json.fields.allowed_formats, folder: r.json.fields.folder, timestamp: r.json.fields.timestamp }, "secret456"));
    expect(JSON.stringify(r.json)).not.toContain("secret456");
  });
});
