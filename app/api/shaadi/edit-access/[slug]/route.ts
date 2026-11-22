import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/cms/queries";
import { EditAccessError, startEditAccess, verifyEditAccess } from "@/lib/shaadi/editAccess";
import { clientIp, rateLimit } from "@/lib/rateLimit";

/**
 * The hidden "edit" button on a guest invite. { email } → emails a code (if that email may edit);
 * { email, code } → { slug, token } so the page can open /i/<link>/edit.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!b) throw new EditAccessError("Invalid request");
    const ip = clientIp(req), email = String(b.email ?? "").toLowerCase();
    const payload = await getPayloadClient();
    if (b.code !== undefined) {
      if (!rateLimit(`invite-edit-verify:${ip}`, 20, 15 * 60_000)) throw new EditAccessError("Too many tries. Please wait a few minutes.", 429);
      return NextResponse.json(await verifyEditAccess(payload, slug, b.email, b.code), { headers: { "cache-control": "no-store" } });
    }
    if (!rateLimit(`invite-edit-code:${ip}`, 8, 15 * 60_000) || !rateLimit(`invite-edit-code:${email}`, 4, 15 * 60_000)) throw new EditAccessError("Too many codes asked for. Please wait a few minutes.", 429);
    return NextResponse.json(await startEditAccess(payload, slug, b.email), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof EditAccessError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[invite-edit-access]", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
