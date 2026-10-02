import { NextResponse } from "next/server";
import { z } from "zod";
import { customerSchema } from "@/lib/schema";
import { getPaymentProvider } from "@/lib/payments";
import { sendDeliveryEmail } from "@/lib/email";

const bodySchema = z.object({
  orderId: z.string().min(1),
  customer: customerSchema,
  payload: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { orderId, customer, payload } = parsed.data;
  try {
    const provider = getPaymentProvider();
    const result = await provider.verify({ orderId, payload });
    if (!result.ok) return NextResponse.json({ error: "Payment could not be verified" }, { status: 402 });

    // TODO (go-live): mark the order as paid in your store, and ideally move delivery
    // to the gateway's webhook so it still happens if the buyer closes the tab.
    const email = await sendDeliveryEmail(customer, orderId);
    return NextResponse.json({ ok: true, orderId, emailSent: email.sent });
  } catch (e) {
    console.error("[verify]", e);
    return NextResponse.json({ error: "Something went wrong verifying your payment" }, { status: 500 });
  }
}
