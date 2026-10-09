import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/cms/queries";
import { signDownload } from "@/lib/cms/downloadToken";
import type { Product, ProductFile } from "@/payload-types";

export const dynamic = "force-dynamic";

/**
 * Personal download link from the delivery email / success page.
 * Only paid orders get through; they're redirected to a signed link that expires in 10 minutes.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const payload = await getPayloadClient();
  const found = await payload.find({ collection: "orders", where: { orderId: { equals: orderId } }, limit: 1, depth: 2 });
  const order = found.docs[0];

  if (!order || order.paymentStatus !== "paid") {
    return NextResponse.json({ error: "This download link isn't valid." }, { status: 403 });
  }

  const file = (order.product as Product | undefined)?.downloadFile as ProductFile | undefined;
  if (!file?.filename || !file.url) {
    return NextResponse.json(
      { error: "The file isn't available yet. Please contact us and we'll send it to you." },
      { status: 404 },
    );
  }

  const { exp, sig } = signDownload(file.filename);
  // Redirect with a *relative* link so the browser stays on the domain the visitor is using.
  // (Behind a hosting proxy, req.url is the internal address, e.g. https://0.0.0.0:3000.)
  const target = new URL(file.url, "http://placeholder.local");
  target.searchParams.set("exp", exp);
  target.searchParams.set("sig", sig);
  return new Response(null, {
    status: 302,
    headers: { Location: target.pathname + target.search, "Cache-Control": "no-store" },
  });
}
