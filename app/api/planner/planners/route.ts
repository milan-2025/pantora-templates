import { getPayloadClient } from "@/lib/cms/queries";
import { PlannerError, cleanState, overLimit } from "@/lib/planner/core";
import { body, route } from "@/lib/planner/http";
import { createPlanner, meta, subjectOf, trialPlan } from "@/lib/planner/server";
import { clientIp, rateLimit } from "@/lib/rateLimit";

/** Starts the free trial: creates the signed-in person's planner (empty template, their Excel import, or their local demo data). */
export const POST = route(async (req) => {
  const email = subjectOf(req);
  if (!email || email.startsWith("support:")) throw new PlannerError("Please sign in again", 401);
  if (!rateLimit(`planner-new:${clientIp(req)}`, 10, 3600_000)) throw new PlannerError("Too many attempts. Please try later.", 429);
  const { state } = await body(req);
  const clean = cleanState(state ?? {});
  const payload = await getPayloadClient();
  const trial = await trialPlan(payload);
  const over = overLimit({}, clean, trial.limits);
  if (over) throw new PlannerError(`The free trial allows ${over.limit} ${over.label.toLowerCase()}, and this data has ${over.count}. Remove some, or start with an empty planner and upgrade.`, 402, { reason: "limit", limit: over });
  const doc = await createPlanner(payload, email, clean);
  return { meta: await meta(payload, doc, "owner"), state: doc.state };
});
