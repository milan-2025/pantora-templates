import type { Product, SiteSetting } from "@/payload-types";
import type { OfferState } from "@/lib/pricing";

/** Everything a landing-page section may need. */
export type LandingProps = {
  product: Product;
  offer: OfferState;
  settings: SiteSetting;
};

export const checkoutHref = (product: Product) => `/checkout?product=${encodeURIComponent(product.slug)}`;
