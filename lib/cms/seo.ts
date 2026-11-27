import type { Metadata } from "next";
import type { Media } from "@/payload-types";
import { mediaDoc } from "@/lib/format";

/** Shown when a page has no share image of its own (WhatsApp, Facebook, X, LinkedIn previews). */
export const DEFAULT_SHARE_IMAGE = { url: "/og-default.jpg", width: 1200, height: 630, alt: "Pandora Templates: ready-to-use tools for life's big projects" };

/**
 * Builds page metadata from an SEO group, with sensible fallbacks.
 * `path` (e.g. "/terms") sets the canonical address, so ?ref=… and other links count as one page in search.
 */
export function seoMetadata(
  seo: { title?: string | null; description?: string | null; image?: string | Media | null } | null | undefined,
  fallback: { title: string; description?: string | null; path?: string },
): Metadata {
  // The site adds " | Pandora Templates" to every title, so a title typed with the brand at the end would show it twice.
  const title = (seo?.title || fallback.title).replace(/\s*[|·–-]\s*Pandora Templates\s*$/i, "") || fallback.title;
  const description = seo?.description || fallback.description || undefined;
  const image = mediaDoc(seo?.image ?? null);
  return {
    title,
    description,
    ...(fallback.path ? { alternates: { canonical: fallback.path } } : {}),
    openGraph: {
      title,
      description,
      ...(fallback.path ? { url: fallback.path } : {}),
      images: image ? [{ url: image.url, alt: image.alt }] : [DEFAULT_SHARE_IMAGE],
    },
    twitter: { card: "summary_large_image" },
  };
}
