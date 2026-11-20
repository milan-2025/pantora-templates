/** schema.org data (JSON-LD) shared by the site's pages: breadcrumbs, the organisation and the website. */

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

/** Breadcrumb trail, e.g. Home › Blog › Post. Paths are site-relative ("/blog"). */
export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, item: base + t.path })),
  };
}

/** Who runs the site, with its social profiles: helps search engines show the brand panel and logo. */
export function organizationJsonLd(o: { name: string; description?: string | null; sameAs?: (string | null | undefined)[]; email?: string | null }) {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${base}/#organization`,
    name: o.name,
    url: `${base}/`,
    logo: `${base}/apple-icon.png`,
    ...(o.description ? { description: o.description } : {}),
    ...(o.email ? { email: o.email } : {}),
    ...(o.sameAs?.filter(Boolean).length ? { sameAs: o.sameAs.filter(Boolean) } : {}),
  };
}

export function websiteJsonLd(name: string) {
  const base = siteUrl();
  return { "@context": "https://schema.org", "@type": "WebSite", "@id": `${base}/#website`, name, url: `${base}/`, publisher: { "@id": `${base}/#organization` } };
}

/** Safe to put inside a <script> tag. */
export const jsonLdString = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
