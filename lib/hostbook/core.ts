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

export const inr = (n: number) => { const v = Math.round(Number(n) || 0); return (v < 0 ? "−₹" : "₹") + Math.abs(v).toLocaleString("en-IN"); };

/* ---------- ID, phone and email checks (check-in form and guest editor) ---------- */

// Verhoeff check digit: the last digit of every Aadhaar number is one, so a single wrong digit is caught.
const VD = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
const VP = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
export function verhoeffOk(num: string) {
  let c = 0;
  const d = num.split("").reverse().map(Number);
  for (let i = 0; i < d.length; i++) c = VD[c][VP[i % 8][d[i]]];
  return c === 0;
}

/** Rules for each ID type. `example` is shown as the placeholder. */
export const ID_RULES: Record<string, { example: string; hint: string }> = {
  Aadhaar: { example: "1234 5678 9012", hint: "12 digits" },
  Passport: { example: "A1234567", hint: "Indian: 1 letter + 7 digits" },
  "Driving licence": { example: "PB65 20110012345", hint: "State code + numbers, e.g. PB65 20110012345" },
  "Voter ID": { example: "ABC1234567", hint: "3 letters + 7 digits" },
  PAN: { example: "ABCDE1234F", hint: "5 letters, 4 digits, 1 letter" },
  Other: { example: "", hint: "" },
};

/**
 * Checks and tidies an ID number for its type. Returns the cleaned value (Aadhaar spaced in groups of four, others in
 * capitals without spaces) or an error to show next to the field. Empty is allowed here; "required" is checked separately.
 */
export function checkId(type: string, raw: unknown, opts: { indian?: boolean } = {}): { value: string; error?: string } {
  const s = String(raw ?? "").trim();
  if (!s) return { value: "" };
  const compact = s.replace(/[\s-]/g, "").toUpperCase();
  switch (type) {
    case "Aadhaar": {
      if (!/^\d+$/.test(compact)) return { value: s, error: "Aadhaar has only digits" };
      if (compact.length !== 12) return { value: s, error: `Aadhaar has 12 digits (this has ${compact.length})` };
      if (/^[01]/.test(compact) || !verhoeffOk(compact)) return { value: s, error: "This isn't a valid Aadhaar number. Please check the digits" };
      return { value: compact.replace(/(\d{4})(?=\d)/g, "$1 ") };
    }
    case "PAN":
      return /^[A-Z]{5}\d{4}[A-Z]$/.test(compact) ? { value: compact } : { value: s, error: "PAN looks like ABCDE1234F (5 letters, 4 digits, 1 letter)" };
    case "Voter ID":
      return /^[A-Z]{3}\d{7}$/.test(compact) ? { value: compact } : { value: s, error: "Voter ID (EPIC) looks like ABC1234567 (3 letters, 7 digits)" };
    case "Driving licence":
      return /^[A-Z]{2}\d{2}[A-Z0-9]{9,14}$/.test(compact) ? { value: compact } : { value: s, error: "Driving licence starts with the state code and 2 digits, e.g. PB65 20110012345" };
    case "Passport":
      if (opts.indian !== false) return /^[A-Z]\d{7}$/.test(compact) ? { value: compact } : { value: s, error: "Indian passport numbers are 1 letter + 7 digits, e.g. A1234567" };
      return /^[A-Z0-9]{6,9}$/.test(compact) ? { value: compact } : { value: s, error: "Passport number should be 6–9 letters or digits" };
    default:
      return /^[A-Z0-9/]{4,20}$/.test(compact) ? { value: compact } : { value: s, error: "ID number should be 4–20 letters or digits" };
  }
}

/** Indian mobile (10 digits starting 6–9, optional +91/0) or an international number with +country code. */
export function checkPhone(raw: unknown): { value: string; error?: string } {
  const s = String(raw ?? "").trim();
  if (!s) return { value: "" };
  const plus = s.startsWith("+");
  const d = s.replace(/\D/g, "");
  if (!plus || d.startsWith("91")) {
    const local = d.length === 12 && d.startsWith("91") ? d.slice(2) : d.length === 11 && d.startsWith("0") ? d.slice(1) : d;
    if (local.length === 10 && /^[6-9]/.test(local)) return { value: `${local.slice(0, 5)} ${local.slice(5)}` };
    if (!plus) return { value: s, error: "Enter a 10-digit mobile number (or add + and the country code)" };
  }
  return d.length >= 8 && d.length <= 15 ? { value: `+${d}` } : { value: s, error: "Phone number looks too short or too long" };
}

export function checkEmail(raw: unknown): { value: string; error?: string } {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return { value: "" };
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? { value: s } : { value: s, error: "This email doesn't look right" };
}

export const isIndian = (nationality: unknown) => !String(nationality ?? "").trim() || /^(india|indian|in|bharat|bhartiya)$/i.test(String(nationality).trim());

/** Fields a host can make required on the check-in form. Name is always required. */
export const CHECKIN_FIELDS = [
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "address", label: "Home address" },
  { key: "city", label: "City" },
  { key: "nationality", label: "Nationality" },
  { key: "gender", label: "Gender" },
  { key: "age", label: "Age" },
  { key: "id", label: "ID type & number" },
  { key: "idFront", label: "ID photo (front)" },
  { key: "idBack", label: "ID photo (back)" },
] as const;
export type CheckinField = (typeof CHECKIN_FIELDS)[number]["key"];
export const DEFAULT_REQUIRED: CheckinField[] = ["phone", "id", "idFront"];
export const CHECKIN_FIELD_KEYS = CHECKIN_FIELDS.map((f) => f.key) as CheckinField[];

/**
 * Checks one guest on the check-in form. `main` = the first guest; `all` = rules apply to every guest (otherwise only
 * the main guest gets the required checks; formats are always checked). Returns field → error.
 */
export function checkGuest(g: Record<string, unknown>, opts: { required: CheckinField[]; all: boolean; main: boolean; photos?: string[]; hadPhotos?: string[]; hadId?: boolean }) {
  const err: Record<string, string> = {};
  const req = new Set(opts.main || opts.all ? opts.required : []);
  if (!String(g.name ?? "").trim()) err.name = "Name is needed";
  const phone = checkPhone(g.phone); if (phone.error) err.phone = phone.error;
  const email = checkEmail(g.email); if (email.error) err.email = email.error;
  const indian = isIndian(g.nationality);
  const id = checkId(String(g.idType || "Other"), g.idNumber, { indian }); if (id.error) err.idNumber = id.error;
  if (g.passport) { const p = checkId("Passport", g.passport, { indian }); if (p.error) err.passport = p.error; }
  // Phone is only ever required for the main guest (children and partners often have none).
  if (req.has("phone") && opts.main && !String(g.phone ?? "").trim()) err.phone = "Phone is needed";
  for (const k of ["email", "address", "city", "nationality", "gender"] as const) if (req.has(k) && !String(g[k] ?? "").trim()) err[k] = "Needed";
  if (req.has("age") && !(Number(g.age) > 0)) err.age = "Needed";
  if (req.has("id") && !opts.hadId && (!g.idType || !String(g.idNumber ?? "").trim())) err.idNumber = "ID number is needed";
  const have = new Set([...(opts.photos ?? []), ...(opts.hadPhotos ?? [])]);
  if (req.has("idFront") && !have.has("front")) err.idFront = "Photo of the ID (front) is needed";
  if (req.has("idBack") && !have.has("back")) err.idBack = "Photo of the ID (back) is needed";
  return err;
}

/* ---------- account statement (every rupee in and out, like a bank statement) ---------- */

export type StatementRow = {
  id: string; date: string; kind: "booking" | "income" | "expense" | "maint"; title: string; sub: string; listingId: string;
  moneyIn: number; moneyOut: number; balance: number;
};

/**
 * All money in (booking payouts on the check-in date, other income) and out (expenses, paid repairs) between two dates,
 * oldest first, with a running balance that starts from everything before `from`. With a listing, only that listing's
 * rows (shared expenses with no listing are left out).
 */
export function buildStatement(items: Rec[], from: string, to: string, opts: { listingId?: string; names?: (id: string) => string } = {}) {
  const name = opts.names ?? (() => "");
  const lines: Omit<StatementRow, "balance">[] = [];
  for (const x of items) {
    if (opts.listingId && x.listingId !== opts.listingId) continue;
    if (x.kind === "booking" && x.status !== "cancelled" && x.status !== "blocked" && isDay(x.start)) {
      const amt = bookingIncome(x);
      if (!amt) continue;
      const fee = Number(x.platformFee) || 0;
      lines.push({ id: x.id, date: x.start, kind: "booking", title: `Booking: ${x.guestName || "Guest"}`, sub: [x.source, `${nights(x)} night${nights(x) === 1 ? "" : "s"}`, fee ? `fee ${inr(fee)}` : ""].filter(Boolean).join(" · "), listingId: x.listingId ?? "", moneyIn: amt, moneyOut: 0 });
    } else if (x.kind === "income" && isDay(x.date) && Number(x.amount)) {
      lines.push({ id: x.id, date: x.date, kind: "income", title: x.source || "Other income", sub: x.note ?? "", listingId: x.listingId ?? "", moneyIn: Number(x.amount), moneyOut: 0 });
    } else if (x.kind === "expense" && isDay(x.date) && Number(x.amount)) {
      lines.push({ id: x.id, date: x.date, kind: "expense", title: x.category || "Expense", sub: [x.vendor, x.method, x.note].filter(Boolean).join(" · "), listingId: x.listingId ?? "", moneyIn: 0, moneyOut: Number(x.amount) });
    } else if (x.kind === "maint" && isDay(x.date) && Number(x.cost) && x.status !== "planned") {
      lines.push({ id: x.id, date: x.date, kind: "maint", title: `Repair: ${x.title || "Maintenance"}`, sub: x.vendor ?? "", listingId: x.listingId ?? "", moneyIn: 0, moneyOut: Number(x.cost) });
    }
  }
  // Same day: money in before money out, then by creation order, so the balance reads naturally.
  lines.sort((a, b) => a.date.localeCompare(b.date) || (b.moneyIn ? 1 : 0) - (a.moneyIn ? 1 : 0));
  const r2 = (v: number) => Math.round(v * 100) / 100;
  let balance = 0;
  const rows: StatementRow[] = [];
  for (const l of lines) {
    balance = r2(balance + l.moneyIn - l.moneyOut);
    if (l.date < from) continue;
    if (l.date > to) break;
    rows.push({ ...l, sub: l.sub || (l.listingId ? name(l.listingId) : ""), balance });
  }
  const opening = r2(lines.filter((l) => l.date < from).reduce((s, l) => s + l.moneyIn - l.moneyOut, 0));
  const moneyIn = r2(rows.reduce((s, r) => s + r.moneyIn, 0)), moneyOut = r2(rows.reduce((s, r) => s + r.moneyOut, 0));
  return { from, to, opening, moneyIn, moneyOut, closing: r2(opening + moneyIn - moneyOut), rows };
}
