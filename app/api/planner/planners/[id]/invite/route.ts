import { getPayloadClient } from "@/lib/cms/queries";
import { PlannerError, effectiveStatus } from "@/lib/planner/core";
import { body, route } from "@/lib/planner/http";
import { openPlanner } from "@/lib/planner/server";
import {
  connectInvite, createInviteFor, editUrlOf, inviteSummary, linkedInvite, parseEditLink, reviewReply, syncInvite,
} from "@/lib/invitePlanner";
import { clientIp, rateLimit } from "@/lib/rateLimit";

/**
 * The planner's wedding invite (from the invite maker at /shaadi).
 * GET: whether one is connected, its link, personal links per family, replies waiting for review.
 */
export const GET = route(async (req, { id }) => {
  const payload = await getPayloadClient();
  const { doc } = await openPlanner(req, payload, id);
  return inviteSummary(payload, doc);
});

/**
 * POST { op }:
 * - "create": make the invite from the planner (names, date, functions, families), or open the existing one.
 * - "open": the private edit link (owner and family members who can edit).
 * - "connect" { link }: connect an invite made on its own, proven with its private edit link.
 * - "review" { rsvp, action: "match" | "add" | "ignore", family }: an RSVP nobody could match.
 * - "sync": push the planner's guests and functions to the invite now.
 */
export const POST = route(async (req, { id }) => {
  if (!rateLimit(`planner-invite:${clientIp(req)}`, 60, 60_000)) throw new PlannerError("Too many attempts. Please wait a moment.", 429);
  const payload = await getPayloadClient();
  const { doc, role, subject } = await openPlanner(req, payload, id);
  if (role !== "owner" && role !== "editor") throw new PlannerError("Only the owner or family members who can edit can change the invite", 403);
  const status = effectiveStatus(doc);
  const b = await body(req);
  const op = String(b.op ?? "");

  if (op === "create" || op === "open") {
    let invite = await linkedInvite(payload, doc);
    if (!invite) {
      if (op === "open") throw new PlannerError("There's no invite yet", 404);
      if (status === "expired" || status === "suspended") throw new PlannerError("Renew your plan to make the invite", 402, { reason: status });
      invite = await createInviteFor(payload, doc);
      const fresh = await payload.findByID({ collection: "planners", id, depth: 0, overrideAccess: true });
      invite = (await syncInvite(payload, fresh as never)) ?? invite;
    }
    return { editUrl: editUrlOf(invite), ...(await inviteSummary(payload, { ...doc, invite: invite.id })) };
  }

  if (op === "connect") {
    const parts = parseEditLink(b.link, b.slug, b.token);
    if (!parts) throw new PlannerError("Paste the private edit link of your invite (it ends with #k=…)");
    const invite = await connectInvite(payload, doc, subject, role, parts.slug, parts.token);
    const fresh = await payload.findByID({ collection: "planners", id, depth: 0, overrideAccess: true });
    return { imported: (invite as { imported?: number }).imported ?? 0, ...(await inviteSummary(payload, fresh as never)) };
  }

  if (op === "review") {
    if (typeof b.rsvp !== "string") throw new PlannerError("Invalid reply");
    await reviewReply(payload, doc, subject, role, b.rsvp, String(b.action ?? ""), typeof b.family === "string" ? b.family : undefined);
    const fresh = await payload.findByID({ collection: "planners", id, depth: 0, overrideAccess: true });
    return inviteSummary(payload, fresh as never);
  }

  if (op === "sync") {
    await syncInvite(payload, doc);
    return inviteSummary(payload, doc);
  }

  throw new PlannerError("Unknown action");
});
