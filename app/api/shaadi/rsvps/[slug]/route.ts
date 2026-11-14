import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/cms/queries";
import { authorize, isLive } from "@/lib/invites";

/** The couple's replies (Premium and Royal plans). */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const payload = await getPayloadClient();
  const invite = await authorize(req, payload, slug);
  if (!invite) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (!isLive(invite) || invite.plan === "basic") return NextResponse.json({ error: "upgrade" }, { status: 402 });
  const res = await payload.find({ collection: "invite-rsvps", where: { invite: { equals: invite.id } }, sort: "-createdAt", limit: 500, depth: 0, overrideAccess: true });
  return NextResponse.json({ rows: res.docs.map((r) => ({ name: r.name, guests: r.guests, events: r.events ?? "", meal: r.meal ?? "", side: r.side ?? "", guest: r.guest ?? "", message: r.message ?? "", created_at: r.createdAt })) });
}
