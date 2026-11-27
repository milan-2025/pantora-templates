import "server-only";
import type { Payload } from "payload";
import type { Review, ReviewProduct } from "@/lib/reviews";

/** The ticked reviews for one app page (Content → Reviews in the admin). Never throws: no reviews hides the section. */
export async function getReviews(payload: Payload, product: ReviewProduct, limit = 6): Promise<Review[]> {
  try {
    const r = await payload.find({ collection: "reviews" as never, where: { and: [{ product: { equals: product } }, { show: { equals: true } }] } as never, sort: "order", limit, depth: 0, overrideAccess: true });
    return (r.docs as unknown as { name: string; detail?: string | null; quote: string }[]).map((d) => ({ name: d.name, detail: d.detail ?? "", quote: d.quote }));
  } catch {
    return [];
  }
}
