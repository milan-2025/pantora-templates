"use client";

import { useEffect } from "react";
import { track } from "@/components/Pixel";
import { product } from "@/lib/content";

/** Fires a Meta Pixel event once on mount. */
export function TrackEvent({ event }: { event: "ViewContent" | "InitiateCheckout" | "Purchase" }) {
  useEffect(() => {
    track(event, { value: product.price, currency: product.currency, content_name: product.name });
  }, [event]);
  return null;
}
