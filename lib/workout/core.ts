/**
 * Workout app (/workout): pure logic shared by the API routes, the tests and (by copy) the app.
 * No database or server-only imports here.
 */

/** Row lists inside a person's workout data. Every row has a string `id` (a day's id is its date). */
export const WCOLLS = ["days", "meals", "body", "prs", "goals", "challenges"] as const;
export type WColl = (typeof WCOLLS)[number];

/** Single values stored beside the rows. */
export const WTOP = ["profile", "challenge", "game", "prefs"] as const;
export type WTop = (typeof WTOP)[number];

export type Row = Record<string, unknown> & { id: string };
export type WState = Partial<Record<WColl, Row[]>> & Partial<Record<WTop, unknown>>;
export type WOp = { c: WColl; id: string; r: Row | null } | { k: WTop; v: unknown } | { replace: WState };

export class WorkoutError extends Error {
  constructor(message: string, public status = 400, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const isColl = (c: unknown): c is WColl => typeof c === "string" && (WCOLLS as readonly string[]).includes(c);
const isTop = (k: unknown): k is WTop => typeof k === "string" && (WTOP as readonly string[]).includes(k);

export const MAX_STATE_BYTES = 2_500_000;
const MAX_ROW_BYTES = 8_000;
const MAX_OPS = 3000;

function cleanRow(id: unknown, r: unknown): Row {
  if (typeof id !== "string" || !id || id.length > 40) throw new WorkoutError("Invalid row id");
  if (!isObj(r)) throw new WorkoutError("Invalid row");
  if (JSON.stringify(r).length > MAX_ROW_BYTES) throw new WorkoutError("A row is too large");
  return { ...r, id };
}

export function cleanState(input: unknown): WState {
  if (!isObj(input)) throw new WorkoutError("Invalid data");
  const out: WState = {};
  for (const c of WCOLLS) {
    const rows = input[c];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) throw new WorkoutError(`Invalid ${c}`);
    const seen = new Set<string>();
    out[c] = rows.map((r) => cleanRow((r as Row)?.id, r)).filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  }
  for (const k of WTOP) if (input[k] !== undefined) out[k] = input[k];
  if (JSON.stringify(out).length > MAX_STATE_BYTES) throw new WorkoutError("Your data is too large to save", 413);
  return out;
}

/** Applies a batch of changes row by row, so changes from two devices both survive. */
export function applyOps(state: WState, ops: unknown): WState {
  if (!Array.isArray(ops) || ops.length > MAX_OPS) throw new WorkoutError("Invalid changes");
  let s: WState = { ...state };
  for (const op of ops) {
    if (!isObj(op)) throw new WorkoutError("Invalid change");
    if ("replace" in op) { s = cleanState(op.replace); continue; }
    if ("k" in op) {
      if (!isTop(op.k)) throw new WorkoutError("Invalid setting");
      if (op.v === null || op.v === undefined) delete s[op.k]; else s[op.k] = op.v;
      continue;
    }
    if (!isColl(op.c)) throw new WorkoutError("Invalid list");
    const rows = [...(s[op.c] ?? [])];
    const i = rows.findIndex((r) => r.id === op.id);
    if (op.r === null) { if (i >= 0) rows.splice(i, 1); } else {
      const row = cleanRow(op.id, op.r);
      if (i >= 0) rows[i] = row; else rows.push(row);
    }
    s[op.c] = rows;
  }
  if (JSON.stringify(s).length > MAX_STATE_BYTES) throw new WorkoutError("Your data is too large to save", 413);
  return s;
}

/* ---------- dates (India time) ---------- */

const IST_MS = 5.5 * 3600_000;
/** "YYYY-MM-DD" in India time. */
export const istDate = (now: number | Date = Date.now()) => new Date(new Date(now).getTime() + IST_MS).toISOString().slice(0, 10);
export const isoDay = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const shiftDay = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
export const dayDiff = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
/** The Monday that starts the week of `d` (weeks run Monday to Sunday). */
export const weekStart = (d: string) => shiftDay(d, -((new Date(d + "T00:00:00Z").getUTCDay() + 6) % 7));
export const istHour = (now: number | Date = Date.now()) => new Date(new Date(now).getTime() + IST_MS).getUTCHours();

/* ---------- a day's log ---------- */

export type Targets = { water: number; sleep: number; steps: number; mob: number; need: number };
export const DEFAULT_TARGETS: Targets = { water: 8, sleep: 7, steps: 8000, mob: 10, need: 4 };

export function targetsOf(state: WState): Targets {
  const p = isObj(state.profile) ? state.profile : {};
  const t = isObj(p.targets) ? p.targets : {};
  const n = (v: unknown, d: number, lo: number, hi: number) => (typeof v === "number" && v >= lo && v <= hi ? v : d);
  return {
    water: n(t.water, DEFAULT_TARGETS.water, 1, 30),
    sleep: n(t.sleep, DEFAULT_TARGETS.sleep, 1, 14),
    steps: n(t.steps, DEFAULT_TARGETS.steps, 500, 50000),
    mob: n(t.mob, DEFAULT_TARGETS.mob, 1, 120),
    need: n(t.need, DEFAULT_TARGETS.need, 1, 5),
  };
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

/** How many of the 5 daily checkpoints a day hit: workout (or a planned rest day), water, sleep, steps, mobility. */
export function checkpoints(row: Row | undefined, t: Targets) {
  if (!row) return 0;
  let n = row.w || row.rest ? 1 : 0;
  if (num(row.water) >= t.water) n++;
  if (num(row.sleep) >= t.sleep) n++;
  if (num(row.steps) >= t.steps) n++;
  if (num(row.mob) >= t.mob) n++;
  return n;
}

/** A complete day: the workout (or rest day) done and enough checkpoints hit. */
export const isComplete = (row: Row | undefined, t: Targets) => Boolean(row && (row.w || row.rest) && checkpoints(row, t) >= t.need);

/** Anything at all logged for the day. */
export const isLogged = (row: Row | undefined) =>
  Boolean(row && (row.w || row.rest || num(row.water) > 0 || num(row.sleep) > 0 || num(row.steps) > 0 || num(row.mob) > 0 || row.mood || num(row.weight) > 0));

/**
 * Streak of complete days ending today (or yesterday, if today isn't done yet). Days covered by a streak
 * freeze keep the streak alive but don't add to it.
 */
export function streakOf(done: Set<string>, frozen: Set<string>, today: string) {
  let d = done.has(today) ? today : shiftDay(today, -1);
  let n = 0;
  for (let i = 0; i < 4000; i++) {
    if (done.has(d)) n++;
    else if (!frozen.has(d)) break;
    d = shiftDay(d, -1);
  }
  return n;
}

export function bestStreak(done: Set<string>, frozen: Set<string>) {
  const all = [...new Set([...done, ...frozen])].sort();
  let best = 0, cur = 0, prev = "";
  for (const d of all) {
    cur = prev && dayDiff(prev, d) === 1 ? cur : 0;
    if (done.has(d)) cur++;
    best = Math.max(best, cur);
    prev = d;
  }
  return best;
}

/* ---------- on-time logging (what gifts and money-back count) ---------- */

/**
 * Days only count for gifts and money-back when they were logged on the day itself or the next day,
 * so filling in a month of old days at once can't unlock anything. Returns the updated lists.
 */
export function countOnTime(prev: { logged?: string[]; completed?: string[] }, after: WState, now = Date.now()) {
  const today = istDate(now), yesterday = shiftDay(today, -1);
  const t = targetsOf(after);
  const logged = new Set(prev.logged ?? []), completed = new Set(prev.completed ?? []);
  const rows = new Map((after.days ?? []).map((r) => [r.id, r]));
  for (const d of [yesterday, today]) {
    const r = rows.get(d);
    if (isLogged(r)) logged.add(d);
    if (isComplete(r, t)) completed.add(d);
  }
  return { logged: [...logged].sort(), completed: [...completed].sort() };
}

/* ---------- points & levels ---------- */

export const XP = { workout: 50, rest: 20, checkpoint: 10, complete: 30, quest: 15, meal: 5, mealMax: 25, pr: 25, body: 20, streakPerDay: 2, streakMax: 30, chestMax: 50 } as const;

/** Points for one day's log (the streak bonus is added by the caller, which knows the streak). */
export function dayXp(row: Row | undefined, t: Targets) {
  if (!row) return 0;
  let xp = row.w ? XP.workout : row.rest ? XP.rest : 0;
  xp += (checkpoints(row, t) - (row.w || row.rest ? 1 : 0)) * XP.checkpoint;
  if (isComplete(row, t)) xp += XP.complete;
  if (Array.isArray(row.q)) xp += Math.min(3, row.q.length) * XP.quest;
  if (typeof row.bx === "number" && row.bx > 0) xp += Math.min(XP.chestMax, Math.round(row.bx)); // the daily chest for finishing all 3 quests
  return xp;
}

/** Total points, and points per day, from everything logged. */
export function xpOf(state: WState) {
  const t = targetsOf(state);
  const per = new Map<string, number>();
  const add = (d: unknown, n: number) => { if (isoDay(d)) per.set(d as string, (per.get(d as string) ?? 0) + n); };
  const days = [...(state.days ?? [])].sort((a, b) => (a.id < b.id ? -1 : 1));
  let run = 0, prev = "";
  for (const r of days) {
    const complete = isComplete(r, t);
    run = complete ? (prev && dayDiff(prev, r.id) === 1 ? run + 1 : 1) : r.fz ? run : 0;
    if (complete || r.fz) prev = r.id;
    add(r.id, dayXp(r, t) + (complete ? Math.min(run, XP.streakMax) * XP.streakPerDay : 0));
  }
  const meals = new Map<string, number>();
  for (const m of state.meals ?? []) if (isoDay(m.d)) meals.set(m.d as string, (meals.get(m.d as string) ?? 0) + 1);
  meals.forEach((n, d) => add(d, Math.min(XP.mealMax, n * XP.meal)));
  for (const p of state.prs ?? []) add(p.d, XP.pr);
  for (const b of state.body ?? []) add(b.d, XP.body);
  let total = 0;
  per.forEach((n) => (total += n));
  return { total, per };
}

export const LEVELS = [
  "Fresh Start", "Warming Up", "Getting Moving", "Habit Builder", "Steady", "Consistent", "Strong", "Fired Up", "Unstoppable", "Iron Will",
  "Athlete", "Beast Mode", "Champion", "Elite", "Titan", "Legend", "Mythic", "Immortal", "Hall of Fame", "GOAT",
];
/** Points needed to reach level n (1-based): 0, 100, 300, 600, 1000 … */
export const levelXp = (n: number) => 50 * (n - 1) * n;
export function levelOf(xp: number) {
  let n = 1;
  while (levelXp(n + 1) <= xp) n++;
  const from = levelXp(n), to = levelXp(n + 1);
  return { level: n, name: LEVELS[Math.min(n, LEVELS.length) - 1], from, to, pct: Math.round(((xp - from) / (to - from)) * 100) };
}

/** Points earned in the week starting `monday` (for group leaderboards). */
export function weekXp(state: WState, monday: string) {
  const { per } = xpOf(state);
  let n = 0;
  for (let i = 0; i < 7; i++) n += per.get(shiftDay(monday, i)) ?? 0;
  return n;
}

/* ---------- gifts (milestones) ---------- */

export type Milestone = { key: string; title: string; kind: "streak" | "total"; days: number; reward: "days" | "freeze" | "coupon" | "badge" | "seat"; amount?: number; code?: string; note?: string; active?: boolean };

export const DEFAULT_MILESTONES: Milestone[] = [
  { key: "streak3", title: "3 days in a row", kind: "streak", days: 3, reward: "badge", note: "Spark badge" },
  { key: "streak7", title: "7 days in a row", kind: "streak", days: 7, reward: "days", amount: 7, note: "A free week added to your plan" },
  { key: "streak14", title: "14 days in a row", kind: "streak", days: 14, reward: "freeze", amount: 1, note: "An extra streak freeze" },
  { key: "streak30", title: "30 days in a row", kind: "streak", days: 30, reward: "days", amount: 30, note: "A free month added to your plan" },
  { key: "total50", title: "50 complete days", kind: "total", days: 50, reward: "badge", note: "Gold theme unlocked" },
  { key: "streak60", title: "60 days in a row", kind: "streak", days: 60, reward: "seat", amount: 1, note: "One more friend can join your plan" },
  { key: "streak100", title: "100 days in a row", kind: "streak", days: 100, reward: "days", amount: 60, note: "Two free months + Legend badge" },
  { key: "total200", title: "200 complete days", kind: "total", days: 200, reward: "days", amount: 30, note: "A free month added to your plan" },
];

/** Milestones reached (by on-time complete days) and not yet given. */
export function newMilestones(completed: string[], given: string[], list: Milestone[], today: string) {
  const done = new Set(completed);
  const streak = Math.max(streakOf(done, new Set(), today), bestStreak(done, new Set()));
  const have = new Set(given);
  return list.filter((m) => m.active !== false && !have.has(m.key) && (m.kind === "streak" ? streak >= m.days : done.size >= m.days));
}

/* ---------- money-back ---------- */

export type MoneyBackTier = { days: number; percent: number; months: number };
export const DEFAULT_MONEYBACK: MoneyBackTier[] = [
  { days: 300, percent: 50, months: 6 },
  { days: 365, percent: 90, months: 12 },
];

/** Days that count for money-back inside the current paid year, and the best tier reached. */
export function moneyBackProgress(days: string[], termStart: string, termEnd: string, tiers: MoneyBackTier[]) {
  const n = days.filter((d) => d >= termStart && d <= termEnd).length;
  const sorted = [...tiers].filter((t) => t.days > 0).sort((a, b) => a.days - b.days);
  const reached = sorted.filter((t) => n >= t.days).pop() ?? null;
  const next = sorted.find((t) => n < t.days) ?? null;
  return { counted: n, reached, next };
}

/* ---------- small helpers ---------- */

export const normEmail = (e: unknown) => String(e ?? "").trim().toLowerCase();
export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 160;
export const firstName = (s: unknown, email = "") => {
  const n = String(s ?? "").trim().split(/\s+/)[0];
  return (n || email.split("@")[0] || "Friend").slice(0, 24);
};
export const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");
/** Indian mobile with country code, or "" if it doesn't look like a phone number. */
export function waNumber(s: unknown) {
  let d = digits(s);
  if (d.length === 10) d = "91" + d;
  return d.length >= 11 && d.length <= 15 ? d : "";
}
