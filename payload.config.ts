import path from "path";
import { fileURLToPath } from "url";
import { buildConfig } from "payload";
import { sqliteAdapter } from "@payloadcms/db-sqlite";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { vercelBlobStorage } from "@payloadcms/storage-vercel-blob";
import { resendAdapter } from "@payloadcms/email-resend";
import sharp from "sharp";

import { Users } from "./collections/Users";
import { Media } from "./collections/Media";
import { ProductFiles } from "./collections/ProductFiles";
import { Products } from "./collections/Products";
import { Pages } from "./collections/Pages";
import { Posts } from "./collections/Posts";
import { Affiliates } from "./collections/Affiliates";
import { Orders } from "./collections/Orders";
import { ContactSubmissions } from "./collections/ContactSubmissions";
import { SiteSettings } from "./globals/SiteSettings";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Sites allowed to use the admin login cookie (CSRF protection): the real domain plus
// Vercel's deployment URLs. Empty in local development so any localhost port works.
const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? [
        process.env.NEXT_PUBLIC_SITE_URL,
        process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
        process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
        process.env.VERCEL_BRANCH_URL && `https://${process.env.VERCEL_BRANCH_URL}`,
      ].filter((u): u is string => Boolean(u))
    : [];

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || "dev-secret-change-me",
  csrf: allowedOrigins,
  cors: allowedOrigins,
  admin: {
    user: Users.slug,
    meta: { titleSuffix: " · Pandora Templates" },
    importMap: { baseDir: dirname },
    components: {
      graphics: {
        Logo: "/components/admin/AdminBrand#AdminLogo",
        Icon: "/components/admin/AdminBrand#AdminIcon",
      },
      afterNavLinks: ["/components/admin/EarningsNavLink#EarningsNavLink"],
      views: {
        affiliateEarnings: {
          Component: "/components/admin/AffiliateEarnings#AffiliateEarnings",
          path: "/affiliate-earnings",
        },
      },
    },
  },
  collections: [Products, Orders, Affiliates, Pages, Posts, Media, ProductFiles, ContactSubmissions, Users],
  globals: [SiteSettings],
  editor: lexicalEditor(),
  // Admin emails (e.g. "forgot password") go through Resend once RESEND_API_KEY is set.
  email: process.env.RESEND_API_KEY
    ? resendAdapter({
        apiKey: process.env.RESEND_API_KEY,
        defaultFromAddress: process.env.EMAIL_FROM_ADDRESS || "onboarding@resend.dev",
        defaultFromName: "Pandora Templates",
      })
    : undefined,
  // Local dev: a SQLite file (schema auto-syncs). Production: Turso (hosted libSQL) via DATABASE_URI +
  // DATABASE_AUTH_TOKEN, with migrations applied by `npm run vercel-build` before each deploy.
  db: sqliteAdapter({
    client: {
      url: process.env.DATABASE_URI || "file:./payload.db",
      authToken: process.env.DATABASE_AUTH_TOKEN,
    },
  }),
  plugins: [
    // Uploads go to Vercel Blob when its token is set (production); otherwise to local folders.
    vercelBlobStorage({
      enabled: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: true,
      collections: { media: true, "product-files": true },
    }),
  ],
  sharp,
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
  graphQL: { disable: true },
});
