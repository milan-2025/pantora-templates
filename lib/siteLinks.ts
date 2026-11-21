/**
 * The site's link map in one place: the stand-alone landing pages that live outside the admin
 * (planner, invite maker, stays, CRM), and old addresses that now redirect.
 *
 * Used by next.config.ts (redirects), the footer, the homepage "Our products" block, product pages,
 * the sitemap and robots.txt. Keep it free of server-only imports and "@/" paths: next.config.ts imports it.
 */

export type LandingPage = {
  /** Stable id, used by the homepage block to pick and order cards. */
  key: "planner" | "invites" | "stays" | "crm" | "workout";
  label: string;
  url: string;
  /** One or two sentences for cards and link titles. */
  description: string;
  /** Button text on cards. */
  cta: string;
  /** lucide icon name (see components/ui/FeatureIcon). */
  icon: string;
  /** Wedding pages link to each other; the rest stand alone. */
  topic: "wedding" | "travel" | "business" | "fitness";
};

export const LANDING_PAGES: readonly LandingPage[] = [
  {
    key: "planner",
    label: "Online Wedding Planner",
    url: "/planner",
    description: "Guests and RSVPs, budget, vendors, payments, stay and shagun in one app your whole family can share.",
    cta: "Start free trial",
    icon: "CalendarHeart",
    topic: "wedding",
  },
  {
    key: "invites",
    label: "Wedding Invite Maker",
    url: "/shaadi",
    description: "Design a beautiful digital wedding invite with RSVPs, maps and music, and share it on WhatsApp.",
    cta: "Make your invite",
    icon: "Mail",
    topic: "wedding",
  },
  {
    key: "stays",
    label: "Pandora Stays",
    url: "/stays",
    description: "Holiday homes and family stays around Chandigarh, Zirakpur and Panchkula, booked directly with the host.",
    cta: "Find a stay",
    icon: "House",
    topic: "travel",
  },
  {
    key: "crm",
    label: "LeadFlow CRM",
    url: "/crm-software",
    description: "Turn Meta ad leads into customers: follow-up reminders, one-tap WhatsApp and team reports.",
    cta: "Try it free",
    icon: "Users",
    topic: "business",
  },
  {
    key: "workout",
    label: "Pandora Workout",
    url: "/workout",
    description: "14 to 100-day workout challenges with a daily plan, guided workouts, streaks, gifts and friends to keep you going.",
    cta: "Start free",
    icon: "Dumbbell",
    topic: "fitness",
  },
];

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
  { url: "/planner", priority: 0.9, changeFrequency: "weekly" },
  { url: "/shaadi", priority: 0.8, changeFrequency: "monthly" },
  { url: "/workout", priority: 0.8, changeFrequency: "weekly" },
  { url: "/crm-software", priority: 0.6, changeFrequency: "monthly" },
];

/**
 * Pages that are not part of the Next.js app (static HTML or a route handler): /planner, /shaadi, the CRM, guest invites.
 * Links to them must be plain <a> tags: Next's <Link> would prefetch them as app pages, and that request never finishes.
 */
export function isStandalonePage(href: string): boolean {
  return /^\/(planner|shaadi|crm-software|crm|i|property|unit|catalogue)(\/|\?|#|\.|$)/i.test(href);
}

/** Same-topic links for "You might also like" on a product's sales page. */
export function relatedLandingPages(productText: string): LandingPage[] {
  const wedding = /wedding|shaadi|marriage|bride|groom|shagun/i.test(productText);
  return wedding ? LANDING_PAGES.filter((p) => p.topic === "wedding") : LANDING_PAGES.filter((p) => p.key === "planner" || p.key === "stays");
}
