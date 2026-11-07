import { NextResponse } from "next/server";
import { z } from "zod";
import { getPayloadClient } from "@/lib/cms/queries";
import { INVITE_PLANS, PLAN_IDS, authorize, quoteFor } from "@/lib/invites";
import { getPaymentProvider } from "@/lib/payments";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { promoCodeSchema } from "@/lib/schema";

const bodySchema = z.object({
  plan: z.enum(PLAN_IDS),
  coupon: promoCodeSchema,
  email: z.email("Please enter a valid email"),
  phone: z.string().trim().max(20).optional().default(""),
});

/** Starts a Razorpay payment for an invite. The price is worked out here, never taken from the browser. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!rateLimit(`invite-order:${clientIp(req)}`, 10, 60_000)) return NextResponse.json({ error: "Too many attempts. Please wait a minute." }, { status: 429 });
  const { slug } = await params;
  const payload = await getPayloadClient();
  const invite = await authorize(req, payload, slug);
  if (!invite) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid details" }, { status: 400 });
  const { plan, coupon, email, phone } = parsed.data;

  const quote = await quoteFor(payload, plan, coupon);
  if ("error" in quote && quote.error) return NextResponse.json({ error: quote.error }, { status: 400 });

  try {
    const order = await getPaymentProvider().createOrder({
      amount: quote.total,
      currency: "INR",
      customer: { name: invite.names || "Wedding invite", email, phone, city: "" },
      description: `Wedding invite – ${INVITE_PLANS[plan].name} plan`,
    });
    await payload.update({
      collection: "invites",
      id: invite.id,
      data: { orderId: order.orderId, orderPlan: plan, contactEmail: email, amount: quote.total, promoCode: coupon ?? "" },
      overrideAccess: true,
    });
    return NextResponse.json({ orderId: order.orderId, provider: order.provider, clientData: order.clientData ?? null });
  } catch (e) {
    console.error("[invite-checkout]", e);
    return NextResponse.json({ error: "Couldn't start the payment. Please try again." }, { status: 502 });
  }
}
