import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/cms/queries";
import { checkSlugShape, cleanState, coupleNames, newToken, randomSuffix, slugTaken, slugify } from "@/lib/invites";
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
  const chosen = checkSlugShape(body?.want);
  const want = !chosen.error && !(await slugTaken(payload, chosen.slug)) ? chosen.slug : "";
  const base = slugify(body?.want) || slugify(`${state.b}-${state.g}`) || "our-wedding";
  const token = newToken();

  for (let attempt = 0; attempt < 6; attempt++) {
    // A link the couple chose is tried as typed first; auto-made ones always get a short code.
    const slug = attempt === 0 && want ? want : `${base}-${randomSuffix()}`;
    try {
      await payload.create({ collection: "invites", data: { slug, names: coupleNames(state), editToken: token, state }, overrideAccess: true });
      return NextResponse.json({ slug, token });
    } catch {
      // most likely the link is taken (unique index); try another
    }
  }
  return NextResponse.json({ error: "Couldn't create your link. Please try again." }, { status: 500 });
}

/** Is a link free? Used by the editor while the couple types: GET ?want=<link>&mine=<their current link> */
export async function GET(req: Request) {
  if (!rateLimit(`link-check:${clientIp(req)}`, 120, 60_000)) return NextResponse.json({ error: "Slow down" }, { status: 429 });
  const q = new URL(req.url).searchParams;
  const { slug, error } = checkSlugShape(q.get("want"));
  if (error) return NextResponse.json({ slug, ok: false, error });
  if (slug === q.get("mine")) return NextResponse.json({ slug, ok: true, current: true });
  const taken = await slugTaken(await getPayloadClient(), slug);
  return NextResponse.json(taken ? { slug, ok: false, error: "Already taken. Try another." } : { slug, ok: true });
}
