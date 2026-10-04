"use client";

import { useEffect } from "react";
import { REF_COOKIE } from "@/lib/referral";

/** Remembers an affiliate's ?ref=CODE for 30 days so the code is applied at checkout. */
export function RefCapture() {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && /^[A-Za-z0-9_-]{3,30}$/.test(ref)) {
      document.cookie = `${REF_COOKIE}=${encodeURIComponent(ref.toUpperCase())}; max-age=${60 * 60 * 24 * 30}; path=/; samesite=lax`;
    }
  }, []);
  return null;
}
