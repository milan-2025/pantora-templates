import "server-only";
import { getPayloadClient } from "@/lib/cms/queries";
import { PRODUCT_SLUG_ALIASES } from "@/lib/siteLinks";

/**
 * Loads a published product for checkout (by slug), with its upsell products and their images.
 * A product whose address moved (e.g. wedding_planner → wedding_planner_sheet) is still found by its old slug.
 */
export async function loadCheckoutProduct(slug: string | null | undefined) {
  if (!slug) return null;
  const payload = await getPayloadClient();
  const slugs = PRODUCT_SLUG_ALIASES[slug] ? [slug, PRODUCT_SLUG_ALIASES[slug]] : [slug];
  const res = await payload.find({
    collection: "products",
    where: { slug: { in: slugs }, _status: { equals: "published" } },
    limit: 1,
    depth: 2,
  });
  return res.docs[0] ? { payload, product: res.docs[0] } : null;
}
