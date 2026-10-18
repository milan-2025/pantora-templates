import type { Payload, Where } from "payload";
import type { Product } from "@/payload-types";
import { getBonusState, getOfferState, type OfferContext } from "@/lib/pricing";
import type { LiveData } from "@/components/landing/LiveData";

const RECENT_DAYS = 30;

/** Orders that bought this product, either as the main item or as a checkout add-on (upsell). */
const boughtThis = (productId: string): Where => ({
  or: [{ product: { equals: productId } }, { "addOns.product": { equals: productId } }],
});

/** Real-time offer numbers + recent real purchases (first name and city only). */
export async function getLiveData(payload: Payload, product: Product, ctx: OfferContext = {}): Promise<LiveData> {
  const offer = await getOfferState(payload, product, ctx);

  let recent: LiveData["recent"] = [];
  if (product.showRecentPurchases) {
    const since = new Date(Date.now() - RECENT_DAYS * 86_400_000).toISOString();
    const orders = await payload.find({
      collection: "orders",
      where: {
        ...boughtThis(product.id),
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

  // Real sales: paid orders on this website (refunds excluded) + genuine earlier sales entered in the admin.
  let sold: LiveData["sold"] = null;
  const counter = product.salesCounter;
  if (counter?.show) {
    const paid = await payload.count({
      collection: "orders",
      where: { ...boughtThis(product.id), paymentStatus: { equals: "paid" } },
    });
    const count = paid.totalDocs + Math.max(0, counter.previousSales ?? 0);
    if (count > 0 && count >= (counter.minimumToShow ?? 0)) {
      sold = { count, text: counter.text || "{count} couples are already planning with this sheet" };
    }
  }

  return {
    offerActive: offer.active,
    price: offer.price,
    endsAt: offer.endsAt,
    bonus: getBonusState(product, ctx),
    sold,
    recent,
  };
}
