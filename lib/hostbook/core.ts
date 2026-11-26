/**
 * Pandora HostBook: pure helpers (no database), shared by the server and the app, and covered by tests/hostbook.test.ts.
 */
import { FIELD_FEATURES, KINDS, type FeatureKey, type FieldType, type Kind } from "./features";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- records are loose JSON
export type Rec = Record<string, any> & { id: string; kind: Kind };

export class HostBookError extends Error {
  constructor(message: string, public status = 400, public extra: Record<string, unknown> = {}) { super(message); }
}

/* ---------- dates (YYYY-MM-DD, India time) ---------- */

export const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
export const istDay = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10);
const t = (day: string) => Date.parse(day + "T00:00:00Z");
export const dayDiff = (a: string, b: string) => Math.round((t(b) - t(a)) / 864e5);
export const addDays = (day: string, n: number) => new Date(t(day) + n * 864e5).toISOString().slice(0, 10);
export function addMonths(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}
export const monthOf = (day: string) => day.slice(0, 7);
export const nights = (b: { start?: string; end?: string; [k: string]: unknown }) => (isDay(b.start) && isDay(b.end) ? Math.max(0, dayDiff(b.start, b.end)) : 0);
/** Nights of [start, end) that fall inside [from, to] (both inclusive days). */
export function nightsIn(b: { start?: string; end?: string; [k: string]: unknown }, from: string, to: string) {
  if (!isDay(b.start) || !isDay(b.end)) return 0;
  const s = b.start > from ? b.start : from;
  const lastNight = addDays(b.end, -1);
  const e = lastNight < to ? lastNight : to;
  return e < s ? 0 : dayDiff(s, e) + 1;
}
export const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) => a.start < b.end && b.start < a.end;

/* ---------- cleaning input ---------- */

const MAX_TEXT = 300, MAX_LONG = 5000;
function clean(type: FieldType, v: unknown): unknown {
  switch (type) {
    case "text": return String(v ?? "").trim().slice(0, MAX_TEXT);
    case "long": return String(v ?? "").slice(0, MAX_LONG);
    case "phone": return String(v ?? "").replace(/[^\d+ ]/g, "").trim().slice(0, 20);
    case "num": { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; }
    case "bool": return v === true || v === "true";
    case "date": return isDay(v) ? v : "";
    case "ref": return /^[\w-]{1,40}$/.test(String(v ?? "")) ? String(v) : "";
    case "list": return Array.isArray(v) ? v.slice(0, 100).map((x) => String(x ?? "").slice(0, MAX_TEXT)).filter(Boolean) : [];
    case "json": {
      try {
        const s = JSON.stringify(v ?? null);
        return s.length <= 20_000 ? JSON.parse(s) : null;
      } catch { return null; }
    }
  }
}

/**
 * Keeps only the known fields of a kind, each cleaned to its type. Fields that need a feature the plan lacks are left out,
 * so a locked feature can't be written through the API.
 */
export function cleanRecord(kind: Kind, data: Record<string, unknown>, has: (f: FeatureKey) => boolean) {
  const fields = KINDS[kind].fields as Record<string, FieldType>;
  const gated = FIELD_FEATURES[kind] ?? {};
  const out: Record<string, unknown> = {};
  for (const [k, type] of Object.entries(fields)) {
    if (!(k in data)) continue;
    const need = (gated as Record<string, FeatureKey>)[k];
    if (need && !has(need)) continue;
    out[k] = clean(type, data[k]);
  }
  return out;
}

export const maskId = (n: unknown) => {
  const s = String(n ?? "").replace(/\s/g, "");
  return s.length <= 4 ? s : "•••• " + s.slice(-4);
};

/* ---------- repeating tasks ---------- */

export type Unit = "day" | "week" | "month" | "year" | "once";
export function nextDue(due: string, every: number, unit: string): string | null {
  const n = Math.max(1, Math.round(every || 1));
  if (unit === "once") return null;
  if (unit === "day") return addDays(due, n);
  if (unit === "week") return addDays(due, 7 * n);
  if (unit === "year") return addMonths(due, 12 * n);
  return addMonths(due, n);
}
export function repeatLabel(every: number, unit: string) {
  if (unit === "once") return "One time";
  const n = Math.max(1, Math.round(every || 1));
  const u = { day: "day", week: "week", month: "month", year: "year" }[unit] ?? "month";
  return n === 1 ? `Every ${u}` : `Every ${n} ${u}s`;
}

/* ---------- iCal (Airbnb / Booking.com export links) ---------- */

export type IcalEvent = { uid: string; start: string; end: string; summary: string; description: string };
const icalDay = (v: string) => {
  const m = /(\d{4})(\d{2})(\d{2})/.exec(v);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
};
export function parseIcal(text: string): IcalEvent[] {
  const lines = String(text).replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
  const out: IcalEvent[] = [];
  let cur: Partial<IcalEvent> | null = null;
  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) cur = {};
    else if (line.startsWith("END:VEVENT")) {
      if (cur && cur.start && cur.end && cur.end > cur.start) out.push({ uid: cur.uid || `${cur.start}-${cur.end}`, start: cur.start, end: cur.end, summary: cur.summary ?? "", description: cur.description ?? "" });
      cur = null;
    } else if (cur) {
      const i = line.indexOf(":");
      if (i < 0) continue;
      const key = line.slice(0, i).split(";")[0].toUpperCase();
      const val = line.slice(i + 1);
      if (key === "UID") cur.uid = val.trim().slice(0, 200);
      else if (key === "DTSTART") cur.start = icalDay(val);
      else if (key === "DTEND") cur.end = icalDay(val);
      else if (key === "SUMMARY") cur.summary = val.replace(/\\,/g, ",").trim().slice(0, 200);
      else if (key === "DESCRIPTION") cur.description = val.replace(/\\n/g, "\n").replace(/\\,/g, ",").slice(0, 1000);
    }
  }
  return out;
}
/** Airbnb sends "Reserved" for bookings and "Airbnb (Not available)" for dates the host blocked. */
export const icalIsBlock = (e: IcalEvent) => /not available|blocked|closed/i.test(e.summary);
/** Airbnb's description has "Phone Number (Last 4 Digits): 1234". */
export const icalPhoneLast4 = (e: IcalEvent) => /Last 4 Digits\)?:\s*(\d{4})/i.exec(e.description)?.[1] ?? "";

/* ---------- plans & checkout ---------- */

export type PlanLite = { id: string; planId: string; name: string; price: number; isFree: boolean; listings: number; staff: number; idDays: number; hostChoosesIdDays: boolean; features: FeatureKey[]; active: boolean; sortOrder: number };

/**
 * What a host pays for a plan for a year:
 * - same plan, still running → renewal: full price + extra listings, one more year on top;
 * - a dearer plan while a paid one is running → only the difference (plus newly added extra listings), same end date;
 * - otherwise → full price + extra listings, a year from today.
 */
export function planQuote(opts: { current: PlanLite | null; expiresAt: string | null; extraNow: number; target: PlanLite; extra: number; extraPrice: number; now?: number }) {
  const now = opts.now ?? Date.now();
  const running = Boolean(opts.current && !opts.current.isFree && opts.expiresAt && Date.parse(opts.expiresAt) > now);
  const extra = Math.max(0, Math.min(200, Math.round(opts.extra || 0)));
  const yearMs = 365 * 864e5;
  if (running && opts.current!.id === opts.target.id) {
    return { kind: "renew" as const, amount: opts.target.price + extra * opts.extraPrice, expiresAt: new Date(Date.parse(opts.expiresAt!) + yearMs).toISOString(), extra };
  }
  if (running && opts.target.price > opts.current!.price) {
    const added = Math.max(0, extra - opts.extraNow);
    return { kind: "upgrade" as const, amount: opts.target.price - opts.current!.price + added * opts.extraPrice, expiresAt: opts.expiresAt!, extra };
  }
  return { kind: "new" as const, amount: opts.target.price + extra * opts.extraPrice, expiresAt: new Date(now + yearMs).toISOString(), extra };
}

/* ---------- WhatsApp ---------- */

export const fillTemplate = (body: string, vars: Record<string, string | number | undefined>) =>
  String(body).replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === "" ? m : String(vars[k])));
export const waLink = (phone: string, text: string) => {
  let p = String(phone || "").replace(/\D/g, "");
  if (p.length === 10) p = "91" + p;
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
};

/* ---------- money & reports ---------- */

/** What the host keeps from a booking (the platform payout). Falls back to gross − platform fee. */
export const bookingIncome = (b: Rec) => (Number(b.payout) || Math.max(0, (Number(b.gross) || 0) - (Number(b.platformFee) || 0)));
const live = (b: Rec) => b.kind === "booking" && b.status !== "cancelled" && b.status !== "blocked";

export type Report = {
  from: string; to: string; income: number; bookingIncome: number; otherIncome: number; expenses: number; profit: number;
  nights: number; available: number; occupancy: number; adr: number; revpar: number; bookings: number;
  byCategory: { name: string; amount: number }[]; bySource: { name: string; amount: number; count: number }[];
  byMonth: { month: string; income: number; expenses: number; profit: number }[];
  byListing: { id: string; name: string; income: number; expenses: number; profit: number; nights: number; occupancy: number }[];
  gst: number; platformFees: number;
};

/**
 * Income, expenses and occupancy for a date range. A booking's payout is spread over its nights, so a stay across two
 * months counts in both. Expenses with no listing count for "all listings" (and are split evenly in the per-listing view).
 */
export function buildReport(items: Rec[], from: string, to: string, listingId = ""): Report {
  const listings = items.filter((x) => x.kind === "listing" && (!x.archived || x.id === listingId) && (!listingId || x.id === listingId));
  const days = dayDiff(from, to) + 1;
  const months = new Map<string, { income: number; expenses: number }>();
  for (let d = from.slice(0, 7) + "-01"; d <= to; d = addMonths(d, 1)) months.set(monthOf(d), { income: 0, expenses: 0 });
  const m = (day: string) => months.get(monthOf(day));
  const per = new Map(listings.map((l) => [l.id, { id: l.id, name: String(l.name || "Listing"), income: 0, expenses: 0, profit: 0, nights: 0, occupancy: 0 }]));
  const cat = new Map<string, number>(), src = new Map<string, { amount: number; count: number }>();
  let bIncome = 0, oIncome = 0, exp = 0, n = 0, count = 0, gst = 0, fees = 0;

  for (const b of items) {
    if (!live(b) || (listingId && b.listingId !== listingId)) continue;
    const total = nights(b), inside = nightsIn(b, from, to);
    if (!total || !inside) continue;
    const share = inside / total, money = bookingIncome(b) * share;
    bIncome += money; n += inside; gst += (Number(b.taxes) || 0) * share; fees += (Number(b.platformFee) || 0) * share;
    if (b.start >= from && b.start <= to) count++;
    const s = src.get(b.source || "Other") ?? { amount: 0, count: 0 };
    s.amount += money; s.count += b.start >= from && b.start <= to ? 1 : 0; src.set(b.source || "Other", s);
    const p = per.get(b.listingId); if (p) { p.income += money; p.nights += inside; }
    // Spread over the months the nights fall in.
    for (let d = b.start > from ? b.start : from; d < b.end && d <= to; d = addDays(d, 1)) { const mm = m(d); if (mm) mm.income += bookingIncome(b) / total; }
  }
  for (const x of items) {
    if (!isDay(x.date) || x.date < from || x.date > to) continue;
    if (listingId && x.listingId !== listingId && !(x.kind === "expense" && !x.listingId)) continue;
    const amt = Number(x.amount ?? x.cost) || 0;
    if (x.kind === "income") { oIncome += amt; const mm = m(x.date); if (mm) mm.income += amt; const p = per.get(x.listingId); if (p) p.income += amt; }
    // Expenses with no listing are shared: in a single-listing report, its even share counts.
    if (x.kind === "expense" || (x.kind === "maint" && amt && x.status !== "planned")) {
      const shared = !x.listingId;
      const part = shared && listingId ? amt / Math.max(1, items.filter((l) => l.kind === "listing" && !l.archived).length) : amt;
      exp += part; cat.set(x.kind === "maint" ? "Maintenance & repairs" : x.category || "Other", (cat.get(x.kind === "maint" ? "Maintenance & repairs" : x.category || "Other") ?? 0) + part);
      const mm = m(x.date); if (mm) mm.expenses += part;
      if (shared) { const k = per.size || 1; for (const p of per.values()) p.expenses += amt / k; }
      else { const p = per.get(x.listingId); if (p) p.expenses += amt; }
    }
  }
  const avail = days * Math.max(1, listings.length);
  const r2 = (v: number) => Math.round(v);
  return {
    from, to, income: r2(bIncome + oIncome), bookingIncome: r2(bIncome), otherIncome: r2(oIncome), expenses: r2(exp), profit: r2(bIncome + oIncome - exp),
    nights: n, available: avail, occupancy: listings.length ? Math.round((n / avail) * 1000) / 10 : 0, adr: n ? r2(bIncome / n) : 0, revpar: r2(bIncome / avail), bookings: count,
    byCategory: [...cat].map(([name, amount]) => ({ name, amount: r2(amount) })).sort((a, b) => b.amount - a.amount),
    bySource: [...src].map(([name, v]) => ({ name, amount: r2(v.amount), count: v.count })).sort((a, b) => b.amount - a.amount),
    byMonth: [...months].map(([month, v]) => ({ month, income: r2(v.income), expenses: r2(v.expenses), profit: r2(v.income - v.expenses) })),
    byListing: [...per.values()].map((p) => ({ ...p, income: r2(p.income), expenses: r2(p.expenses), profit: r2(p.income - p.expenses), occupancy: Math.round((p.nights / days) * 1000) / 10 })),
    gst: r2(gst), platformFees: r2(fees),
  };
}

/** Owner statement for one listing and month: what the manager earned and what the owner is owed. */
export function ownerStatement(items: Rec[], listingId: string, month: string, commissionPct: number) {
  const from = month + "-01", to = addDays(addMonths(from, 1), -1);
  const r = buildReport(items, from, to, listingId);
  const ownExpenses = items.filter((x) => x.kind === "expense" && x.listingId === listingId && isDay(x.date) && x.date >= from && x.date <= to);
  const expenses = ownExpenses.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const commission = Math.round((r.income * Math.max(0, Math.min(100, commissionPct || 0))) / 100);
  const bookings = items.filter((b) => live(b) && b.listingId === listingId && nightsIn(b, from, to) > 0).sort((a, b) => a.start.localeCompare(b.start));
  return { from, to, income: r.income, nights: r.nights, commission, expenses: Math.round(expenses), due: Math.round(r.income - commission - expenses), bookings, expenseRows: ownExpenses };
}

/* ---------- CSV ---------- */

export function toCsv(rows: (string | number | null | undefined)[][]) {
  return rows.map((r) => r.map((c) => {
    const s = String(c ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\r\n");
}

export const inr = (n: number) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
