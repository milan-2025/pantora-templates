import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/cms/queries";
import { findInvite, isLive, publicView, type InviteState } from "@/lib/invites";

/**
 * What guests see. Only paid (and not expired) invites are served. The guest list and phone numbers are never
 * included; with ?guest=<guest-link> the guest is greeted and sees only the events they are invited to.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const invite = await findInvite(await getPayloadClient(), slug);
  if (!invite || !isLive(invite)) return NextResponse.json({ error: "not_live" }, { status: 404 });
  const guest = new URL(req.url).searchParams.get("guest");
  const view = publicView(invite.state as InviteState, guest);
  return NextResponse.json({ state: view.state, guest: view.guest, plan: invite.plan ?? "basic" }, { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
