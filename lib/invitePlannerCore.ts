/**
 * Wedding planner ↔ invite maker: the pure rules (no database), shared by the API routes and tests.
 *
 * The planner is the master guest list. Each planner family (guests with the same "Family / group",
 * or a single guest with none) becomes one invite guest with its own personal link. Planner functions
 * become invite events; a family's link shows only the functions it is invited to in the planner.
 * RSVPs on the invite flow back into the planner's guest rows.
 */
import { guestSlugs } from "@/lib/invites";

// The planner's JSON state has no fixed TypeScript shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any> & { id: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PState = Record<string, any>;
export type InvGuest = { n: string; p: string; g: string; s?: number; r?: number; k?: string; e?: string[]; en?: string[] };
export type InvEvent = Record<string, unknown> & { n?: string; d?: string; v?: string; x?: string; pk?: string };

const s = (v: unknown, max = 200) => (v == null ? "" : String(v)).trim().slice(0, max);
const low = (v: unknown) => s(v).toLowerCase();
const rows = (ps: PState, c: string): Row[] => (Array.isArray(ps?.[c]) ? ps[c] : []);
export const familyKey = (g: Row) => s(g.group || g.name || "", 80);

/** Digits WhatsApp can dial (91 added to 10-digit Indian numbers), or "". Same rule as the invite editor. */
export function dialable(p: unknown) {
  let d = String(p ?? "").replace(/[^\d]/g, "");
  if (!d) return "";
  if (d.length === 11 && d[0] === "0") d = d.slice(1);
  if (d.length < 7) return "";
  if (d.length === 10) d = "91" + d;
  return d.slice(0, 16);
}

export const activeFunctions = (ps: PState) => rows(ps, "functions").filter((f) => s(f.name) && f.active !== "No");

export type Family = { k: string; n: string; p: string; g: string; fnIds: string[]; fnNames: string[]; members: Row[] };

/** The planner's guests grouped into families, in list order. */
export function familiesOf(ps: PState): Family[] {
  const fns = activeFunctions(ps);
  const byName = new Map(fns.map((f) => [s(f.name), f]));
  const out = new Map<string, Family>();
  for (const g of rows(ps, "guests")) {
    if (!s(g.name) && !s(g.group)) continue;
    const k = familyKey(g);
    let fam = out.get(k);
    if (!fam) out.set(k, (fam = { k, n: k, p: "", g: s(g.cat, 30), fnIds: [], fnNames: [], members: [] }));
    fam.members.push(g);
    if (!fam.p) fam.p = dialable(g.phone);
    for (const name of Object.keys(g.fn ?? {})) {
      const f = byName.get(name);
      if (f && !fam.fnIds.includes(f.id)) { fam.fnIds.push(f.id); fam.fnNames.push(s(f.name)); }
    }
  }
  return [...out.values()];
}

/** The invite's guest list from the planner. Keeps the invite's "sent" marks for families that were already there. */
export function inviteGuestsFrom(ps: PState, old: InvGuest[] = []): { gu: InvGuest[]; grp: string[] } {
  const prev = new Map<string, InvGuest>();
  for (const g of old) prev.set(low(g.k || g.n), g);
  const gu = familiesOf(ps).slice(0, 600).map((f) => {
    const was = prev.get(low(f.k));
    const out: InvGuest = { n: f.n, p: f.p, g: f.g, k: f.k };
    if (f.fnIds.length) { out.e = f.fnIds; out.en = f.fnNames.map((x) => x.toLowerCase()); }
    if (was?.s) out.s = was.s;
    if (was?.r) out.r = was.r;
    return out;
  });
  const grp = [...new Set(gu.map((g) => g.g).filter(Boolean))].slice(0, 12);
  return { gu, grp };
}

const fnWhen = (f: Row, oldD?: unknown) => {
  const date = /^\d{4}-\d\d-\d\d$/.test(s(f.date)) ? s(f.date) : "";
  if (!date) return "";
  const t = /^\d\d:\d\d$/.test(s(f.time)) ? s(f.time) : /T(\d\d:\d\d)/.exec(s(oldD))?.[1] || "18:00";
  return `${date}T${t}`;
};
const dshort = (d: string) => {
  const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(d);
  return m ? `${+m[3]} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+m[2] - 1]}` : "";
};

/**
 * Brings the invite's events in line with the planner's functions (matched by planner id, then by name).
 * Only what the planner knows changes (name, date, time, venue); the couple's notes, photos and icons stay.
 * Events the couple added themselves (no planner id) are left alone. Returns what changed, for the editor's banner.
 */
export function eventsFrom(ps: PState, oldEv: InvEvent[] = []): { ev: InvEvent[]; changes: string[] } {
  const fns = activeFunctions(ps);
  const ids = new Set(fns.map((f) => f.id));
  const changes: string[] = [];
  const ev: InvEvent[] = [];
  const used = new Set<number>();
  // Events that came from a planner function that is gone or switched off are dropped.
  oldEv.forEach((e, i) => {
    if (e.pk && !ids.has(String(e.pk))) { used.add(i); changes.push(`Removed ${s(e.n) || "an event"}`); }
  });
  const keep = oldEv.map((e, i) => ({ e, i })).filter((x) => !used.has(x.i));
  const slots = new Map<number, InvEvent>();
  const added: InvEvent[] = [];
  for (const f of fns) {
    let hit = keep.find((x) => !used.has(x.i) && x.e.pk === f.id);
    if (!hit) hit = keep.find((x) => !used.has(x.i) && !x.e.pk && low(x.e.n) === low(f.name));
    const when = fnWhen(f, hit?.e.d);
    if (hit) {
      used.add(hit.i);
      const e: InvEvent = { ...hit.e, pk: f.id };
      const what: string[] = [];
      if (s(e.n) !== s(f.name)) { what.push(`renamed to ${s(f.name)}`); e.n = s(f.name, 80); }
      if (when && when !== s(e.d)) { what.push(when.slice(0, 10) !== s(e.d).slice(0, 10) ? `date ${dshort(when)}` : `time ${when.slice(11)}`); e.d = when; }
      if (s(f.venue) && s(f.venue) !== s(e.v)) { what.push("venue"); e.v = s(f.venue); }
      if (what.length) changes.push(`${s(hit.e.n) || s(f.name)}: ${what.join(", ")}`);
      slots.set(hit.i, e);
    } else {
      added.push({ n: s(f.name, 80), d: when, v: s(f.venue), x: s(f.dress) ? `Dress code: ${s(f.dress)}` : "", pk: f.id });
      changes.push(`Added ${s(f.name)}`);
    }
  }
  oldEv.forEach((e, i) => {
    if (slots.has(i)) ev.push(slots.get(i)!);
    else if (!used.has(i)) ev.push(e); // the couple's own event
  });
  // New functions go in date order among the others.
  for (const a of added) {
    const at = ev.findIndex((e) => s(e.d) && s(a.d) && s(e.d) > s(a.d));
    if (at < 0) ev.push(a);
    else ev.splice(at, 0, a);
  }
  return { ev: ev.slice(0, 30), changes };
}

const mainDate = (ps: PState, oldDate?: unknown) => {
  const date = s(ps?.settings?.date);
  if (!/^\d{4}-\d\d-\d\d$/.test(date)) return "";
  const main = activeFunctions(ps).find((f) => s(f.date) === date && /wedding|phera|shaadi|vivah|nikah|lagan/i.test(s(f.name)));
  const t = /^\d\d:\d\d$/.test(s(main?.time)) ? s(main?.time) : /T(\d\d:\d\d)/.exec(s(oldDate))?.[1] || "19:00";
  return `${date}T${t}`;
};

/** The invite's draft brought up to date with the planner: names, wedding date, events and guests. */
export function syncedState(ps: PState, st: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...st };
  const changes: string[] = [];
  const set = ps?.settings ?? {};
  if (s(set.bride) && s(set.bride) !== s(st.b)) { out.b = s(set.bride, 60); changes.push("Bride’s name"); }
  if (s(set.groom) && s(set.groom) !== s(st.g)) { out.g = s(set.groom, 60); changes.push("Groom’s name"); }
  const d = mainDate(ps, st.date);
  if (d && d.slice(0, 10) !== s(st.date).slice(0, 10)) { out.date = d; changes.push(`Wedding date ${dshort(d)}`); }
  const ev = eventsFrom(ps, Array.isArray(st.ev) ? (st.ev as InvEvent[]) : []);
  out.ev = ev.ev;
  changes.push(...ev.changes);
  const g = inviteGuestsFrom(ps, Array.isArray(st.gu) ? (st.gu as InvGuest[]) : []);
  out.gu = g.gu;
  const grp = Array.isArray(st.grp) ? (st.grp as string[]) : [];
  out.grp = [...new Set([...grp, ...g.grp])].slice(0, 12);
  delete out.gl;
  return { state: out, changes };
}

/** A new invite made from the planner: the couple's names, date, functions and families filled in. */
export function seedState(ps: PState) {
  const set = ps?.settings ?? {};
  const base: Record<string, unknown> = { b: s(set.bride, 60) || "Bride", g: s(set.groom, 60) || "Groom", ev: [], gu: [], grp: [] };
  return syncedState(ps, base).state;
}

/* ---------- RSVPs back into the planner ---------- */

export type Reply = { name: string; guests: number; events: string; meal?: string; side?: string; guest?: string; message?: string; at?: string };

/** Which planner family a reply belongs to: the family behind the personal link, or an exact name match. */
export function matchFamily(ps: PState, gu: InvGuest[], reply: Reply): string | null {
  const fams = familiesOf(ps);
  const has = (k: string) => fams.find((f) => low(f.k) === low(k))?.k ?? null;
  if (reply.guest) {
    const i = guestSlugs(gu).indexOf(reply.guest);
    if (i >= 0) { const hit = has(gu[i].k || gu[i].n); if (hit) return hit; }
  }
  const nm = low(reply.name);
  if (!nm) return null;
  const byFam = fams.filter((f) => low(f.k) === nm);
  if (byFam.length === 1) return byFam[0].k;
  const byPerson = fams.filter((f) => f.members.some((m) => low(m.name) === nm));
  return byPerson.length === 1 ? byPerson[0].k : null;
}

const DIETS: [RegExp, string][] = [[/jain/i, "Jain"], [/non[\s-]?veg/i, "Non-Vegetarian"], [/vegan/i, "Vegan"], [/veg/i, "Vegetarian"]];
const dietOf = (meal?: string) => DIETS.find(([re]) => re.test(meal ?? ""))?.[1] ?? "";

/**
 * The planner changes for one reply: every member of the family gets the reply for each function
 * (C = coming, N = not coming), RSVP Confirmed/Declined, an empty diet filled in, and the reply itself
 * (headcount, message) saved on the family's first guest so the profile and thank-you list can show it.
 */
export function replyOps(ps: PState, key: string, reply: Reply) {
  const fns = activeFunctions(ps);
  const fam = familiesOf(ps).find((f) => f.k === key);
  if (!fam) return null;
  const said = reply.events.split(",").map((x) => low(x)).filter(Boolean);
  const coming = new Set(fns.filter((f) => said.includes(low(f.name))).map((f) => s(f.name)));
  const attending = reply.guests > 0 && coming.size > 0;
  const diet = dietOf(reply.meal);
  const ir = {
    n: attending ? reply.guests : 0, ev: [...coming], meal: s(reply.meal, 40), msg: s(reply.message, 500), name: s(reply.name, 80),
    at: reply.at || new Date().toISOString(), listed: fam.members.length,
  };
  const ops = fam.members.map((m, i) => {
    const r: Row = { ...m, fn: { ...(m.fn ?? {}) } };
    for (const f of fns) {
      const name = s(f.name);
      if (coming.has(name)) r.fn[name] = "C";
      else if (r.fn[name]) r.fn[name] = "N";
    }
    r.rsvp = attending ? "Confirmed" : "Declined";
    r.invited = "Yes";
    if (diet && !s(m.diet)) r.diet = diet;
    if (i === 0) r.ir = ir;
    else if (r.ir) delete r.ir;
    return { c: "guests" as const, id: m.id, r };
  });
  const summary = `RSVP from your invite: ${fam.k} (${attending ? `${reply.guests} coming` : "not coming"})`;
  return { ops, summary, check: attending && reply.guests !== fam.members.length ? { said: reply.guests, listed: fam.members.length } : null };
}

/** A reply nobody could match, added to the planner as a new family (one guest row; the headcount is kept on it). */
export function newGuestOps(ps: PState, reply: Reply, id: string) {
  const fns = activeFunctions(ps);
  const said = reply.events.split(",").map((x) => low(x)).filter(Boolean);
  const fn: Record<string, string> = {};
  for (const f of fns) if (said.includes(low(f.name))) fn[s(f.name)] = "C";
  const attending = reply.guests > 0 && Object.keys(fn).length > 0;
  const name = s(reply.name, 80) || "Guest";
  const row: Row = {
    id, name, group: name, side: reply.side === "bride" ? "Bride" : reply.side === "groom" ? "Groom" : "", cat: "Family", age: "Adult",
    invited: "Yes", rsvp: attending ? "Confirmed" : "Declined", stay: "No", transport: "No", fn, diet: dietOf(reply.meal),
    notes: reply.guests > 1 ? `Replied on the invite for ${reply.guests} people` : "",
    ir: { n: attending ? reply.guests : 0, ev: Object.keys(fn), meal: s(reply.meal, 40), msg: s(reply.message, 500), name, at: reply.at || new Date().toISOString(), listed: 1 },
  };
  return { ops: [{ c: "guests" as const, id, r: row }], summary: `Added ${name} from an invite RSVP` };
}

/** Invite guests the planner doesn't have yet (used when an existing invite is connected): new planner rows. */
export function importGuestOps(ps: PState, gu: InvGuest[], ev: InvEvent[], mkId: () => string) {
  const have = new Set(familiesOf(ps).flatMap((f) => [low(f.k), ...f.members.map((m) => low(m.name))]));
  const fns = activeFunctions(ps);
  const ops: { c: "guests"; id: string; r: Row }[] = [];
  for (const g of gu) {
    if (!s(g.n) || have.has(low(g.n))) continue;
    have.add(low(g.n));
    const fn: Record<string, string> = {};
    for (const e of ev) {
      const a = Array.isArray(e.a) ? (e.a as string[]) : [];
      if (a.length && !a.includes(g.g)) continue;
      const f = fns.find((x) => low(x.name) === low(e.n));
      if (f) fn[s(f.name)] = "Y";
    }
    const id = mkId();
    ops.push({ c: "guests", id, r: { id, name: s(g.n, 80), group: s(g.n, 80), phone: g.p ? `+${g.p}` : "", cat: s(g.g, 30) || "Family", age: "Adult", invited: g.s ? "Yes" : "No", rsvp: "Pending", stay: "No", transport: "No", fn } });
  }
  return ops;
}

/** Personal link per planner family (Premium/Royal), from the invite's current guest list. */
export function familyLinks(gu: InvGuest[], base: string) {
  const sl = guestSlugs(gu);
  const out: Record<string, string> = {};
  gu.forEach((g, i) => { out[g.k || g.n] = `${base}/${sl[i]}`; });
  return out;
}
