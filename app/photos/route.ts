import { getPayloadClient } from "@/lib/cms/queries";
import { getPhotoPlans } from "@/lib/photos/plans";
import { landingHtml } from "@/lib/photos/pages/landing";

export const dynamic = "force-dynamic";

/** /photos: wedding photo sharing landing page, sign-up and sign-in. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const cfg = await getPhotoPlans(await getPayloadClient());
  const site = (process.env.NEXT_PUBLIC_SITE_URL || url.origin).replace(/\/$/, "");
  const source = (url.searchParams.get("utm_source") || url.searchParams.get("ref") || "").slice(0, 60);
  const html = landingHtml({ plans: cfg.plans, banner: cfg.banner, renewalPrice: cfg.renewalPrice, site, source });
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
