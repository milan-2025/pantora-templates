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
  const { state, source } = await body(req);
  const clean = cleanState(state ?? {});
  const payload = await getPayloadClient();
  const trial = await trialPlan(payload);
  const over = overLimit({}, clean, trial.limits);
  if (over) throw new PlannerError(`The free trial allows ${over.limit} ${over.label.toLowerCase()}, and this data has ${over.count}. Remove some, or start with an empty planner and upgrade.`, 402, { reason: "limit", limit: over });
  // Which ad or link brought them, e.g. "facebook / diwali-sale / reel-2". Plain text, capped.
  const src = typeof source === "string" ? source.replace(/[^\w .:/|@+-]/g, "").slice(0, 200) : "";
  const doc = await createPlanner(payload, email, clean, src);
  return { meta: await meta(payload, doc, "owner"), state: doc.state };
});
