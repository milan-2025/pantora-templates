import { NextResponse } from "next/server";
import { z } from "zod";
import { getPayloadClient } from "@/lib/cms/queries";
import { emailCouple } from "@/lib/inviteEmail";
import { authorize } from "@/lib/invites";
import { clientIp, rateLimit } from "@/lib/rateLimit";

const bodySchema = z.object({ email: z.email("Please enter a valid email") });

/** Saves the couple's email on their draft and emails them their private edit link (at most once an hour). */
export async function PUT(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!rateLimit(`invite-contact:${clientIp(req)}`, 10, 3_600_000)) return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  const { slug } = await params;
  const payload = await getPayloadClient();
  const invite = await authorize(req, payload, slug);
  if (!invite) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid email" }, { status: 400 });

  const email = parsed.data.email;
  const recentlyEmailed = invite.lastEmailedAt && Date.now() - new Date(invite.lastEmailedAt).getTime() < 3_600_000;
  const updated = await payload.update({ collection: "invites", id: invite.id, data: { contactEmail: email }, depth: 0, overrideAccess: true });
  if (invite.paymentStatus !== "paid" && !recentlyEmailed) {
    await emailCouple(payload, updated, { kind: "saved" }).catch((e) => console.error("[invite-contact]", e));
    await payload.update({ collection: "invites", id: invite.id, data: { lastEmailedAt: new Date().toISOString() }, depth: 0, overrideAccess: true });
  }
  return NextResponse.json({ ok: true });
}
