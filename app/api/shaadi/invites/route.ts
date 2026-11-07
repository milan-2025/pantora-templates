import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/cms/queries";
import { cleanState, coupleNames, isReservedSlug, newToken, randomSuffix, slugify } from "@/lib/invites";
import { clientIp, rateLimit } from "@/lib/rateLimit";

/** Creates a draft invite the first time a couple changes something. Returns its link and private edit token. */
export async function POST(req: Request) {
  if (!rateLimit(`invite-new:${clientIp(req)}`, 20, 3_600_000)) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as { state?: unknown; want?: unknown } | null;
  const state = cleanState(body?.state);
  if (!state) return NextResponse.json({ error: "Invalid invite" }, { status: 400 });

  const payload = await getPayloadClient();
  const want = slugify(body?.want);
  const base = want || slugify(`${state.b}-${state.g}`) || "our-wedding";
  const token = newToken();

  for (let attempt = 0; attempt < 6; attempt++) {
    // A link the couple chose is tried as typed first; auto-made ones always get a short code.
    const slug = attempt === 0 && want && !isReservedSlug(want) ? want : `${base}-${randomSuffix()}`;
    try {
      await payload.create({ collection: "invites", data: { slug, names: coupleNames(state), editToken: token, state }, overrideAccess: true });
      return NextResponse.json({ slug, token });
    } catch {
      // most likely the link is taken (unique index); try another
    }
  }
  return NextResponse.json({ error: "Couldn't create your link. Please try again." }, { status: 500 });
}
