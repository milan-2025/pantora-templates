import "server-only";
import { getPayloadClient } from "@/lib/cms/queries";
import { coupleNames, findInvite, isLive, liveState } from "@/lib/invites";
import { studioResponse } from "@/lib/shaadi/page";

/**
 * A couple's invite page (/i/<link>, /i/<link>/<guest>) or their editor (/i/<link>/edit).
 * The page itself loads the invite and shows "not live yet" if it isn't paid.
 */
export async function inviteResponse(req: Request, slug: string) {
  let title = "Wedding invitation";
  const url = new URL(req.url);
  const isEdit = url.pathname.split("/")[3] === "edit";
  try {
    const invite = await findInvite(await getPayloadClient(), slug);
    // Renamed invite: forward the old link (and any /<guest> part) to the new one.
    if (invite && invite.slug !== slug) {
      const rest = url.pathname.split("/").slice(3).join("/");
      const to = `/i/${encodeURIComponent(invite.slug)}${rest ? `/${rest}` : ""}${url.search}`;
      return new Response(null, { status: 308, headers: { Location: to, "Cache-Control": "no-store" } });
    }
    if (isEdit) return studioResponse("Edit your invite · Pandora Templates", url.pathname, false);
    if (isLive(invite) && invite) title = `${coupleNames(liveState(invite))} are getting married`;
  } catch {
    // keep the generic title
  }
  return studioResponse(isEdit ? "Edit your invite · Pandora Templates" : title, url.pathname, !isEdit);
}
