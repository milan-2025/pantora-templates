import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/cms/queries";
import { authorize, cleanState, coupleNames, isLive } from "@/lib/invites";
import { clientIp, rateLimit } from "@/lib/rateLimit";

type Ctx = { params: Promise<{ slug: string }> };

/** Saves the couple's changes (needs their private edit token). */
export async function PUT(req: Request, { params }: Ctx) {
  if (!rateLimit(`invite-save:${clientIp(req)}`, 120, 60_000)) return NextResponse.json({ error: "Too many saves" }, { status: 429 });
  const { slug } = await params;
  const payload = await getPayloadClient();
  const invite = await authorize(req, payload, slug);
  if (!invite) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { state?: unknown } | null;
  const state = cleanState(body?.state);
  if (!state) return NextResponse.json({ error: "Invalid invite" }, { status: 400 });

  await payload.update({ collection: "invites", id: invite.id, data: { state, names: coupleNames(state) }, overrideAccess: true });
  return NextResponse.json({ ok: true, paid: isLive(invite), plan: invite.plan ?? null });
}
