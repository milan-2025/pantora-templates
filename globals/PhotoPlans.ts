import type { GlobalConfig } from "payload";
import { anyone, authenticated } from "@/lib/cms/access";
import { DEFAULT_PHOTO_PLANS, DEFAULT_RENEWAL_PRICE } from "@/lib/photos/planDefaults";

/** Prices, limits and "what's included" for wedding photo galleries (/photos). */
export const PhotoPlans: GlobalConfig = {
  slug: "photo-plans",
  label: "Photo gallery plans & prices",
  admin: {
    group: "Wedding photos",
    description:
      "Names, prices (₹, incl. GST), limits and bullet points of the gallery plans. Leave the 'Plan' dropdown as it is: it decides which features each plan unlocks. Changes apply to new payments.",
  },
  access: { read: anyone, update: authenticated },
  fields: [
    { name: "banner", type: "text", admin: { description: "Optional line above the plans, e.g. “Wedding season offer: 20% off with code PHOTOS20”." } },
    {
      type: "row",
      fields: [
        { name: "renewalPrice", type: "number", min: 1, defaultValue: DEFAULT_RENEWAL_PRICE, label: "Renewal price (₹ per extra year)", admin: { width: "50%", description: "What a couple pays to keep a paid gallery online one more year." } },
        { name: "reminderDays", type: "number", min: 1, max: 60, defaultValue: 14, label: "Remind couples this many days before it expires", admin: { width: "50%" } },
      ],
    },
    {
      name: "plans",
      type: "array",
      minRows: 4,
      maxRows: 4,
      labels: { singular: "Plan", plural: "Plans" },
      defaultValue: DEFAULT_PHOTO_PLANS,
      admin: { initCollapsed: true },
      fields: [
        {
          type: "row",
          fields: [
            {
              name: "planId",
              type: "select",
              required: true,
              label: "Plan",
              options: [
                { label: "Free", value: "free" },
                { label: "Basic", value: "basic" },
                { label: "Premium", value: "premium" },
                { label: "Royal", value: "royal" },
              ],
              admin: { width: "34%" },
            },
            { name: "name", type: "text", required: true, label: "Name shown to customers", admin: { width: "33%" } },
            { name: "price", type: "number", min: 0, label: "Price (₹, incl. GST)", admin: { width: "33%", description: "Ignored for Free." } },
          ],
        },
        {
          type: "row",
          fields: [
            { name: "maxPhotos", type: "number", min: 1, label: "Max photos", admin: { width: "25%" } },
            { name: "videoGb", type: "number", min: 0, label: "Video (GB, 0 = none)", admin: { width: "25%" } },
            { name: "months", type: "number", min: 0, label: "Online for (months)", admin: { width: "25%", description: "Paid plans" } },
            { name: "freeDays", type: "number", min: 1, label: "Free: online for (days)", admin: { width: "25%" } },
          ],
        },
        {
          type: "row",
          fields: [
            { name: "guestUploads", type: "checkbox", label: "Guests can add photos", admin: { width: "50%" } },
            { name: "originals", type: "checkbox", label: "Full-size originals", admin: { width: "50%" } },
          ],
        },
        { name: "tagline", type: "text", label: "Short line under the name" },
        { name: "badge", type: "text", label: "Badge (optional)" },
        { name: "features", type: "array", label: "What's included (one line each)", fields: [{ name: "text", type: "text", required: true }] },
      ],
    },
  ],
};
