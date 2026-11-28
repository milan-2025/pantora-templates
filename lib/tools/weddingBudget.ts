/**
 * Wedding budget calculator: rough costs for an Indian wedding from a few answers. Pure functions (no React),
 * used by /wedding-budget-calculator and its tests. Prices are typical 2025–26 figures in ₹; real quotes vary.
 */

export type CityTier = "metro" | "tier2" | "small";
export type Style = "simple" | "mid" | "grand" | "luxury";
export type FunctionKey = "roka" | "haldi" | "mehendi" | "sangeet" | "wedding" | "reception";

export const CITY_TIERS: { key: CityTier; label: string; hint: string }[] = [
  { key: "metro", label: "Metro city", hint: "Delhi NCR, Mumbai, Bengaluru, Hyderabad, Chennai, Pune" },
  { key: "tier2", label: "Big city", hint: "Chandigarh, Jaipur, Lucknow, Ahmedabad, Indore, Ludhiana" },
  { key: "small", label: "Smaller town", hint: "Home town, district town" },
];

export const STYLES: { key: Style; label: string; hint: string }[] = [
  { key: "simple", label: "Simple", hint: "Banquet hall or home, simple decor" },
  { key: "mid", label: "Mid-range", hint: "Good banquet or lawn, themed decor" },
  { key: "grand", label: "Grand", hint: "Hotel or farmhouse, big decor, live counters" },
  { key: "luxury", label: "Luxury", hint: "5-star or palace, designer everything" },
];

/** Each function, and the share of the guest list that usually comes to it. */
export const FUNCTIONS: { key: FunctionKey; label: string; share: number; main?: boolean }[] = [
  { key: "roka", label: "Roka / Engagement", share: 0.35 },
  { key: "haldi", label: "Haldi", share: 0.35 },
  { key: "mehendi", label: "Mehendi", share: 0.45 },
  { key: "sangeet", label: "Sangeet", share: 0.7 },
  { key: "wedding", label: "Wedding (Phere)", share: 1, main: true },
  { key: "reception", label: "Reception", share: 0.9 },
];

const S = (simple: number, mid: number, grand: number, luxury: number): Record<Style, number> => ({ simple, mid, grand, luxury });

/** Venue + catering per plate, by city. */
const PLATE: Record<CityTier, Record<Style, number>> = {
  metro: S(1300, 2100, 3300, 5500),
  tier2: S(850, 1400, 2300, 3800),
  small: S(550, 950, 1600, 2800),
};
/** Most other costs move with the city. */
const CITY: Record<CityTier, number> = { metro: 1.25, tier2: 1, small: 0.8 };

const DECOR_MAIN = S(50_000, 1_50_000, 3_50_000, 8_00_000); // decor for the wedding itself; smaller functions get less
const PHOTO = S(60_000, 1_50_000, 3_00_000, 6_00_000); // photo + video for a 2–3 function wedding
const OUTFITS = S(1_00_000, 2_50_000, 6_00_000, 15_00_000); // couple's outfits + jewellery, close family
const MAKEUP = S(30_000, 75_000, 1_50_000, 3_00_000); // bridal makeup, mehendi artist
const MUSIC = S(25_000, 75_000, 2_00_000, 5_00_000); // DJ, dhol, band, choreographer
const PER_GUEST_GIFTS = S(60, 180, 400, 900); // invites, favours, shagun envelopes, welcome kits
const ROOM = S(2_500, 4_500, 8_000, 15_000); // per room per night, in a big city
const TRANSPORT = S(20_000, 50_000, 1_20_000, 3_00_000); // baraat, ghodi, cars, guest pickups
const RITUALS = S(15_000, 30_000, 50_000, 1_00_000); // pandit, puja samagri, mandap items

export type BudgetInput = {
  city: CityTier;
  style: Style;
  guests: number;
  functions: FunctionKey[];
  /** % of guests from out of town who need a room. */
  outstation: number;
  /** Nights the out-of-town guests stay. */
  nights: number;
};

export type BudgetLine = { key: string; label: string; amount: number; note: string };

export const DEFAULT_INPUT: BudgetInput = { city: "tier2", style: "mid", guests: 300, functions: ["haldi", "mehendi", "sangeet", "wedding"], outstation: 20, nights: 2 };

const round = (n: number, to = 1000) => Math.round(n / to) * to;

export function estimateBudget(raw: BudgetInput) {
  const guests = Math.max(10, Math.min(5000, Math.round(raw.guests || 0)));
  const fns = FUNCTIONS.filter((f) => raw.functions.includes(f.key));
  const list = fns.length ? fns : FUNCTIONS.filter((f) => f.main);
  const { city, style } = raw;
  const c = CITY[city];
  const extraFns = list.filter((f) => !f.main).length;

  const plates = list.reduce((n, f) => n + Math.round(guests * f.share), 0);
  // Smaller functions cost a bit less per plate (simpler menus).
  const food = list.reduce((n, f) => n + Math.round(guests * f.share) * PLATE[city][style] * (f.main || f.key === "reception" || f.key === "sangeet" ? 1 : 0.7), 0);
  const decor = list.reduce((n, f) => n + DECOR_MAIN[style] * c * (f.main ? 1 : f.key === "reception" || f.key === "sangeet" ? 0.6 : 0.3), 0);
  const photo = PHOTO[style] * c * (0.7 + 0.12 * list.length);
  const outfits = OUTFITS[style] * (0.85 + 0.05 * list.length);
  const makeup = MAKEUP[style] * c * (0.8 + 0.1 * list.length);
  const music = MUSIC[style] * c * (list.some((f) => f.key === "sangeet") ? 1 : 0.5) * (0.8 + 0.1 * extraFns);
  const gifts = PER_GUEST_GIFTS[style] * guests;
  const rooms = Math.ceil((guests * Math.min(100, Math.max(0, raw.outstation))) / 100 / 2.5);
  const stay = rooms * Math.max(0, Math.min(7, Math.round(raw.nights))) * ROOM[style] * c;
  const transport = TRANSPORT[style] * c;
  const rituals = RITUALS[style];

  const lines: BudgetLine[] = [
    { key: "food", label: "Venue & catering", amount: food, note: `${plates.toLocaleString("en-IN")} plates across ${list.length} function${list.length > 1 ? "s" : ""}` },
    { key: "decor", label: "Decor & flowers", amount: decor, note: "Mandap, stage, entrance, lighting" },
    { key: "outfits", label: "Outfits & jewellery", amount: outfits, note: "The couple and close family" },
    { key: "photo", label: "Photography & video", amount: photo, note: "Photos, film, reels, album" },
    { key: "stay", label: "Guest stay", amount: stay, note: rooms ? `${rooms} room${rooms > 1 ? "s" : ""} × ${raw.nights} night${raw.nights === 1 ? "" : "s"}` : "No out-of-town guests" },
    { key: "music", label: "Music & entertainment", amount: music, note: "DJ, dhol, band, choreographer" },
    { key: "makeup", label: "Makeup & mehendi", amount: makeup, note: "Bridal makeup, family, mehendi artist" },
    { key: "gifts", label: "Invites, favours & gifts", amount: gifts, note: "Cards, welcome kits, return gifts" },
    { key: "transport", label: "Baraat & transport", amount: transport, note: "Ghodi, cars, pickups" },
    { key: "rituals", label: "Pandit & rituals", amount: rituals, note: "Puja samagri, mandap items" },
  ].map((l) => ({ ...l, amount: round(l.amount) }));

  const subtotal = lines.reduce((n, l) => n + l.amount, 0);
  const buffer = round(subtotal * 0.1);
  lines.push({ key: "buffer", label: "Buffer for surprises", amount: buffer, note: "10%: last-minute guests, tips, overtime" });
  const total = subtotal + buffer;
  return {
    lines,
    total,
    low: round(total * 0.85, 10_000),
    high: round(total * 1.15, 10_000),
    perGuest: Math.round(total / guests),
    plates,
    guests,
  };
}

/** "₹12.4 lakh", "₹1.2 crore", "₹85,000". */
export function lakh(n: number) {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(n >= 10_00_00_000 ? 1 : 2).replace(/\.?0+$/, "")} crore`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(n >= 10_00_000 ? 1 : 2).replace(/\.?0+$/, "")} lakh`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
