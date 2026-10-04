import { NextResponse } from "next/server";
import { z } from "zod";
import { loadCheckoutProduct } from "@/lib/checkout";
import { getQuote } from "@/lib/pricing";
import { promoCodeSchema } from "@/lib/schema";
import { clientIp, rateLimit } from "@/lib/rateLimit";

const bodySchema = z.object({ product: z.string().min(1).max(80), promoCode: promoCodeSchema });

/** Price for the checkout summary: offer price, promo-code discount and total. Always computed here. */
export async function POST(req: Request) {
  if (!rateLimit(`quote:${clientIp(req)}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Please wait a minute." }, { status: 429 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const loaded = await loadCheckoutProduct(parsed.data.product);
  if (!loaded) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const q = await getQuote(loaded.payload, loaded.product, parsed.data.promoCode);
  return NextResponse.json({
    regularPrice: q.offer.regularPrice,
    offerActive: q.offer.active,
    listPrice: q.listPrice,
    discount: q.discount,
    total: q.total,
    promoCode: q.promoCode,
    discountPercent: q.affiliate?.discountPercent ?? 0,
    codeError: q.codeError,
  });
}
