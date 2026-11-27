import "server-only";
import { cache } from "react";
import { getPayload } from "payload";
import config from "@payload-config";
import { CATEGORIES, LANDING_PAGES, productCategory, type Category } from "@/lib/siteLinks";

export const getPayloadClient = () => getPayload({ config });

// The Local API skips access control, so public queries filter to published docs explicitly.
const published = { _status: { equals: "published" } } as const;

export const getSettings = cache(async () => {
  const payload = await getPayloadClient();
  return payload.findGlobal({ slug: "site-settings", depth: 1 });
});

export const getProductBySlug = cache(async (slug: string) => {
  const payload = await getPayloadClient();
  const res = await payload.find({
    collection: "products",
    where: { slug: { equals: slug }, ...published },
    depth: 1,
    limit: 1,
  });
  return res.docs[0] ?? null;
});

export const getPageBySlug = cache(async (slug: string) => {
  const payload = await getPayloadClient();
  const res = await payload.find({
    collection: "pages",
    where: { slug: { equals: slug }, ...published },
    depth: 2,
    limit: 1,
  });
  return res.docs[0] ?? null;
});

export const getProducts = cache(async (ids?: string[]) => {
  const payload = await getPayloadClient();
  const res = await payload.find({
    collection: "products",
    where: { ...published, ...(ids?.length ? { id: { in: ids } } : {}) },
    depth: 1,
    limit: 50,
    sort: "name",
  });
  return res.docs;
});

/** Name + address of every published product, for menus and footers (no images, so it is cheap). */
export const getProductLinks = cache(async () => {
  const payload = await getPayloadClient();
  const res = await payload.find({
    collection: "products",
    where: published,
    depth: 1,
    limit: 50,
    sort: "name",
    select: { name: true, slug: true, tagline: true, category: true, cardImage: true },
  });
  return res.docs.map((d) => ({
    name: d.name,
    slug: d.slug,
    tagline: d.tagline ?? null,
    category: productCategory({ slug: d.slug, name: d.name, category: d.category }),
    image: typeof d.cardImage === "object" && d.cardImage?.url ? d.cardImage.url : null,
  }));
});

export type CatalogueItem = { title: string; text: string; url: string; cta: string; icon: string; image?: string | null; kind: "app" | "template" };
export type CatalogueGroup = { category: Category; apps: CatalogueItem[]; templates: CatalogueItem[] };

/** Every app and published template, grouped by category (the menu, footer, homepage and category pages all use it). */
export const getCatalogue = cache(async (): Promise<CatalogueGroup[]> => {
  const products = await getProductLinks().catch(() => []);
  return CATEGORIES.map((category) => ({
    category,
    apps: LANDING_PAGES.filter((p) => p.category === category.key).map((p) => ({
      title: p.label, text: p.description, url: p.url, cta: p.cta, icon: p.icon, kind: "app" as const,
    })),
    templates: products
      .filter((p) => p.category === category.key)
      .map((p) => ({
        title: p.name, text: p.tagline ?? "", url: `/${p.slug}`, cta: "See what's inside", icon: "FileSpreadsheet", image: p.image, kind: "template" as const,
      })),
  }));
});

export const getPosts = cache(async () => {
  const payload = await getPayloadClient();
  const res = await payload.find({ collection: "posts", where: published, depth: 1, limit: 100, sort: "-publishedAt" });
  return res.docs;
});

export const getPostBySlug = cache(async (slug: string) => {
  const payload = await getPayloadClient();
  const res = await payload.find({
    collection: "posts",
    where: { slug: { equals: slug }, ...published },
    depth: 1,
    limit: 1,
  });
  return res.docs[0] ?? null;
});
