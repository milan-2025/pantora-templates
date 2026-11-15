import { getPayloadClient } from "@/lib/cms/queries";
import { PlannerError } from "@/lib/planner/core";
import { route } from "@/lib/planner/http";
import { listMine, subjectOf } from "@/lib/planner/server";

/** Who is signed in, and the planners they can open (their own and ones shared with them). */
export const GET = route(async (req) => {
  const subject = subjectOf(req);
  if (!subject) throw new PlannerError("Please sign in again", 401);
  if (subject.startsWith("support:")) return { email: null, support: true, planners: [{ id: subject.slice(8), names: "Customer planner", role: "support" }] };
  return { email: subject, planners: await listMine(await getPayloadClient(), subject) };
});
