import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/brevo", () => ({ sendWithBrevo: vi.fn(async () => ({ ok: true })) }));
import { Invites } from "@/collections/Invites";
import { sendWithBrevo } from "@/lib/brevo";

const hook = Invites.hooks!.beforeChange![0] as (a: unknown) => Promise<Record<string, unknown>>;
const original = { id: "1", slug: "aanya-rohan", paymentStatus: "created", plan: null, editToken: "tok", contactEmail: "c@x.in", names: "Aanya & Rohan" };
const payload = { findGlobal: async () => ({ validityMonths: 6 }), findByID: async () => original };
const run = (data: Record<string, unknown>, orig: Record<string, unknown> = original) => hook({ data: { ...data }, originalDoc: orig, req: { payload }, operation: "update" });

describe("manual package in /admin", () => {
  it("marking paid without a payment fills package, paid date and expiry", async () => {
    const d = await run({ paymentStatus: "paid", plan: "royal", paidAt: null, expiresAt: null });
    expect(d.plan).toBe("royal");
    expect(d.paidAt).toBeTruthy();
    const months = (new Date(d.expiresAt as string).getTime() - Date.now()) / (30.4 * 864e5);
    expect(Math.round(months)).toBe(6);
  });
  it("defaults to Basic when no package chosen; keeps admin-typed expiry", async () => {
    const d = await run({ paymentStatus: "paid", plan: null, expiresAt: "2030-01-01T00:00:00.000Z" });
    expect(d.plan).toBe("basic");
    expect(d.expiresAt).toBe("2030-01-01T00:00:00.000Z");
  });
  it("changing the package on an already-paid invite only changes the package", async () => {
    const d = await run({ paymentStatus: "paid", plan: "premium", paidAt: "2026-01-01T00:00:00.000Z", expiresAt: "2027-01-01T00:00:00.000Z" }, { ...original, paymentStatus: "paid", plan: "basic" });
    expect(d).toMatchObject({ plan: "premium", paidAt: "2026-01-01T00:00:00.000Z", expiresAt: "2027-01-01T00:00:00.000Z" });
  });
  it("email live link: refuses on a draft, sends with edit link once paid", async () => {
    await expect(run({ paymentStatus: "created", emailLive: true })).rejects.toThrow(/Paid/);
    const d = await run({ paymentStatus: "paid", plan: "basic", emailLive: true });
    expect(d.emailLive).toBe(false);
    const html = (vi.mocked(sendWithBrevo).mock.calls[0][0] as { html: string }).html;
    expect(html).toContain("/i/aanya-rohan");
    expect(html).toContain("/shaadi?edit=aanya-rohan.tok");
  });
});

describe("admin preview / edit links", () => {
  it("redirects a logged-in admin to the editor, and blocks everyone else", async () => {
    let user: unknown = null;
    vi.doMock("@/lib/cms/queries", () => ({ getPayloadClient: async () => ({ auth: async () => ({ user }) }) }));
    vi.doMock("@/lib/invites", () => ({ findInvite: async () => ({ slug: "aanya-rohan", editToken: "tok" }) }));
    const { GET } = await import("@/app/api/shaadi/admin-open/[slug]/route");
    const call = (to: string) => GET(new Request(`http://x/api/shaadi/admin-open/aanya-rohan?to=${to}`), { params: Promise.resolve({ slug: "aanya-rohan" }) });
    expect((await call("edit")).status).toBe(401);
    user = { id: "admin" };
    expect((await call("edit")).headers.get("location")).toBe("/shaadi?edit=aanya-rohan.tok");
    expect((await call("preview")).headers.get("location")).toBe("/shaadi?edit=aanya-rohan.tok&pv=1");
    expect((await call("live")).headers.get("location")).toBe("/i/aanya-rohan");
  });
});
