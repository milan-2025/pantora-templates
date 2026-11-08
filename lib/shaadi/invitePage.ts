import "server-only";
import { getPayloadClient } from "@/lib/cms/queries";
import { findInvite, isLive } from "@/lib/invites";
import { studioResponse } from "@/lib/shaadi/page";

/** A couple's invite page. The page itself loads the invite and shows "not live yet" if it isn't paid. */
export async function inviteResponse(req: Request, slug: string) {
  let title = "Wedding invitation";
  try {
    const invite = await findInvite(await getPayloadClient(), slug);
    if (isLive(invite) && invite?.names) title = `${invite.names} are getting married`;
  } catch {
    // keep the generic title
  }
  return studioResponse(title, new URL(req.url).pathname);
}
