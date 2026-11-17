/** Site visits: pure helpers. Visits are stored on the lead as appointments of type "Site visit" (lead.data.appts). */

export const SITE_VISIT = "Site visit";
export const OUTCOMES = ["interested", "thinking", "not_interested", "no_show"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export type Appt = {
  id: string; at: string; type?: string; note?: string; done?: boolean;
  project?: string; unit?: string; outcome?: Outcome; feedback?: string; doneAt?: number;
};

const WHEN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/; // browser "datetime-local" value, in the agent's own time zone
const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

export const isVisit = (a: any): a is Appt => !!a && a.type === SITE_VISIT && typeof a.at === "string";

/** Validate a visit entered in the app. */
export function cleanVisit(raw: Record<string, unknown>): { ok: true; v: Pick<Appt, "at" | "project" | "unit" | "note"> } | { ok: false; error: string } {
  const at = String(raw.at ?? "");
  if (!WHEN.test(at) || Number.isNaN(Date.parse(at))) return { ok: false, error: "Pick a valid date and time" };
  return { ok: true, v: { at, project: clip(raw.project, 80), unit: clip(raw.unit, 30), note: clip(raw.note, 300) } };
}

/** Where a visit sits in the agent's day. `now` is the agent's local time in the same format as `at`. */
export function bucketOf(v: { at: string; done?: boolean }, now: string): "done" | "overdue" | "today" | "upcoming" {
  if (v.done) return "done";
  if (v.at < now) return "overdue";
  return v.at.slice(0, 10) === now.slice(0, 10) ? "today" : "upcoming";
}

const EARLY = ["New", "Contacted", "Qualified"];
/** Scheduling a visit moves early-stage leads to "Site visit scheduled". Later stages are never moved backwards. */
export const stageOnSchedule = (status: string): string => (EARLY.includes(status) ? "Site visit scheduled" : status);
/** Completing a visit moves the lead to "Site visit done" unless it is already further along. */
export const stageOnDone = (status: string, outcome: Outcome): string =>
  outcome === "no_show" ? status : [...EARLY, "Site visit scheduled"].includes(status) ? "Site visit done" : status;

const nid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function addVisit(appts: Appt[] | undefined, v: { at: string; project?: string; unit?: string; note?: string }): Appt[] {
  return [...(appts || []), { id: nid(), type: SITE_VISIT, done: false, ...v }];
}
export function updateVisit(appts: Appt[] | undefined, id: string, v: Partial<Appt>): Appt[] | null {
  const list = appts || [];
  if (!list.some((a) => a.id === id && isVisit(a))) return null;
  return list.map((a) => (a.id === id ? { ...a, ...v, id: a.id, type: SITE_VISIT } : a));
}
export const removeVisit = (appts: Appt[] | undefined, id: string): Appt[] => (appts || []).filter((a) => !(a.id === id && isVisit(a)));

export function cleanOutcome(v: unknown): Outcome | null {
  return (OUTCOMES as readonly string[]).includes(String(v)) ? (v as Outcome) : null;
}

export function visitNote(by: string, v: Appt, outcome: Outcome, feedback: string): { t: number; by: string; x: string } {
  const label = { interested: "interested", thinking: "still thinking", not_interested: "not interested", no_show: "did not come" }[outcome];
  const where = [v.project, v.unit].filter(Boolean).join(" ");
  return { t: Date.now(), by, x: `Site visit${where ? " (" + where + ")" : ""}: ${label}${feedback ? ". " + feedback : ""}` };
}

/** Flatten every lead's visits into one list for the Site visits screen. */
export function listVisits(
  leads: { id: string; name?: string; phone?: string; owner?: string; status?: string; appts?: unknown }[],
  now: string,
) {
  const out: any[] = [];
  for (const l of leads) {
    for (const a of Array.isArray(l.appts) ? l.appts : []) {
      if (!isVisit(a)) continue;
      out.push({ ...a, leadId: l.id, leadName: l.name || "", phone: l.phone || "", owner: l.owner || "", leadStatus: l.status || "", bucket: bucketOf(a, now) });
    }
  }
  return out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/** Move a visit to a new time (e.g. after a no-show): it becomes pending again and loses its old outcome. */
export function rescheduleVisit(appts: Appt[] | undefined, id: string, v: { at: string; project?: string; unit?: string; note?: string }): Appt[] | null {
  const list = appts || [];
  if (!list.some((a) => a.id === id && isVisit(a))) return null;
  return list.map((a) => {
    if (a.id !== id) return a;
    const { outcome: _o, feedback: _f, doneAt: _d, ...rest } = a;
    return { ...rest, ...v, done: false };
  });
}
