import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/brevo", () => ({ sendWithBrevo: vi.fn(async () => ({ sent: true })) }));
vi.mock("cloudinary", () => ({ v2: { config: () => ({}), utils: {}, url: () => "", uploader: {} } }));
import { fakePayload } from "./plannerFakePayload";
vi.mock("@/lib/cms/queries", () => ({ getPayloadClient: async () => fakePayload }));
import { checkLogin, hashPassword, passwordMatches, setPassword } from "@/lib/auth/passwords";
import * as P from "@/lib/planner/server";
import * as W from "@/lib/workout/server";
import { readToken } from "@/lib/planner/core";
import { startEditAccess, verifyEditAccess } from "@/lib/shaadi/editAccess";

const reset = () => { for (const k of Object.keys(fakePayload.db)) delete fakePayload.db[k]; };

describe("optional passwords", () => {
  beforeEach(reset);
  it("hashes with a salt and checks", async () => {
    const a = await hashPassword("correct horse"), b = await hashPassword("correct horse");
    expect(a).not.toBe(b);
    expect(await passwordMatches("correct horse", a)).toBe(true);
    expect(await passwordMatches("Correct horse", a)).toBe(false);
    expect(await passwordMatches("x", "garbage")).toBe(false);
  });
  it("planner: no password → refused; set → sign in; change; remove", async () => {
    await expect(P.passwordLogin(fakePayload, "a@x.in", "whatever1")).rejects.toMatchObject({ status: 401 });
    await expect(P.setMyPassword(fakePayload, "a@x.in", "short")).rejects.toMatchObject({ status: 400 });
    expect(await P.setMyPassword(fakePayload, "a@x.in", "first-pass")).toMatchObject({ hasPassword: true });
    const r = await P.passwordLogin(fakePayload, "A@X.in ", "first-pass");
    expect(r.email).toBe("a@x.in");
    expect(readToken(process.env.PAYLOAD_SECRET || "dev-secret-change-me", r.token)).toBe("a@x.in");
    await expect(P.passwordLogin(fakePayload, "a@x.in", "wrong-pass")).rejects.toMatchObject({ status: 401 });
    await P.setMyPassword(fakePayload, "a@x.in", "second-pass");
    await expect(P.passwordLogin(fakePayload, "a@x.in", "first-pass")).rejects.toMatchObject({ status: 401 });
    await expect(P.passwordLogin(fakePayload, "a@x.in", "second-pass")).resolves.toMatchObject({ email: "a@x.in" });
    expect(await P.plannerHasPassword(fakePayload, "a@x.in")).toBe(true);
    await P.setMyPassword(fakePayload, "a@x.in", null, true);
    expect(await P.plannerHasPassword(fakePayload, "a@x.in")).toBe(false);
    await expect(P.passwordLogin(fakePayload, "a@x.in", "second-pass")).rejects.toMatchObject({ status: 401 });
  });
  it("planner and workout passwords are separate", async () => {
    await P.setMyPassword(fakePayload, "a@x.in", "planner-pass");
    await expect(W.passwordLogin(fakePayload, "a@x.in", "planner-pass")).rejects.toMatchObject({ status: 401 });
    await W.setMyPassword(fakePayload, "a@x.in", "workout-pass");
    await expect(W.passwordLogin(fakePayload, "a@x.in", "workout-pass")).resolves.toMatchObject({ email: "a@x.in" });
  });
  it("pauses the password after 10 wrong tries in a row", async () => {
    await setPassword(fakePayload, "planner", "b@x.in", "right-pass");
    for (let i = 0; i < 10; i++) await expect(checkLogin(fakePayload, "planner", "b@x.in", "nope-nope")).rejects.toMatchObject({ status: 401 });
    await expect(checkLogin(fakePayload, "planner", "b@x.in", "right-pass")).rejects.toMatchObject({ status: 429 });
  });
  it("refreshes the session token once it is a day old", () => {
    const fresh = W.tokenFor("c@x.in");
    expect(W.refreshedToken(new Request("http://x", { headers: { authorization: `Bearer ${fresh}` } }), "c@x.in")).toBeUndefined();
    const [s, , sig] = fresh.split(".");
    const old = `${s}.${Date.now() + 10 * 864e5}.${sig}`; // expiry only matters for the "is it old" check
    expect(W.refreshedToken(new Request("http://x", { headers: { authorization: `Bearer ${old}` } }), "c@x.in")).toBeTruthy();
  });
});

describe("invite: sign in to edit from the guest page", () => {
  beforeEach(reset);
  it("sends a code only to the invite's email, and the code returns the edit key", async () => {
    const inv = await fakePayload.create({ collection: "invites", data: { slug: "a-weds-b", editToken: "k".repeat(32), contactEmail: "Couple@x.in", names: "A & B" } });
    expect(await startEditAccess(fakePayload, "a-weds-b", "stranger@x.in")).toEqual({ ok: true }); // same answer, no code
    expect(fakePayload.db["planner-logins"] ?? []).toHaveLength(0);
    const r = await startEditAccess(fakePayload, "a-weds-b", "couple@x.in");
    const code = (r as { devCode: string }).devCode;
    expect(code).toMatch(/^\d{6}$/);
    await expect(verifyEditAccess(fakePayload, "a-weds-b", "couple@x.in", code === "000000" ? "111111" : "000000")).rejects.toMatchObject({ status: 401 });
    expect(await verifyEditAccess(fakePayload, "a-weds-b", "couple@x.in", code)).toEqual({ slug: "a-weds-b", token: inv.editToken });
    await expect(verifyEditAccess(fakePayload, "a-weds-b", "couple@x.in", code)).rejects.toThrow(); // single use
  });
  it("planner owner and editors may sign in; view-only family may not", async () => {
    const pl = await fakePayload.create({ collection: "planners", data: { ownerEmail: "o@x.in", collaborators: [{ email: "ed@x.in", role: "editor" }, { email: "vw@x.in", role: "viewer" }] } });
    await fakePayload.create({ collection: "invites", data: { slug: "c-d", editToken: "t".repeat(32), planner: pl.id } });
    expect(await startEditAccess(fakePayload, "c-d", "o@x.in")).toHaveProperty("devCode");
    expect(await startEditAccess(fakePayload, "c-d", "ed@x.in")).toHaveProperty("devCode");
    expect(await startEditAccess(fakePayload, "c-d", "vw@x.in")).not.toHaveProperty("devCode");
  });
});
