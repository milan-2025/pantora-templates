"use client";

import { useEffect } from "react";
import { track } from "@/components/Pixel";

/** Fires a Meta Pixel event once on mount. */
export function TrackEvent({
  event,
  value,
  name,
}: {
  event: "ViewContent" | "InitiateCheckout" | "Purchase";
  value?: number;
  name?: string;
}) {
  useEffect(() => {
    track(event, { value, currency: "INR", content_name: name });
  }, [event, value, name]);
  return null;
}
