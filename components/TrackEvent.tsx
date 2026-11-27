"use client";

import { useEffect } from "react";
import { track } from "@/components/Pixel";
import { SHOP_CATEGORIES } from "@/lib/tracking";

/** Fires a Meta Pixel event once on mount. */
export function TrackEvent({
  event,
  value,
  name,
  id,
}: {
  event: "ViewContent" | "InitiateCheckout" | "Purchase";
  value?: number;
  name?: string;
  /** Product slug: sent as content_ids, with its category, so each product gets its own custom conversion. */
  id?: string;
}) {
  useEffect(() => {
    const extra = id ? { content_ids: [id], content_type: "product", content_category: SHOP_CATEGORIES[id] } : {};
    track(event, { value, currency: "INR", content_name: name, ...extra });
  }, [event, value, name, id]);
  return null;
}
