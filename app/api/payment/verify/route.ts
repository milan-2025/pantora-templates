import { NextResponse } from "next/server";
import { z } from "zod";
import { getPaymentProvider } from "@/lib/payments";
import { getPayloadClient } from "@/lib/cms/queries";
import { markOrderPaid } from "@/lib/fulfil";

const bodySchema = z.object({
  orderId: z.string().min(1).max(100),
  payload: z.record(z.string(), z.unknown()).default({}),
});

/** Called by the checkout page right after the buyer pays (Razorpay's webhook is the backup). */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { orderId, payload: gatewayPayload } = parsed.data;
  try {
    const payload = await getPayloadClient();
    const found = await payload.find({ collection: "orders", where: { orderId: { equals: orderId } }, limit: 1, depth: 0 });
    const order = found.docs[0];
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // Already confirmed (page refresh, or the webhook got there first).
    if (order.paymentStatus === "paid") return NextResponse.json({ ok: true, orderId });

    const result = await getPaymentProvider().verify({ orderId, payload: gatewayPayload });
    if (!result.ok) {
      await payload.update({ collection: "orders", id: order.id, data: { paymentStatus: "failed" } });
      return NextResponse.json({ error: "Payment could not be verified" }, { status: 402 });
    }

    const done = await markOrderPaid(payload, orderId, result.paymentId);
    return NextResponse.json({ ok: true, orderId, emailSent: "emailSent" in done ? done.emailSent : false });
  } catch (e) {
    console.error("[verify]", e);
    return NextResponse.json({ error: "Something went wrong verifying your payment" }, { status: 500 });
  }
}
