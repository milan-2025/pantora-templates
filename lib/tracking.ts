/**
 * Meta Pixel labels for every product, so Events Manager can tell them apart.
 *
 * One Pixel (the ID in Site settings) is used everywhere. Every event carries:
 *   content_ids: [id]          e.g. ["planner"]      → make one custom conversion per product with "content_ids contains planner"
 *   content_name: name         e.g. "Online Wedding Planner"
 *   content_category: category e.g. "weddings"      → or one per category
 * Kept free of server-only imports: it is used by route handlers that write plain HTML.
 */

export type Category = "weddings" | "self-improvement" | "business" | "hospitality";

export type TrackedProduct = { id: string; name: string; category: Category };

export const TRACKED: Record<string, TrackedProduct> = {
  planner: { id: "planner", name: "Online Wedding Planner", category: "weddings" },
  invites: { id: "invites", name: "Wedding Invite Maker", category: "weddings" },
  photos: { id: "photos", name: "Wedding Photo Sharing", category: "weddings" },
  workout: { id: "workout", name: "Pandora Workout", category: "self-improvement" },
  hostbook: { id: "hostbook", name: "HostBook", category: "hospitality" },
  stays: { id: "stays", name: "Pandora Stays", category: "hospitality" },
  crm: { id: "crm", name: "LeadFlow CRM", category: "business" },
  "crm-real-estate": { id: "crm-real-estate", name: "LeadFlow for Real Estate", category: "business" },
};

/** Shop products (templates) by slug; anything not listed is reported without a category. */
export const SHOP_CATEGORIES: Record<string, Category> = {
  wedding_planner_sheet: "weddings",
  workout_challange: "self-improvement",
};

const attr = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The <script> tag that loads public/pt-track.js for one product (for pages written as plain HTML). */
export function trackingScript(key: keyof typeof TRACKED | string, opts: { view?: boolean } = {}): string {
  const p = TRACKED[key];
  if (!p) return "";
  const view = opts.view === false ? ' data-view="off"' : "";
  return `<script src="/pt-track.js" data-id="${attr(p.id)}" data-name="${attr(p.name)}" data-category="${attr(p.category)}"${view} defer></script>`;
}
