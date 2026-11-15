import { getPayloadClient } from "@/lib/cms/queries";
import { PlannerError } from "@/lib/planner/core";
import { body, route } from "@/lib/planner/http";
import { getPlan, openPlanner, quotePlan } from "@/lib/planner/server";
import { getPaymentProvider } from "@/lib/payments";
import { clientIp, rateLimit } from "@/lib/rateLimit";

/** POST { plan, coupon, quoteOnly }: price check, or starts a Razorpay payment. The price is always worked out here. */
export const POST = route(async (req, { id }) => {
  if (!rateLimit(`planner-order:${clientIp(req)}`, 15, 60_000)) throw new PlannerError("Too many attempts. Please wait a minute.", 429);
  const payload = await getPayloadClient();
  const { doc, role } = await openPlanner(req, payload, id);
  if (role !== "owner") throw new PlannerError("Only the planner's owner can change the plan", 403);
  const b = await body(req);
  const plan = await getPlan(payload, b.plan);
  if (!plan || plan.isTrial || !plan.active || plan.price < 1) throw new PlannerError("Please pick a plan");
  const coupon = typeof b.coupon === "string" && b.coupon.trim() ? b.coupon.trim().toUpperCase().slice(0, 30) : undefined;
  const quote = await quotePlan(payload, plan, coupon);
  if ("error" in quote && quote.error) throw new PlannerError(quote.error);
  if (b.quoteOnly) return { total: quote.total, discount: quote.discount, name: plan.name };

  const order = await getPaymentProvider().createOrder({
    amount: quote.total,
    currency: "INR",
    customer: { name: doc.names || "Wedding planner", email: doc.ownerEmail, phone: "", city: "" } as never,
    description: `Wedding planner – ${plan.name} plan`,
  });
  await payload.update({
    collection: "planners" as never, id: doc.id,
    data: { orderId: order.orderId, orderPlan: plan.id, orderAmount: quote.total, orderPaid: false, promoCode: coupon ?? "" } as never,
    overrideAccess: true,
  });
  return { orderId: order.orderId, provider: order.provider, clientData: order.clientData ?? null, total: quote.total };
});
