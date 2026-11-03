import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/cms/queries";
import { getLiveData } from "@/lib/live";
import { cookies } from "next/headers";
import { ensureVisitorStart } from "@/lib/offerWindow";
import { findAffiliate } from "@/lib/pricing";
import { REF_COOKIE } from "@/lib/referral";

export const dynamic = "force-dynamic";

/** Real-time offer numbers + recent purchases for a product page. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const payload = await getPayloadClient();
  const res = await payload.find({
    collection: "products",
    where: { slug: { equals: slug }, _status: { equals: "published" } },
    limit: 1,
    depth: 0,
  });
  const product = res.docs[0];
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Starts this visitor's quick-order bonus window on their first visit (signed cookie).
  const visitorStart = product.bonus?.enabled ? await ensureVisitorStart(product) : null;
  // An affiliate's code (from the ?ref=CODE link, or remembered in the cookie) shows the referral price.
  const refCode = new URL(req.url).searchParams.get("ref") || (await cookies()).get(REF_COOKIE)?.value;
  const affiliate = await findAffiliate(payload, refCode);
  const data = await getLiveData(payload, product, { visitorStart }, affiliate);
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
