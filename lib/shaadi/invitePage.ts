import "server-only";
import { getPayloadClient } from "@/lib/cms/queries";
import { coupleNames, findInvite, isLive, liveState, ogImage } from "@/lib/invites";
import { studioResponse } from "@/lib/shaadi/page";

/**
 * A couple's invite page (/i/<link>, /i/<link>/<guest>) or their editor (/i/<link>/edit).
 * The page itself loads the invite and shows "not live yet" if it isn't paid.
 */
export async function inviteResponse(req: Request, slug: string) {
  let title = "Wedding invitation";
  const og: { image?: string | null; description?: string | null } = {};
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
    if (isLive(invite) && invite) {
      const st = liveState(invite);
      title = `${coupleNames(st)} are getting married`;
      og.image = ogImage(st);
      const d = new Date(String(st.date ?? ""));
      if (!isNaN(d.getTime())) og.description = `${d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · Tap to open your invitation`;
    }
  } catch {
    // keep the generic title
  }
  return studioResponse(isEdit ? "Edit your invite · Pandora Templates" : title, url.pathname, !isEdit, og);
}
