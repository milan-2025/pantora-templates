/**
 * Stays: searching, filtering and sorting property cards. Pure, works on guest-safe cards only
 * (so a search can never reveal anything a card doesn't show).
 *
 * Price filters and price sorting only use prices the guest is allowed to see: a property with hidden prices is
 * left out of results when a price range is set, and sorted last by price, so the filter can't be used to guess it.
 */
import type { PublicCard } from "./views";

export type SearchQuery = {
  q?: string; city?: string; locality?: string; type?: string; category?: string;
  guests?: number; bedrooms?: number; bathrooms?: number; beds?: number;
  minPrice?: number; maxPrice?: number; priceBasis?: "from" | "weekday" | "weekend";
  amenities?: string[]; features?: string[]; featured?: boolean;
  bbox?: [number, number, number, number]; // south, west, north, east
  sort?: "recommended" | "price_asc" | "price_desc" | "newest" | "updated" | "bedrooms" | "guests";
  page?: number; perPage?: number;
};

const n = (v: unknown) => {
  const x = Number(v);
  return v === "" || v === null || v === undefined || !Number.isFinite(x) ? undefined : x;
};
const list = (v: unknown) => (Array.isArray(v) ? v : String(v ?? "").split(",")).map((s) => String(s).trim()).filter(Boolean).slice(0, 30);

/** Turns URL search params (or a JSON body) into a clean query. */
export function parseQuery(src: URLSearchParams | Record<string, unknown>): SearchQuery {
  const g = (k: string) => (src instanceof URLSearchParams ? src.get(k) ?? undefined : (src as Record<string, unknown>)[k]);
  const s = (k: string) => String(g(k) ?? "").trim().slice(0, 80) || undefined;
  const bb = list(g("bbox")).map(Number);
  const sorts = ["recommended", "price_asc", "price_desc", "newest", "updated", "bedrooms", "guests"];
  const basis = ["from", "weekday", "weekend"];
  return {
    q: s("q"), city: s("city"), locality: s("locality"), type: s("type"), category: s("category"),
    guests: n(g("guests")), bedrooms: n(g("bedrooms")), bathrooms: n(g("bathrooms")), beds: n(g("beds")),
    minPrice: n(g("minPrice")), maxPrice: n(g("maxPrice")),
    priceBasis: basis.includes(String(g("priceBasis"))) ? (String(g("priceBasis")) as SearchQuery["priceBasis"]) : "from",
    amenities: list(g("amenities")), features: list(g("features")),
    featured: g("featured") === "1" || g("featured") === "true" || g("featured") === true,
    bbox: bb.length === 4 && bb.every(Number.isFinite) ? (bb as SearchQuery["bbox"]) : undefined,
    sort: sorts.includes(String(g("sort"))) ? (String(g("sort")) as SearchQuery["sort"]) : "recommended",
    page: Math.max(1, Math.floor(n(g("page")) || 1)),
    perPage: Math.min(60, Math.max(1, Math.floor(n(g("perPage")) || 24))),
  };
}

const norm = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
const has = (hay: unknown, needle: string) => norm(hay).includes(norm(needle));

export const priceOf = (c: PublicCard, basis: SearchQuery["priceBasis"] = "from") =>
  !c.price ? null : basis === "weekday" ? c.price.weekday : basis === "weekend" ? c.price.weekend : c.price.from;

/** Does this card match? (Everything combined with AND.) */
export function matches(c: PublicCard, q: SearchQuery): boolean {
  if (q.q) {
    const words = norm(q.q).split(/\s+/).filter(Boolean);
    const hay = norm([c.title, c.code, c.place, c.propertyType, c.category, c.shortDescription, ...(c.allFeatures || [])].join(" "));
    if (!words.every((w) => hay.includes(w))) return false;
  }
  if (q.city && !has(c.city, q.city)) return false;
  if (q.locality && !(has(c.locality, q.locality) || has(c.society, q.locality))) return false;
  if (q.type) {
    const t = norm(q.type);
    // "4BHK+" also matches 5BHK, 6BHK … and any property with 4+ bedrooms
    if (t === "4bhk+") { if (!((c.bedrooms ?? 0) >= 4 || /^[4-9]\d*bhk/.test(norm(c.propertyType)))) return false; }
    else if (norm(c.propertyType) !== t) return false;
  }
  if (q.category && norm(c.category) !== norm(q.category)) return false;
  if (q.guests && (c.maxGuests ?? 0) < q.guests) return false;
  if (q.bedrooms && (c.bedrooms ?? 0) < q.bedrooms) return false;
  if (q.bathrooms && (c.bathrooms ?? 0) < q.bathrooms) return false;
  if (q.beds && (c.beds ?? 0) < q.beds) return false;
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    const p = priceOf(c, q.priceBasis);
    if (p === null || p === undefined) return false;
    if (q.minPrice !== undefined && p < q.minPrice) return false;
    if (q.maxPrice !== undefined && p > q.maxPrice) return false;
  }
  if (q.amenities?.length && !q.amenities.every((a) => c.amenities.includes(a))) return false;
  if (q.features?.length && !q.features.every((f) => c.allFeatures.some((x) => norm(x) === norm(f)))) return false;
  if (q.featured && !c.featured) return false;
  if (q.bbox) {
    if (!c.approx) return false;
    const [s, w, nn, e] = q.bbox;
    if (c.approx.lat < s || c.approx.lat > nn || c.approx.lng < w || c.approx.lng > e) return false;
  }
  return true;
}

export function sortCards(cards: PublicCard[], sort: SearchQuery["sort"], basis: SearchQuery["priceBasis"] = "from") {
  const byPrice = (dir: 1 | -1) => (a: PublicCard, b: PublicCard) => {
    const x = priceOf(a, basis), y = priceOf(b, basis);
    if (x === null && y === null) return 0;
    if (x === null) return 1; // hidden or missing prices always last
    if (y === null) return -1;
    return (x - y) * dir;
  };
  const cmp: Record<string, (a: PublicCard, b: PublicCard) => number> = {
    price_asc: byPrice(1),
    price_desc: byPrice(-1),
    newest: (a, b) => b.createdAt - a.createdAt,
    updated: (a, b) => b.updatedAt - a.updatedAt,
    bedrooms: (a, b) => (b.bedrooms ?? 0) - (a.bedrooms ?? 0),
    guests: (a, b) => (b.maxGuests ?? 0) - (a.maxGuests ?? 0),
    recommended: (a, b) =>
      Number(b.featured) - Number(a.featured) ||
      Number(a.availability === "unavailable") - Number(b.availability === "unavailable") ||
      Number(!!b.cover) - Number(!!a.cover) ||
      b.updatedAt - a.updatedAt,
  };
  return [...cards].sort((a, b) => cmp[sort || "recommended"](a, b) || a.code.localeCompare(b.code));
}

export function search(cards: PublicCard[], q: SearchQuery) {
  const all = sortCards(cards.filter((c) => matches(c, q)), q.sort, q.priceBasis);
  const per = q.perPage || 24, page = q.page || 1;
  return { total: all.length, page, perPage: per, pages: Math.max(1, Math.ceil(all.length / per)), results: all.slice((page - 1) * per, page * per) };
}

/** Suggestions for the search box: cities, localities/societies and property types that start with or contain the text. */
export function suggest(cards: PublicCard[], text: string, limit = 8) {
  const t = norm(text).trim();
  if (t.length < 2) return [];
  const seen = new Map<string, { label: string; kind: "city" | "locality" | "type"; count: number }>();
  const add = (label: string, kind: "city" | "locality" | "type") => {
    if (!label || !norm(label).includes(t)) return;
    const k = kind + ":" + norm(label);
    const cur = seen.get(k);
    if (cur) cur.count++; else seen.set(k, { label, kind, count: 1 });
  };
  for (const c of cards) { add(c.city, "city"); add(c.locality, "locality"); add(c.society, "locality"); add(c.propertyType, "type"); }
  return [...seen.values()].sort((a, b) => Number(norm(b.label).startsWith(t)) - Number(norm(a.label).startsWith(t)) || b.count - a.count).slice(0, limit);
}

/** City → number of listed properties, most first (for "Popular destinations"). */
export function destinations(cards: PublicCard[], limit = 8) {
  const m = new Map<string, { city: string; count: number; cover: PublicCard["cover"] }>();
  for (const c of cards) {
    if (!c.city) continue;
    const k = norm(c.city);
    const cur = m.get(k);
    if (cur) { cur.count++; if (!cur.cover && c.cover) cur.cover = c.cover; } else m.set(k, { city: c.city, count: 1, cover: c.cover });
  }
  return [...m.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}
