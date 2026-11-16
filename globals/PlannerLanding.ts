import type { GlobalConfig } from "payload";
import { authenticated } from "@/lib/cms/access";

/**
 * Settings for the landing page people see at /planner before they sign in (the page ads point to).
 * Read through /api/planner/landing, which only ever returns testimonials ticked "Show on page".
 */
export const PlannerLanding: GlobalConfig = {
  slug: "planner-landing",
  label: "Planner landing page & promo codes",
  admin: {
    group: "Wedding planner",
    description:
      "The page at pandoratemplates.com/planner that visitors and ad clicks see before signing in. Prices come from Planner plans. Changes show within a minute.",
  },
  // Read via the API route (which filters hidden testimonials), so no public read here.
  access: { read: authenticated, update: authenticated },
  fields: [
    {
      type: "collapsible",
      label: "Ads tracking",
      admin: { initCollapsed: false },
      fields: [
        {
          name: "metaPixelId",
          type: "text",
          label: "Meta Pixel ID",
          admin: {
            placeholder: "e.g. 123456789012345",
            description:
              "Numbers only, from Meta Events Manager. When set, the page reports PageView, Lead (sign-in code requested), StartTrial (planner created) and Purchase (plan paid). Leave empty to turn the Pixel off.",
          },
        },
      ],
    },
    {
      type: "collapsible",
      label: "WhatsApp button",
      admin: { initCollapsed: false },
      fields: [
        {
          type: "row",
          fields: [
            { name: "whatsappNumber", type: "text", label: "WhatsApp number", admin: { width: "40%", placeholder: "e.g. 919876543210", description: "With country code, digits only. Leave empty to hide the button." } },
            { name: "whatsappMessage", type: "text", label: "Pre-filled message", defaultValue: "Hi! I have a question about the Pandora wedding planner.", admin: { width: "60%" } },
          ],
        },
      ],
    },
    {
      type: "collapsible",
      label: "Promo codes (planner only)",
      admin: { initCollapsed: false },
      fields: [
        {
          name: "offerText",
          type: "text",
          label: "Offer line on the landing page (optional)",
          admin: { placeholder: "e.g. Launch offer: ₹500 off the Family plan with code SHAADI500", description: "Shown above the prices. Leave empty to hide." },
        },
        {
          name: "promoCodes",
          type: "array",
          labels: { singular: "Promo code", plural: "Promo codes" },
          admin: { description: "Fixed ₹ discounts that work only on planner upgrades (not the shop or invites). Customers type the code when they upgrade. Shop/affiliate codes still work too." },
          fields: [
            {
              type: "row",
              fields: [
                { name: "code", type: "text", required: true, admin: { width: "25%", placeholder: "SHAADI500" }, hooks: { beforeValidate: [({ value }) => (typeof value === "string" ? value.trim().toUpperCase() : value)] } },
                { name: "amountOff", type: "number", required: true, min: 1, label: "₹ off", admin: { width: "15%" } },
                { name: "validUntil", type: "date", label: "Valid until (optional)", admin: { width: "25%" } },
                { name: "active", type: "checkbox", defaultValue: true, admin: { width: "15%" } },
              ],
            },
            { name: "note", type: "text", admin: { placeholder: "Who it's for, e.g. Excel planner buyers" } },
          ],
        },
      ],
    },
    {
      name: "testimonials",
      type: "array",
      labels: { singular: "Testimonial", plural: "Testimonials" },
      admin: {
        description:
          "Only rows ticked “Show on page” appear, and the section is hidden while none are ticked. The rows filled in for you are samples showing the format: replace them with real customer words (with their permission) before ticking.",
      },
      fields: [
        {
          type: "row",
          fields: [
            { name: "name", type: "text", required: true, admin: { width: "30%", placeholder: "Riya S." } },
            { name: "detail", type: "text", label: "Who / where", admin: { width: "40%", placeholder: "Bride · Jaipur · Feb 2027" } },
            { name: "show", type: "checkbox", label: "Show on page", defaultValue: false, admin: { width: "30%" } },
          ],
        },
        { name: "quote", type: "textarea", required: true, admin: { description: "Keep it to 1–3 sentences." } },
      ],
    },
    { name: "seededAt", type: "date", admin: { hidden: true } },
  ],
};

/** Format examples added (hidden) the first time the page loads. They never show until replaced and ticked. */
export const SAMPLE_TESTIMONIALS = [
  { name: "Sample – replace me", detail: "Bride · city · wedding month", show: false, quote: "One or two lines in the customer's own words about what the planner made easier, e.g. guest list, budget or coordinating with family." },
  { name: "Sample – replace me", detail: "Mother of the groom · city", show: false, quote: "A parent's view works well here: how sharing the planner with the family helped." },
  { name: "Sample – replace me", detail: "Groom · city", show: false, quote: "A line about vendors, payments or the day-of run sheet." },
];
