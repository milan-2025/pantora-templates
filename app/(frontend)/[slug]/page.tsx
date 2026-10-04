import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageBySlug, getPayloadClient, getProductBySlug, getSettings } from "@/lib/cms/queries";
import { seoMetadata } from "@/lib/cms/seo";
import { RenderBlocks } from "@/components/blocks/RenderBlocks";
import { SiteShell } from "@/components/SiteShell";
import { ProductLanding } from "@/components/landing/ProductLanding";

export const revalidate = 300;

type Args = { params: Promise<{ slug: string }> };

/** Pre-render every published product and page; new ones are rendered on first visit and then cached. */
export async function generateStaticParams() {
  const payload = await getPayloadClient();
  const published = { _status: { equals: "published" } } as const;
  const [products, pages] = await Promise.all([
    payload.find({ collection: "products", where: published, limit: 200, depth: 0, select: { slug: true } }),
    payload.find({ collection: "pages", where: published, limit: 500, depth: 0, select: { slug: true } }),
  ]);
  return [...products.docs, ...pages.docs].map((d) => ({ slug: d.slug })).filter((p) => p.slug && p.slug !== "home");
}

/**
 * pandoratemplates.com/<slug>
 *   → a Product's animated sales page (e.g. /wedding_planner), or
 *   → a Page built from blocks in the admin (e.g. /ultimateweddingplanner, /terms).
 */
export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (product) return seoMetadata(product.seo, { title: product.name, description: product.tagline });
  const page = await getPageBySlug(slug);
  if (page) return seoMetadata(page.seo, { title: page.title });
  return {};
}

export default async function SlugPage({ params }: Args) {
  const { slug } = await params;
  if (slug === "home") notFound(); // the home page lives at "/"

  const [product, settings] = await Promise.all([getProductBySlug(slug), getSettings()]);
  if (product) return <ProductLanding product={product} settings={settings} />;

  const page = await getPageBySlug(slug);
  if (!page) notFound();

  return (
    <SiteShell>
      <RenderBlocks blocks={page.layout} settings={settings} />
    </SiteShell>
  );
}
