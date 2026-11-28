/**
 * Airbnb / homestay profit calculator. Pure functions (no React), used by /airbnb-profit-calculator and its tests.
 * All amounts in ₹ per month unless named otherwise.
 */

export type ProfitInput = {
  /** Average nightly rate the guest pays (before the platform's guest fee). */
  rate: number;
  /** % of nights booked. */
  occupancy: number;
  /** Average nights per booking (sets how many cleanings there are). */
  avgStay: number;
  /** Platform commission taken from the host, in %. */
  platformFee: number;
  /** % of bookings that come direct (WhatsApp, own website): no platform fee on those. */
  directShare: number;
  /** The rate includes GST, which the host pays to the government (registered hosts). */
  gstIncluded: boolean;
  // Per booking
  cleaning: number;
  laundry: number;
  // Per guest night
  supplies: number;
  // Monthly fixed
  rent: number;
  electricity: number;
  internet: number;
  staff: number;
  society: number;
  other: number;
  /** % of revenue set aside for repairs and replacing things. */
  maintenance: number;
  /** One-time cost to furnish and set up, for the payback time. */
  setup: number;
};

export const DEFAULT_PROFIT: ProfitInput = {
  rate: 3500,
  occupancy: 55,
  avgStay: 2,
  platformFee: 15,
  directShare: 20,
  gstIncluded: false,
  cleaning: 500,
  laundry: 300,
  supplies: 120,
  rent: 18000,
  electricity: 5000,
  internet: 1200,
  staff: 8000,
  society: 2500,
  other: 1500,
  maintenance: 3,
  setup: 400000,
};

/** Platform presets for the fee field. */
export const PLATFORMS = [
  { label: "Airbnb (host-only fee)", fee: 15 },
  { label: "Airbnb (split fee)", fee: 3 },
  { label: "Booking.com", fee: 15 },
  { label: "MakeMyTrip / Goibibo", fee: 20 },
  { label: "Direct only", fee: 0 },
];

/** GST on a room night in India from 22 Sep 2025: nil up to ₹1,000, 5% up to ₹7,500, 18% above. */
export function gstRate(rate: number) {
  if (rate <= 1000) return 0;
  if (rate <= 7500) return 5;
  return 18;
}

const DAYS = 30.4;
const num = (n: unknown, min = 0, max = 1e9) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : min;
};

export function profit(raw: ProfitInput) {
  const rate = num(raw.rate, 0, 1e6);
  const occupancy = num(raw.occupancy, 0, 100);
  const avgStay = num(raw.avgStay, 1, 60);
  const nights = (DAYS * occupancy) / 100;
  const bookings = nights / avgStay;
  const gross = nights * rate;
  const gstPct = raw.gstIncluded ? gstRate(rate) : 0;
  const gst = gross - gross / (1 + gstPct / 100);
  const viaPlatform = 1 - num(raw.directShare, 0, 100) / 100;
  const fees = (gross - gst) * viaPlatform * (num(raw.platformFee, 0, 50) / 100);
  const perStay = bookings * (num(raw.cleaning) + num(raw.laundry));
  const supplies = nights * num(raw.supplies);
  const maintenance = (gross - gst) * (num(raw.maintenance, 0, 50) / 100);
  const fixed = num(raw.rent) + num(raw.electricity) + num(raw.internet) + num(raw.staff) + num(raw.society) + num(raw.other);
  const variable = fees + perStay + supplies + maintenance + gst;
  const net = gross - variable - fixed;

  // What one booked night leaves after the costs that come with it; fixed costs ÷ that = nights needed.
  const perNight = rate - rate * (1 - 1 / (1 + gstPct / 100)) - (rate / (1 + gstPct / 100)) * (viaPlatform * num(raw.platformFee, 0, 50) / 100 + num(raw.maintenance, 0, 50) / 100) - (num(raw.cleaning) + num(raw.laundry)) / avgStay - num(raw.supplies);
  const breakEvenNights = perNight > 0 ? fixed / perNight : Infinity;
  const breakEven = perNight > 0 ? (breakEvenNights / DAYS) * 100 : Infinity;
  const setup = num(raw.setup);

  return {
    nights,
    bookings,
    gross,
    gstPct,
    lines: [
      { key: "fees", label: "Platform fees", amount: fees },
      { key: "gst", label: "GST", amount: gst },
      { key: "perStay", label: "Cleaning & laundry", amount: perStay },
      { key: "supplies", label: "Toiletries & supplies", amount: supplies },
      { key: "maintenance", label: "Repairs fund", amount: maintenance },
      { key: "fixed", label: "Rent, bills & staff", amount: fixed },
    ],
    costs: variable + fixed,
    net,
    yearly: net * 12,
    margin: gross > 0 ? (net / gross) * 100 : 0,
    perNight,
    breakEven,
    paybackMonths: net > 0 && setup > 0 ? setup / net : null,
  };
}

/** Net profit at other occupancy levels, for the "what if" table. */
export function scenarios(raw: ProfitInput, levels = [35, 50, 65, 80]) {
  return levels.map((o) => ({ occupancy: o, net: profit({ ...raw, occupancy: o }).net }));
}

export const inr = (n: number) => (n < 0 ? "−" : "") + "₹" + Math.round(Math.abs(n)).toLocaleString("en-IN");
