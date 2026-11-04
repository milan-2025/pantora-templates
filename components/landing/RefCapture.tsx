"use client";

import { useEffect } from "react";
import { REF_COOKIE, isValidRefCode, refCookieValue } from "@/lib/referral";

/** Remembers an affiliate's ?ref=CODE (for the time set in Site settings) so the code is applied at checkout. */
export function RefCapture({ maxAgeSeconds }: { maxAgeSeconds: number }) {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (isValidRefCode(ref)) {
      document.cookie = `${REF_COOKIE}=${encodeURIComponent(refCookieValue(ref))}; max-age=${maxAgeSeconds}; path=/; samesite=lax`;
    }
  }, [maxAgeSeconds]);
  return null;
}
