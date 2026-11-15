import { getPayloadClient } from "@/lib/cms/queries";
import { supportToken } from "@/lib/planner/server";

/**
 * Admin-only, from /admin ▸ Customer planners: opens that planner read-only (2-hour support pass).
 * The pass travels in the URL fragment, which browsers never send to servers or put in referrers.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payload = await getPayloadClient();
  const { user } = await payload.auth({ headers: req.headers });
  if (!user) return new Response("Please log in to /admin first.", { status: 401 });
  const doc = await payload.findByID({ collection: "planners" as never, id, depth: 0 }).catch(() => null);
  if (!doc) return new Response("Planner not found", { status: 404 });
  return new Response(null, {
    status: 303,
    headers: { Location: `/planner#support=${supportToken(id)}`, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
