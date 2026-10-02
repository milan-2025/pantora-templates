import { NextResponse } from "next/server";
import { customerSchema } from "@/lib/schema";
import { getPaymentProvider } from "@/lib/payments";
import { product } from "@/lib/content";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = customerSchema.safeParse(body?.customer);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid details" }, { status: 400 });
  }

  try {
    const provider = getPaymentProvider();
    // Price always comes from the server, never from the client.
    const order = await provider.createOrder({ amount: product.price, currency: product.currency, customer: parsed.data });
    // TODO (go-live): persist { orderId, customer, status: "created" } in a DB / sheet
    // so the verify step and the download page can look the order up.
    return NextResponse.json(order);
  } catch (e) {
    console.error("[create-order]", e);
    return NextResponse.json({ error: "Payments are temporarily unavailable. Please try again." }, { status: 503 });
  }
}
