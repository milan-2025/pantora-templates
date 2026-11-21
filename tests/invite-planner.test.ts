import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/brevo", () => ({ sendWithBrevo: vi.fn(async () => ({ sent: true })) }));
import { fakePayload } from "./plannerFakePayload";
vi.mock("@/lib/cms/queries", () => ({ getPayloadClient: async () => fakePayload }));
import { sendWithBrevo } from "@/lib/brevo";
import {
  eventsFrom, familiesOf, inviteGuestsFrom, matchFamily, replyOps, seedState, importGuestOps, familyLinks,
} from "@/lib/invitePlannerCore";
import { guestSlugs, publicView } from "@/lib/invites";

const fns = [
  { id: "f1", name: "Mehendi", date: "2027-02-12", time: "16:00", venue: "Bagh, Jaipur", active: "Yes" },
  { id: "f2", name: "Sangeet", date: "2027-02-13", time: "19:00", venue: "Lawn", active: "Yes" },
  { id: "f3", name: "Wedding", date: "2027-02-14", time: "20:00", venue: "Palace", active: "Yes" },
  { id: "f4", name: "Haldi", date: "2027-02-12", active: "No" },
];
const guests = [
  { id: "g1", name: "Ramesh Sharma", group: "Sharma family", phone: "98765 43210", cat: "Relative", fn: { Mehendi: "Y", Wedding: "Y" } },
  { id: "g2", name: "Sunita Sharma", group: "Sharma family", phone: "", cat: "Relative", fn: { Wedding: "Y" } },
  { id: "g3", name: "Priya", group: "", phone: "+44 7700 900123", cat: "Friend", fn: { Sangeet: "Y", Wedding: "Y" } },
  { id: "g4", name: "", group: "" },
];
const PS = { settings: { bride: "Aanya", groom: "Rohan", date: "2027-02-14", city: "Jaipur" }, functions: fns, guests };

describe("planner → invite rules", () => {
  it("groups guests into families with a phone and the functions they're invited to", () => {
    const f = familiesOf(PS);
    expect(f.map((x) => [x.k, x.p, x.fnIds])).toEqual([
      ["Sharma family", "919876543210", ["f1", "f3"]],
      ["Priya", "447700900123", ["f2", "f3"]],
    ]);
    const { gu, grp } = inviteGuestsFrom(PS, [{ n: "Sharma family", p: "", g: "", k: "Sharma family", s: 123 }]);
    expect(gu[0]).toMatchObject({ n: "Sharma family", k: "Sharma family", e: ["f1", "f3"], en: ["mehendi", "wedding"], s: 123 });
    expect(gu[1].s).toBeUndefined();
    expect(grp).toEqual(["Relative", "Friend"]);
  });

  it("turns functions into events and keeps the couple's own touches", () => {
    const first = eventsFrom(PS, []);
    expect(first.ev.map((e) => [e.n, e.d, e.v, e.pk])).toEqual([
      ["Mehendi", "2027-02-12T16:00", "Bagh, Jaipur", "f1"],
      ["Sangeet", "2027-02-13T19:00", "Lawn", "f2"],
      ["Wedding", "2027-02-14T20:00", "Palace", "f3"],
    ]);
    const mine = [...first.ev.map((e) => ({ ...e, x: "Wear green", ic: "mehendi" })), { n: "After party", d: "2027-02-15T22:00", v: "Club" }];
    const moved = { ...PS, functions: [{ ...fns[0], date: "2027-02-11" }, { ...fns[1], venue: "Terrace" }, fns[3]] };
    const next = eventsFrom(moved, mine);
    expect(next.ev.map((e) => [e.n, e.d, e.v, e.x])).toEqual([
      ["Mehendi", "2027-02-11T16:00", "Bagh, Jaipur", "Wear green"],
      ["Sangeet", "2027-02-13T19:00", "Terrace", "Wear green"],
      ["After party", "2027-02-15T22:00", "Club", undefined],
    ]);
    expect(next.changes).toEqual(["Removed Wedding", "Mehendi: date 11 Feb", "Sangeet: venue"]);
    expect(eventsFrom(moved, next.ev).changes).toEqual([]);
  });

  it("seeds a new invite with names, the wedding date and time, events and families", () => {
    const st = seedState(PS);
    expect(st).toMatchObject({ b: "Aanya", g: "Rohan", date: "2027-02-14T20:00" });
    expect((st.ev as unknown[]).length).toBe(3);
    expect((st.gu as unknown[]).length).toBe(2);
  });

  it("a family's personal link shows only its functions", () => {
    const st = seedState(PS);
    const sl = guestSlugs(st.gu as { n: string }[]);
    expect(sl).toEqual(["sharma-family", "priya"]);
    expect((publicView(st, "sharma-family").state.ev as { n: string }[]).map((e) => e.n)).toEqual(["Mehendi", "Wedding"]);
    expect((publicView(st, "priya").state.ev as { n: string }[]).map((e) => e.n)).toEqual(["Sangeet", "Wedding"]);
    expect((publicView(st, null).state.ev as unknown[]).length).toBe(3); // the general link: everything open to all
    // Events published before the planner connected (no planner id) match by name.
    const old = { ...st, ev: (st.ev as object[]).map((e) => ({ ...e, pk: undefined })) };
    expect((publicView(old, "priya").state.ev as { n: string }[]).map((e) => e.n)).toEqual(["Sangeet", "Wedding"]);
    expect(familyLinks(st.gu as never, "https://x/i/a")).toEqual({ "Sharma family": "https://x/i/a/sharma-family", Priya: "https://x/i/a/priya" });
  });
});

describe("invite RSVPs → planner rules", () => {
  const gu = inviteGuestsFrom(PS).gu;
  it("finds the family from the personal link or an exact name", () => {
    expect(matchFamily(PS, gu, { name: "Whoever", guests: 2, events: "", guest: "sharma-family" })).toBe("Sharma family");
    expect(matchFamily(PS, gu, { name: "sunita sharma", guests: 1, events: "" })).toBe("Sharma family");
    expect(matchFamily(PS, gu, { name: "Priya", guests: 1, events: "" })).toBe("Priya");
    expect(matchFamily(PS, gu, { name: "Mystery uncle", guests: 1, events: "" })).toBeNull();
  });
  it("marks each function coming / not coming for the whole family and keeps the blessing", () => {
    const r = replyOps(PS, "Sharma family", { name: "Ramesh", guests: 3, events: "Wedding", meal: "Vegetarian", message: "Bless you both" })!;
    expect(r.ops.map((o) => [o.id, o.r.fn, o.r.rsvp, o.r.diet])).toEqual([
      ["g1", { Mehendi: "N", Wedding: "C" }, "Confirmed", "Vegetarian"],
      ["g2", { Wedding: "C" }, "Confirmed", "Vegetarian"],
    ]);
    expect(r.ops[0].r.ir).toMatchObject({ n: 3, ev: ["Wedding"], msg: "Bless you both", listed: 2 });
    expect(r.check).toEqual({ said: 3, listed: 2 });
    const no = replyOps(PS, "Priya", { name: "Priya", guests: 1, events: "" })!;
    expect(no.ops[0].r).toMatchObject({ rsvp: "Declined", fn: { Sangeet: "N", Wedding: "N" } });
  });
  it("imports an invite's own guests that the planner doesn't have", () => {
    let n = 0;
    const ops = importGuestOps(PS, [{ n: "Priya", p: "", g: "" }, { n: "Verma family", p: "919999999999", g: "Friends", s: 5 }], [{ n: "Sangeet", a: ["Friends"] }, { n: "Mehendi", a: ["Family"] }], () => "n" + ++n);
    expect(ops).toHaveLength(1);
    expect(ops[0].r).toMatchObject({ name: "Verma family", phone: "+919999999999", invited: "Yes", fn: { Sangeet: "Y" } });
  });
});

describe("planner ↔ invite through the server", () => {
  let server: typeof import("@/lib/planner/server");
  let ip: typeof import("@/lib/invitePlanner");
  const clean = () => { for (const k of Object.keys(fakePayload.db)) delete fakePayload.db[k]; };
  beforeEach(async () => {
    clean();
    vi.mocked(sendWithBrevo).mockClear();
    server = await import("@/lib/planner/server");
    ip = await import("@/lib/invitePlanner");
  });
  const invite = (id: string) => fakePayload.db.invites.find((d: { id: string }) => d.id === id);
  const planner = (id: string) => fakePayload.db.planners.find((d: { id: string }) => d.id === id);

  it("creates the invite from the planner and keeps it in step as the planner changes", async () => {
    const p = await server.createPlanner(fakePayload, "o@x.in", PS);
    const inv = await ip.createInviteFor(fakePayload, p);
    expect(planner(p.id).invite).toBe(inv.id);
    expect(inv).toMatchObject({ names: "Aanya & Rohan", contactEmail: "o@x.in", planner: p.id });
    expect(inv.slug).toMatch(/^aanya-rohan-[0-9a-f]{4}$/);

    await ip.createInviteFor(fakePayload, planner(p.id)); // no second invite
    expect(fakePayload.db.invites).toHaveLength(1);

    // A new family and a moved function, saved by a family member
    await server.savePlanner(fakePayload, p.id, "mom@x.in", "editor", [
      { c: "guests", id: "g9", r: { id: "g9", name: "Verma ji", group: "Verma family", phone: "9811111111", fn: { Sangeet: "Y" } } },
      { c: "functions", id: "f2", r: { ...fns[1], date: "2027-02-10" } },
    ]);
    const st = invite(inv.id).state;
    expect(st.gu.map((g: { n: string }) => g.n)).toEqual(["Sharma family", "Priya", "Verma family"]);
    expect(st.ev.find((e: { pk: string }) => e.pk === "f2").d).toBe("2027-02-10T19:00");
    expect(invite(inv.id).plannerNote).toBe("Sangeet: date 10 Feb");
    // Editing something unrelated (budget) doesn't touch the invite
    const at = invite(inv.id).updatedAt;
    await server.savePlanner(fakePayload, p.id, "o@x.in", "owner", [{ k: "totalBudget", v: 100 }]);
    expect(invite(inv.id).updatedAt).toBe(at);
  });

  it("puts RSVPs into the guest list, and unmatched ones on the review list", async () => {
    const p = await server.createPlanner(fakePayload, "o@x.in", PS);
    const inv = await ip.createInviteFor(fakePayload, p);
    await ip.syncInvite(fakePayload, planner(p.id));
    const r1 = await fakePayload.create({ collection: "invite-rsvps", data: { invite: inv.id, name: "Ramesh", guests: 2, events: "Mehendi, Wedding", guest: "sharma-family", message: "Blessings!" } });
    expect(await ip.routeReply(fakePayload, invite(inv.id), r1)).toBe("applied");
    const pg = planner(p.id).state.guests;
    expect(pg.find((g: { id: string }) => g.id === "g2")).toMatchObject({ rsvp: "Confirmed", invited: "Yes", fn: { Wedding: "C" } });
    expect(pg.find((g: { id: string }) => g.id === "g1").ir).toMatchObject({ n: 2, msg: "Blessings!" });
    expect(fakePayload.db["planner-history"].at(-1)).toMatchObject({ by: "Wedding invite", summary: "RSVP from your invite: Sharma family (2 coming)" });
    expect(fakePayload.db["invite-rsvps"][0]).toMatchObject({ plannerStatus: "applied", plannerFamily: "Sharma family" });

    const r2 = await fakePayload.create({ collection: "invite-rsvps", data: { invite: inv.id, name: "Mystery uncle", guests: 4, events: "Wedding", side: "groom" } });
    expect(await ip.routeReply(fakePayload, invite(inv.id), r2)).toBe("review");
    const sum = await ip.inviteSummary(fakePayload, planner(p.id));
    expect(sum).toMatchObject({ linked: true, replies: 2, live: false, premium: false, links: {} });
    expect((sum as { review: { name: string }[] }).review.map((x) => x.name)).toEqual(["Mystery uncle"]);

    await ip.reviewReply(fakePayload, planner(p.id), "o@x.in", "owner", r2.id, "add");
    const added = planner(p.id).state.guests.at(-1);
    expect(added).toMatchObject({ name: "Mystery uncle", group: "Mystery uncle", side: "Groom", rsvp: "Confirmed", fn: { Wedding: "C" } });
    expect(invite(inv.id).state.gu.map((g: { n: string }) => g.n)).toContain("Mystery uncle"); // and onto the invite
    await expect(ip.reviewReply(fakePayload, planner(p.id), "o@x.in", "owner", r2.id, "match", "Nobody")).rejects.toThrow(/Pick a family/);
  });

  it("connects an invite made on its own: imports its guests and old replies, then the planner leads", async () => {
    const p = await server.createPlanner(fakePayload, "o@x.in", PS);
    const own = await fakePayload.create({ collection: "invites", data: { slug: "anu-rohan", editToken: "a".repeat(32), state: { b: "Anu", g: "Rohan", ev: [{ n: "Wedding", d: "2027-02-14T19:00", v: "Hall" }], gu: [{ n: "Kapoor family", p: "919800000000", g: "Family", s: 9 }], grp: ["Family"] } } });
    await fakePayload.create({ collection: "invite-rsvps", data: { invite: own.id, name: "Kapoor ji", guests: 3, events: "Wedding", guest: "kapoor-family" } });
    await expect(ip.connectInvite(fakePayload, planner(p.id), "o@x.in", "owner", "anu-rohan", "b".repeat(32))).rejects.toThrow(/doesn't match/);
    const res = await ip.connectInvite(fakePayload, planner(p.id), "o@x.in", "owner", "anu-rohan", "a".repeat(32));
    expect((res as { imported: number }).imported).toBe(1);
    const kapoor = planner(p.id).state.guests.find((g: { name: string }) => g.name === "Kapoor family");
    expect(kapoor).toMatchObject({ rsvp: "Confirmed", fn: { Wedding: "C" }, invited: "Yes" });
    const st = invite(own.id).state;
    expect(st.gu.map((g: { n: string; s?: number }) => [g.n, g.s])).toEqual([["Sharma family", undefined], ["Priya", undefined], ["Kapoor family", 9]]);
    expect(st.ev.map((e: { n: string; pk?: string }) => [e.n, e.pk])).toEqual([["Mehendi", "f1"], ["Sangeet", "f2"], ["Wedding", "f3"]]);
    expect(invite(own.id).b ?? st.b).toBe("Aanya");
    expect(ip.parseEditLink("https://pandoratemplates.com/i/anu-rohan/edit#k=abc123")).toEqual({ slug: "anu-rohan", token: "abc123" });
  });

  it("bundle payment makes the planner Family and the invite Premium", async () => {
    const p = await server.createPlanner(fakePayload, "o@x.in", PS);
    const fam = (await server.getPlans(fakePayload)).find((x) => x.planId === "family")!;
    await fakePayload.update({ collection: "planners", id: p.id, data: { orderId: "ord_1", orderPlan: fam.id, orderAmount: 2999, orderBundle: true } });
    await server.markPlannerPaid(fakePayload, "ord_1", "pay_1");
    expect(planner(p.id)).toMatchObject({ status: "paid", plan: fam.id });
    const inv = invite(planner(p.id).invite);
    expect(inv).toMatchObject({ paymentStatus: "paid", plan: "premium", contactEmail: "o@x.in" });
    expect(inv.published).toBeTruthy();
    const sum = await ip.inviteSummary(fakePayload, planner(p.id));
    expect(sum).toMatchObject({ premium: true, links: { Priya: expect.stringMatching(/\/i\/aanya-rohan-\w+\/priya$/) } });
  });

  it("sends each cross-sell email once, two days after the purchase", async () => {
    const days = (n: number) => new Date(Date.now() - n * 864e5).toISOString();
    await fakePayload.create({ collection: "invites", data: { slug: "a-b", editToken: "t1", names: "A & B", paymentStatus: "paid", paidAt: days(3), contactEmail: "c@x.in", state: {} } });
    await fakePayload.create({ collection: "invites", data: { slug: "c-d", editToken: "t2", paymentStatus: "paid", paidAt: days(1), contactEmail: "d@x.in", state: {} } });
    await fakePayload.create({ collection: "planners", data: { ownerEmail: "p@x.in", status: "paid", paidAt: days(4), state: {} } });
    expect(await ip.sendCrossSells(fakePayload)).toEqual({ invites: 1, planners: 1 });
    expect(vi.mocked(sendWithBrevo).mock.calls.map((c) => c[0].to[0].email)).toEqual(["c@x.in", "p@x.in"]);
    expect(String(vi.mocked(sendWithBrevo).mock.calls[0][0].html)).toContain("/planner/signup?utm_source=invite-email#ik=a-b.t1");
    expect(await ip.sendCrossSells(fakePayload)).toEqual({ invites: 0, planners: 0 });
  });

  it("an open invite editor can't overwrite the planner's guests or newer function changes", async () => {
    const p = await server.createPlanner(fakePayload, "o@x.in", PS);
    const inv = await ip.createInviteFor(fakePayload, p);
    await ip.syncInvite(fakePayload, planner(p.id));
    const psa = invite(inv.id).plannerSyncAt;
    const { PUT } = await import("@/app/api/shaadi/invites/[slug]/route");
    const put = (state: object, k: string | null) =>
      PUT(new Request("http://x/api/shaadi/invites/" + inv.slug, { method: "PUT", headers: { "x-edit-token": inv.editToken }, body: JSON.stringify({ state, psa: k }) }), { params: Promise.resolve({ slug: inv.slug }) });
    const mine = { ...invite(inv.id).state, th: "nikah", gu: [{ n: "Sharma family", k: "Sharma family", p: "", g: "", s: 77 }], ev: [{ n: "Only mine" }] };
    let r = await (await put(mine, psa)).json();
    expect(r.reload).toBeUndefined();
    let st = invite(inv.id).state;
    expect([st.th, st.ev[0].n, st.gu.length, st.gu[0].s]).toEqual(["nikah", "Only mine", 2, 77]);
    // The planner moves a function while the editor is open with an older copy
    await server.savePlanner(fakePayload, p.id, "o@x.in", "owner", [{ c: "functions", id: "f1", r: { ...fns[0], venue: "New lawn" } }]);
    r = await (await put({ ...mine, th: "story" }, psa)).json();
    expect(r.reload).toBe(true);
    st = invite(inv.id).state;
    expect(st.th).toBe("story");
    expect(st.ev.some((e: { v?: string }) => e.v === "New lawn")).toBe(true);
  });
});
