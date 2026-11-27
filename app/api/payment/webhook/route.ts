import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/cms/queries";
import { markOrderPaid } from "@/lib/fulfil";
import { markInvitePaid } from "@/lib/invites";
import { markPlannerPaid } from "@/lib/planner/server";
import { markPledgePaid, markWorkoutPaid } from "@/lib/workout/server";
import { markPhotosPaid } from "@/lib/photos/server";
import { markHostbookPaid } from "@/lib/hostbook/server";
import { markCrmPaid } from "@/lib/crm/billing";
import { hmacHex, signaturesMatch } from "@/lib/payments";

/**
 * Razorpay webhook (Razorpay Dashboard → Account & Settings → Webhooks):
 *   URL:    https://<your-site>/api/payment/webhook
 *   Secret: same value as RAZORPAY_WEBHOOK_SECRET
 *   Events: payment.captured, order.paid
 *
 * Confirms payments even if the buyer closes the tab before the checkout page could.
 */
export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });

  // The signature covers the exact raw body, so read it as text before parsing.
  const raw = await req.text();
  if (!signaturesMatch(hmacHex(secret, raw), req.headers.get("x-razorpay-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: {
    event?: string;
    payload?: { payment?: { entity?: { id?: string; order_id?: string; status?: string } }; order?: { entity?: { id?: string } } };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (event.event === "payment.captured" || event.event === "order.paid") {
    const payment = event.payload?.payment?.entity;
    const orderId = payment?.order_id ?? event.payload?.order?.entity?.id;
    if (orderId) {
      const payload = await getPayloadClient();
      const result = await markOrderPaid(payload, orderId, payment?.id);
      // Orders from other sites/tests on the same Razorpay account are simply ignored.
      if (!result.found) {
        // Not a shop order: it may be a wedding invite payment.
        const invite = await markInvitePaid(payload, orderId, payment?.id);
        // Or an online wedding planner upgrade.
        const planner = invite.found ? null : await markPlannerPaid(payload, orderId, payment?.id);
        // Or a workout app plan.
        const workout = invite.found || planner?.found ? null : await markWorkoutPaid(payload, orderId, payment?.id);
        // Or a workout pledge (money on finishing a challenge).
        const pledge = invite.found || planner?.found || workout?.found ? null : await markPledgePaid(payload, orderId, payment?.id);
        // Or a wedding photo gallery plan / renewal.
        const photos = invite.found || planner?.found || workout?.found || pledge?.found ? null : await markPhotosPaid(payload, orderId, payment?.id);
        // Or a HostBook plan (Airbnb host tool).
        const hostbook = invite.found || planner?.found || workout?.found || pledge?.found || photos?.found ? null : await markHostbookPaid(payload, orderId, payment?.id);
        // Or a LeadFlow CRM plan.
        const crm = invite.found || planner?.found || workout?.found || pledge?.found || photos?.found || hostbook?.found ? null : await markCrmPaid(orderId, payment?.id);
        if (!invite.found && !planner?.found && !workout?.found && !pledge?.found && !photos?.found && !hostbook?.found && !crm?.found) console.log(`[webhook] no order ${orderId} on this site; ignored`);
      }
    }
  }
  // Always 200 for valid, signed events so Razorpay doesn't keep retrying ones we don't use.
  return NextResponse.json({ ok: true });
}
