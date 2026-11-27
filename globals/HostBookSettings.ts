import type { GlobalConfig } from "payload";
import { authenticated } from "@/lib/cms/access";

/** Settings for Pandora HostBook (/hostbook) that aren't per plan. */
export const HostBookSettings: GlobalConfig = {
  slug: "hostbook-settings",
  label: "HostBook settings",
  admin: { group: "HostBook" },
  access: { read: authenticated, update: authenticated },
  fields: [
    {
      type: "row",
      fields: [
        { name: "extraListingPrice", type: "number", min: 0, defaultValue: 299, label: "Extra listing (₹ a year)", admin: { width: "50%" } },
        { name: "reminderDays", type: "number", min: 1, max: 60, defaultValue: 14, label: "Remind hosts this many days before the plan ends", admin: { width: "50%" } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "staysPlan", type: "text", defaultValue: "starter", label: "Plan code Pandora Stays hosts get free", admin: { width: "50%", description: "Leave empty to give Stays hosts nothing extra." } },
        { name: "whatsappNumber", type: "text", label: "WhatsApp number for questions (e.g. 918437512120)", admin: { width: "50%" } },
      ],
    },
    { name: "offerText", type: "text", label: "Offer line on the plans page (optional)" },
    // Keys for phone notifications (web push). Made automatically the first time; don't change them, or phones stop getting alerts.
    { name: "vapidPublic", type: "text", admin: { hidden: true } },
    { name: "vapidPrivate", type: "text", admin: { hidden: true } },
  ],
};
