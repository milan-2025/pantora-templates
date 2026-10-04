"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getPayload } from "payload";
import config from "@payload-config";

/** Marks every owed commission for one affiliate as paid. Admin-only. */
export async function markCommissionPaid(formData: FormData) {
  const affiliateId = String(formData.get("affiliateId") ?? "");
  if (!affiliateId) return;

  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await headers() });
  if (!user) throw new Error("Not allowed");

  await payload.update({
    collection: "orders",
    where: {
      affiliate: { equals: affiliateId },
      paymentStatus: { equals: "paid" },
      commissionStatus: { equals: "pending" },
    },
    data: { commissionStatus: "paid" },
    user,
    overrideAccess: false,
  });
  revalidatePath("/admin/affiliate-earnings");
}
