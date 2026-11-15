import "server-only";
import { getPayloadClient } from "@/lib/cms/queries";
import { findInvite, isLive } from "@/lib/invites";
import { studioResponse } from "@/lib/shaadi/page";

/** A couple's invite page. The page itself loads the invite and shows "not live yet" if it isn't paid. */
export async function inviteResponse(req: Request, slug: string) {
  let title = "Wedding invitation";
  const url = new URL(req.url);
  try {
    const invite = await findInvite(await getPayloadClient(), slug);
    // Renamed invite: forward the old link (and any /<guest> part) to the new one.
    if (invite && invite.slug !== slug) {
      const rest = url.pathname.split("/").slice(3).join("/");
      const to = `/i/${encodeURIComponent(invite.slug)}${rest ? `/${rest}` : ""}${url.search}`;
      return new Response(null, { status: 308, headers: { Location: to, "Cache-Control": "no-store" } });
    }
    if (isLive(invite) && invite?.names) title = `${invite.names} are getting married`;
  } catch {
    // keep the generic title
  }
  return studioResponse(title, url.pathname);
}
