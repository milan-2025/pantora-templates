import { NextResponse } from "next/server";
import { APIError } from "payload";
import { getPayloadClient } from "@/lib/cms/queries";
import { authorize, checkSlugShape, cleanState, coupleNames, isLive } from "@/lib/invites";
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

/**
 * The couple changes their invite link (needs their private edit token). Allowed before and after payment:
 * the old link keeps working and forwards guests to the new one.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  if (!rateLimit(`invite-link:${clientIp(req)}`, 20, 3_600_000)) {
    return NextResponse.json({ error: "Too many changes. Please try again later." }, { status: 429 });
  }
  const { slug } = await params;
  const payload = await getPayloadClient();
  const invite = await authorize(req, payload, slug);
  if (!invite) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { want?: unknown } | null;
  const { slug: want, error } = checkSlugShape(body?.want);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (want === invite.slug) return NextResponse.json({ slug: want });
  try {
    const doc = await payload.update({ collection: "invites", id: invite.id, data: { slug: want }, overrideAccess: true });
    return NextResponse.json({ slug: doc.slug });
  } catch (e) {
    const msg = e instanceof APIError ? e.message : "That link is already taken. Please choose another.";
    return NextResponse.json({ error: msg }, { status: 409 });
  }
}
