import type { Product } from "@/payload-types";
import { getProductLinks } from "@/lib/cms/queries";
import { categoryByKey, productCategory, relatedLandingPages } from "@/lib/siteLinks";
import { LinkCards, type LinkCard } from "@/components/sections/LinkCards";

/**
 * "You might also like" at the end of a product's sales page: the apps in the product's category (e.g. the
 * workout app on the workout tracker's page), then other templates from the same category, then a link to the
 * category page. Keeps product pages from being dead ends for visitors and search engines.
 */
export async function RelatedLinks({ product }: { product: Product }) {
  const key = productCategory(product);
  const category = categoryByKey(key)!;
  const others = (await getProductLinks().catch(() => [])).filter((p) => p.slug !== product.slug && p.category === key).slice(0, 3);
  const cards: LinkCard[] = [
    ...relatedLandingPages(key).map((p) => ({ title: p.label, text: p.description, url: p.url, cta: p.cta, icon: p.icon })),
    ...others.map((p) => ({ title: p.name, text: p.tagline, url: `/${p.slug}`, cta: "See what's inside", icon: "FileSpreadsheet" })),
  ].slice(0, 5);
  cards.push({ title: `All of ${category.label}`, text: category.description, url: category.url, cta: "Explore", icon: category.icon });
  return (
    <LinkCards
      id="more"
      eyebrow="More from Pandora Templates"
      heading="You might also like"
      cards={cards}
      tone="sand"
      accent={{ color: category.accent, tint: category.tint }}
    />
  );
}
