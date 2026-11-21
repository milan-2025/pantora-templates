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
    { name: "meal", type: "text" },
    { name: "side", type: "select", options: [{ label: "Bride's side", value: "bride" }, { label: "Groom's side", value: "groom" }], admin: { description: "Which side the guest is on (story templates)" } },
    { name: "guest", type: "text", admin: { description: "Which guest link they replied from (if any)" } },
    { name: "message", type: "textarea", admin: { description: "Blessing / note the guest left for the couple" } },
    {
      name: "plannerStatus",
      type: "select",
      label: "In the wedding planner",
      options: [
        { label: "Added to the guest list", value: "applied" },
        { label: "Waiting for the couple to match it", value: "review" },
        { label: "Ignored by the couple", value: "ignored" },
      ],
      admin: { readOnly: true, description: "Only for invites connected to a wedding planner." },
    },
    { name: "plannerFamily", type: "text", label: "Planner family", admin: { readOnly: true } },
  ],
};
