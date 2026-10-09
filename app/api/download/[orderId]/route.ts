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

  const file = (order.product as Product | undefined)?.downloadFile as ProductFile | undefined;
  if (!file?.filename || !file.url) {
    return NextResponse.json(
      { error: "The file isn't available yet. Please contact us and we'll send it to you." },
      { status: 404 },
    );
  }

  const { exp, sig } = signDownload(file.filename);
  // Payload may give an absolute URL (serverURL); keep the visitor on the domain they used.
  const origin = new URL(req.url).origin;
  const fileUrl = new URL(file.url, origin);
  const target = new URL(fileUrl.pathname + fileUrl.search, origin);
  target.searchParams.set("exp", exp);
  target.searchParams.set("sig", sig);
  return NextResponse.redirect(target, 302);
}
