import type { MetadataRoute } from "next";
import { ROBOTS_DISALLOW } from "@/lib/siteLinks";

/** /robots.txt: keep admin areas, APIs, share links and the host portal out of search engines. Landing pages stay crawlable. */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...ROBOTS_DISALLOW] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
