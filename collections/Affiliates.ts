import type { CollectionConfig } from "payload";
import { authenticated } from "@/lib/cms/access";

export const Affiliates: CollectionConfig = {
  slug: "affiliates",
  admin: {
    group: "Shop",
    useAsTitle: "name",
    defaultColumns: ["name", "code", "discountPercent", "commissionPercent", "active"],
    description:
      "Each affiliate gets a promo code. Share links like pandoratemplates.com/wedding_planner?ref=CODE. " +
      "See what you owe under 'Affiliate earnings' in the menu.",
  },
  access: { read: authenticated, create: authenticated, update: authenticated, delete: authenticated },
  fields: [
    { name: "name", type: "text", required: true },
    {
      name: "code",
      type: "text",
      required: true,
      unique: true,
      index: true,
      hooks: { beforeValidate: [({ value }) => (typeof value === "string" ? value.trim().toUpperCase() : value)] },
      validate: (v: string | null | undefined) =>
        (!!v && /^[A-Z0-9_-]{3,30}$/.test(v)) || "3–30 letters/numbers, no spaces",
      admin: { description: "Customers type this at checkout, or arrive via ?ref=CODE" },
    },
    {
      type: "row",
      fields: [
        {
          name: "discountPercent",
          type: "number",
          min: 0,
          max: 99,
          defaultValue: 10,
          admin: { description: "Customer discount % (up to 99%)" },
        },
        {
          name: "commissionPercent",
          type: "number",
          min: 0,
          max: 100,
          defaultValue: 20,
          admin: { description: "Affiliate commission, as % of the amount paid" },
        },
      ],
    },
    { name: "active", type: "checkbox", defaultValue: true },
    {
      type: "row",
      fields: [
        { name: "email", type: "email" },
        { name: "phone", type: "text" },
      ],
    },
    { name: "payoutDetails", type: "textarea", admin: { description: "UPI ID / bank details for paying commission" } },
    { name: "notes", type: "textarea" },
  ],
};
