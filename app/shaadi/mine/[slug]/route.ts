import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/cms/queries";
import { authorize, isLive } from "@/lib/invites";

/** The couple's own invite for editing (needs their private edit token). */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const invite = await authorize(req, await getPayloadClient(), slug);
  if (!invite) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  return NextResponse.json({ slug: invite.slug, state: invite.state, paid: isLive(invite), plan: invite.plan ?? null, expires: invite.expiresAt ?? null });
}
