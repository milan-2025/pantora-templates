/** Stays: page metadata and structured data. Built only from guest-safe data, so nothing private can end up in it. */
import type { Metadata } from "next";
import { inr } from "./core";
import type { PublicProperty } from "./views";

type SiteSeo = { siteName: string; seo: { title: string; description: string; ogImage: string } };

export function propertyMetadata(p: PublicProperty, site: SiteSeo, canonicalPath: string | null, indexable: boolean): Metadata {
  const price = p.price?.from ? ` · from ${inr(p.price.from)}/night` : "";
  const description = (p.shortDescription || `${p.propertyType || "Stay"} in ${p.place} for up to ${p.maxGuests ?? "—"} guests.`).slice(0, 160);
  const image = p.photos[0]?.src || site.seo.ogImage || undefined;
  return {
    title: `${p.title} · ${p.place}${price}`.slice(0, 90) + ` | ${site.siteName}`,
    description,
    alternates: canonicalPath ? { canonical: canonicalPath } : undefined,
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    openGraph: { title: p.title, description, type: "website", siteName: site.siteName, images: image ? [{ url: image, width: 1200, height: 630, alt: p.title }] : undefined, ...(canonicalPath ? { url: canonicalPath } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title: p.title, description, images: image ? [image] : undefined },
  };
}

/** schema.org data for search engines: locality-level address only, guest price only when shown. */
export function jsonLd(p: PublicProperty, path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "";
  const data = {
    "@context": "https://schema.org",
    "@type": "VacationRental",
    name: p.title,
    identifier: p.code,
    description: p.shortDescription || p.description.slice(0, 300),
    url: base + path,
    image: p.photos.slice(0, 8).map((x) => x.src),
    address: { "@type": "PostalAddress", addressLocality: p.locality || p.city, addressRegion: p.state || p.city, addressCountry: "IN" },
    containsPlace: {
      "@type": "Accommodation",
      ...(p.maxGuests ? { occupancy: { "@type": "QuantitativeValue", maxValue: p.maxGuests } } : {}),
      ...(p.bedrooms ? { numberOfBedrooms: p.bedrooms } : {}),
      ...(p.bathrooms ? { numberOfBathroomsTotal: p.bathrooms } : {}),
      amenityFeature: p.amenityList.slice(0, 30).map((a) => ({ "@type": "LocationFeatureSpecification", name: a.label, value: true })),
    },
    ...(p.price?.from ? { priceRange: `${inr(p.price.from)}+ per night` } : {}),
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
