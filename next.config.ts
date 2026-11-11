import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig: NextConfig = {
  // LeadFlow CRM lives at /CRM (static screens in public/CRM, server code in app/api/crm).
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/CRM", destination: "/CRM/index.html" },
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
