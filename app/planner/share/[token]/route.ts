import { getPayloadClient } from "@/lib/cms/queries";
import { sharedRunSheet } from "@/lib/planner/server";
import { runSheetPage } from "@/lib/planner/sharePage";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/** A couple's run sheet, shared by link with their coordinator or caterer: view only, no sign-in. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const headers = { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer" };
  if (!rateLimit(`planner-share-view:${clientIp(req)}`, 120, 60_000)) return new Response("Too many requests. Please wait a minute.", { status: 429, headers: { "content-type": "text/plain" } });
  try {
    const payload = await getPayloadClient();
    const page = runSheetPage(await sharedRunSheet(payload, token));
    return new Response(page.html, { status: page.status, headers });
  } catch (e) {
    console.error("[planner-share]", e);
    return new Response("Something went wrong. Please try again.", { status: 500, headers: { "content-type": "text/plain" } });
  }
}
