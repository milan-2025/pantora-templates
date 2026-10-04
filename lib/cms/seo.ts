import type { Metadata } from "next";
import type { Media } from "@/payload-types";
import { mediaDoc } from "@/lib/format";

/** Builds page metadata from an SEO group, with sensible fallbacks. */
export function seoMetadata(
  seo: { title?: string | null; description?: string | null; image?: string | Media | null } | null | undefined,
  fallback: { title: string; description?: string | null },
): Metadata {
  const title = seo?.title || fallback.title;
  const description = seo?.description || fallback.description || undefined;
  const image = mediaDoc(seo?.image ?? null);
  return {
    title,
    description,
    openGraph: { title, description, images: image ? [{ url: image.url, alt: image.alt }] : undefined },
  };
}
