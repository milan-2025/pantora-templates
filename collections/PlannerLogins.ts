import type { CollectionConfig } from "payload";
import { nobody } from "@/lib/cms/access";

/** One-time sign-in codes for the wedding planner (stored hashed, valid 15 minutes). Internal. */
export const PlannerLogins: CollectionConfig = {
  slug: "planner-logins",
  admin: { hidden: true },
  access: { read: nobody, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: "email", type: "text", required: true, index: true },
    { name: "codeHash", type: "text", required: true },
    { name: "expiresAt", type: "date", required: true },
    { name: "attempts", type: "number", defaultValue: 0 },
  ],
};
