import path from "path";
import { fileURLToPath } from "url";
import { buildConfig } from "payload";
import { mongooseAdapter } from "@payloadcms/db-mongodb";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import sharp from "sharp";
import { cloudinaryStorage } from "./lib/storage/cloudinary";
import { brevoAdapter } from "./lib/brevo";
import { autoPublishContent } from "./lib/content/autoPublish";

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
import { Reviews } from "./collections/Reviews";
import { Planners } from "./collections/Planners";
import { PlannerPlans } from "./collections/PlannerPlans";
import { PlannerHistory } from "./collections/PlannerHistory";
import { PlannerLogins } from "./collections/PlannerLogins";
import { AppPasswords } from "./collections/AppPasswords";
import { PhotoGalleries } from "./collections/PhotoGalleries";
import { PhotoItems } from "./collections/PhotoItems";
import { SiteSettings } from "./globals/SiteSettings";
import { InvitePlans } from "./globals/InvitePlans";
import { PlannerLanding } from "./globals/PlannerLanding";
import { WORKOUT_COLLECTIONS } from "./collections/Workout";
import { WorkoutSettings } from "./globals/WorkoutSettings";
import { PhotoPlans } from "./globals/PhotoPlans";
import { HOSTBOOK_COLLECTIONS } from "./collections/HostBook";
import { HostBookSettings } from "./globals/HostBookSettings";

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

// Sites allowed to use the admin login cookie (CSRF protection): the real domain, with and without www.
// Empty in local development so any localhost port works.
const allowedOrigins = process.env.NODE_ENV === "production" ? withWww(process.env.NEXT_PUBLIC_SITE_URL).filter(Boolean) : [];

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
  collections: [Products, Orders, Invites, InviteRsvps, Planners, PlannerPlans, PlannerHistory, PlannerLogins, AppPasswords, PhotoGalleries, PhotoItems, Affiliates, Pages, Posts, Reviews, Media, ProductFiles, ContactSubmissions, ...WORKOUT_COLLECTIONS, ...HOSTBOOK_COLLECTIONS, Users],
  globals: [SiteSettings, InvitePlans, PlannerLanding, WorkoutSettings, PhotoPlans, HostBookSettings],
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
    // Publishes the content pack in lib/content/ once, on the production site only (see autoPublish.ts).
    await autoPublishContent(payload);
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
