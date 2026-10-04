import type { Payload } from "payload";
import type { Product } from "@/payload-types";
import { getOfferState } from "@/lib/pricing";
import type { LiveData } from "@/components/landing/LiveData";

const RECENT_DAYS = 14;

/** Real-time offer numbers + recent real purchases (first name and city only). */
export async function getLiveData(payload: Payload, product: Product): Promise<LiveData> {
  const offer = await getOfferState(payload, product);

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
      limit: 10,
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
    sold: offer.sold,
    cap: offer.cap,
    endsAt: offer.endsAt,
    recent,
  };
}
