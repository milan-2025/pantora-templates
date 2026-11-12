import { describe, expect, it } from "vitest";
import { addVisit, bucketOf, cleanOutcome, cleanVisit, listVisits, removeVisit, stageOnDone, stageOnSchedule, updateVisit, visitNote } from "../lib/crm/visits";

describe("cleanVisit", () => {
  it("accepts a local date-time and trims text", () => {
    const r = cleanVisit({ at: "2026-11-20T16:30", project: "  Sunrise  ", unit: "A-101", note: "x".repeat(500) });
    expect(r.ok && r.v).toMatchObject({ at: "2026-11-20T16:30", project: "Sunrise", unit: "A-101" });
    expect(r.ok && r.v.note!.length).toBe(300);
  });
  it("rejects bad dates", () => {
    for (const at of ["", "tomorrow", "2026-13-40T99:99", "2026-11-20", undefined]) expect(cleanVisit({ at }).ok).toBe(false);
  });
});

describe("bucketOf", () => {
  const now = "2026-11-12T10:00";
  it("sorts visits into the agent's day", () => {
    expect(bucketOf({ at: "2026-11-12T09:00" }, now)).toBe("overdue");
    expect(bucketOf({ at: "2026-11-12T17:00" }, now)).toBe("today");
    expect(bucketOf({ at: "2026-11-13T09:00" }, now)).toBe("upcoming");
    expect(bucketOf({ at: "2026-11-01T09:00", done: true }, now)).toBe("done");
  });
});

describe("stage movement", () => {
  it("scheduling only moves early stages forward", () => {
    for (const s of ["New", "Contacted", "Qualified"]) expect(stageOnSchedule(s)).toBe("Site visit scheduled");
    for (const s of ["Negotiation", "Booked", "Won", "Lost", "Site visit done"]) expect(stageOnSchedule(s)).toBe(s);
  });
  it("completing moves to Site visit done, never backwards, and a no-show changes nothing", () => {
    expect(stageOnDone("Site visit scheduled", "interested")).toBe("Site visit done");
    expect(stageOnDone("New", "thinking")).toBe("Site visit done");
    expect(stageOnDone("Negotiation", "interested")).toBe("Negotiation");
    expect(stageOnDone("Booked", "interested")).toBe("Booked");
    expect(stageOnDone("Site visit scheduled", "no_show")).toBe("Site visit scheduled");
  });
});

describe("appointments list", () => {
  it("adds, updates and removes only site visits, leaving other appointments alone", () => {
    const meeting = { id: "m1", at: "2026-11-20T10:00", type: "Meeting" };
    let a = addVisit([meeting], { at: "2026-11-21T11:00", project: "P" });
    expect(a).toHaveLength(2);
    const id = a[1].id;
    expect(updateVisit(a, "m1", { at: "x" })).toBeNull(); // not a site visit
    a = updateVisit(a, id, { done: true, outcome: "interested" })!;
    expect(a[1]).toMatchObject({ done: true, type: "Site visit", id });
    expect(removeVisit(a, "m1")).toHaveLength(2);
    expect(removeVisit(a, id)).toEqual([meeting]);
  });
});

describe("outcome + note", () => {
  it("validates outcomes", () => {
    expect(cleanOutcome("interested")).toBe("interested");
    expect(cleanOutcome("whatever")).toBeNull();
  });
  it("writes a readable note", () => {
    const n = visitNote("Ravi", { id: "1", at: "x", project: "Sunrise", unit: "A-101" }, "not_interested", "Too far");
    expect(n.x).toBe("Site visit (Sunrise A-101): not interested. Too far");
  });
});

describe("listVisits", () => {
  it("flattens visits across leads, sorted by time, ignoring other appointment types", () => {
    const leads = [
      { id: "l1", name: "A", phone: "1", owner: "X", status: "New", appts: [{ id: "a", at: "2026-11-13T10:00", type: "Site visit" }, { id: "m", at: "2026-11-12T10:00", type: "Meeting" }] },
      { id: "l2", name: "B", appts: [{ id: "b", at: "2026-11-12T12:00", type: "Site visit", done: true }] },
      { id: "l3", name: "C" },
    ];
    const v = listVisits(leads, "2026-11-12T10:00");
    expect(v.map((x) => x.id)).toEqual(["b", "a"]);
    expect(v[0]).toMatchObject({ leadId: "l2", bucket: "done" });
    expect(v[1]).toMatchObject({ leadName: "A", bucket: "upcoming", owner: "X" });
  });
});
