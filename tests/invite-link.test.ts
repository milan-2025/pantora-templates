import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));

type Doc = { id: string; slug: string; previousSlugs?: string[] | null; editToken: string; names?: string; paymentStatus?: string };
let docs: Doc[] = [];

// Minimal stand-in for Payload: equals / or queries (an array field matches if it contains the value), and
// update() runs the Invites collection's beforeChange hooks like the real thing.
const match = (d: Doc, w: Record<string, unknown>): boolean => {
  if (Array.isArray(w.or)) return (w.or as Record<string, unknown>[]).some((x) => match(d, x));
  const [k, c] = Object.entries(w)[0] as [keyof Doc, { equals: string }];
  const v = d[k];
  return Array.isArray(v) ? v.includes(c.equals) : v === c.equals;
};
const payload = {
  find: async ({ where, limit }: { where: Record<string, unknown>; limit?: number }) => ({ docs: docs.filter((d) => match(d, where)).slice(0, limit ?? 10) }),
  findGlobal: async () => ({}),
  update: async ({ id, data }: { id: string; data: Partial<Doc> }) => {
    const { Invites } = await import("@/collections/Invites");
    const doc = docs.find((d) => d.id === id)!;
    let out: Record<string, unknown> = { ...data };
    for (const h of Invites.hooks!.beforeChange!) out = (await (h as (a: unknown) => Promise<Record<string, unknown>>)({ data: out, originalDoc: { ...doc }, req: { payload }, operation: "update" })) ?? out;
    Object.assign(doc, out);
    return doc;
  },
};
vi.mock("@/lib/cms/queries", () => ({ getPayloadClient: async () => payload }));
vi.mock("@/lib/shaadi/page", () => ({ studioResponse: (t: string) => new Response(t, { status: 200 }) }));

import { checkSlugShape, findInvite } from "@/lib/invites";

beforeEach(() => {
  docs = [
    { id: "1", slug: "aanya-rohan-3f2a", editToken: "tok1", names: "Aanya & Rohan", paymentStatus: "paid" },
    { id: "2", slug: "meera-kabir", previousSlugs: ["meera-weds-kabir"], editToken: "tok2" },
  ];
});
const rename = (id: string, slug: string) => payload.update({ id, data: { slug } });

describe("link rules", () => {
  it("cleans what people type", () => {
    expect(checkSlugShape("  Aanya Weds Rohan!! ")).toEqual({ slug: "aanya-weds-rohan" });
  });
  it("rejects too short and reserved links", () => {
    expect(checkSlugShape("ab").error).toMatch(/at least 3/);
    expect(checkSlugShape("Admin").error).toMatch(/reserved/);
    expect(checkSlugShape("planner").error).toMatch(/reserved/);
  });
});

describe("changing a link (admin or editor)", () => {
  it("saves the new link and remembers the old one", async () => {
    await rename("1", "Aanya Weds Rohan");
    expect(docs[0]).toMatchObject({ slug: "aanya-weds-rohan", previousSlugs: ["aanya-rohan-3f2a"] });
  });
  it("old links still find the invite", async () => {
    await rename("1", "aanya-weds-rohan");
    expect((await findInvite(payload as never, "aanya-rohan-3f2a"))?.id).toBe("1");
    expect((await findInvite(payload as never, "aanya-weds-rohan"))?.id).toBe("1");
  });
  it("can't take another couple's link, current or old", async () => {
    await expect(rename("1", "meera-kabir")).rejects.toThrow(/taken/);
    await expect(rename("1", "meera-weds-kabir")).rejects.toThrow(/taken/);
    expect(docs[0].slug).toBe("aanya-rohan-3f2a");
  });
  it("can go back to its own old link", async () => {
    await rename("2", "meera-weds-kabir");
    expect(docs[1]).toMatchObject({ slug: "meera-weds-kabir", previousSlugs: ["meera-kabir"] });
  });
  it("rejects reserved links in /admin too", async () => {
    await expect(rename("1", "admin")).rejects.toThrow(/reserved/);
  });
});

describe("editor endpoints", () => {
  it("couple renames with their edit token, even via the old link", async () => {
    const { PATCH } = await import("@/app/api/shaadi/invites/[slug]/route");
    const call = (slug: string, want: string, token = "tok1") =>
      PATCH(new Request(`http://x/api/shaadi/invites/${slug}`, { method: "PATCH", headers: { "x-edit-token": token, "content-type": "application/json" }, body: JSON.stringify({ want }) }), { params: Promise.resolve({ slug }) });
    expect((await call("aanya-rohan-3f2a", "x", "wrong")).status).toBe(403);
    const ok = await call("aanya-rohan-3f2a", "Aanya Weds Rohan");
    expect(await ok.json()).toEqual({ slug: "aanya-weds-rohan" });
    const again = await call("aanya-rohan-3f2a", "aanya-and-rohan"); // other device still holds the old link
    expect(await again.json()).toEqual({ slug: "aanya-and-rohan" });
    const clash = await call("aanya-and-rohan", "meera-kabir");
    expect(clash.status).toBe(409);
    expect((await clash.json()).error).toMatch(/taken/);
  });
  it("availability check", async () => {
    const { GET } = await import("@/app/api/shaadi/invites/route");
    const q = async (want: string, mine = "") => (await GET(new Request(`http://x/api/shaadi/invites?want=${encodeURIComponent(want)}&mine=${mine}`))).json();
    expect(await q("Meera Kabir")).toMatchObject({ slug: "meera-kabir", ok: false });
    expect(await q("meera-weds-kabir")).toMatchObject({ ok: false });
    expect(await q("priya-weds-arjun")).toMatchObject({ slug: "priya-weds-arjun", ok: true });
    expect(await q("aanya-rohan-3f2a", "aanya-rohan-3f2a")).toMatchObject({ ok: true, current: true });
    expect(await q("ab")).toMatchObject({ ok: false });
  });
});

describe("guest pages", () => {
  it("an old link (with guest name and query) forwards to the new link", async () => {
    await rename("1", "aanya-weds-rohan");
    const { inviteResponse } = await import("@/lib/shaadi/invitePage");
    const r = await inviteResponse(new Request("http://x/i/aanya-rohan-3f2a/sharma-family?utm=wa"), "aanya-rohan-3f2a");
    expect(r.status).toBe(308);
    expect(r.headers.get("location")).toBe("/i/aanya-weds-rohan/sharma-family?utm=wa");
    expect((await inviteResponse(new Request("http://x/i/aanya-weds-rohan"), "aanya-weds-rohan")).status).toBe(200);
  });
});
