import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/cms/queries";
import { findInvite, isLive } from "@/lib/invites";

/** What guests see. Only invites that are paid (and not expired) are served. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const invite = await findInvite(await getPayloadClient(), slug);
  if (!invite || !isLive(invite)) return NextResponse.json({ error: "not_live" }, { status: 404 });
  return NextResponse.json({ state: invite.state }, { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
