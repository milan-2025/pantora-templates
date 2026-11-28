/**
 * Meta Pixel labels for every product, so Events Manager can tell them apart.
 *
 * One Pixel (the ID in Site settings) is used everywhere. Every event carries:
 *   content_ids: [id]          e.g. ["planner"]      → make one custom conversion per product with "content_ids contains planner"
 *   content_name: name         e.g. "Online Wedding Planner"
 *   content_category: category e.g. "weddings"      → or one per category
 * Kept free of server-only imports: it is used by route handlers that write plain HTML.
 */

import { SHOP_CATEGORIES, type CategoryKey } from "./siteLinks";
import { AD_VARIANTS } from "./adVariants";

export type Category = CategoryKey;
export { SHOP_CATEGORIES };

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

const attr = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The <script> tag that loads public/pt-track.js for one product (for pages written as plain HTML). */
export function trackingScript(key: keyof typeof TRACKED | string, opts: { view?: boolean } = {}): string {
  const p = TRACKED[key];
  if (!p) return "";
  const view = opts.view === false ? ' data-view="off"' : "";
  const v = variantsFor(key);
  return `<script src="/pt-track.js" data-id="${attr(p.id)}" data-name="${attr(p.name)}" data-category="${attr(p.category)}"${v ? ` data-variants="${attr(v)}"` : ""}${view} defer></script>`;
}

/** The ad headline versions a product's pages know (lib/adVariants.ts), for pt-track.js's data-variants. */
export function variantsFor(key: string): string {
  const all = (AD_VARIANTS as Record<string, Record<string, unknown>>)[key];
  return all ? Object.keys(all).join(",") : "";
}
