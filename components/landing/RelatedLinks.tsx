import type { Product } from "@/payload-types";
import { getProductLinks } from "@/lib/cms/queries";
import { relatedLandingPages } from "@/lib/siteLinks";
import { LinkCards, type LinkCard } from "@/components/sections/LinkCards";

/**
 * "You might also like" at the end of a product's sales page: the planner / invite maker for wedding products,
 * plus up to three other products from the shop. Keeps product pages from being dead ends for visitors and search engines.
 */
export async function RelatedLinks({ product }: { product: Product }) {
  const others = (await getProductLinks().catch(() => [])).filter((p) => p.slug !== product.slug).slice(0, 3);
  const topic = [product.name, product.slug, product.tagline].filter(Boolean).join(" ");
  const cards: LinkCard[] = [
    ...relatedLandingPages(topic).map((p) => ({ title: p.label, text: p.description, url: p.url, cta: p.cta, icon: p.icon })),
    ...others.map((p) => ({ title: p.name, text: p.tagline, url: `/${p.slug}`, cta: "See what's inside", icon: "FileSpreadsheet" })),
  ].slice(0, 6);
  return <LinkCards id="more" eyebrow="More from Pandora Templates" heading="You might also like" cards={cards} tone="sand" />;
}
