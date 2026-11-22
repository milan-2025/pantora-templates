import { getPayloadClient } from "@/lib/cms/queries";
import { PlannerError } from "@/lib/planner/core";
import { body, route } from "@/lib/planner/http";
import { setMyPassword, subjectOf } from "@/lib/planner/server";
import { clientIp, rateLimit } from "@/lib/rateLimit";

/** Sets or changes the signed-in person's password ({ password }), or removes it ({ remove: true }). */
export const POST = route(async (req) => {
  const subject = subjectOf(req);
  if (!subject || subject.startsWith("support:")) throw new PlannerError("Please sign in again", 401);
  if (!rateLimit(`planner-setpw:${clientIp(req)}`, 10, 15 * 60_000)) throw new PlannerError("Too many changes. Please wait a few minutes.", 429);
  const b = await body(req);
  return setMyPassword(await getPayloadClient(), subject, b.password, b.remove === true);
});
