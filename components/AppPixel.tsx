import Script from "next/script";
import { TRACKED, variantsFor } from "@/lib/tracking";

/**
 * Loads /pt-track.js (the shared Meta Pixel for app pages) labelled with one product, so Events Manager can tell
 * HostBook, Stays and the rest apart. `view={false}` skips ViewContent on screens inside an app.
 */
export function AppPixel({ product, view = true }: { product: keyof typeof TRACKED; view?: boolean }) {
  const p = TRACKED[product];
  if (!p) return null;
  return (
    <Script
      id={`pt-track-${p.id}`}
      src="/pt-track.js"
      strategy="afterInteractive"
      data-id={p.id}
      data-name={p.name}
      data-category={p.category}
      {...(variantsFor(product) ? { "data-variants": variantsFor(product) } : {})}
      {...(view ? {} : { "data-view": "off" })}
    />
  );
}
