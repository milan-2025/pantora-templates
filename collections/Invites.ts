import type { CollectionConfig } from "payload";
import { authenticated, nobody } from "@/lib/cms/access";

/** Wedding invites made with the invite maker (/shaadi). Created and edited through /api/shaadi, never the public Payload API. */
export const Invites: CollectionConfig = {
  slug: "invites",
  admin: {
    group: "Wedding invites",
    useAsTitle: "names",
    defaultColumns: ["names", "slug", "paymentStatus", "plan", "amount", "contactEmail", "createdAt"],
    listSearchableFields: ["names", "slug", "contactEmail", "orderId"],
    description: "Open a couple's invite at pandoratemplates.com/i/<link>. Their design data is stored privately.",
  },
  defaultSort: "-createdAt",
  access: { read: authenticated, create: nobody, update: authenticated, delete: authenticated },
  fields: [
    { name: "slug", type: "text", required: true, unique: true, index: true, admin: { readOnly: true, description: "The invite link: /i/<slug>" } },
    { name: "names", type: "text", admin: { readOnly: true } },
    {
      type: "row",
      fields: [
        {
          name: "paymentStatus",
          type: "select",
          defaultValue: "created",
          index: true,
          options: [
            { label: "Not paid (draft)", value: "created" },
            { label: "Paid (live)", value: "paid" },
            { label: "Refunded", value: "refunded" },
          ],
        },
        {
          name: "plan",
          type: "select",
          options: [
            { label: "Basic", value: "basic" },
            { label: "Premium", value: "premium" },
            { label: "Royal", value: "royal" },
          ],
        },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "paidAt", type: "date", admin: { readOnly: true } },
        { name: "expiresAt", type: "date", admin: { description: "The invite stops showing after this date (12 months from payment). Change it to extend." } },
      ],
    },
    {
      type: "collapsible",
      label: "Payment details",
      admin: { initCollapsed: true },
      fields: [
        { name: "contactEmail", type: "email" },
        { name: "amount", type: "number", admin: { readOnly: true, description: "Rupees charged for the selected plan" } },
        { name: "promoCode", type: "text", admin: { readOnly: true } },
        { name: "orderId", type: "text", index: true, admin: { readOnly: true } },
        {
          name: "orderPlan",
          type: "select",
          options: [
            { label: "Basic", value: "basic" },
            { label: "Premium", value: "premium" },
            { label: "Royal", value: "royal" },
          ],
          admin: { readOnly: true, description: "The plan being paid for; becomes the plan once payment is confirmed" },
        },
        { name: "paymentId", type: "text", admin: { readOnly: true } },
      ],
    },
    // The couple's private edit key. Never returned by the API or shown in the admin.
    { name: "editToken", type: "text", access: { read: () => false, update: () => false }, admin: { hidden: true } },
    // The whole design (names, theme, events, photos, guests…). Large, so hidden from the admin form.
    { name: "state", type: "json", required: true, admin: { hidden: true } },
  ],
};
