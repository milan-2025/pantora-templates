import type { MetadataRoute } from "next";
import { getPayloadClient } from "@/lib/cms/queries";
import { loadSitemap } from "@/lib/stays/pages";
import { SITEMAP_LANDING_PAGES } from "@/lib/siteLinks";

export const dynamic = "force-dynamic";

/**
 * /sitemap.xml for the whole site: published pages, products and blog posts, plus every PUBLIC stay
 * (unlisted and private stays, share links, the host portal and dashboards are never listed),
 * and the stand-alone landing pages (planner, invite maker, CRM).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const out: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    ...SITEMAP_LANDING_PAGES.map((p) => ({ url: `${base}${p.url}`, changeFrequency: p.changeFrequency, priority: p.priority })),
  ];
  try {
    const payload = await getPayloadClient();
    const published = { _status: { equals: "published" } } as const;
    const [pages, products, posts] = await Promise.all([
      payload.find({ collection: "pages", where: published, limit: 500, depth: 0 }),
      payload.find({ collection: "products", where: published, limit: 500, depth: 0 }),
      payload.find({ collection: "posts", where: published, limit: 1000, depth: 0 }),
    ]);
    for (const d of [...pages.docs, ...products.docs]) if (d.slug && d.slug !== "home") out.push({ url: `${base}/${d.slug}`, lastModified: d.updatedAt });
    if (posts.docs.length) out.push({ url: `${base}/blog` });
    for (const d of posts.docs) out.push({ url: `${base}/blog/${d.slug}`, lastModified: d.updatedAt });
  } catch (e) {
    console.error("[sitemap] site pages", e);
  }
  try {
    out.push({ url: `${base}/stays`, changeFrequency: "daily", priority: 0.9 }, { url: `${base}/stays/search`, changeFrequency: "daily", priority: 0.6 });
    for (const s of await loadSitemap()) out.push({ url: `${base}/stay/${s.slug}`, lastModified: new Date(s.updatedAt), changeFrequency: "weekly", priority: 0.8 });
  } catch (e) {
    console.error("[sitemap] stays", e);
  }
  return out;
}
