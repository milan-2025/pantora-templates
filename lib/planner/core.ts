/**
 * Wedding planner (/planner): pure logic shared by the API routes and tests.
 * No database or server-only imports here.
 */
import { createHmac, timingSafeEqual } from "crypto";

/** Row collections inside a planner's data. Every row has a string `id`. */
export const COLLS = [
  "functions", "guests", "hotels", "vehicles", "roomAlloc", "transAlloc", "budgetCats", "budgetLines",
  "vendors", "payments", "tasks", "rituals", "runsheet", "shagun", "milni", "shopping",
] as const;
export type Coll = (typeof COLLS)[number];

/** Single-value settings stored beside the rows. */
export const TOP_KEYS = ["settings", "totalBudget", "cat", "team", "msg", "lists", "cols"] as const;
export type TopKey = (typeof TOP_KEYS)[number];

/** Collections a plan can cap, with the label shown to customers and in /admin. */
export const LIMITS = {
  guests: "Guests",
  vendors: "Vendor quotes",
  payments: "Payments",
  tasks: "Tasks",
  functions: "Functions",
  hotels: "Hotel room types",
  vehicles: "Vehicles",
  shopping: "Shopping items",
  shagun: "Shagun entries",
  runsheet: "Run sheet activities",
  rituals: "Ritual items",
  milni: "Milni pairs",
} as const;
export type LimitKey = keyof typeof LIMITS;
export const LIMIT_KEYS = Object.keys(LIMITS) as LimitKey[];

/** null / undefined = unlimited. */
export type Limits = Partial<Record<LimitKey, number | null>>;

export type Row = Record<string, unknown> & { id: string };
export type State = Partial<Record<Coll, Row[]>> & Partial<Record<TopKey, unknown>>;

/** One change sent by the app: upsert/delete a row, set a setting, or replace everything (import / restore). */
export type Op = { c: Coll; id: string; r: Row | null } | { k: TopKey; v: unknown } | { replace: State };

const isColl = (c: unknown): c is Coll => typeof c === "string" && (COLLS as readonly string[]).includes(c);
const isTop = (k: unknown): k is TopKey => typeof k === "string" && (TOP_KEYS as readonly string[]).includes(k);
const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);

export const MAX_STATE_BYTES = 3_000_000; // Vercel request bodies stop at 4.5 MB
const MAX_ROW_BYTES = 12_000;
const MAX_OPS = 5000;

export class PlannerError extends Error {
  constructor(message: string, public status = 400, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

function cleanRow(id: unknown, r: unknown): Row {
  if (typeof id !== "string" || !id || id.length > 40) throw new PlannerError("Invalid row id");
  if (!isObj(r)) throw new PlannerError("Invalid row");
  if (JSON.stringify(r).length > MAX_ROW_BYTES) throw new PlannerError("A row is too large");
  return { ...r, id };
}

/** A whole planner as sent by the app (import / restore / first save): only known keys, valid rows. */
export function cleanState(input: unknown): State {
  if (!isObj(input)) throw new PlannerError("Invalid planner data");
  const out: State = {};
  for (const c of COLLS) {
    const rows = input[c];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) throw new PlannerError(`Invalid ${c}`);
    const seen = new Set<string>();
    out[c] = rows.map((r) => cleanRow((r as Row)?.id, r)).filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  }
  for (const k of TOP_KEYS) if (input[k] !== undefined) out[k] = input[k];
  if (JSON.stringify(out).length > MAX_STATE_BYTES) throw new PlannerError("The planner is too large to save", 413);
  return out;
}

/** Applies the app's changes on top of the saved planner. Rows merge one by one, so two people editing different rows never overwrite each other. */
export function applyOps(state: State, ops: unknown): State {
  if (!Array.isArray(ops) || ops.length > MAX_OPS) throw new PlannerError("Invalid changes");
  let next: State = { ...state };
  const touched = new Set<Coll>();
  for (const op of ops as Record<string, unknown>[]) {
    if (!isObj(op)) throw new PlannerError("Invalid change");
    if ("replace" in op) {
      next = cleanState(op.replace);
      touched.clear();
      continue;
    }
    if ("k" in op) {
      if (!isTop(op.k)) throw new PlannerError("Unknown setting");
      next[op.k] = op.v;
      continue;
    }
    if (!isColl(op.c)) throw new PlannerError("Unknown list");
    if (!touched.has(op.c)) {
      next[op.c] = [...(next[op.c] ?? [])];
      touched.add(op.c);
    }
    const rows = next[op.c]!;
    const i = rows.findIndex((r) => r.id === op.id);
    if (op.r === null) {
      if (i >= 0) rows.splice(i, 1);
    } else {
      const row = cleanRow(op.id, op.r);
      if (i >= 0) rows[i] = row;
      else rows.push(row);
    }
  }
  if (JSON.stringify(next).length > MAX_STATE_BYTES) throw new PlannerError("The planner is too large to save", 413);
  return next;
}

/** How many rows of each capped list the planner has. */
export function counts(state: State | null | undefined): Record<LimitKey, number> {
  const out = {} as Record<LimitKey, number>;
  for (const k of LIMIT_KEYS) {
    const rows = state?.[k as Coll];
    out[k] = Array.isArray(rows) ? (k === "guests" ? rows.filter((g) => g.name || g.group).length : rows.length) : 0;
  }
  return out;
}

/**
 * The first plan limit this change would break, or null. A list that is already over its limit
 * (e.g. after a downgrade) can still be edited and trimmed; it just can't grow.
 */
export function overLimit(before: State, after: State, limits: Limits) {
  const b = counts(before), a = counts(after);
  for (const k of LIMIT_KEYS) {
    const lim = limits[k];
    if (lim == null || lim < 0) continue;
    if (a[k] > lim && a[k] > b[k]) return { key: k, label: LIMITS[k], limit: lim, count: a[k] };
  }
  return null;
}

/* ---------- sign-in ---------- */

export const normEmail = (e: unknown) => String(e ?? "").trim().toLowerCase();
export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 160;

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString();
const sign = (secret: string, data: string) => createHmac("sha256", `planner:${secret}`).update(data).digest("base64url");
const same = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Session token: "<base64 subject>.<expiry>.<signature>". The subject is the customer's email,
 * or "support:<plannerId>" for a read-only support view opened from /admin.
 */
export function makeToken(secret: string, subject: string, ttlMs: number, now = Date.now()) {
  const exp = String(now + ttlMs);
  const head = `${b64(subject)}.${exp}`;
  return `${head}.${sign(secret, head)}`;
}

export function readToken(secret: string, token: string | null | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [s, exp, sig] = parts;
  if (!same(sig, sign(secret, `${s}.${exp}`))) return null;
  if (!(Number(exp) > now)) return null;
  try {
    return unb64(s);
  } catch {
    return null;
  }
}

export const hashCode = (secret: string, email: string, code: string) => sign(secret, `code:${email}:${code}`);
export const codesMatch = (a: string, b: string) => same(a, b);

/* ---------- plans ---------- */

export type PlanStatus = "trial" | "active" | "expired" | "suspended";

export function effectiveStatus(p: { status?: string | null; expiresAt?: string | null }, now = Date.now()): PlanStatus {
  if (p.status === "suspended") return "suspended";
  if (p.expiresAt && new Date(p.expiresAt).getTime() <= now) return "expired";
  return p.status === "paid" ? "active" : "trial";
}

export const daysLeft = (expiresAt?: string | null, now = Date.now()) =>
  expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 864e5)) : null;

export const addDays = (from: Date | number, days: number) => new Date(new Date(from).getTime() + days * 864e5);

/** Expiry after paying for `days` more: renewing the same plan early adds to the time left; anything else starts today. */
export function newExpiry(current: { expiresAt?: string | null; status?: string | null; plan?: string | null }, planId: string, days: number, now = Date.now()) {
  const left = current.expiresAt ? new Date(current.expiresAt).getTime() : 0;
  const start = current.status === "paid" && current.plan === planId && left > now ? left : now;
  return addDays(start, days);
}

/** "Added 2 guests · Updated vendor" etc., written by the server when the app sends no summary. */
export function describeOps(ops: Op[]) {
  const n: Record<string, { a: number; u: number; d: number }> = {};
  for (const op of ops) {
    if ("replace" in op) return "Replaced the whole planner";
    const key = "k" in op ? op.k : op.c;
    n[key] ??= { a: 0, u: 0, d: 0 };
    if ("k" in op) n[key].u++;
    else if (op.r === null) n[key].d++;
    else n[key].u++;
  }
  return Object.entries(n)
    .map(([k, v]) => [v.d && `deleted ${v.d} ${k}`, v.u && `updated ${v.u} ${k}`].filter(Boolean).join(", "))
    .join(" · ")
    .replace(/^./, (c) => c.toUpperCase());
}
