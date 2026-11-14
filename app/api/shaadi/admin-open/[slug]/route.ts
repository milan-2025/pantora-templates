import { getPayloadClient } from "@/lib/cms/queries";
import { findInvite } from "@/lib/invites";

/**
 * Admin-only shortcut from /admin ▸ Invites: opens a couple's invite in the editor (to=edit),
 * straight into the full-screen guest preview (to=preview), or the live guest page (to=live).
 * The private edit token never appears in the admin UI; it's only added here, after checking the admin login.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const payload = await getPayloadClient();
  const { user } = await payload.auth({ headers: req.headers });
  if (!user) return new Response("Please log in to /admin first.", { status: 401 });
  const invite = await findInvite(payload, slug);
  if (!invite) return new Response("Invite not found", { status: 404 });

  const to = new URL(req.url).searchParams.get("to");
  let location = `/i/${encodeURIComponent(invite.slug)}`;
  if ((to === "edit" || to === "preview") && invite.editToken) {
    location = `/shaadi?edit=${encodeURIComponent(invite.slug)}.${invite.editToken}${to === "preview" ? "&pv=1" : ""}`;
  }
  // Relative redirect, so it works behind Hostinger's proxy whatever host Next sees.
  return new Response(null, {
    status: 303,
    headers: { Location: location, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
