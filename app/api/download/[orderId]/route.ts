import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/cms/queries";
import { signDownload } from "@/lib/cms/downloadToken";
import type { Product, ProductFile } from "@/payload-types";

export const dynamic = "force-dynamic";

/**
 * Personal download link from the delivery email / success page.
 * Only paid orders get through; they're redirected to a signed link that expires in 10 minutes.
 */
export async function GET(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const payload = await getPayloadClient();
  const found = await payload.find({ collection: "orders", where: { orderId: { equals: orderId } }, limit: 1, depth: 2 });
  const order = found.docs[0];

  if (!order || order.paymentStatus !== "paid") {
    return NextResponse.json({ error: "This download link isn't valid." }, { status: 403 });
  }

  // ?item=bonus → the quick-order bonus (only for orders that earned it)
  // ?item=addon-<productId> → an upsell product bought with this order
  const item = new URL(req.url).searchParams.get("item") ?? "";
  const product = order.product as Product | undefined;
  let file: ProductFile | undefined;
  if (item === "bonus") {
    if (!order.bonusIncluded) return NextResponse.json({ error: "This order doesn't include the bonus." }, { status: 403 });
    file = product?.bonus?.file as ProductFile | undefined;
  } else if (item.startsWith("addon-")) {
    const addonId = item.slice("addon-".length);
    const line = (order.addOns ?? []).find((a) => a.product && String(typeof a.product === "object" ? a.product.id : a.product) === addonId);
    if (!line) return NextResponse.json({ error: "This order doesn't include that add-on." }, { status: 403 });
    file = (typeof line.product === "object" ? line.product?.downloadFile : undefined) as ProductFile | undefined;
  } else {
    file = product?.downloadFile as ProductFile | undefined;
  }
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
