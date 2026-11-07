import { getPayloadClient } from "@/lib/cms/queries";
import { findInvite, isLive } from "@/lib/invites";
import { studioResponse } from "@/lib/shaadi/page";

export const dynamic = "force-dynamic";

/** A couple's invite: /i/<link> or /i/<link>/<guest> (the guest page greets them by name). */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string; guest?: string[] }> }) {
  const { slug } = await ctx.params;
  let title = "Wedding invitation";
  try {
    const invite = await findInvite(await getPayloadClient(), slug);
    if (isLive(invite) && invite?.names) title = `${invite.names} are getting married`;
  } catch {
    // keep the generic title; the page itself shows "not live yet" if needed
  }
  return studioResponse(title, new URL(req.url).pathname);
}
