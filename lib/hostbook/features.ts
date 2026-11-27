/**
 * Pandora HostBook: the features a plan can switch on, the starting plans, and the fields each kind of record keeps.
 * Shared by the server (checks) and the app (lock badges), so it has no server-only imports.
 */

export const FEATURES = [
  { key: "checkin", label: "Online guest check-in links", group: "Guests" },
  { key: "ical", label: "Airbnb / Booking.com calendar sync", group: "Bookings" },
  { key: "police", label: "Police guest register", group: "Compliance" },
  { key: "tasks", label: "Regular tasks & reminders", group: "Running" },
  { key: "whatsapp", label: "WhatsApp message templates", group: "Guests" },
  { key: "receipts", label: "Receipt photos on expenses", group: "Money" },
  { key: "cleaning", label: "Cleaning checklists after checkout", group: "Running" },
  { key: "guestFlags", label: "Guest flags, ratings & do-not-host list", group: "Guests" },
  { key: "reports", label: "Profit & loss reports and charts", group: "Money" },
  { key: "export", label: "Excel (CSV) export", group: "Money" },
  { key: "recurring", label: "Repeating expenses (rent, EMI, internet)", group: "Money" },
  { key: "formC", label: "Form C helper for foreign guests", group: "Compliance" },
  { key: "inventory", label: "Stock list with low-stock alerts", group: "Running" },
  { key: "maintenance", label: "Maintenance log", group: "Running" },
  { key: "meters", label: "Electricity meter readings", group: "Running" },
  { key: "deposits", label: "Security deposits & damage log", group: "Guests" },
  { key: "guidebook", label: "Digital guidebook for guests", group: "Guests" },
  { key: "owners", label: "Owner statements (for property managers)", group: "Money" },
  { key: "gst", label: "GST summary", group: "Money" },
  { key: "branding", label: "Own logo on guest pages", group: "Guests" },
] as const;

export type FeatureKey = (typeof FEATURES)[number]["key"];
export const FEATURE_KEYS = FEATURES.map((f) => f.key) as FeatureKey[];
export const FEATURE_LABEL = Object.fromEntries(FEATURES.map((f) => [f.key, f.label])) as Record<FeatureKey, string>;
export const isFeature = (k: unknown): k is FeatureKey => typeof k === "string" && (FEATURE_KEYS as string[]).includes(k);

const FREE: FeatureKey[] = ["checkin", "ical", "police", "tasks"];
const STARTER: FeatureKey[] = [...FREE, "whatsapp", "receipts", "cleaning", "guestFlags", "reports", "export", "recurring"];
const PRO: FeatureKey[] = [...STARTER, "formC", "inventory", "maintenance", "meters", "deposits", "guidebook"];
const BUSINESS: FeatureKey[] = [...FEATURE_KEYS];

/** Created in /admin the first time HostBook runs. After that, admin is the only source of truth. */
export const DEFAULT_HOSTBOOK_PLANS = [
  { planId: "free", name: "Free", sortOrder: 1, isFree: true, active: true, price: 0, listings: 1, staff: 1, idDays: 30, hostChoosesIdDays: false, features: FREE.map((f) => f), tagline: "For one home", badge: "" },
  { planId: "starter", name: "Starter", sortOrder: 2, isFree: false, active: true, price: 999, listings: 3, staff: 2, idDays: 180, hostChoosesIdDays: false, features: STARTER.map((f) => f), tagline: "For a few listings", badge: "" },
  { planId: "pro", name: "Pro", sortOrder: 3, isFree: false, active: true, price: 2499, listings: 8, staff: 5, idDays: 365, hostChoosesIdDays: false, features: PRO.map((f) => f), tagline: "For busy hosts", badge: "Most popular" },
  { planId: "business", name: "Business", sortOrder: 4, isFree: false, active: true, price: 5999, listings: 25, staff: 15, idDays: 365, hostChoosesIdDays: true, features: BUSINESS.map((f) => f), tagline: "For property managers", badge: "" },
];

/* ---------- records ---------- */

/** Field types the server accepts. Anything not listed for a kind is dropped. */
export type FieldType = "text" | "long" | "num" | "bool" | "date" | "ref" | "list" | "json" | "phone";

export const EXPENSE_CATEGORIES = ["Cleaning", "Laundry", "Electricity", "Water", "Gas", "Internet", "Rent / EMI", "Maintenance & repairs", "Supplies & toiletries", "Staff salary", "Platform fees", "Furniture & appliances", "Marketing", "Taxes & fees", "Other"];
export const BOOKING_SOURCES = ["Airbnb", "Booking.com", "MakeMyTrip", "Agoda", "Direct", "Walk-in", "Other"];
export const ID_TYPES = ["Aadhaar", "Passport", "Driving licence", "Voter ID", "PAN", "Other"];
export const PAY_METHODS = ["UPI", "Cash", "Bank transfer", "Card", "Platform payout", "Other"];

export const KINDS = {
  listing: {
    feature: null,
    fields: {
      name: "text", address: "long", city: "text", mapUrl: "text", rules: "long", wifiName: "text", wifiPass: "text", checkIn: "text", checkOut: "text",
      cleaningFee: "num", guidebook: "long", ical: "json", checklist: "list", ownerId: "ref", commission: "num", archived: "bool", color: "text", gstin: "text", gstRate: "num",
    },
  },
  booking: {
    feature: null,
    fields: {
      listingId: "ref", start: "date", end: "date", status: "text", source: "text", guestId: "ref", guestIds: "list", guestName: "text", phone: "phone",
      adults: "num", children: "num", payout: "num", platformFee: "num", cleaningFee: "num", taxes: "num", gross: "num", deposit: "num", depositStatus: "text",
      depositBack: "num", notes: "long", icalUid: "text", icalFeed: "text", checkinCode: "text", checkinStatus: "text", rating: "num", reviewAsked: "bool",
    },
  },
  guest: {
    feature: null,
    fields: {
      name: "text", phone: "phone", phone2: "phone", email: "text", address: "long", city: "text", nationality: "text", idType: "text", idNumber: "text",
      flag: "text", rating: "num", notes: "long", gender: "text", age: "num",
      passport: "text", passportIssued: "date", passportExpiry: "date", visa: "text", visaType: "text", visaExpiry: "date", arrivedFrom: "text", nextDestination: "text", arrivalInIndia: "date",
    },
  },
  expense: { feature: null, fields: { date: "date", listingId: "ref", category: "text", amount: "num", method: "text", note: "long", recurringId: "ref", vendor: "text" } },
  income: { feature: null, fields: { date: "date", listingId: "ref", amount: "num", source: "text", note: "long" } },
  recurring: { feature: "recurring", fields: { listingId: "ref", category: "text", amount: "num", day: "num", note: "text", active: "bool", lastMonth: "text" } },
  task: { feature: "tasks", fields: { listingId: "ref", title: "text", every: "num", unit: "text", due: "date", assignee: "text", notes: "long", active: "bool" } },
  taskrun: { feature: "tasks", fields: { taskId: "ref", listingId: "ref", date: "date", due: "date", by: "text", note: "long", status: "text" } },
  clean: { feature: "cleaning", fields: { bookingId: "ref", listingId: "ref", date: "date", items: "json", doneAt: "text", by: "text", note: "long" } },
  inventory: { feature: "inventory", fields: { listingId: "ref", name: "text", qty: "num", min: "num", unit: "text" } },
  maint: { feature: "maintenance", fields: { listingId: "ref", date: "date", title: "text", cost: "num", vendor: "text", note: "long", status: "text" } },
  meter: { feature: "meters", fields: { listingId: "ref", date: "date", reading: "num", note: "text" } },
  damage: { feature: "deposits", fields: { bookingId: "ref", guestId: "ref", listingId: "ref", date: "date", note: "long", cost: "num", recovered: "num" } },
  owner: { feature: "owners", fields: { name: "text", phone: "phone", email: "text", commission: "num", notes: "long" } },
  template: { feature: "whatsapp", fields: { name: "text", body: "long" } },
  /** In-app notifications. Written only by the server (never through the records API). */
  notice: { feature: null, fields: {} },
} as const satisfies Record<string, { feature: FeatureKey | null; fields: Record<string, FieldType> }>;

export type Kind = keyof typeof KINDS;
export const isKind = (k: unknown): k is Kind => typeof k === "string" && Object.prototype.hasOwnProperty.call(KINDS, k);

/** Fields that need a feature on top of their kind's own. */
export const FIELD_FEATURES: Partial<Record<Kind, Record<string, FeatureKey>>> = {
  guest: { flag: "guestFlags", rating: "guestFlags" },
  booking: { deposit: "deposits", depositStatus: "deposits", depositBack: "deposits", rating: "guestFlags" },
  listing: { guidebook: "guidebook", ical: "ical", checklist: "cleaning", ownerId: "owners", commission: "owners", gstin: "gst", gstRate: "gst" },
};

/** Who may do what. Owners can do everything; staff get the ticked permissions only. */
export const STAFF_PERMS = [
  { key: "bookings", label: "See and edit bookings & calendar" },
  { key: "guests", label: "See guest details" },
  { key: "ids", label: "See guest ID photos and numbers" },
  { key: "tasks", label: "Do tasks and cleaning checklists" },
  { key: "expenses", label: "Add expenses" },
  { key: "money", label: "See income, reports and totals" },
] as const;
export type StaffPerm = (typeof STAFF_PERMS)[number]["key"];

/** Which permission a staff member needs to read / write each kind. */
export const KIND_PERM: Record<Kind, StaffPerm | "owner"> = {
  listing: "bookings", booking: "bookings", guest: "guests", expense: "expenses", income: "money", recurring: "money", task: "tasks", taskrun: "tasks",
  clean: "tasks", inventory: "tasks", maint: "tasks", meter: "tasks", damage: "bookings", owner: "owner", template: "bookings", notice: "bookings",
};

export const DEFAULT_TEMPLATES = [
  { name: "Booking confirmed", body: "Hi {guest}! Your stay at {listing} is confirmed for {checkin} to {checkout}. We'll share check-in details a day before. – {host}" },
  { name: "Check-in details", body: "Hi {guest}, welcome! Check-in at {listing} is from {checkinTime}.\nAddress: {address}\nWi-Fi: {wifi} / {wifiPass}\nPlease fill your guest details here: {checkinLink}" },
  { name: "Checkout reminder", body: "Hi {guest}, hope you enjoyed your stay! A gentle reminder that checkout is at {checkoutTime} tomorrow. Safe travels!" },
  { name: "Review request", body: "Hi {guest}, thank you for staying at {listing}! If you enjoyed it, a review would mean a lot to us. 🙏" },
];
