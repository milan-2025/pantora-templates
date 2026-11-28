import { getPayloadClient } from "@/lib/cms/queries";
import { PlannerError } from "@/lib/planner/core";
import { body, route } from "@/lib/planner/http";
import { bundleInfo, packInfo } from "@/lib/invitePlanner";
import { getPlan, getPlans, openPlanner, quotePlan } from "@/lib/planner/server";
import { getPaymentProvider } from "@/lib/payments";
import { clientIp, rateLimit } from "@/lib/rateLimit";

/**
 * POST { plan, coupon, quoteOnly }: price check, or starts a Razorpay payment. The price is always worked out here.
 * plan "bundle" = Planner + Invite bundle: the Family plan plus the wedding invite on Premium, at the bundle price
 * set in Admin → Planner landing page & promo codes.
 * plan "pack" = Shaadi pack: the same, plus a wedding photo gallery on the plan picked there, at the pack price.
 */
export const POST = route(async (req, { id }) => {
  if (!rateLimit(`planner-order:${clientIp(req)}`, 15, 60_000)) throw new PlannerError("Too many attempts. Please wait a minute.", 429);
  const payload = await getPayloadClient();
  const { doc, role } = await openPlanner(req, payload, id);
  if (role !== "owner") throw new PlannerError("Only the planner's owner can change the plan", 403);
  const b = await body(req);
  const isPack = b.plan === "pack";
  const isBundle = b.plan === "bundle" || isPack;
  let plan = isBundle ? null : await getPlan(payload, b.plan);
  if (isPack) {
    const pack = await packInfo(payload);
    const family = (await getPlans(payload)).find((p) => p.planId === "family" && p.active) ?? null;
    if (!pack.on || !family) throw new PlannerError("The Shaadi pack isn't available right now");
    if (doc.photoGallery) throw new PlannerError("This planner already has the Shaadi pack. Renew the planner from its own plans.");
    plan = { ...family, price: pack.price, name: "Shaadi pack" };
  } else if (isBundle) {
    const bundle = await bundleInfo(payload);
    const family = (await getPlans(payload)).find((p) => p.planId === "family" && p.active) ?? null;
    if (!bundle.on || !family) throw new PlannerError("The bundle isn't available right now");
    plan = { ...family, price: bundle.price, name: "Planner + Invite bundle" };
  }
  if (!plan || plan.isTrial || !plan.active || plan.price < 1) throw new PlannerError("Please pick a plan");
  const coupon = typeof b.coupon === "string" && b.coupon.trim() ? b.coupon.trim().toUpperCase().slice(0, 30) : undefined;
  const quote = await quotePlan(payload, plan, coupon, { bundle: isBundle, pack: isPack });
  if ("error" in quote && quote.error) throw new PlannerError(quote.error);
  if (b.quoteOnly) return { total: quote.total, discount: quote.discount, name: plan.name };

  const order = await getPaymentProvider().createOrder({
    amount: quote.total,
    currency: "INR",
    customer: { name: doc.names || "Wedding planner", email: doc.ownerEmail, phone: "", city: "" } as never,
    description: isPack
      ? "Shaadi pack: wedding planner Family + wedding invite Premium + photo gallery"
      : isBundle
        ? "Wedding planner Family + wedding invite Premium"
        : `Wedding planner – ${plan.name} plan`,
  });
  await payload.update({
    collection: "planners" as never, id: doc.id,
    data: { orderId: order.orderId, orderPlan: plan.id, orderAmount: quote.total, orderPaid: false, orderBundle: isBundle, orderPack: isPack, promoCode: coupon ?? "" } as never,
    overrideAccess: true,
  });
  return { orderId: order.orderId, provider: order.provider, clientData: order.clientData ?? null, total: quote.total };
});
