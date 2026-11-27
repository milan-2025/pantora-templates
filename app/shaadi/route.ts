import { getPayloadClient } from "@/lib/cms/queries";
import { getPlanConfig } from "@/lib/invites";
import { landingHtml } from "@/lib/shaadi/landing";
import { getReviews } from "@/lib/reviewsServer";

export const dynamic = "force-dynamic";

/** Old editor links that carried editor settings in the address (/shaadi?edit=…, ?pv=1) now open the editor. */
const EDITOR_PARAMS = ["edit", "pv", "reel"];

/** The wedding invite maker's landing page. The editor itself is at /shaadi/create. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (EDITOR_PARAMS.some((p) => url.searchParams.has(p))) {
    return Response.redirect(new URL("/shaadi/create" + url.search, url), 307);
  }
  const payload = await getPayloadClient();
  const [cfg, reviews] = await Promise.all([getPlanConfig(payload), getReviews(payload, "invites")]);
  const site = process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  const html = landingHtml({ plans: cfg.plans, banner: cfg.banner, months: cfg.months, site, qs: url.searchParams.toString(), reviews });
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
