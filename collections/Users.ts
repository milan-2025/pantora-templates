import type { CollectionConfig } from "payload";
import { authenticated } from "@/lib/cms/access";

export const Users: CollectionConfig = {
  slug: "users",
  labels: { singular: "Admin user", plural: "Admin users" },
  auth: true,
  admin: { useAsTitle: "email", group: "Settings" },
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [{ name: "name", type: "text" }],
};
