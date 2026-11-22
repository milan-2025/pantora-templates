import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/brevo", () => ({ sendWithBrevo: vi.fn(async () => ({ sent: true })) }));
vi.mock("cloudinary", () => ({ v2: { config: () => ({ cloud_name: "c", api_key: "k", api_secret: "s" }), utils: { api_sign_request: () => "sig" }, url: (id: string, o: { format?: string }) => `https://res/${id}${o?.format ? "." + o.format : ""}`, uploader: { destroy: async () => ({}) } } }));
import { fakePayload } from "./plannerFakePayload";
vi.mock("@/lib/cms/queries", () => ({ getPayloadClient: async () => fakePayload }));
import { istDate, shiftDay } from "@/lib/workout/core";
import * as W from "@/lib/workout/server";

const P = fakePayload;
const reset = () => { for (const k of Object.keys(P.db)) delete P.db[k]; P.globals = {}; W.clearSettingsCache(); };
const prof = (email: string) => P.db["workout-profiles"].find((d: { email: string }) => d.email === email);
const full = (id: string) => ({ id, w: 1, water: 8, sleep: 7, steps: 9000, mob: 10 });
async function buy(email: string, plan = "basic") {
  const p = await W.getOrCreateProfile(P, email);
  const q = await W.quote(P, email, plan, "", "");
  await P.update({ collection: "workout-profiles", id: p.id, data: { orderId: "ord_" + email, order: { plan: q.plan.id, amount: q.total } } });
  return W.markWorkoutPaid(P, "ord_" + email, "pay_1");
}

describe("group shared goal", () => {
  beforeEach(reset);
  it("counts everyone's km (activities + steps) and celebrates once", async () => {
    const t = istDate();
    await W.getOrCreateProfile(P, "a@x.com");
    const { code } = await W.createGroup(P, "a@x.com", { name: "Walkers", mode: "log" });
    await W.joinGroup(P, "b@x.com", code);
    await expect(W.setGroupGoal(P, "b@x.com", code, { kind: "km", target: 10 })).rejects.toMatchObject({ status: 403 });
    await W.setGroupGoal(P, "a@x.com", code, { kind: "km", target: 10, start: t, end: shiftDay(t, 6) });
    await W.saveState(P, "a@x.com", [{ c: "days", id: t, r: { id: t, acts: [{ t: "walk", min: 40, km: 4 }] } }]);
    let v = await W.groupView(P, "a@x.com", code);
    expect(v.goal).toMatchObject({ kind: "km", target: 10, total: 4, done: false });
    await W.saveState(P, "b@x.com", [{ c: "days", id: t, r: { id: t, steps: 8000 } }]); // 6 km
    v = await W.groupView(P, "b@x.com", code);
    expect(v.goal).toMatchObject({ total: 10, pct: 100, done: true });
    await W.groupView(P, "a@x.com", code);
    expect(v.feed.filter((f) => /reached the goal/.test(f.text))).toHaveLength(1);
    expect(W.goalAmount({ days: [full(t)] }, "complete", t, t)).toBe(1);
  });
});

describe("voice notes", () => {
  beforeEach(reset);
  it("only accepts the sender's own uploads, and plays as a signed mp3", async () => {
    await W.getOrCreateProfile(P, "a@x.com");
    const { code } = await W.createGroup(P, "a@x.com", { name: "Fam", mode: "log" });
    await W.joinGroup(P, "b@x.com", code);
    const up = await W.signVoice(P, "a@x.com");
    expect(up.url).toMatch(/\/video\/upload$/);
    await expect(W.groupPost(P, "b@x.com", code, { voice: { id: up.id, secs: 5 } })).rejects.toThrow(/didn't upload/);
    await W.groupPost(P, "a@x.com", code, { voice: { id: up.id, secs: 40 } });
    const v = await W.groupView(P, "b@x.com", code);
    expect(v.feed[0]).toMatchObject({ kind: "voice", secs: 15, voice: `https://res/${up.id}.mp3` });
  });
});

describe("family league", () => {
  beforeEach(reset);
  it("ranks everyone on one plan and lets them cheer each other", async () => {
    await buy("o@x.com");
    expect((await W.familyView(P, "o@x.com")).on).toBe(false); // nobody added yet
    await W.addMember(P, "o@x.com", "kid@x.com", "Kid");
    const t = istDate();
    await W.saveState(P, "kid@x.com", [{ c: "days", id: t, r: full(t) }]);
    const v = await W.familyView(P, "o@x.com");
    expect(v.on).toBe(true);
    expect(v.people?.[0].email).toBe("kid@x.com");
    await W.familyPost(P, "o@x.com", { to: "kid@x.com", preset: "proud" });
    expect((await W.inbox(P, "kid@x.com", "")).map((x) => x.group)).toContain("family");
    await W.getOrCreateProfile(P, "out@x.com");
    await expect(W.familyPost(P, "out@x.com", { preset: "go" })).rejects.toMatchObject({ status: 403 });
    expect((await W.me(P, "o@x.com")).family).toBe(true);
  });
});

describe("9 pm streak alert", () => {
  beforeEach(reset);
  it("alerts once when a streak is at risk, and not when today is done or it's turned off", async () => {
    const nine = Date.parse(istDate() + "T15:30:00Z"); // 21:00 India time
    const today = istDate(nine);
    for (const e of ["risk@x.com", "done@x.com", "off@x.com"]) {
      await W.getOrCreateProfile(P, e);
      Object.assign(prof(e), { streak: 5, push: [{ endpoint: "https://push.example/" + e }] });
    }
    prof("done@x.com").completed = [today];
    prof("off@x.com").state = { prefs: { streakAlert: false } };
    const r = await W.sendReminders(P, nine);
    expect(r.streakAlerts).toBe(1);
    expect(prof("risk@x.com").lastAlertDay).toBe(today);
    expect((await W.inbox(P, "risk@x.com", "")).map((x) => x.kind)).toContain("alert");
    expect((await W.sendReminders(P, nine)).streakAlerts).toBe(0); // once a day
  });
});

describe("pledge: money on finishing", () => {
  beforeEach(reset);
  const on = () => { P.globals["workout-settings"] = { pledgeOn: true, pledgeCharity: "Akshaya Patra", pledgeAmounts: "199, 499", pledgeNeed: 80, pledgeMinDays: 14 }; W.clearSettingsCache(); };
  it("stays off until a charity is named", async () => {
    P.globals["workout-settings"] = { pledgeOn: true }; W.clearSettingsCache();
    await W.getOrCreateProfile(P, "x@x.com");
    await expect(W.startPledge(P, "x@x.com", { amount: 199 })).rejects.toThrow(/aren't open/);
  });
  it("pays, counts on-time complete days and settles won or lost", async () => {
    on();
    const t = istDate();
    await W.getOrCreateProfile(P, "p@x.com");
    await W.saveState(P, "p@x.com", [{ k: "challenge", v: { id: "c1", program: "home", length: 14, start: t } }]);
    await expect(W.startPledge(P, "p@x.com", { amount: 300, challengeId: "c1" })).rejects.toThrow(/amounts/);
    const o = await W.startPledge(P, "p@x.com", { amount: 199, challengeId: "c1" });
    expect(o).toMatchObject({ amount: 199, days: 14, needed: 12 });
    await W.verifyPledge(P, "p@x.com", {});
    expect((await W.markPledgePaid(P, o.orderId)).alreadyPaid).toBe(true); // webhook after the app: no double
    await expect(W.startPledge(P, "p@x.com", { amount: 199, challengeId: "c1" })).rejects.toThrow(/already/);
    prof("p@x.com").completed = Array.from({ length: 12 }, (_, i) => shiftDay(t, i));
    const later = Date.parse(shiftDay(t, 16) + "T06:00:00Z");
    await W.settlePledges(P, prof("p@x.com"), later);
    expect(P.db["workout-pledges"][0]).toMatchObject({ status: "won", counted: 12 });

    await W.getOrCreateProfile(P, "q@x.com");
    await W.saveState(P, "q@x.com", [{ k: "challenge", v: { id: "c2", program: "walk", length: 21, start: t } }]);
    const o2 = await W.startPledge(P, "q@x.com", { amount: 499, challengeId: "c2" });
    await W.markPledgePaid(P, o2.orderId, "pay_x");
    prof("q@x.com").completed = [t];
    const r = await W.sendReminders(P, Date.parse(shiftDay(t, 25) + "T01:30:00Z")); // 7 am India time
    expect(r.pledgesSettled).toBe(1);
    expect(P.db["workout-pledges"].find((d: { email: string }) => d.email === "q@x.com")).toMatchObject({ status: "lost", needed: 17, counted: 1 });
  });
  it("needs enough days left in the challenge", async () => {
    on();
    const t = istDate();
    await W.getOrCreateProfile(P, "s@x.com");
    await W.saveState(P, "s@x.com", [{ k: "challenge", v: { id: "c3", program: "home", length: 14, start: shiftDay(t, -5) } }]);
    await expect(W.startPledge(P, "s@x.com", { amount: 199, challengeId: "c3" })).rejects.toThrow(/at least 14 days/);
  });
});
