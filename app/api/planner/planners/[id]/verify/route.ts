import { getPayloadClient } from "@/lib/cms/queries";
import { PlannerError } from "@/lib/planner/core";
import { body, route } from "@/lib/planner/http";
import { markPlannerPaid, openPlanner } from "@/lib/planner/server";
import { getPaymentProvider } from "@/lib/payments";
import { clientIp, rateLimit } from "@/lib/rateLimit";

/** Confirms the payment with Razorpay's signature, then switches the plan. */
export const POST = route(async (req, { id }) => {
  if (!rateLimit(`planner-verify-pay:${clientIp(req)}`, 20, 60_000)) throw new PlannerError("Too many attempts", 429);
  const payload = await getPayloadClient();
  const { doc } = await openPlanner(req, payload, id);
  if (!doc.orderId) throw new PlannerError("No payment to confirm", 400);
  const result = await getPaymentProvider().verify({ orderId: doc.orderId, payload: await body(req) });
  if (!result.ok) throw new PlannerError("Payment could not be verified", 400);
  await markPlannerPaid(payload, doc.orderId, result.paymentId);
  return { ok: true };
});
