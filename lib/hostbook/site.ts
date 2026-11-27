/**
 * HostBook booking websites: every host can switch on a public site at pandoratemplates.com/h/<name> that shows
 * their listings, photos and free dates. Guests send a booking enquiry to the host's WhatsApp (no online payment).
 *
 * This file is pure (no database), so the rules are unit-tested in tests/hostbook-site.test.ts:
 * which addresses are allowed, what a public listing may show (never the exact address, Wi-Fi, money or
 * owner details), which nights are taken, and the WhatsApp message a guest sends.
 */

export const SITE_PATH = "/h";

/** Addresses a host can't take, because they would look like ours or clash with words people expect. */
const RESERVED = new Set([
  "admin", "api", "app", "www", "help", "support", "pandora", "pandoratemplates", "hostbook", "stays", "stay", "booking", "bookings",
  "login", "signup", "account", "settings", "new", "edit", "about", "contact", "terms", "privacy", "refund", "blog",
]);

export const SITE_AMENITIES = [
  "Wi-Fi", "Air conditioning", "Heating", "Kitchen", "Washing machine", "Free parking", "Power backup", "Lift", "TV", "Workspace",
  "Hot water", "Refrigerator", "Microwave", "Balcony", "Garden", "Mountain view", "Pool", "Pets allowed", "Family friendly", "Self check-in",
];

export type SiteSettings = {
  on: boolean;
  title: string;
  tagline: string;
  about: string;
  whatsapp: string;
  heroUrl: string;
  instagram: string;
};

export const EMPTY_SITE: SiteSettings = { on: false, title: "", tagline: "", about: "", whatsapp: "", heroUrl: "", instagram: "" };

/** "Sunny Homes!" → "sunny-homes". Returns an error message instead when it can't be used. */
export function cleanSlug(raw: unknown): { slug: string } | { error: string } {
  const slug = String(raw ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (slug.length < 3) return { error: "Use at least 3 letters or numbers for your website address" };
  if (slug.length > 40) return { error: "Keep your website address to 40 characters or fewer" };
  if (RESERVED.has(slug)) return { error: `"${slug}" is reserved. Try your business name.` };
  return { slug };
}

/** Only photos uploaded through HostBook (our Cloudinary account, https) are shown on a public page. */
export const isSitePhoto = (u: unknown, cloudName?: string): u is string =>
  typeof u === "string" &&
  u.length < 400 &&
  /^https:\/\/res\.cloudinary\.com\/[\w-]+\/image\/upload\/[^\s"'<>]+$/.test(u) &&
  (!cloudName || u.startsWith(`https://res.cloudinary.com/${cloudName}/`));

/** An Indian mobile (10 digits) gets +91; anything else must already have its country code. Digits only. */
export function cleanWhatsApp(raw: unknown): string {
  const d = String(raw ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (/^[6-9]\d{9}$/.test(d)) return "91" + d;
  return d.length >= 11 && d.length <= 15 ? d : "";
}

export function cleanSite(b: Record<string, unknown>, cloudName?: string): SiteSettings {
  const text = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
  return {
    on: b.on === true,
    title: text(b.title, 80),
    tagline: text(b.tagline, 140),
    about: String(b.about ?? "").trim().slice(0, 2000),
    whatsapp: cleanWhatsApp(b.whatsapp),
    heroUrl: isSitePhoto(b.heroUrl, cloudName) ? String(b.heroUrl) : "",
    instagram: text(b.instagram, 60).replace(/^@/, "").replace(/[^\w.]/g, ""),
  };
}

/** The listing fields a guest may see. The exact address, map pin, Wi-Fi, guidebook, money and owner details stay private. */
export type PublicListing = {
  id: string;
  name: string;
  city: string;
  area: string;
  headline: string;
  description: string;
  photos: string[];
  price: number;
  maxGuests: number;
  bedrooms: number;
  bathrooms: number;
  amenities: string[];
  checkIn: string;
  checkOut: string;
  rules: string;
};

const num = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : 0);

export function publicListing(l: Record<string, unknown>, cloudName?: string): PublicListing {
  const str = (v: unknown, n = 300) => String(v ?? "").slice(0, n);
  return {
    id: String(l._id ?? l.id ?? ""),
    name: str(l.name, 120),
    city: str(l.city, 80),
    area: str(l.area, 120),
    headline: str(l.headline, 200),
    description: str(l.description, 5000),
    photos: (Array.isArray(l.photos) ? l.photos : []).filter((u) => isSitePhoto(u, cloudName)).slice(0, 15) as string[],
    price: num(l.price),
    maxGuests: num(l.maxGuests),
    bedrooms: num(l.bedrooms),
    bathrooms: num(l.bathrooms),
    amenities: (Array.isArray(l.amenities) ? l.amenities : []).map(String).filter((a) => SITE_AMENITIES.includes(a)),
    checkIn: str(l.checkIn, 40),
    checkOut: str(l.checkOut, 40),
    rules: str(l.rules, 5000),
  };
}

/** Whether a listing record belongs on the public site. */
export const showsOnSite = (l: Record<string, unknown>) => l.onSite === true && l.archived !== true && l.deleted !== true;

/** "Sea View 2BHK" + "a1b2" → "sea-view-2bhk--a1b2" (the id after "--" finds it; the name is for people and search). */
export const listingPath = (l: { id: string; name: string }) => {
  const words = l.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return `${words ? words + "--" : ""}${l.id}`;
};
export const listingIdFromPath = (p: string) => decodeURIComponent(p).split("--").pop() ?? "";

const DAY = 864e5;
const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const dayAdd = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);

/**
 * The nights that are taken for one listing between `from` and `from + days`: every night of a booking that is
 * not cancelled (check-in night included, check-out day free). Only dates leave the server, never who booked.
 */
export function busyNights(bookings: Record<string, unknown>[], listingId: string, from: string, days = 120): string[] {
  const end = dayAdd(from, days);
  const out = new Set<string>();
  for (const b of bookings) {
    if (b.listingId !== listingId || b.status === "cancelled" || b.deleted === true || !isDay(b.start) || !isDay(b.end)) continue;
    for (let d = b.start < from ? from : b.start; d < b.end && d < end; d = dayAdd(d, 1)) out.add(d);
  }
  return [...out].sort();
}

/** True when every night from check-in up to (not including) check-out is free. */
export const datesFree = (busy: string[], start: string, end: string) => {
  if (!isDay(start) || !isDay(end) || end <= start) return false;
  const taken = new Set(busy);
  for (let d = start; d < end; d = dayAdd(d, 1)) if (taken.has(d)) return false;
  return true;
};

export const nightsBetween = (start: string, end: string) => (isDay(start) && isDay(end) && end > start ? Math.round((Date.parse(end) - Date.parse(start)) / DAY) : 0);

const fmt = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** The message a guest sends to the host on WhatsApp. */
export function enquiryText(o: { site: string; listing: string; start?: string; end?: string; guests?: number; name?: string; url?: string }) {
  const n = o.start && o.end ? nightsBetween(o.start, o.end) : 0;
  const lines = [
    `Hi${o.site ? ` ${o.site}` : ""}! I'd like to book ${o.listing}.`,
    n ? `Dates: ${fmt(o.start!)} to ${fmt(o.end!)} (${n} night${n === 1 ? "" : "s"})` : "Dates: flexible, please share what's free",
    o.guests ? `Guests: ${o.guests}` : "",
    o.name ? `Name: ${o.name}` : "",
    o.url ? `(from ${o.url})` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

export const waLink = (number: string, text: string) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
