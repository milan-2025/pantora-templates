/* eslint-disable @typescript-eslint/no-explicit-any -- this file cleans untrusted request bodies */
/**
 * Stays: cleaning what admins and hosts send for a property. Pure (no database).
 * Every field is whitelisted per role, so a host can never set prices they must not see, a status, a visibility,
 * the featured flag, another host, or the admin's private notes, whatever they put in the request.
 */
import { AVAILABILITY, OWNERSHIP, VISIBILITIES, type Availability, type Ownership, type Visibility } from "./constants";
import { cleanCoords, cleanMapsUrl, cleanMoney, coordsFromMapsUrl, type PricePair } from "./core";

export type Role = "admin" | "host";

export const str = (v: unknown, max = 200) =>
  String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/[ \t]+/g, " ").trim().slice(0, max);
/** Multi-line text: keeps line breaks, collapses 3+ blank lines. */
export const text = (v: unknown, max = 5000) =>
  String(v ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
export const int = (v: unknown, min = 0, max = 1000): number | null => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
};
/** true / false, or null for "not said". */
export const tri = (v: unknown): boolean | null => (v === true || v === "true" || v === "yes" || v === 1 ? true : v === false || v === "false" || v === "no" || v === 0 ? false : null);
export const bool = (v: unknown) => tri(v) === true;
const oneOf = <T extends string>(list: readonly T[], v: unknown, fb: T): T => (list.includes(v as T) ? (v as T) : fb);
const strList = (v: unknown, maxItems: number, maxLen = 60) => {
  const arr = Array.isArray(v) ? v : String(v ?? "").split(/\n|,/);
  const out: string[] = [];
  for (const x of arr) {
    const s = str(x, maxLen);
    if (s && !out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
};

/** Only https links to an Airbnb listing are kept (any airbnb.* domain, or abnb.me short links). */
export function cleanAirbnbUrl(v: unknown): string {
  const s = str(v, 500);
  if (!s) return "";
  try {
    const u = new URL(s);
    const h = u.hostname.toLowerCase();
    return u.protocol === "https:" && (/(^|\.)airbnb\.[a-z.]{2,7}$/.test(h) || h === "abnb.me" || h.endsWith(".abnb.me")) ? u.toString() : "";
  } catch {
    return "";
  }
}

const cleanPair = (v: any): PricePair => ({ weekday: cleanMoney(v?.weekday), weekend: cleanMoney(v?.weekend) });

export type LocationIn = {
  address: string; society: string; street: string; locality: string; city: string; state: string; pin: string; country: string;
  lat: number | null; lng: number | null; mapsUrl: string;
};

export function cleanLocation(v: any): LocationIn {
  const mapsUrl = cleanMapsUrl(v?.mapsUrl);
  let { lat, lng } = cleanCoords(v?.lat, v?.lng);
  if (lat === null && mapsUrl) {
    const c = coordsFromMapsUrl(mapsUrl);
    if (c) ({ lat, lng } = c);
  }
  return {
    address: text(v?.address, 400),
    society: str(v?.society, 120),
    street: str(v?.street, 160),
    locality: str(v?.locality, 120),
    city: str(v?.city, 80),
    state: str(v?.state, 80),
    pin: String(v?.pin ?? "").replace(/\D/g, "").slice(0, 6),
    country: str(v?.country, 60) || "India",
    lat, lng, mapsUrl,
  };
}

export function cleanRooms(v: any) {
  return {
    bedrooms: int(v?.bedrooms, 0, 50),
    bathrooms: int(v?.bathrooms, 0, 50),
    attachedBathrooms: int(v?.attachedBathrooms, 0, 50),
    beds: int(v?.beds, 0, 100),
    bedConfig: str(v?.bedConfig, 200),
    maxGuests: int(v?.maxGuests, 1, 100),
    livingRoom: tri(v?.livingRoom),
    kitchen: tri(v?.kitchen),
    balconies: int(v?.balconies, 0, 20),
    floor: int(v?.floor, -5, 200),
    totalFloors: int(v?.totalFloors, 0, 200),
    lift: tri(v?.lift),
    parking: int(v?.parking, 0, 50),
    sizeSqft: int(v?.sizeSqft, 0, 1_000_000),
  };
}

export function cleanPolicies(v: any) {
  return {
    checkIn: str(v?.checkIn, 20),
    checkOut: str(v?.checkOut, 20),
    earlyCheckIn: str(v?.earlyCheckIn, 200),
    lateCheckout: str(v?.lateCheckout, 200),
    couples: tri(v?.couples),
    unmarriedCouples: tri(v?.unmarriedCouples),
    familyFriendly: tri(v?.familyFriendly),
    pets: tri(v?.pets),
    smoking: str(v?.smoking, 120),
    alcohol: str(v?.alcohol, 120),
    visitors: str(v?.visitors, 120),
    ageRestriction: str(v?.ageRestriction, 120),
    idRequirements: str(v?.idRequirements, 200),
    rules: text(v?.rules, 2000),
  };
}

/** Fields both roles may send. `amenityKeys` limits amenities to ones that exist. */
function common(b: any, amenityKeys: Set<string>) {
  return {
    title: str(b.title, 120),
    shortDescription: str(b.shortDescription, 300),
    description: text(b.description, 6000),
    propertyType: str(b.propertyType, 40),
    category: str(b.category, 40),
    location: cleanLocation(b.location),
    rooms: cleanRooms(b.rooms),
    amenities: (Array.isArray(b.amenities) ? b.amenities : []).map((x: unknown) => String(x)).filter((k: string, i: number, a: string[]) => amenityKeys.has(k) && a.indexOf(k) === i).slice(0, 200),
    features: strList(b.features, 30, 60),
    policies: cleanPolicies(b.policies),
  };
}

export type AdminInput = ReturnType<typeof common> & {
  ownership: Ownership; hostId: string; visibility: Visibility; availability: Availability; featured: boolean; showPrice: boolean;
  pricing: { landing: PricePair; listing: PricePair }; airbnbUrl: string; adminNotes: string; ownerName: string; showSociety: boolean;
};
export type HostInput = ReturnType<typeof common> & { landing: PricePair; airbnbUrl: string; hostNotes: string };

export function cleanAdminInput(b: any, amenityKeys: Set<string>): AdminInput {
  b = b && typeof b === "object" ? b : {};
  return {
    ...common(b, amenityKeys),
    ownership: oneOf(OWNERSHIP, b.ownership, "own"),
    hostId: str(b.hostId, 40),
    visibility: oneOf(VISIBILITIES, b.visibility, "public"),
    availability: oneOf(AVAILABILITY, b.availability, "available"),
    featured: bool(b.featured),
    showPrice: tri(b.showPrice) ?? true,
    showSociety: tri(b.showSociety) ?? true,
    pricing: { landing: cleanPair(b.pricing?.landing), listing: cleanPair(b.pricing?.listing) },
    airbnbUrl: cleanAirbnbUrl(b.airbnbUrl),
    adminNotes: text(b.adminNotes, 4000),
    ownerName: str(b.ownerName, 120),
  };
}

export function cleanHostInput(b: any, amenityKeys: Set<string>): HostInput {
  b = b && typeof b === "object" ? b : {};
  return {
    ...common(b, amenityKeys),
    landing: cleanPair(b.landing),
    airbnbUrl: cleanAirbnbUrl(b.airbnbUrl),
    hostNotes: text(b.hostNotes, 2000),
  };
}

/** What must be filled in before a property can be submitted for review or published. */
export function missingForReview(p: { title?: string; location?: { city?: string; locality?: string }; rooms?: { maxGuests?: number | null } }) {
  const m: string[] = [];
  if (!p.title) m.push("title");
  if (!p.location?.city) m.push("city");
  if (!p.location?.locality) m.push("locality");
  if (!p.rooms?.maxGuests) m.push("maximum guests");
  return m;
}

/** Fields whose changes are written to the audit log (dot paths into the stored property). */
export const AUDITED = [
  "pricing.landing.weekday", "pricing.landing.weekend", "pricing.listing.weekday", "pricing.listing.weekend",
  "location.address", "location.society", "location.street", "location.locality", "location.city", "location.pin", "location.lat", "location.lng",
  "hostId", "ownership", "status", "visibility", "showPrice", "featured", "private.airbnbUrl",
];

const get = (o: any, p: string) => p.split(".").reduce((a, k) => (a == null ? undefined : a[k]), o);
/** Field-by-field differences between two versions of a property, limited to audited fields. */
export function auditDiff(before: any, after: any, fields = AUDITED) {
  const out: { field: string; from: unknown; to: unknown }[] = [];
  for (const f of fields) {
    const a = get(before, f) ?? null, b = get(after, f) ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ field: f, from: a, to: b });
  }
  return out;
}
