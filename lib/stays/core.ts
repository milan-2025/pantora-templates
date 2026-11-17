/**
 * Stays: small pure helpers (IDs, slugs, money, margins, coordinates, WhatsApp links).
 * No database and no network, so they are unit-tested directly (tests/stays-core.test.ts).
 */
import { DEFAULT_TEMPLATES, type TemplateKey } from "./constants";

// ---------- property IDs and URLs ----------

/** Letters only, 2–5 characters, upper case ("lac" → "LAC"). Falls back when the setting is unusable. */
export const cleanPrefix = (v: unknown, fallback: string) => {
  const p = String(v ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
  return p.length >= 2 ? p : fallback;
};
/** LAC-0001. Numbers grow past 9999 without breaking (LAC-10000). */
export const formatCode = (prefix: string, n: number) => `${prefix}-${String(Math.max(1, Math.floor(n))).padStart(4, "0")}`;
export const CODE_RE = /^[A-Z]{2,5}-\d{4,}$/;

export const slugify = (s: unknown) =>
  String(s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/g, "");

/** "Sea view 2BHK" + LAC-0001 → "sea-view-2bhk-LAC-0001" (the ID keeps its capitals so it reads like the ID). */
export const propertySlug = (title: unknown, code: string) => [slugify(title), code].filter(Boolean).join("-");

/** The property ID at the end of a /stay/<slug> address, or "" if there isn't one. */
export function codeFromSlug(slug: unknown): string {
  const m = /([A-Za-z]{2,5}-\d{4,})$/.exec(decodeURIComponent(String(slug ?? "")).trim());
  return m ? m[1].toUpperCase() : "";
}

// ---------- money ----------

/** A whole number of rupees, or null when empty / not a number / negative / absurd. */
export function cleanMoney(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[₹,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return null;
  return Math.round(n);
}

/** ₹2,500 (Indian digit grouping). */
export const inr = (n: number | null | undefined) =>
  n === null || n === undefined || !Number.isFinite(n) ? "" : `₹${Math.round(n).toLocaleString("en-IN")}`;

export type PricePair = { weekday: number | null; weekend: number | null };
export type Pricing = { landing: PricePair; listing: PricePair };

const diff = (a: number | null, b: number | null) => (a === null || b === null ? null : a - b);
const pct = (m: number | null, base: number | null) => (m === null || !base ? null : Math.round((m / base) * 1000) / 10);

/**
 * Margin = listing price (what the guest pays) − landing price (what the host is paid).
 * Percentage is of the listing price. "Per week" assumes 5 weekday + 2 weekend nights.
 */
export function margins(p: Pricing) {
  const weekday = diff(p.listing.weekday, p.landing.weekday);
  const weekend = diff(p.listing.weekend, p.landing.weekend);
  return {
    weekday,
    weekend,
    weekdayPct: pct(weekday, p.listing.weekday),
    weekendPct: pct(weekend, p.listing.weekend),
    perWeek: weekday === null || weekend === null ? null : weekday * 5 + weekend * 2,
    missing: [p.landing.weekday, p.landing.weekend, p.listing.weekday, p.listing.weekend].some((x) => x === null),
    negative: (weekday !== null && weekday < 0) || (weekend !== null && weekend < 0),
  };
}

/** Lowest guest price shown on cards ("from ₹2,500"). */
export const fromPrice = (l: PricePair) => {
  const xs = [l.weekday, l.weekend].filter((x): x is number => typeof x === "number" && x > 0);
  return xs.length ? Math.min(...xs) : null;
};

// ---------- coordinates ----------

export const validLat = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= -90 && v <= 90 && v !== 0;
export const validLng = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= -180 && v <= 180 && v !== 0;
const num = (v: unknown) => (v === "" || v === null || v === undefined ? NaN : Number(v));

/** Exact coordinates rounded to ~1 m, or null for each when unusable. */
export function cleanCoords(lat: unknown, lng: unknown): { lat: number | null; lng: number | null } {
  const a = num(lat), b = num(lng);
  return validLat(a) && validLng(b) ? { lat: Math.round(a * 1e5) / 1e5, lng: Math.round(b * 1e5) / 1e5 } : { lat: null, lng: null };
}

/**
 * Reads coordinates out of a pasted Google Maps link (…/@30.71,76.80,15z, ?q=30.71,76.80, !3d30.71!4d76.80).
 * Short links (maps.app.goo.gl) carry no coordinates; those are resolved on the server.
 */
export function coordsFromMapsUrl(url: unknown): { lat: number; lng: number } | null {
  const s = decodeURIComponent(String(url ?? ""));
  const pats = [/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/, /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/, /[?&](?:q|query|ll|destination|center)=(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/, /^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/];
  for (const re of pats) {
    const m = re.exec(s);
    if (m) {
      const c = cleanCoords(m[1], m[2]);
      if (c.lat !== null && c.lng !== null) return { lat: c.lat, lng: c.lng };
    }
  }
  return null;
}

/** Only real Google Maps links (or bare "lat,lng") are kept. */
export function cleanMapsUrl(v: unknown): string {
  const s = String(v ?? "").trim().slice(0, 600);
  if (!s) return "";
  let u: URL;
  try { u = new URL(s); } catch { return ""; }
  if (u.protocol !== "https:") return "";
  const h = u.hostname.toLowerCase();
  const ok = h === "maps.app.goo.gl" || h === "goo.gl" || h === "maps.google.com" || /(^|\.)google\.[a-z.]{2,6}$/.test(h);
  if (!ok) return "";
  if (/(^|\.)google\./.test(h) && !h.startsWith("maps.") && !u.pathname.startsWith("/maps")) return "";
  return u.toString();
}

/**
 * Public position for a property: moved 250–650 m from the real spot in a direction that is fixed per property
 * (so it doesn't jump around on every visit and can't be averaged out), then rounded to 3 decimals (~110 m).
 * `seed` is a secret-keyed hash of the property id, so the offset can't be reversed without the server secret.
 */
export function approxCoords(lat: number, lng: number, seed: Uint8Array): { lat: number; lng: number } {
  const a = ((seed[0] << 8) | seed[1]) / 65536; // 0..1 → direction
  const d = 250 + (((seed[2] << 8) | seed[3]) / 65536) * 400; // metres
  const angle = a * 2 * Math.PI;
  const dLat = (d * Math.cos(angle)) / 111_320;
  const dLng = (d * Math.sin(angle)) / (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return { lat: Math.round((lat + dLat) * 1000) / 1000, lng: Math.round((lng + dLng) * 1000) / 1000 };
}

/** Straight-line distance in metres (used by tests and "nearby" sorting). */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371e3, r = Math.PI / 180;
  const x = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// ---------- WhatsApp ----------

/** Digits with country code. A bare 10-digit Indian mobile gets 91 in front. Returns "" if unusable. */
export function waNumber(v: unknown): string {
  let d = String(v ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = "91" + d;
  return d.length >= 11 && d.length <= 15 ? d : "";
}

export type EnquiryVars = {
  title?: string; id?: string; location?: string;
  checkin?: string; checkout?: string; adults?: number | string; children?: number | string; guests?: number | string;
};

/** "2026-12-24" → "24 Dec 2026" (dates typed by the guest; anything else is passed through trimmed). */
export const prettyDate = (v: unknown) => {
  const s = String(v ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s.slice(0, 20);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mo = Number(m[2]);
  return mo >= 1 && mo <= 12 ? `${Number(m[3])} ${months[mo - 1]} ${m[1]}` : s;
};

/** Fills {placeholders}. Unknown placeholders are left as typed so the admin notices them. */
export function fillTemplate(tpl: string, vars: EnquiryVars): string {
  const map: Record<string, string> = {
    title: String(vars.title ?? ""), id: String(vars.id ?? ""), location: String(vars.location ?? ""),
    checkin: prettyDate(vars.checkin), checkout: prettyDate(vars.checkout),
    adults: String(vars.adults ?? ""), children: String(vars.children ?? ""), guests: String(vars.guests ?? ""),
  };
  return tpl.replace(/\{(\w+)\}/g, (m, k: string) => (k in map ? map[k] : m));
}

export function enquiryMessage(type: TemplateKey, vars: EnquiryVars, templates?: Partial<Record<TemplateKey, string>>) {
  const tpl = (templates?.[type] || "").trim() || DEFAULT_TEMPLATES[type];
  return fillTemplate(tpl, vars);
}

/** https://wa.me/<number>?text=<message>, properly encoded. "" if the number is unusable. */
export function waLink(number: unknown, message: string) {
  const n = waNumber(number);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(message)}` : "";
}

/** Guest counts from the "Check availability" form. Total = adults + children unless a bigger total is typed. */
export function cleanGuests(input: { adults?: unknown; children?: unknown; guests?: unknown }) {
  const n = (v: unknown, min: number) => {
    const x = Math.floor(Number(v));
    return Number.isFinite(x) ? Math.min(50, Math.max(min, x)) : min;
  };
  const adults = n(input.adults, 1);
  const children = n(input.children, 0);
  const total = Math.max(adults + children, n(input.guests, 0));
  return { adults, children, guests: total };
}

/** A YYYY-MM-DD date, or "". */
export const cleanDate = (v: unknown) => {
  const s = String(v ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const d = new Date(s + "T00:00:00Z");
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? "" : s;
};
