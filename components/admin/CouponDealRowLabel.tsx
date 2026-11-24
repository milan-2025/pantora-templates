"use client";

import { useRowLabel } from "@payloadcms/ui";

const KIND: Record<string, string> = { shop: "Shop product", planner: "Planner plan", bundle: "Planner + Invite bundle", invite: "Invite plan", workout: "Workout plan" };

/** Shows each product deal as e.g. "Invite plan (premium): ₹499 special price" in the code's list. */
export function CouponDealRowLabel() {
  const { data, rowNumber } = useRowLabel<{ kind?: string; type?: string; value?: number; invitePlan?: string }>();
  if (!data?.kind) return <span>Product deal {(rowNumber ?? 0) + 1}</span>;
  const v = data.value ?? 0;
  const deal = data.type === "flat" ? `₹${v} off` : data.type === "price" ? `special price ₹${v}` : `${v}% off`;
  const which = data.kind === "invite" && data.invitePlan ? ` (${data.invitePlan})` : "";
  return <span>{KIND[data.kind] ?? data.kind}{which}: {deal}</span>;
}
