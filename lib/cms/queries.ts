import "server-only";
import { cache } from "react";
import { getPayload } from "payload";
import config from "@payload-config";

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

export const getProducts = cache(async (ids?: number[]) => {
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
