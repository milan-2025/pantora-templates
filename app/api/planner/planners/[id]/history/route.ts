import { getPayloadClient } from "@/lib/cms/queries";
import { PlannerError } from "@/lib/planner/core";
import { body, route } from "@/lib/planner/http";
import { listHistory, openPlanner, restore } from "@/lib/planner/server";

/** GET: recent activity (who changed what) with restore points. */
export const GET = route(async (req, { id }) => {
  const payload = await getPayloadClient();
  await openPlanner(req, payload, id);
  return { items: await listHistory(payload, id) };
});

/** POST { restore: <activity id> }: puts the planner back to how it was before that save. Owner and editors only. */
export const POST = route(async (req, { id }) => {
  const payload = await getPayloadClient();
  const { role, subject } = await openPlanner(req, payload, id);
  const b = await body(req);
  if (typeof b.restore !== "string") throw new PlannerError("Pick a restore point");
  return restore(payload, id, subject, role, b.restore);
});
