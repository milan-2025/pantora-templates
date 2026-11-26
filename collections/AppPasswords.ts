import type { CollectionConfig } from "payload";
import { nobody } from "@/lib/cms/access";

/** Optional passwords for the code-sign-in apps (wedding planner, workout). Only a scrypt hash is kept. Internal. */
export const AppPasswords: CollectionConfig = {
  slug: "app-passwords",
  admin: { hidden: true },
  access: { read: nobody, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: "app", type: "select", required: true, index: true, options: [{ label: "Wedding planner", value: "planner" }, { label: "Workout", value: "workout" }, { label: "HostBook", value: "hostbook" }] },
    { name: "email", type: "text", required: true, index: true },
    { name: "hash", type: "text", required: true },
    { name: "failed", type: "number", defaultValue: 0 },
    { name: "lockedUntil", type: "date" },
  ],
};
