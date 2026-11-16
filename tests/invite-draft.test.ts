import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));

type Doc = Record<string, unknown> & { id: string; slug: string; editToken: string };
let docs: Doc[] = [];
const payload = {
  find: async ({ where }: { where: Record<string, { equals: string }> }) => {
    const [k, c] = Object.entries(where)[0];
    return { docs: docs.filter((d) => (Array.isArray(d[k]) ? (d[k] as string[]).includes(c.equals) : d[k] === c.equals)) };
  },
  findGlobal: async () => ({ validityMonths: 12 }),
  update: async ({ id, data, where }: { id?: string; data: Record<string, unknown>; where?: Record<string, { equals?: string; not_equals?: string }> }) => {
    if (where) {
      const d = docs.find((x) => x.orderId === where.orderId.equals && x.paymentStatus !== "paid");
      if (d) Object.assign(d, data);
      return { docs: d ? [d] : [] };
    }
    const d = docs.find((x) => x.id === id)!;
    Object.assign(d, data);
    return d;
  },
};
vi.mock("@/lib/cms/queries", () => ({ getPayloadClient: async () => payload }));
vi.mock("@/lib/shaadi/page", () => ({ studioResponse: (t: string, _p: string, guest: boolean) => new Response(JSON.stringify({ t, guest })) }));
vi.mock("@/lib/brevo", () => ({ sendWithBrevo: vi.fn(async () => ({ ok: true })) }));

import { guestSlugs, hasUnsavedChanges, liveState, lockFree, markInvitePaid } from "@/lib/invites";

const LIVE_DESIGN = { b: "Anu", g: "Jyoti", th: "rajwada", ev: [], gu: [{ n: "Old Guest", p: "", g: "" }] };
beforeEach(() => {
  docs = [
    {
      id: "1", slug: "anujyoti", editToken: "tok", paymentStatus: "paid", plan: "premium",
      published: LIVE_DESIGN,
      state: { ...LIVE_DESIGN, th: "mahal", gu: [{ n: "Sharma Family", p: "9876543210", g: "" }] },
    },
  ];
});
const req = (method: string, path: string, body?: unknown, sid = "tabA", token = "tok") =>
  new Request(`http://x${path}`, { method, headers: { "x-edit-token": token, "x-edit-session": sid, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
const ctx = { params: Promise.resolve({ slug: "anujyoti" }) };

describe("draft vs live", () => {
  it("guests get the saved design with the current guest list", () => {
    const live = liveState(docs[0] as never);
    expect(live.th).toBe("rajwada"); // unsaved theme change stays in the draft
    expect(live.gu).toEqual([{ n: "Sharma Family", p: "9876543210", g: "" }]); // guests added since still get their link
  });
  it("knows when there are unsaved changes (guest-list edits don't count)", () => {
    expect(hasUnsavedChanges(docs[0] as never)).toBe(true);
    expect(hasUnsavedChanges({ state: { ...LIVE_DESIGN, gu: [] }, published: LIVE_DESIGN })).toBe(false);
    expect(hasUnsavedChanges({ state: LIVE_DESIGN, published: null })).toBe(true);
  });
  it("public invite serves the live version; personal links use the latest guest list", async () => {
    const { GET } = await import("@/app/api/shaadi/public/[slug]/route");
    const r = await (await GET(new Request("http://x/api/shaadi/public/anujyoti?guest=sharma-family"), ctx)).json();
    expect(r.state.th).toBe("rajwada");
    expect(r.guest).toMatchObject({ n: "Sharma Family" });
    expect(r.state.gu).toBeUndefined(); // guest list itself never leaves the server
  });
  it("autosave changes only the draft; Save makes it live", async () => {
    const { PUT, POST } = await import("@/app/api/shaadi/invites/[slug]/route");
    await PUT(req("PUT", "/api/shaadi/invites/anujyoti", { state: { ...LIVE_DESIGN, b: "Anu R" } }), ctx);
    expect((docs[0].state as { b: string }).b).toBe("Anu R");
    expect((docs[0].published as { b: string }).b).toBe("Anu");
    const r = await (await POST(req("POST", "/api/shaadi/invites/anujyoti", { op: "publish", state: { ...LIVE_DESIGN, b: "Anu R" } }), ctx)).json();
    expect(r.ok).toBe(true);
    expect((docs[0].published as { b: string }).b).toBe("Anu R");
    expect(docs[0].publishedAt).toBeTruthy();
    expect(hasUnsavedChanges(docs[0] as never)).toBe(false);
  });
  it("first payment publishes the draft so the invite goes live as designed", async () => {
    docs[0] = { id: "2", slug: "new-couple", editToken: "t", paymentStatus: "created", orderId: "order_1", orderPlan: "basic", state: { b: "A", g: "B" }, published: null };
    await markInvitePaid(payload as never, "order_1");
    expect(docs[0]).toMatchObject({ paymentStatus: "paid", published: { b: "A", g: "B" } });
  });
});

describe("one editor at a time", () => {
  it("first tab gets the lease; a second tab is told it's open elsewhere", async () => {
    const { POST } = await import("@/app/api/shaadi/invites/[slug]/route");
    expect(await (await POST(req("POST", "/x", { op: "lock" }, "tabA"), ctx)).json()).toEqual({ ok: true });
    const b = await (await POST(req("POST", "/x", { op: "lock" }, "tabB"), ctx)).json();
    expect(b).toMatchObject({ ok: false, held: true });
  });
  it("the other tab can't save until it takes over; then the first tab is locked out", async () => {
    const { POST, PUT } = await import("@/app/api/shaadi/invites/[slug]/route");
    await POST(req("POST", "/x", { op: "lock" }, "tabA"), ctx);
    expect((await PUT(req("PUT", "/x", { state: LIVE_DESIGN }, "tabB"), ctx)).status).toBe(409);
    expect((await POST(req("POST", "/x", { op: "publish", state: LIVE_DESIGN }, "tabB"), ctx)).status).toBe(409);
    expect(await (await POST(req("POST", "/x", { op: "lock", take: true }, "tabB"), ctx)).json()).toEqual({ ok: true });
    expect((await PUT(req("PUT", "/x", { state: LIVE_DESIGN }, "tabB"), ctx)).status).toBe(200);
    expect((await PUT(req("PUT", "/x", { state: LIVE_DESIGN }, "tabA"), ctx)).status).toBe(409);
    expect((await (await POST(req("POST", "/x", { op: "lock" }, "tabA"), ctx)).json()).held).toBe(true);
  });
  it("closing a tab frees it; a lease left behind lapses after 45s", async () => {
    const { POST } = await import("@/app/api/shaadi/invites/[slug]/route");
    await POST(req("POST", "/x", { op: "lock" }, "tabA"), ctx);
    await POST(req("POST", "/x", { op: "lock", release: true }, "tabA"), ctx);
    expect((await (await POST(req("POST", "/x", { op: "lock" }, "tabB"), ctx)).json()).ok).toBe(true);
    expect(lockFree({ editSid: "tabB", editAt: new Date(Date.now() - 46_000).toISOString() }, "tabC")).toBe(true);
    expect(lockFree({ editSid: "tabB", editAt: new Date(Date.now() - 5_000).toISOString() }, "tabC")).toBe(false);
  });
  it("needs the private key", async () => {
    const { POST } = await import("@/app/api/shaadi/invites/[slug]/route");
    expect((await POST(req("POST", "/x", { op: "lock" }, "tabA", "wrong"), ctx)).status).toBe(403);
  });
});

describe("edit address", () => {
  it("/i/<link>/edit serves the editor, not the guest page", async () => {
    const { inviteResponse } = await import("@/lib/shaadi/invitePage");
    expect(await (await inviteResponse(new Request("http://x/i/anujyoti/edit"), "anujyoti")).json()).toEqual({ t: "Edit your invite · Pandora Templates", guest: false });
    const g = await (await inviteResponse(new Request("http://x/i/anujyoti"), "anujyoti")).json();
    expect(g).toEqual({ t: "Anu & Jyoti are getting married", guest: true }); // title from the live version
  });
  it("a guest named Edit never takes the edit address", () => {
    expect(guestSlugs([{ n: "Edit" }, { n: "Edit" }])).toEqual(["edit-guest", "edit-guest-2"]);
  });
});
