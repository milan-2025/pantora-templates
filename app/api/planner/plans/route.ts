import { getPayloadClient } from "@/lib/cms/queries";
import { route } from "@/lib/planner/http";
import { getPlans } from "@/lib/planner/server";

/** Plans for the upgrade screen (and the trial, so the app can show its limits). */
export const GET = route(async () => {
  const plans = await getPlans(await getPayloadClient());
  return { plans: plans.filter((p) => p.active || p.isTrial) };
});
