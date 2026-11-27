import { getPayloadClient } from "@/lib/cms/queries";

/** The site's Meta Pixel ID (Settings → Site settings → Tracking), for /pt-track.js on the app pages. Public: a Pixel ID is not a secret. */
export async function GET() {
  let id = "";
  try {
    const payload = await getPayloadClient();
    const s = (await payload.findGlobal({ slug: "site-settings", depth: 0 })) as { metaPixelId?: string | null };
    id = String(s.metaPixelId ?? process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "").replace(/\D/g, "");
  } catch {
    id = String(process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "").replace(/\D/g, "");
  }
  return Response.json({ id: id || null }, { headers: { "cache-control": "public, max-age=60, s-maxage=300" } });
}
