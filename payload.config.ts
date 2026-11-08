import path from "path";
import { fileURLToPath } from "url";
import { buildConfig } from "payload";
import { mongooseAdapter } from "@payloadcms/db-mongodb";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import sharp from "sharp";
import { cloudinaryStorage } from "./lib/storage/cloudinary";
import { brevoAdapter } from "./lib/brevo";

import { Users } from "./collections/Users";
import { Media } from "./collections/Media";
import { ProductFiles } from "./collections/ProductFiles";
import { Products } from "./collections/Products";
import { Pages } from "./collections/Pages";
import { Posts } from "./collections/Posts";
import { Affiliates } from "./collections/Affiliates";
import { Orders } from "./collections/Orders";
import { Invites } from "./collections/Invites";
import { InviteRsvps } from "./collections/InviteRsvps";
import { ContactSubmissions } from "./collections/ContactSubmissions";
import { SiteSettings } from "./globals/SiteSettings";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Accept the site address with and without "www." so either works for logging in.
const withWww = (url?: string) => {
  if (!url) return [];
  try {
    const u = new URL(url);
    const bare = u.hostname.replace(/^www\./, "");
    return [`${u.protocol}//${bare}${u.port ? `:${u.port}` : ""}`, `${u.protocol}//www.${bare}${u.port ? `:${u.port}` : ""}`];
  } catch {
    return [];
  }
};

// Sites allowed to use the admin login cookie (CSRF protection): the real domain plus
// Vercel's deployment URLs. Empty in local development so any localhost port works.
const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? [
        ...withWww(process.env.NEXT_PUBLIC_SITE_URL),
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
    meta: {
      titleSuffix: " · Pandora Templates",
      icons: [{ rel: "icon", type: "image/svg+xml", url: "/favicon.svg" }],
    },
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
  collections: [Products, Orders, Invites, InviteRsvps, Affiliates, Pages, Posts, Media, ProductFiles, ContactSubmissions, Users],
  globals: [SiteSettings],
  editor: lexicalEditor(),
  // Admin emails (e.g. "forgot password") go through Brevo, like the rest of the site's email.
  email: brevoAdapter,
  // MongoDB Atlas (or any MongoDB). Collections and indexes are created automatically:
  // there are no migration files to run.
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || "",
    // Multi-document transactions are unreliable on Atlas shared clusters (random
    // "TransientTransactionError" / lock timeouts). Every write on this site is a single
    // document, so they aren't needed.
    transactionOptions: false,
  }),
  // MongoDB creates collections and builds indexes lazily, which clashes with transactions on a
  // brand-new database ("catalog changes" / "LockTimeout" errors). So at startup, create every
  // collection and wait for its indexes to finish before anything is written.
  onInit: async (payload) => {
    type Model = { createCollection: () => Promise<unknown>; createIndexes: () => Promise<unknown> };
    const models = Object.values((payload.db as unknown as { connection: { models: Record<string, Model> } }).connection.models);
    await Promise.allSettled(models.map((m) => m.createCollection()));
    await Promise.allSettled(models.map((m) => m.createIndexes()));
  },
  plugins: [
    // Images, videos and paid files go to Cloudinary once CLOUDINARY_URL is set;
    // until then they're saved to local folders (fine for local development only).
    cloudinaryStorage({
      collections: {
        media: { folder: "pandora/media", visibility: "public" },
        "product-files": { folder: "pandora/product-files", visibility: "private" },
      },
    }),
  ],
  sharp,
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
  graphQL: { disable: true },
});
