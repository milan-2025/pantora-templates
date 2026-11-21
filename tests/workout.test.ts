import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/brevo", () => ({ sendWithBrevo: vi.fn(async () => ({ sent: true })) }));
vi.mock("cloudinary", () => ({ v2: { config: () => ({ cloud_name: "c", api_key: "k", api_secret: "s" }), utils: { api_sign_request: () => "sig" }, url: (id: string) => `https://res/${id}`, uploader: { destroy: async () => ({}) } } }));
import { fakePayload } from "./plannerFakePayload";
vi.mock("@/lib/cms/queries", () => ({ getPayloadClient: async () => fakePayload }));
import {
  applyOps, bestStreak, checkpoints, countOnTime, istDate, isComplete, levelOf, moneyBackProgress, newMilestones, shiftDay, streakOf, xpOf, DEFAULT_MILESTONES, DEFAULT_TARGETS,
} from "@/lib/workout/core";
import * as W from "@/lib/workout/server";

const T = DEFAULT_TARGETS;
const full = (id: string) => ({ id, w: 1, water: 8, sleep: 7, steps: 9000, mob: 10 });
const reset = () => { for (const k of Object.keys(fakePayload.db)) delete fakePayload.db[k]; fakePayload.globals = {}; W.clearSettingsCache(); };

describe("workout rules", () => {
  it("counts checkpoints and complete days", () => {
    expect(checkpoints({ id: "d", w: 1, water: 8 }, T)).toBe(2);
    expect(isComplete({ id: "d", w: 1, water: 8, sleep: 7 }, T)).toBe(false);
    expect(isComplete({ id: "d", w: 1, water: 8, sleep: 7, mob: 10 }, T)).toBe(true);
    expect(isComplete({ id: "d", water: 8, sleep: 7, mob: 10, steps: 9000 }, T)).toBe(false); // no workout
    expect(isComplete({ id: "d", rest: 1, water: 8, sleep: 7, mob: 10 }, T)).toBe(true);
  });
  it("keeps a streak alive over a freeze without adding to it", () => {
    const done = new Set(["2026-11-17", "2026-11-18", "2026-11-20", "2026-11-21"]);
    expect(streakOf(done, new Set(), "2026-11-21")).toBe(2);
    expect(streakOf(done, new Set(["2026-11-19"]), "2026-11-21")).toBe(4);
    expect(streakOf(done, new Set(), "2026-11-22")).toBe(2); // today not done yet: counts to yesterday
    expect(bestStreak(done, new Set(["2026-11-19"]))).toBe(4);
  });
  it("only counts days logged on the day or the next day", () => {
    const now = Date.parse("2026-11-21T10:00:00+05:30");
    const st = { days: [full("2026-11-21"), full("2026-11-20"), full("2026-11-10")] };
    const r = countOnTime({}, st, now);
    expect(r.completed).toEqual(["2026-11-20", "2026-11-21"]);
    expect(countOnTime(r, { days: [] }, now).completed).toEqual(["2026-11-20", "2026-11-21"]); // never taken away
  });
  it("gives points and levels", () => {
    const days = [full("2026-11-20"), { ...full("2026-11-21"), q: ["a", "b", "c"], bx: 999 }];
    const { total } = xpOf({ days, meals: [{ id: "m", d: "2026-11-21" }] });
    // day1: 50 + 4*10 + 30 + streak 2 = 122; day2: 122 + 2 more streak + 45 quests + 50 chest (capped) = 219; meal 5
    expect(total).toBe(122 + 219 + 5);
    expect(levelOf(0).level).toBe(1);
    expect(levelOf(100).level).toBe(2);
    expect(levelOf(299).level).toBe(2);
    expect(levelOf(300).name).toBe("Getting Moving");
  });
  it("finds milestones reached and money-back tiers", () => {
    const days = Array.from({ length: 8 }, (_, i) => shiftDay("2026-11-21", -i));
    expect(newMilestones(days, ["streak3"], DEFAULT_MILESTONES, "2026-11-21").map((m) => m.key)).toEqual(["streak7"]);
    const mb = moneyBackProgress(Array.from({ length: 310 }, (_, i) => shiftDay("2026-01-01", i)), "2026-01-01", "2026-12-31", [{ days: 300, percent: 50, months: 6 }, { days: 365, percent: 90, months: 12 }]);
    expect(mb.counted).toBe(310);
    expect(mb.reached).toMatchObject({ percent: 50 });
    expect(mb.next).toMatchObject({ days: 365 });
  });
  it("applies row changes and rejects junk", () => {
    const s = applyOps({ days: [{ id: "a", w: 1 }] }, [{ c: "days", id: "b", r: { id: "b", w: 1 } }, { c: "days", id: "a", r: null }, { k: "profile", v: { name: "A" } }]);
    expect(s.days!.map((r) => r.id)).toEqual(["b"]);
    expect(() => applyOps({}, [{ c: "hack", id: "x", r: {} }])).toThrow();
  });
});

describe("workout accounts, plans and sharing", () => {
  beforeEach(reset);
  const P = fakePayload;
  const prof = (email: string) => P.db["workout-profiles"].find((d: { email: string }) => d.email === email);
  async function buy(email: string, plan = "basic", ref = "") {
    const p = await W.getOrCreateProfile(P, email);
    const q = await W.quote(P, email, plan, "", ref);
    await P.update({ collection: "workout-profiles", id: p.id, data: { orderId: "ord_" + email, order: { plan: q.plan.id, amount: q.total, ref: q.ref } } });
    return W.markWorkoutPaid(P, "ord_" + email, "pay_1");
  }

  it("starts the free challenge on first log and locks it when it ends", async () => {
    await W.getOrCreateProfile(P, "a@x.com");
    expect((await W.me(P, "a@x.com")).access).toMatchObject({ kind: "free", status: "new", canLog: true });
    const day = istDate();
    await W.saveState(P, "a@x.com", [{ c: "days", id: day, r: { id: day, w: 1 } }]);
    expect(prof("a@x.com").freeStart).toBeTruthy();
    prof("a@x.com").freeStart = new Date(Date.now() - 15 * 864e5).toISOString();
    await expect(W.saveState(P, "a@x.com", [{ c: "days", id: day, r: { id: day, w: 1, water: 2 } }])).rejects.toMatchObject({ status: 402 });
    await W.saveState(P, "a@x.com", [{ k: "prefs", v: { theme: "day" } }]); // settings still save
  });

  it("buys once, safely, and shares the plan with friends up to the seat limit", async () => {
    await buy("o@x.com");
    expect((await W.markWorkoutPaid(P, "ord_o@x.com")).alreadyPaid).toBe(true);
    expect(P.db["workout-memberships"]).toHaveLength(1);
    const a = (await W.me(P, "o@x.com")).access;
    expect(a).toMatchObject({ kind: "owner", isPaid: true, seats: 3, photosPerWeek: 1 });
    for (const e of ["f1@x.com", "f2@x.com", "f3@x.com"]) await W.addMember(P, "o@x.com", e, "F");
    await expect(W.addMember(P, "o@x.com", "f4@x.com", "F")).rejects.toMatchObject({ status: 402 });
    const f = (await W.me(P, "f1@x.com")).access;
    expect(f).toMatchObject({ kind: "member", isPaid: true, ownerEmail: "o@x.com" });
    await W.removeMember(P, "o@x.com", "f1@x.com");
    expect((await W.me(P, "f1@x.com")).access.kind).toBe("free");
  });

  it("gives the friend a discount and the referrer free days", async () => {
    await buy("r@x.com");
    const code = prof("r@x.com").refCode;
    const before = P.db["workout-memberships"].find((m: { ownerEmail: string }) => m.ownerEmail === "r@x.com").expiresAt;
    expect((await W.quote(P, "n@x.com", "basic", "", code)).total).toBe(899);
    expect((await W.quote(P, "r@x.com", "basic", "", code)).total).toBe(999); // not your own code
    await buy("n@x.com", "basic", code);
    const after = P.db["workout-memberships"].find((m: { ownerEmail: string }) => m.ownerEmail === "r@x.com").expiresAt;
    expect(Math.round((Date.parse(after) - Date.parse(before)) / 864e5)).toBe(30);
    expect(prof("r@x.com").refCount).toBe(1);
  });

  it("unlocks a milestone gift once and adds free days to the buyer's plan", async () => {
    await buy("g@x.com");
    const p = prof("g@x.com");
    p.completed = Array.from({ length: 7 }, (_, i) => shiftDay(istDate(), -i));
    const m = P.db["workout-memberships"][0], before = m.expiresAt;
    const access = await W.accessOf(P, p);
    const gifts = await W.grantMilestones(P, prof("g@x.com"), access);
    expect(gifts.map((g) => g.key)).toEqual(["streak3", "streak7"]);
    expect(Math.round((Date.parse(P.db["workout-memberships"][0].expiresAt) - Date.parse(before)) / 864e5)).toBe(7);
    expect(await W.grantMilestones(P, prof("g@x.com"), access)).toEqual([]);
  });

  it("matches two paid people as buddies and hides numbers until both agree", async () => {
    await buy("b1@x.com"); await buy("b2@x.com");
    expect((await W.requestBuddy(P, "b1@x.com")).status).toBe("waiting");
    expect((await W.requestBuddy(P, "b2@x.com")).status).toBe("matched");
    expect(prof("b1@x.com").buddyEmail).toBe("b2@x.com");
    prof("b1@x.com").buddySince = prof("b2@x.com").buddySince = new Date(Date.now() - 8 * 864e5).toISOString();
    await W.buddyAction(P, "b1@x.com", { action: "share", on: true, phone: "9876543210" });
    expect((await W.buddyView(P, "b2@x.com")).wa?.number).toBe("");
    await W.buddyAction(P, "b2@x.com", { action: "share", on: true, phone: "9123456789" });
    expect((await W.buddyView(P, "b2@x.com")).wa?.number).toBe("919876543210");
    await W.buddyAction(P, "b1@x.com", { action: "report" });
    expect(prof("b2@x.com")).toMatchObject({ buddyStatus: "none", reports: 1 });
    await W.getOrCreateProfile(P, "free@x.com");
    await expect(W.requestBuddy(P, "free@x.com")).rejects.toMatchObject({ status: 402 });
  });

  it("lets the buyer claim money back once the days are reached", async () => {
    await buy("m@x.com");
    const start = istDate();
    await expect(W.claimMoneyBack(P, "m@x.com", "refund")).rejects.toThrow(/Keep going/);
    prof("m@x.com").logged = Array.from({ length: 300 }, (_, i) => shiftDay(start, i));
    await W.claimMoneyBack(P, "m@x.com", "refund");
    expect(P.db["workout-claims"][0]).toMatchObject({ percent: 50, refundAmount: 500, status: "pending" });
    await expect(W.claimMoneyBack(P, "m@x.com", "extend")).rejects.toThrow(/already/);
  });

  it("limits progress photos per week by plan", async () => {
    await W.getOrCreateProfile(P, "p@x.com");
    await W.signPhoto(P, "p@x.com", istDate());
    await expect(W.signPhoto(P, "p@x.com", istDate())).rejects.toMatchObject({ status: 402 });
    prof("p@x.com").photosOverride = 3; // set by hand in /admin
    await W.signPhoto(P, "p@x.com", istDate());
  });

  it("runs groups with a member limit", async () => {
    await W.getOrCreateProfile(P, "h@x.com");
    fakePayload.globals["workout-settings"] = { groupMax: 2 }; W.clearSettingsCache();
    const { code } = await W.createGroup(P, "h@x.com", { name: "Squad", mode: "log" });
    await W.joinGroup(P, "j@x.com", code);
    await expect(W.joinGroup(P, "k@x.com", code)).rejects.toThrow(/full/);
    await W.groupPost(P, "j@x.com", code, { preset: "go" });
    const v = await W.groupView(P, "h@x.com", code);
    expect(v.people).toHaveLength(2);
    expect(v.feed.map((f) => f.text)).toContain("💪 You got this!");
    expect((await W.inbox(P, "h@x.com", "")).length).toBe(2); // joined + message
  });
});
