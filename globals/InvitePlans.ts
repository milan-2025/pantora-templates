import type { GlobalConfig } from "payload";
import { anyone, authenticated } from "@/lib/cms/access";
import { DEFAULT_PLANS } from "@/lib/invitePlanDefaults";

/** Prices and "what's included" for the wedding invite maker. Changes show on the site within a minute. */
export const InvitePlans: GlobalConfig = {
  slug: "invite-plans",
  label: "Invite plans & prices",
  admin: {
    group: "Wedding invites",
    description:
      "Edit the names, prices (₹, incl. GST) and bullet points of the three invite plans. Leave the 'Plan' dropdown as it is: it decides which features each plan unlocks (guest links and RSVP tracker from Premium, custom domain on Royal).",
  },
  access: { read: anyone, update: authenticated },
  fields: [
    { name: "banner", type: "text", admin: { description: "Optional line above the plans, e.g. “Festive offer: 20% off with code SHAADI20”." } },
    {
      name: "validityMonths",
      type: "number",
      defaultValue: 12,
      min: 1,
      max: 60,
      admin: { description: "How many months an invite stays live after payment (applies to new payments)." },
    },
    {
      type: "collapsible",
      label: "Reminder emails to couples who haven't paid",
      admin: { initCollapsed: true },
      fields: [
        { name: "reminderEnabled", type: "checkbox", defaultValue: false, label: "Send an automatic reminder", admin: { description: "Emails couples who saved their email but didn't pay. Needs a daily cron job calling /api/shaadi/cron/reminders (see the README)." } },
        { name: "reminderAfterHours", type: "number", defaultValue: 24, min: 1, max: 720, label: "Send it this many hours after their last change" },
        { name: "reminderPromoCode", type: "text", label: "Promo code to include (optional)", admin: { description: "An active code from Affiliates, e.g. SHAADI20. The email shows its discount and applies it at checkout." } },
        { name: "reminderMessage", type: "textarea", label: "Your message in the email (optional)" },
      ],
    },
    {
      name: "plans",
      type: "array",
      minRows: 3,
      maxRows: 3,
      labels: { singular: "Plan", plural: "Plans" },
      defaultValue: DEFAULT_PLANS,
      admin: { initCollapsed: false, components: {} },
      fields: [
        {
          name: "planId",
          type: "select",
          required: true,
          label: "Plan",
          options: [
            { label: "Basic (lowest tier)", value: "basic" },
            { label: "Premium (middle tier)", value: "premium" },
            { label: "Royal (top tier)", value: "royal" },
          ],
        },
        { name: "name", type: "text", required: true, label: "Name shown to customers" },
        { name: "price", type: "number", required: true, min: 1, label: "Price (₹, incl. GST)" },
        { name: "tagline", type: "text", label: "Short line under the name" },
        { name: "badge", type: "text", label: "Badge (optional)", admin: { description: "Small label on the card, e.g. “Most chosen”." } },
        {
          name: "features",
          type: "array",
          label: "What's included (one line each)",
          fields: [{ name: "text", type: "text", required: true }],
        },
      ],
    },
  ],
};
