import type { CollectionConfig } from "payload";
import { authenticated, nobody } from "@/lib/cms/access";

export const ContactSubmissions: CollectionConfig = {
  slug: "contact-submissions",
  labels: { singular: "Contact message", plural: "Contact messages" },
  admin: {
    group: "Inbox",
    useAsTitle: "name",
    defaultColumns: ["name", "email", "message", "handled", "createdAt"],
  },
  defaultSort: "-createdAt",
  access: { read: authenticated, create: nobody, update: authenticated, delete: authenticated },
  fields: [
    {
      type: "row",
      fields: [
        { name: "name", type: "text", required: true },
        { name: "email", type: "email", required: true },
      ],
    },
    { name: "phone", type: "text" },
    { name: "message", type: "textarea", required: true },
    { name: "page", type: "text", admin: { readOnly: true, description: "Page the message was sent from" } },
    { name: "handled", type: "checkbox", defaultValue: false, admin: { position: "sidebar" } },
  ],
};
