import type { MetadataRoute } from "next";

/** /robots.txt: keep admin areas, APIs, share links and the host portal out of search engines. */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/stays/admin", "/stays/host", "/stay/s/", "/checkout", "/success", "/CRM", "/planner"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
