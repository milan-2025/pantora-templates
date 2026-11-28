/**
 * The site's link map in one place: the four categories, the apps that live outside the admin
 * (planner, invite maker, photos, workout, CRM, HostBook, Stays), and old addresses that now redirect.
 *
 * Used by next.config.ts (redirects), the footer, the homepage "Our products" block, product pages,
 * the sitemap and robots.txt. Keep it free of server-only imports and "@/" paths: next.config.ts imports it.
 */

/** The four areas the site is organised by. Each has its own page (url) and accent colour on the shared plum/cream base. */
export type CategoryKey = "weddings" | "self-improvement" | "business" | "hospitality";

export type Category = {
  key: CategoryKey;
  label: string;
  url: string;
  /** Short line for tiles and the menu. */
  tagline: string;
  /** One or two sentences for the category page and its search description. */
  description: string;
  /** Accent colour (text on light backgrounds passes WCAG AA) and a soft tint for backgrounds. */
  accent: string;
  tint: string;
  /** lucide icon name (see components/ui/FeatureIcon). */
  icon: string;
};

export const CATEGORIES: readonly Category[] = [
  {
    key: "weddings",
    label: "Weddings & Events",
    url: "/weddings",
    tagline: "Plan, invite and remember",
    description: "Plan the wedding with your whole family, send digital invites with RSVPs, share every photo in one link, or start with a planner sheet.",
    accent: "#A23A2F",
    tint: "#F8E1DD",
    icon: "CalendarHeart",
  },
  {
    key: "self-improvement",
    label: "Self-Improvement",
    url: "/self-improvement",
    tagline: "Build habits that stick",
    description: "Workout challenges with a daily plan, streaks and friends to keep you going, and trackers for Excel and Google Sheets.",
    accent: "#2A6E45",
    tint: "#DFF0E4",
    icon: "Dumbbell",
  },
  {
    key: "business",
    label: "Business Software",
    url: "/business",
    tagline: "Follow up every lead",
    description: "Software for small sales teams, builders and brokers: every lead called, every follow-up on time, property inventory and site visits, and reports that show which ads bring buyers.",
    accent: "#3F4BA8",
    tint: "#E3E6F7",
    icon: "Users",
  },
  {
    key: "hospitality",
    label: "Hosts & Hospitality",
    url: "/hospitality",
    tagline: "Run your stays with less work",
    description: "Tools for Airbnb hosts and small hospitality businesses: guest register and check-in, bookings, cleaning and profit, plus holiday homes to book directly.",
    accent: "#94491F",
    tint: "#F7E4D8",
    icon: "House",
  },
];

export const categoryByKey = (key: string | null | undefined): Category | undefined => CATEGORIES.find((c) => c.key === key);

export type LandingPage = {
  /** Stable id, used by the homepage block to pick and order cards. */
  key: "planner" | "invites" | "photos" | "shaadi-pack" | "stays" | "hostbook" | "crm" | "crm-real-estate" | "workout";
  label: string;
  url: string;
  /** One or two sentences for cards and link titles. */
  description: string;
  /** Button text on cards. */
  cta: string;
  /** lucide icon name (see components/ui/FeatureIcon). */
  icon: string;
  category: CategoryKey;
};

/** The apps (software) that live outside the admin, in the order they are shown. */
export const LANDING_PAGES: readonly LandingPage[] = [
  {
    key: "planner",
    label: "Online Wedding Planner",
    url: "/planner",
    description: "Guests and RSVPs, budget, vendors, payments, stay and shagun in one app your whole family can share.",
    cta: "Start free trial",
    icon: "CalendarHeart",
    category: "weddings",
  },
  {
    key: "invites",
    label: "Wedding Invite Maker",
    url: "/shaadi",
    description: "Design a beautiful digital wedding invite with RSVPs, maps and music, and share it on WhatsApp.",
    cta: "Make your invite",
    icon: "Mail",
    category: "weddings",
  },
  {
    key: "photos",
    label: "Wedding Photo Sharing",
    url: "/photos",
    description: "Every wedding photo and video in one private link, with albums per function, a QR code for the venue and guest uploads.",
    cta: "Start free",
    icon: "Image",
    category: "weddings",
  },
  {
    key: "shaadi-pack",
    label: "Shaadi Pack",
    url: "/shaadi-pack",
    description: "The planner, the digital invite and the photo gallery together, for one price: plan it, invite everyone, then share every photo.",
    cta: "See the pack",
    icon: "Gift",
    category: "weddings",
  },
  {
    key: "workout",
    label: "Pandora Workout",
    url: "/workout",
    description: "14 to 100-day workout challenges with a daily plan, guided workouts, streaks, gifts and friends to keep you going.",
    cta: "Start free",
    icon: "Dumbbell",
    category: "self-improvement",
  },
  {
    key: "crm",
    label: "LeadFlow CRM",
    url: "/crm-software",
    description: "Turn Meta ad leads into customers: follow-up reminders, one-tap WhatsApp and team reports.",
    cta: "Try it free",
    icon: "Users",
    category: "business",
  },
  {
    key: "crm-real-estate",
    label: "LeadFlow for Real Estate",
    url: "/real-estate-crm",
    description: "For builders, brokers and channel partners: enquiries, live unit inventory and holds, site visits, project pages and partner logins.",
    cta: "Try it free",
    icon: "Building2",
    category: "business",
  },
  {
    key: "hostbook",
    label: "HostBook",
    url: "/hostbook",
    description: "Your own booking website with WhatsApp enquiries, plus guest register and online check-in, bookings, cleaning and profit for every listing.",
    cta: "Start free",
    icon: "BookOpen",
    category: "hospitality",
  },
  {
    key: "stays",
    label: "Pandora Stays",
    url: "/stays",
    description: "Holiday homes and family stays around Chandigarh, Zirakpur and Panchkula, booked directly with the host.",
    cta: "Find a stay",
    icon: "House",
    category: "hospitality",
  },
];

/** Free calculators: no sign-in, found on Google, each leads to the app in its category. */
export type FreeTool = { key: "wedding-budget" | "airbnb-profit"; label: string; url: string; description: string; cta: string; icon: string; category: CategoryKey };

export const FREE_TOOLS: readonly FreeTool[] = [
  {
    key: "wedding-budget",
    label: "Wedding Budget Calculator",
    url: "/wedding-budget-calculator",
    description: "Pick your city, guest count and functions, and see what an Indian wedding costs, split into venue, food, decor, outfits and more.",
    cta: "Work out my budget",
    icon: "Calculator",
    category: "weddings",
  },
  {
    key: "airbnb-profit",
    label: "Airbnb Profit Calculator",
    url: "/airbnb-profit-calculator",
    description: "Nightly rate, occupancy, platform fees, cleaning, bills and GST in, monthly and yearly profit out, plus the break-even occupancy.",
    cta: "Work out my profit",
    icon: "Calculator",
    category: "hospitality",
  },
];

/** Shop products (templates) whose category is known by their address, for products saved before the Category field existed. */
export const SHOP_CATEGORIES: Readonly<Record<string, CategoryKey>> = {
  wedding_planner_sheet: "weddings",
  workout_challange: "self-improvement",
};

/** A shop product's category: the one picked in the admin, else known by its address, else guessed from its name. */
export function productCategory(p: { slug?: string | null; name?: string | null; category?: string | null }): CategoryKey {
  if (p.category && categoryByKey(p.category)) return p.category as CategoryKey;
  if (p.slug && SHOP_CATEGORIES[p.slug]) return SHOP_CATEGORIES[p.slug];
  const t = `${p.name ?? ""} ${p.slug ?? ""}`;
  if (/workout|fitness|gym|habit|diet|study|journal|reading|self/i.test(t)) return "self-improvement";
  if (/crm|lead|sales|business|invoice|inventory|gst|real.?estate/i.test(t)) return "business";
  if (/airbnb|host|stay|hotel|homestay|guest.?house|rental/i.test(t)) return "hospitality";
  return "weddings";
}

/**
 * Old or mistyped addresses → where they live now (permanent redirects; the query string, e.g. ?ref=CODE, is kept).
 * Only list a source that is not a live page: a redirect wins over a page with the same address.
 */
export const LEGACY_REDIRECTS: readonly { source: string; destination: string }[] = [
  // The wedding planner sheet's sales page moved from /wedding_planner to /wedding_planner_sheet.
  { source: "/wedding_planner", destination: "/wedding_planner_sheet" },
  // The workout page's address is spelt "challange"; send the correct spelling there too.
  { source: "/workout_challenge", destination: "/workout_challange" },
  // The CRM sales page has a clean address.
  { source: "/crm-software.html", destination: "/crm-software" },
  { source: "/real-estate-crm.html", destination: "/real-estate-crm" },
];

/** Product slugs that moved: old checkout links (?product=wedding_planner) still find the product. */
export const PRODUCT_SLUG_ALIASES: Readonly<Record<string, string>> = Object.fromEntries(
  LEGACY_REDIRECTS.filter((r) => /^\/[a-z0-9_-]+$/.test(r.source) && /^\/[a-z0-9_-]+$/.test(r.destination)).map((r) => [
    r.source.slice(1),
    r.destination.slice(1),
  ]),
);

/**
 * Paths search engines should skip: dashboards, APIs, checkout, private share links and the CRM app.
 * Guest invites (/i/…) are not listed: they carry a noindex tag, and WhatsApp/Facebook link previews obey robots.txt.
 */
export const ROBOTS_DISALLOW: readonly string[] = [
  "/admin",
  "/api/",
  "/stays/admin",
  "/stays/host",
  "/stay/s/",
  "/checkout",
  "/success",
  "/CRM",
  "/planner/share/",
];

/** Landing pages that are not in the admin, for the sitemap. */
export const SITEMAP_LANDING_PAGES: readonly { url: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }[] = [
  // The category pages.
  { url: "/weddings", priority: 0.8, changeFrequency: "weekly" },
  { url: "/self-improvement", priority: 0.7, changeFrequency: "weekly" },
  { url: "/business", priority: 0.7, changeFrequency: "weekly" },
  { url: "/hospitality", priority: 0.7, changeFrequency: "weekly" },
  { url: "/planner", priority: 0.9, changeFrequency: "weekly" },
  { url: "/shaadi", priority: 0.8, changeFrequency: "monthly" },
  { url: "/photos", priority: 0.8, changeFrequency: "monthly" },
  { url: "/workout", priority: 0.8, changeFrequency: "weekly" },
  { url: "/crm-software", priority: 0.7, changeFrequency: "monthly" },
  { url: "/real-estate-crm", priority: 0.7, changeFrequency: "monthly" },
  { url: "/hostbook", priority: 0.8, changeFrequency: "monthly" },
  { url: "/shaadi-pack", priority: 0.8, changeFrequency: "monthly" },
  { url: "/wedding-budget-calculator", priority: 0.8, changeFrequency: "monthly" },
  { url: "/airbnb-profit-calculator", priority: 0.8, changeFrequency: "monthly" },
];

/**
 * Pages that are not part of the Next.js app (static HTML or a route handler): /planner, /shaadi, /photos, /workout, the CRM, guest invites.
 * Links to them must be plain <a> tags: Next's <Link> would prefetch them as app pages, and that request never finishes.
 */
export function isStandalonePage(href: string): boolean {
  return /^\/(planner|shaadi|photos|p|workout|crm-software|real-estate-crm|crm|i|property|unit|catalogue)(\/|\?|#|\.|$)/i.test(href);
}

/** Apps in the same category, for "You might also like" on a product's sales page (other categories are one tap away in the menu). */
export function relatedLandingPages(category: CategoryKey): LandingPage[] {
  return LANDING_PAGES.filter((p) => p.category === category);
}
