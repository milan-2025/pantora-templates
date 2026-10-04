import { NextResponse } from "next/server";
import { z } from "zod";
import { getPaymentProvider } from "@/lib/payments";
import { getPayloadClient, getSettings } from "@/lib/cms/queries";
import { sendDeliveryEmail } from "@/lib/email";
import { whatsappLink } from "@/lib/format";
import type { Product } from "@/payload-types";

const bodySchema = z.object({
  orderId: z.string().min(1).max(100),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { orderId, payload: gatewayPayload } = parsed.data;
  try {
    const payload = await getPayloadClient();
    const found = await payload.find({ collection: "orders", where: { orderId: { equals: orderId } }, limit: 1, depth: 1 });
    const order = found.docs[0];
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // Already verified (e.g. page refreshed): don't charge commission or email twice.
    if (order.paymentStatus === "paid") return NextResponse.json({ ok: true, orderId });

    const provider = getPaymentProvider();
    const result = await provider.verify({ orderId, payload: gatewayPayload });
    if (!result.ok) {
      await payload.update({ collection: "orders", id: order.id, data: { paymentStatus: "failed" } });
      return NextResponse.json({ error: "Payment could not be verified" }, { status: 402 });
    }

    await payload.update({
      collection: "orders",
      id: order.id,
      data: {
        paymentStatus: "paid",
        paidAt: new Date().toISOString(),
        paymentId: result.paymentId,
        commissionStatus: order.affiliate ? "pending" : "none",
      },
    });

    // TODO (go-live): move delivery to the gateway's webhook so it also happens if the buyer closes the tab.
    const product = order.product as Product;
    const settings = await getSettings();
    const email = await sendDeliveryEmail({
      orderId,
      customerName: order.customerName,
      email: order.email,
      productName: product.name,
      hasFile: Boolean(product.downloadFile),
      googleSheetsCopyUrl: product.googleSheetsCopyUrl,
      supportWhatsapp: whatsappLink(settings.whatsappNumber, settings.whatsappMessage),
    });

    return NextResponse.json({ ok: true, orderId, emailSent: email.sent });
  } catch (e) {
    console.error("[verify]", e);
    return NextResponse.json({ error: "Something went wrong verifying your payment" }, { status: 500 });
  }
}
