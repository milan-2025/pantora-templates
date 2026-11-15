import { getPayloadClient } from "@/lib/cms/queries";
import { PlannerError, normEmail } from "@/lib/planner/core";
import { body, route } from "@/lib/planner/http";
import { addCollaborator, openPlanner, removeCollaborator } from "@/lib/planner/server";
import { clientIp, rateLimit } from "@/lib/rateLimit";

/** POST { email, role }: the owner invites a family member (limited by their plan). */
export const POST = route(async (req, { id }) => {
  if (!rateLimit(`planner-collab:${clientIp(req)}`, 20, 3600_000)) throw new PlannerError("Too many invites. Please try later.", 429);
  const payload = await getPayloadClient();
  const { doc, role } = await openPlanner(req, payload, id);
  if (role !== "owner") throw new PlannerError("Only the planner's owner can invite people", 403);
  const { email, role: r } = await body(req);
  return { collaborators: await addCollaborator(payload, doc, email, r) };
});

/** DELETE { email }: the owner removes someone, or a collaborator leaves. */
export const DELETE = route(async (req, { id }) => {
  const payload = await getPayloadClient();
  const { doc, role, subject } = await openPlanner(req, payload, id);
  const { email } = await body(req);
  if (role !== "owner" && normEmail(email) !== normEmail(subject)) throw new PlannerError("Only the planner's owner can remove people", 403);
  return { collaborators: await removeCollaborator(payload, doc, email) };
});
