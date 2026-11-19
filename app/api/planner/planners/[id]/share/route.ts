import { getPayloadClient } from "@/lib/cms/queries";
import { PlannerError } from "@/lib/planner/core";
import { body, route } from "@/lib/planner/http";
import { openPlanner, setShareLink } from "@/lib/planner/server";
import { clientIp, rateLimit } from "@/lib/rateLimit";

/** POST { on: true | false }: turns the view-only run sheet link on or off. */
export const POST = route(async (req, { id }) => {
  if (!rateLimit(`planner-share:${clientIp(req)}`, 30, 3600_000)) throw new PlannerError("Too many changes. Please try later.", 429);
  const payload = await getPayloadClient();
  const { doc, role } = await openPlanner(req, payload, id);
  const { on } = await body(req);
  return setShareLink(payload, doc, role, on === true);
});
