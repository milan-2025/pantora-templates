import { NextResponse } from "next/server";
import { z } from "zod";
import { getPayloadClient } from "@/lib/cms/queries";
import { findInvite, isLive } from "@/lib/invites";
import { clientIp, rateLimit } from "@/lib/rateLimit";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  guests: z.coerce.number().int().min(1).max(50).default(1),
  events: z.string().trim().max(250).optional().default(""),
  meal: z.string().trim().max(30).optional().default(""),
  side: z.enum(["bride", "groom", ""]).optional().default(""),
  guest: z.string().trim().max(90).optional().default(""),
  message: z.string().trim().max(500).optional().default(""),
});

/** A guest's reply from a live invite. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!rateLimit(`invite-rsvp:${clientIp(req)}`, 20, 3_600_000)) return NextResponse.json({ error: "Too many replies" }, { status: 429 });
  const { slug } = await params;
  const payload = await getPayloadClient();
  const invite = await findInvite(payload, slug);
  if (!invite || !isLive(invite)) return NextResponse.json({ error: "not_live" }, { status: 404 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please enter your name" }, { status: 400 });
  await payload.create({ collection: "invite-rsvps", data: { invite: invite.id, ...parsed.data, side: parsed.data.side || undefined }, overrideAccess: true });
  return NextResponse.json({ ok: true });
}
