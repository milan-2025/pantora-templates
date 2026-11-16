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
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
};

export default withPayload(nextConfig, { devBundleServerPackages: false });
