"use client";

import Script from "next/script";

type FbqEvent = "ViewContent" | "InitiateCheckout" | "Purchase" | "Lead";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/** Fire a Meta Pixel standard event. No-op when the pixel isn't configured. */
export function track(event: FbqEvent, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.fbq) window.fbq("track", event, params);
}

/** Meta (Instagram/Facebook) Pixel. The ID comes from Site settings (or NEXT_PUBLIC_META_PIXEL_ID). */
export function Pixel({ id }: { id?: string | null }) {
  const PIXEL_ID = (id || process.env.NEXT_PUBLIC_META_PIXEL_ID || "").replace(/\D/g, "");
  if (!PIXEL_ID) return null;
  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${PIXEL_ID}');fbq('track','PageView');`}
    </Script>
  );
}
