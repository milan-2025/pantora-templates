import { NextResponse } from "next/server";
import { z } from "zod";
import { customerSchema, promoCodeSchema } from "@/lib/schema";
import { getPaymentProvider } from "@/lib/payments";
import { loadCheckoutProduct } from "@/lib/checkout";
import { getQuote } from "@/lib/pricing";
import { ensureVisitorStart } from "@/lib/offerWindow";
import { clientIp, rateLimit } from "@/lib/rateLimit";

const bodySchema = z.object({
  product: z.string().min(1).max(80),
  customer: customerSchema,
  promoCode: promoCodeSchema,
});

export async function POST(req: Request) {
  if (!rateLimit(`order:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Please wait a minute." }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid details" }, { status: 400 });
  }
  const { customer, promoCode } = parsed.data;

  const loaded = await loadCheckoutProduct(parsed.data.product);
  if (!loaded) return NextResponse.json({ error: "This product isn't available" }, { status: 404 });
  const { payload, product } = loaded;

  try {
    // Price always comes from the server, never from the browser.
    // A buyer who reaches checkout without ever loading the product page starts their bonus window now.
    const visitorStart = product.bonus?.enabled ? await ensureVisitorStart(String(product.id)) : null;
    const quote = await getQuote(payload, product, promoCode, { visitorStart });
    if (quote.codeError) return NextResponse.json({ error: quote.codeError }, { status: 400 });

    const provider = getPaymentProvider();
    const order = await provider.createOrder({ amount: quote.total, currency: "INR", customer, description: product.name });

    await payload.create({
      collection: "orders",
      data: {
        orderId: order.orderId,
        provider: order.provider,
        product: product.id,
        paymentStatus: "created",
        customerName: customer.name,
        email: customer.email,
        phone: customer.phone,
        city: customer.city || undefined,
        listPrice: quote.listPrice,
        discountAmount: quote.discount,
        amount: quote.total,
        offerApplied: quote.offer.active,
        bonusIncluded: Boolean(quote.bonus?.active),
        promoCode: quote.promoCode ?? undefined,
        affiliate: quote.affiliate?.id,
        commissionAmount: quote.commission,
        commissionStatus: "none", // becomes "pending" once paid
      },
    });

    return NextResponse.json({ ...order, amount: quote.total });
  } catch (e) {
    console.error("[create-order]", e);
    return NextResponse.json({ error: "Payments are temporarily unavailable. Please try again." }, { status: 503 });
  }
}
