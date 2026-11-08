import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/cms/queries";
import { authorize, markInvitePaid } from "@/lib/invites";
import { getPaymentProvider } from "@/lib/payments";
import { clientIp, rateLimit } from "@/lib/rateLimit";

/** Confirms a payment with Razorpay's signature, then makes the invite live. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!rateLimit(`invite-verify:${clientIp(req)}`, 20, 60_000)) return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  const { slug } = await params;
  const payload = await getPayloadClient();
  const invite = await authorize(req, payload, slug);
  if (!invite || !invite.orderId) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const result = await getPaymentProvider().verify({ orderId: invite.orderId, payload: body });
  if (!result.ok) return NextResponse.json({ error: "Payment could not be verified" }, { status: 400 });

  await markInvitePaid(payload, invite.orderId, result.paymentId);
  return NextResponse.json({ ok: true, plan: invite.orderPlan ?? "basic" });
}
