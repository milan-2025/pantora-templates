import { getPayloadClient } from "@/lib/cms/queries";
import { PlannerError } from "@/lib/planner/core";
import { body, route } from "@/lib/planner/http";
import { changesSince, meta, openPlanner, savePlanner } from "@/lib/planner/server";
import { clientIp, rateLimit } from "@/lib/rateLimit";

/**
 * GET: the planner (whole, or only the changes since ?since=<save number>) plus plan, limits and role.
 * The app calls this every few seconds to pick up family members' edits.
 */
export const GET = route(async (req, { id }) => {
  const payload = await getPayloadClient();
  const { doc, role } = await openPlanner(req, payload, id);
  const sinceRaw = new URL(req.url).searchParams.get("since");
  const m = await meta(payload, doc, role);
  if (sinceRaw === null) return { meta: m, rev: doc.rev ?? 0, state: doc.state ?? null };
  return { meta: m, ...(await changesSince(payload, doc, Number(sinceRaw))) };
});

/** PUT { ops: [...], summary }: saves a batch of changes. */
export const PUT = route(async (req, { id }) => {
  if (!rateLimit(`planner-save:${clientIp(req)}`, 240, 60_000)) throw new PlannerError("Too many saves. Please wait a moment.", 429);
  const payload = await getPayloadClient();
  const { role, subject } = await openPlanner(req, payload, id);
  const { ops, summary } = await body(req);
  if (!Array.isArray(ops)) throw new PlannerError("Invalid changes");
  if (!ops.length) return { rev: null };
  return savePlanner(payload, id, subject, role, ops, typeof summary === "string" ? summary : undefined);
});
