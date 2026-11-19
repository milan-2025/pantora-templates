import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig: NextConfig = {
  experimental: { cpus: 2 },
  // LeadFlow CRM lives at /CRM (static screens in public/CRM, server code in app/api/crm).
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/CRM", destination: "/CRM/index.html" },
        // Online wedding planner (static app in public/planner, server code in app/api/planner).
        { source: "/planner", destination: "/planner/index.html" },
        { source: "/planner/signup", destination: "/planner/index.html" },
        { source: "/planner/login", destination: "/planner/index.html" },
        { source: "/crm", destination: "/crm-software.html" },
        { source: "/CRM/api.php", destination: "/api/crm" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  // Stays: keep private screens and share links out of search engines, and stop other sites framing them.
  async headers() {
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      { source: "/stay/s/:token*", headers: noindex },
      { source: "/stays/admin", headers: [...noindex, { key: "X-Frame-Options", value: "DENY" }] },
      { source: "/stays/host", headers: [...noindex, { key: "X-Frame-Options", value: "DENY" }] },
      { source: "/api/stays/:path*", headers: noindex },
      { source: "/stays/admin-sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/stays/admin" }] },
      // Wedding planner: offline worker for /planner, and run sheets shared by link stay out of search engines.
      { source: "/planner/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/planner" }] },
      { source: "/planner/share/:token*", headers: [...noindex, { key: "X-Frame-Options", value: "DENY" }] },
    ];
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
};

export default withPayload(nextConfig, { devBundleServerPackages: false });
