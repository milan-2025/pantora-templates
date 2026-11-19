import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/brevo", () => ({ sendWithBrevo: vi.fn(async () => ({ sent: true })) }));
import {
  applyOps, cleanState, counts, overLimit, makeToken, readToken, effectiveStatus, newExpiry, PlannerError, describeOps, runSheetView,
} from "@/lib/planner/core";
import { dialDigits, runSheetPage } from "@/lib/planner/sharePage";
import { fakePayload } from "./plannerFakePayload";
import { Planners } from "@/collections/Planners";

const g = (id: string, name = id) => ({ id, name });

describe("planner sync: row-by-row merge", () => {
  it("upserts, deletes and sets settings without touching other rows", () => {
    const base = { guests: [g("a"), g("b")], settings: { bride: "A" } };
    const next = applyOps(base, [
      { c: "guests", id: "b", r: g("b", "Bee") },
      { c: "guests", id: "c", r: g("c") },
      { c: "guests", id: "a", r: null },
      { k: "settings", v: { bride: "Asha" } },
    ]);
    expect(next.guests!.map((x) => x.name)).toEqual(["Bee", "c"]);
    expect(next.settings).toEqual({ bride: "Asha" });
    expect(base.guests.length).toBe(2); // original untouched
  });
  it("two people's batches on different rows both survive", () => {
    const base = { guests: [g("a"), g("b")] };
    const one = applyOps(base, [{ c: "guests", id: "a", r: { id: "a", name: "a", city: "Noida" } }]);
    const both = applyOps(one, [{ c: "guests", id: "b", r: { id: "b", name: "b", city: "Pune" } }]);
    expect(both.guests!.map((x) => x.city)).toEqual(["Noida", "Pune"]);
  });
  it("replace swaps the whole planner; unknown lists and keys are refused", () => {
    expect(applyOps({ guests: [g("a")] }, [{ replace: { vendors: [{ id: "v", vendor: "X" }] } }])).toEqual({ vendors: [{ id: "v", vendor: "X" }] });
    expect(() => applyOps({}, [{ c: "secrets", id: "x", r: { id: "x" } }])).toThrow(PlannerError);
    expect(() => applyOps({}, [{ k: "paid", v: true }])).toThrow(PlannerError);
    expect(() => cleanState({ guests: [{ name: "no id" }] })).toThrow(PlannerError);
  });
  it("describes changes for the activity log", () => {
    expect(describeOps([{ c: "guests", id: "a", r: null }, { k: "msg", v: "" }])).toMatch(/Deleted 1 guests · updated 1 msg/i);
  });
});

describe("plan limits", () => {
  it("blocks growing past a limit, but allows editing a list that is already over it (after a downgrade)", () => {
    const lim = { guests: 2, vendors: null };
    expect(overLimit({ guests: [g("a")] }, { guests: [g("a"), g("b")] }, lim)).toBeNull();
    expect(overLimit({ guests: [g("a"), g("b")] }, { guests: [g("a"), g("b"), g("c")] }, lim)).toMatchObject({ key: "guests", limit: 2, count: 3 });
    const over = { guests: [g("a"), g("b"), g("c")] };
    expect(overLimit(over, { guests: [g("a", "x"), g("b"), g("c")] }, lim)).toBeNull();
    expect(overLimit(over, { guests: [g("a"), g("b")] }, lim)).toBeNull();
  });
  it("blank guest rows don't count", () => {
    expect(counts({ guests: [{ id: "a" }, g("b")] }).guests).toBe(1);
  });
});

describe("sign-in tokens", () => {
  it("round-trips, and rejects tampering, another secret and expiry", () => {
    const t = makeToken("s1", "a@b.in", 60_000);
    expect(readToken("s1", t)).toBe("a@b.in");
    expect(readToken("s2", t)).toBeNull();
    const [s, exp, sig] = t.split(".");
    expect(readToken("s1", `${Buffer.from("x@y.in").toString("base64url")}.${exp}.${sig}`)).toBeNull();
    expect(readToken("s1", `${s}.${Number(exp) + 1}.${sig}`)).toBeNull();
    expect(readToken("s1", t, Date.now() + 120_000)).toBeNull();
  });
});

describe("validity", () => {
  it("status from the admin fields", () => {
    expect(effectiveStatus({ status: "trial", expiresAt: new Date(Date.now() + 864e5).toISOString() })).toBe("trial");
    expect(effectiveStatus({ status: "paid", expiresAt: "2020-01-01" })).toBe("expired");
    expect(effectiveStatus({ status: "suspended" })).toBe("suspended");
  });
  it("renewing the same plan early adds to the time left; switching plans starts today", () => {
    const now = Date.parse("2027-01-01T00:00:00Z");
    const cur = { status: "paid", plan: "p1", expiresAt: "2027-03-01T00:00:00Z" };
    expect(newExpiry(cur, "p1", 365, now).toISOString().slice(0, 10)).toBe("2028-02-29"); // 365 days on, 2028 is a leap year
    expect(newExpiry(cur, "p2", 365, now).toISOString().slice(0, 10)).toBe("2028-01-01");
    expect(newExpiry({ status: "trial", plan: "p1", expiresAt: "2027-01-10T00:00:00Z" }, "p1", 365, now).toISOString().slice(0, 10)).toBe("2028-01-01");
  });
});

describe("admin: changing a customer's plan", () => {
  const hook = Planners.hooks!.beforeChange![0] as (a: unknown) => Promise<Record<string, unknown>>;
  const payload = { findByID: async ({ id }: { id: string }) => (id === "fam" ? { id: "fam", isTrial: false, durationDays: 365 } : { id: "trial", isTrial: true, durationDays: 14 }) };
  const orig = { id: "1", plan: "trial", status: "trial", expiresAt: "2026-12-01T00:00:00.000Z" };
  const run = (data: Record<string, unknown>) => hook({ data: { ...orig, ...data }, originalDoc: orig, req: { payload }, operation: "update" });
  it("picking a paid plan marks Paid and restarts validity from today", async () => {
    const d = await run({ plan: "fam" });
    expect(d.status).toBe("paid");
    expect(Math.round((Date.parse(d.expiresAt as string) - Date.now()) / 864e5)).toBe(365);
    expect(d.paidAt).toBeTruthy();
  });
  it("an expiry date typed by the admin wins", async () => {
    expect((await run({ plan: "fam", expiresAt: "2030-01-01T00:00:00.000Z" })).expiresAt).toBe("2030-01-01T00:00:00.000Z");
  });
  it("lower-cases emails so sign-in matches", async () => {
    const d = await run({ ownerEmail: " Bride@Mail.COM ", collaborators: [{ email: "Mom@Mail.com", role: "viewer" }] });
    expect(d.ownerEmail).toBe("bride@mail.com");
    expect((d.collaborators as { email: string }[])[0].email).toBe("mom@mail.com");
  });
});

describe("saving through the server", () => {
  let server: typeof import("@/lib/planner/server");
  beforeEach(async () => {
    for (const k of Object.keys(fakePayload.db)) delete fakePayload.db[k];
    server = await import("@/lib/planner/server");
  });
  it("creates a trial planner, merges two stale saves, enforces limits and blocks expired plans", async () => {
    const doc = await server.createPlanner(fakePayload, "o@x.in", { guests: [g("a")] });
    await expect(server.createPlanner(fakePayload, "o@x.in", {})).rejects.toThrow(/already have/);
    const [r1, r2] = await Promise.all([
      server.savePlanner(fakePayload, doc.id, "o@x.in", "owner", [{ c: "guests", id: "b", r: g("b") }]),
      server.savePlanner(fakePayload, doc.id, "m@x.in", "editor", [{ c: "guests", id: "c", r: g("c") }]),
    ]);
    expect(new Set([r1.rev, r2.rev])).toEqual(new Set([1, 2]));
    const saved = await fakePayload.findByID({ collection: "planners", id: doc.id });
    expect(saved.state.guests.map((x: { id: string }) => x.id).sort()).toEqual(["a", "b", "c"]);
    const since = await server.changesSince(fakePayload, saved, 0);
    expect(since.changes?.length).toBe(2);

    const many = Array.from({ length: 40 }, (_, i) => ({ c: "guests" as const, id: `n${i}`, r: g(`n${i}`) }));
    await expect(server.savePlanner(fakePayload, doc.id, "o@x.in", "owner", many)).rejects.toMatchObject({ status: 402 });
    await expect(server.savePlanner(fakePayload, doc.id, "v@x.in", "viewer", [{ k: "msg", v: "x" }])).rejects.toMatchObject({ status: 403 });

    await fakePayload.update({ collection: "planners", id: doc.id, data: { expiresAt: "2020-01-01T00:00:00.000Z" } });
    await expect(server.savePlanner(fakePayload, doc.id, "o@x.in", "owner", [{ k: "msg", v: "x" }])).rejects.toMatchObject({ status: 402 });
  });
  it("collaborators: none on the trial, up to the plan's number once paid, and roles are respected", async () => {
    const doc = await server.createPlanner(fakePayload, "o@x.in", {});
    await expect(server.addCollaborator(fakePayload, doc, "m@x.in", "editor")).rejects.toMatchObject({ status: 402 });
    const fam = (await server.getPlans(fakePayload)).find((p) => p.planId === "family")!;
    await fakePayload.update({ collection: "planners", id: doc.id, data: { plan: fam.id, status: "paid" } });
    let cur = await fakePayload.findByID({ collection: "planners", id: doc.id });
    for (const e of ["a@x.in", "b@x.in", "c@x.in"]) { await server.addCollaborator(fakePayload, cur, e, "viewer"); cur = await fakePayload.findByID({ collection: "planners", id: doc.id }); }
    await expect(server.addCollaborator(fakePayload, cur, "d@x.in", "editor")).rejects.toMatchObject({ status: 402 });
    expect(server.roleFor(cur, "A@x.in")).toBe("viewer");
    expect(server.roleFor(cur, "o@x.in")).toBe("owner");
    expect(server.roleFor(cur, "z@x.in")).toBeNull();
    expect(server.roleFor(cur, `support:${doc.id}`)).toBe("support");
  });
  it("payment confirmation switches the plan once, even if confirmed twice", async () => {
    const doc = await server.createPlanner(fakePayload, "o@x.in", {});
    const fam = (await server.getPlans(fakePayload)).find((p) => p.planId === "family")!;
    await fakePayload.update({ collection: "planners", id: doc.id, data: { orderId: "order_1", orderPlan: fam.id, orderAmount: 1499, orderPaid: false } });
    expect(await server.markPlannerPaid(fakePayload, "order_1", "pay_1")).toMatchObject({ found: true, alreadyPaid: false });
    const first = await fakePayload.findByID({ collection: "planners", id: doc.id });
    expect(await server.markPlannerPaid(fakePayload, "order_1", "pay_1")).toMatchObject({ alreadyPaid: true });
    const second = await fakePayload.findByID({ collection: "planners", id: doc.id });
    expect(first.status).toBe("paid");
    expect(second.expiresAt).toBe(first.expiresAt);
    expect(await server.markPlannerPaid(fakePayload, "unknown")).toMatchObject({ found: false });
  });
  it("sign-in codes: right code gives a session, wrong ones are counted", async () => {
    const { devCode } = await server.startLogin(fakePayload, "New@X.in");
    await expect(server.verifyLogin(fakePayload, "new@x.in", "000000" === devCode ? "111111" : "000000")).rejects.toMatchObject({ status: 401 });
    const ok = await server.verifyLogin(fakePayload, "NEW@x.in", devCode);
    expect(ok.email).toBe("new@x.in");
    await expect(server.verifyLogin(fakePayload, "new@x.in", devCode)).rejects.toThrow(); // single use
  });
  it("run sheet link: on, shown, renewed and off", async () => {
    const doc = await server.createPlanner(fakePayload, "o@x.in", { features: { sharelink: true }, functions: [{ id: "f", name: "Sangeet", active: "Yes" }], runsheet: [{ id: "r", fn: "Sangeet", activity: "DJ" }] });
    await expect(server.setShareLink(fakePayload, doc, "viewer", true)).rejects.toMatchObject({ status: 403 });
    const { shareToken } = await server.setShareLink(fakePayload, doc, "owner", true);
    expect(shareToken).toMatch(/^[\w-]{20}$/);
    expect((await server.sharedRunSheet(fakePayload, shareToken!))?.functions[0].items[0].activity).toBe("DJ");
    const cur = await fakePayload.findByID({ collection: "planners", id: doc.id });
    expect((await server.setShareLink(fakePayload, cur, "editor", true)).shareToken).toBe(shareToken); // same link while on
    expect((await server.meta(fakePayload, cur, "owner")).shareToken).toBe(shareToken);
    expect((await server.meta(fakePayload, cur, "viewer")).shareToken).toBeNull();
    await server.setShareLink(fakePayload, cur, "owner", false);
    expect(await server.sharedRunSheet(fakePayload, shareToken!)).toBeNull();
    expect(await server.sharedRunSheet(fakePayload, "bad token!")).toBeNull();
  });
});

describe("contacts, features and the run sheet link", () => {
  it("saves the new lists and settings (people, features, messages)", () => {
    const next = applyOps({}, [{ c: "people", id: "p1", r: { id: "p1", name: "Mama ji", phone: "98765 43210" } }, { k: "features", v: { daymode: true } }, { k: "msgs", v: { remind: "Hi {name}" } }]);
    expect(next.people).toHaveLength(1);
    expect(next.features).toEqual({ daymode: true });
    expect(cleanState({ people: [{ id: "x" }], features: {}, msgs: {} })).toHaveProperty("people");
  });
  const state = {
    settings: { bride: "Asha", groom: "Ravi", date: "2026-12-12", city: "Jaipur" },
    features: { sharelink: true },
    functions: [{ id: "f1", name: "Wedding", date: "2026-12-12", active: "Yes" }, { id: "f2", name: "Haldi", date: "2026-12-11", active: "Yes" }, { id: "f3", name: "Off", active: "No" }],
    runsheet: [
      { id: "r1", fn: "Wedding", time: "19:00", activity: "Pheras", who: "Pandit ji" },
      { id: "r2", fn: "Wedding", time: "17:00", activity: "Baraat", status: "Done", notes: "secret note" },
      { id: "r3", fn: "Haldi", time: "10:00", activity: "Haldi <b>" },
      { id: "r4", fn: "Off", activity: "hidden" },
    ],
    people: [{ id: "p1", name: "Mama ji", role: "Coordinator", phone: "98765 43210", star: "Yes" }, { id: "p2", name: "Not starred", phone: "98765 00000" }],
    vendors: [{ id: "v1", vendor: "Lens Co", line: "Photography", phone: "+44 7700 900123", star: "Yes", quoted: 90000 }],
    guests: [{ id: "g1", name: "Guest", phone: "9999999999", star: "Yes" }],
    payments: [{ id: "pay", amount: 5 }],
  };
  it("shows only the run sheet and starred contacts, in time order", () => {
    const v = runSheetView(state)!;
    expect(v.names).toBe("Asha & Ravi");
    expect(v.functions.map((f) => f.name)).toEqual(["Haldi", "Wedding"]);
    expect(v.functions[1].items.map((i) => i.activity)).toEqual(["Baraat", "Pheras"]);
    expect(v.functions[1].items[0].done).toBe(true);
    expect(v.contacts.map((c) => c.name)).toEqual(["Mama ji", "Lens Co"]); // no guests, nobody unstarred
    const json = JSON.stringify(v);
    expect(json).not.toMatch(/secret note|90000|9999999999|hidden/);
  });
  it("is off unless the couple switched the link on (and the run sheet is on)", () => {
    expect(runSheetView({ ...state, features: {} })).toBeNull();
    expect(runSheetView({ ...state, features: { sharelink: true, runsheet: false } })).toBeNull();
    expect(runSheetView(null)).toBeNull();
  });
  it("renders a safe page with call links", () => {
    const { status, html } = runSheetPage(runSheetView(state));
    expect(status).toBe(200);
    expect(html).toContain("Haldi &lt;b&gt;");
    expect(html).toContain('href="tel:+919876543210"');
    expect(html).toContain('href="tel:+447700900123"');
    expect(html).toContain("noindex");
    expect(runSheetPage(null).status).toBe(404);
  });
  it("dials Indian numbers typed in any common way", () => {
    expect(dialDigits("98765 43210")).toBe("919876543210");
    expect(dialDigits("098765-43210")).toBe("919876543210");
    expect(dialDigits("+91 98765 43210")).toBe("919876543210");
    expect(dialDigits("0044 7700 900123")).toBe("447700900123");
    expect(dialDigits("123")).toBe("");
  });
});
