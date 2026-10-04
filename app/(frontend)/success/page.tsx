import type { Metadata } from "next";
import { getPayloadClient, getSettings } from "@/lib/cms/queries";
import { whatsappLink } from "@/lib/format";
import type { Product } from "@/payload-types";
import { TrackEvent } from "@/components/TrackEvent";
import { SuccessContent } from "./SuccessContent";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "You're all set!", robots: { index: false } };

type Args = { searchParams: Promise<{ order?: string }> };

export default async function SuccessPage({ searchParams }: Args) {
  const { order: orderId } = await searchParams;
  const payload = await getPayloadClient();
  const found = orderId
    ? await payload.find({ collection: "orders", where: { orderId: { equals: orderId } }, limit: 1, depth: 1 })
    : null;
  const order = found?.docs[0];
  const settings = await getSettings();
  const product = order?.product as Product | undefined;
  const paid = order?.paymentStatus === "paid";

  return (
    <div className="bg-glow grid min-h-screen place-items-center px-4 py-16">
      {paid && <TrackEvent event="Purchase" value={order.amount} name={product?.name} />}
      <SuccessContent
        paid={paid}
        orderId={order?.orderId ?? ""}
        firstName={order?.customerName.split(" ")[0] ?? ""}
        email={order?.email ?? ""}
        productName={product?.name ?? "your template"}
        productSlug={product?.slug ?? ""}
        hasFile={Boolean(product?.downloadFile)}
        googleSheetsCopyUrl={product?.googleSheetsCopyUrl ?? null}
        whatsappHref={whatsappLink(
          settings.whatsappNumber,
          `Hi! I bought the ${product?.name ?? "template"} (order ${order?.orderId ?? ""}) and need a little help.`,
        )}
      />
    </div>
  );
}
