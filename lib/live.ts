import type { Payload } from "payload";
import type { Product } from "@/payload-types";
import { getOfferState, type OfferContext } from "@/lib/pricing";
import type { LiveData } from "@/components/landing/LiveData";

const RECENT_DAYS = 30;

/** Real-time offer numbers + recent real purchases (first name and city only). */
export async function getLiveData(payload: Payload, product: Product, ctx: OfferContext = {}): Promise<LiveData> {
  const offer = await getOfferState(payload, product, ctx);

  let recent: LiveData["recent"] = [];
  if (product.showRecentPurchases) {
    const since = new Date(Date.now() - RECENT_DAYS * 86_400_000).toISOString();
    const orders = await payload.find({
      collection: "orders",
      where: {
        product: { equals: product.id },
        paymentStatus: { equals: "paid" },
        paidAt: { greater_than: since },
        city: { exists: true },
      },
      sort: "-paidAt",
      limit: 20,
      depth: 0,
      select: { customerName: true, city: true, paidAt: true },
    });
    recent = orders.docs
      .filter((o) => o.city && o.paidAt)
      .map((o) => ({
        firstName: (o.customerName ?? "").trim().split(/\s+/)[0] || "Someone",
        city: (o.city ?? "").trim(),
        at: o.paidAt as string,
      }));
  }

  return {
    offerActive: offer.active,
    price: offer.price,
    endsAt: offer.endsAt,
    recent,
  };
}
