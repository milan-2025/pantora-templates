import "server-only";
import { getPayloadClient } from "@/lib/cms/queries";

/** Loads a published product for checkout (by slug). */
export async function loadCheckoutProduct(slug: string | null | undefined) {
  if (!slug) return null;
  const payload = await getPayloadClient();
  const res = await payload.find({
    collection: "products",
    where: { slug: { equals: slug }, _status: { equals: "published" } },
    limit: 1,
    depth: 1,
  });
  return res.docs[0] ? { payload, product: res.docs[0] } : null;
}
