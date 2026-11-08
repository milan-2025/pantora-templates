import type { CollectionConfig } from "payload";
import { authenticated, nobody } from "@/lib/cms/access";

/** Replies guests send from a live wedding invite. */
export const InviteRsvps: CollectionConfig = {
  slug: "invite-rsvps",
  admin: {
    group: "Wedding invites",
    useAsTitle: "name",
    defaultColumns: ["name", "guests", "events", "invite", "createdAt"],
    listSearchableFields: ["name"],
  },
  defaultSort: "-createdAt",
  access: { read: authenticated, create: nobody, update: authenticated, delete: authenticated },
  fields: [
    { name: "invite", type: "relationship", relationTo: "invites", required: true, index: true },
    { name: "name", type: "text", required: true },
    { name: "guests", type: "number", required: true, min: 1, max: 50 },
    { name: "events", type: "text" },
  ],
};
