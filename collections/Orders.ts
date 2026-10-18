import type { CollectionConfig } from "payload";
import { authenticated, nobody } from "@/lib/cms/access";

/** Created by the checkout (never through the public API). Editors can update the statuses. */
export const Orders: CollectionConfig = {
  slug: "orders",
  admin: {
    group: "Shop",
    useAsTitle: "orderId",
    defaultColumns: ["orderId", "customerName", "product", "amount", "affiliate", "paymentStatus", "commissionStatus", "createdAt"],
    listSearchableFields: ["orderId", "customerName", "email", "promoCode"],
  },
  defaultSort: "-createdAt",
  access: { read: authenticated, create: nobody, update: authenticated, delete: authenticated },
  fields: [
    { name: "orderId", type: "text", required: true, unique: true, index: true, admin: { readOnly: true } },
    { name: "product", type: "relationship", relationTo: "products", required: true, admin: { readOnly: true } },
    {
      type: "row",
      fields: [
        {
          name: "paymentStatus",
          type: "select",
          defaultValue: "created",
          index: true,
          options: [
            { label: "Started (not paid)", value: "created" },
            { label: "Paid", value: "paid" },
            { label: "Failed", value: "failed" },
            { label: "Refunded", value: "refunded" },
          ],
        },
        { name: "paidAt", type: "date", index: true, admin: { readOnly: true } },
      ],
    },
    {
      type: "collapsible",
      label: "Customer",
      fields: [
        {
          type: "row",
          fields: [
            { name: "customerName", type: "text", required: true },
            { name: "email", type: "email", required: true },
          ],
        },
        {
          type: "row",
          fields: [
            { name: "phone", type: "text" },
            { name: "city", type: "text" },
          ],
        },
      ],
    },
    {
      type: "collapsible",
      label: "Amounts (₹)",
      fields: [
        {
          type: "row",
          fields: [
            { name: "listPrice", type: "number", admin: { readOnly: true, description: "Main product price before promo code" } },
            { name: "subtotal", type: "number", admin: { readOnly: true, description: "Main product + add-ons, before promo code" } },
            { name: "discountAmount", type: "number", admin: { readOnly: true } },
            { name: "amount", type: "number", required: true, admin: { readOnly: true, description: "Amount charged" } },
          ],
        },
        {
          name: "addOns",
          type: "array",
          label: "Add-ons (upsells)",
          admin: { readOnly: true },
          fields: [
            {
              type: "row",
              fields: [
                { name: "product", type: "relationship", relationTo: "products", index: true },
                { name: "name", type: "text" },
                { name: "price", type: "number" },
              ],
            },
          ],
        },
        {
          name: "bonusIncluded",
          type: "checkbox",
          index: true,
          admin: { readOnly: true, description: "Ordered within the quick-order bonus window, so the bonus is delivered" },
        },
        {
          name: "offerApplied",
          type: "checkbox",
          index: true,
          admin: { readOnly: true, description: "Bought at the limited-time offer price" },
        },
      ],
    },
    {
      type: "collapsible",
      label: "Affiliate",
      fields: [
        {
          type: "row",
          fields: [
            { name: "promoCode", type: "text", admin: { readOnly: true } },
            { name: "affiliate", type: "relationship", relationTo: "affiliates", index: true, admin: { readOnly: true } },
          ],
        },
        {
          type: "row",
          fields: [
            { name: "commissionAmount", type: "number", admin: { readOnly: true } },
            {
              name: "commissionStatus",
              type: "select",
              defaultValue: "none",
              index: true,
              options: [
                { label: "No affiliate", value: "none" },
                { label: "Owed", value: "pending" },
                { label: "Paid to affiliate", value: "paid" },
              ],
            },
          ],
        },
      ],
    },
    { name: "paymentId", type: "text", admin: { readOnly: true, position: "sidebar" } },
    { name: "provider", type: "text", admin: { readOnly: true, position: "sidebar" } },
  ],
};
