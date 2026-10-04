import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/cms/queries";
import { getLiveData } from "@/lib/live";

export const dynamic = "force-dynamic";

/** Real-time offer numbers + recent purchases for a product page. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
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

  const data = await getLiveData(payload, product);
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
