import "server-only";
import type { Payload } from "payload";
import { getSettings } from "@/lib/cms/queries";
import { sendDeliveryEmail } from "@/lib/email";
import { whatsappLink } from "@/lib/format";
import type { Product } from "@/payload-types";

/**
 * Marks an order paid and emails the buyer their files.
 * Safe to call more than once for the same order (the checkout page and Razorpay's webhook
 * both call it): only the first call changes the order and sends the email.
 */
export async function markOrderPaid(payload: Payload, orderId: string, paymentId?: string) {
  const found = await payload.find({ collection: "orders", where: { orderId: { equals: orderId } }, limit: 1, depth: 0 });
  const existing = found.docs[0];
  if (!existing) return { found: false as const };
  if (existing.paymentStatus === "paid") return { found: true as const, alreadyPaid: true, emailSent: false };

  // Conditional update: only flips orders that aren't paid yet, so two simultaneous calls
  // can't both "win" and double-send.
  const updated = await payload.update({
    collection: "orders",
    where: { orderId: { equals: orderId }, paymentStatus: { not_equals: "paid" } },
    data: {
      paymentStatus: "paid",
      paidAt: new Date().toISOString(),
      ...(paymentId ? { paymentId } : {}),
      commissionStatus: existing.affiliate ? "pending" : "none",
    },
    depth: 1,
  });
  const order = updated.docs[0];
  if (!order) return { found: true as const, alreadyPaid: true, emailSent: false };

  const product = order.product as Product;
  const settings = await getSettings();
  const email = await sendDeliveryEmail({
    orderId,
    customerName: order.customerName,
    email: order.email,
    productName: product.name,
    hasFile: Boolean(product.downloadFile),
    googleSheetsCopyUrl: product.googleSheetsCopyUrl,
    supportWhatsapp: whatsappLink(settings.whatsappNumber, settings.whatsappMessage),
    bonus:
      order.bonusIncluded && product.bonus?.title
        ? { title: product.bonus.title, hasFile: Boolean(product.bonus.file), link: product.bonus.link }
        : null,
    addOns: (order.addOns ?? [])
      .filter((a) => a.product && typeof a.product === "object")
      .map((a) => {
        const p = a.product as Product;
        return { id: String(p.id), name: a.name || p.name, hasFile: Boolean(p.downloadFile), googleSheetsCopyUrl: p.googleSheetsCopyUrl };
      }),
  });
  return { found: true as const, alreadyPaid: false, emailSent: email.sent };
}
