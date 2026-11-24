import type { CollectionConfig, FieldHook } from "payload";
import { authenticated } from "@/lib/cms/access";
import { PLAN_ORDER } from "@/lib/invitePlanDefaults";

/** How a code lowers the price: a % off, a fixed ₹ amount off, or a new price for the product. */
export const DISCOUNT_TYPES = [
  { label: "Percentage off (%)", value: "percent" },
  { label: "Flat amount off (₹)", value: "flat" },
  { label: "Set a special price (₹)", value: "price" },
];

/** What a product rule points at: a shop product or a plan in one of the web apps. */
export const RULE_KINDS = [
  { label: "Shop product (Excel sheets, templates…)", value: "shop" },
  { label: "Wedding planner plan", value: "planner" },
  { label: "Planner + Invite bundle", value: "bundle" },
  { label: "Wedding invite plan", value: "invite" },
  { label: "Workout app plan", value: "workout" },
];

const upper: FieldHook = ({ value }) => (typeof value === "string" ? value.trim().toUpperCase() : value);

export const Affiliates: CollectionConfig = {
  slug: "affiliates",
  labels: { singular: "Coupon / affiliate code", plural: "Coupon & affiliate codes" },
  admin: {
    group: "Shop",
    useAsTitle: "code",
    defaultColumns: ["code", "name", "appliesTo", "discountType", "commissionPercent", "active"],
    description:
      "Discount codes for the shop, the wedding planner, the invite maker and the workout app. " +
      "Each code can give a % off, a flat ₹ off, or a special price, on everything or only on the products you pick (each product with its own deal). " +
      "Affiliates can share links like pandoratemplates.com/wedding_planner_sheet?ref=CODE. See what you owe under 'Affiliate earnings'.",
  },
  access: { read: authenticated, create: authenticated, update: authenticated, delete: authenticated },
  fields: [
    {
      type: "row",
      fields: [
        {
          name: "code",
          type: "text",
          required: true,
          unique: true,
          index: true,
          hooks: { beforeValidate: [upper] },
          validate: (v: string | null | undefined) => (!!v && /^[A-Z0-9_-]{3,30}$/.test(v)) || "3–30 letters/numbers, no spaces",
          admin: { width: "40%", description: "Customers type this at checkout, or arrive via ?ref=CODE" },
        },
        { name: "name", type: "text", required: true, label: "Name (affiliate or campaign)", admin: { width: "60%", description: "E.g. Riya (Instagram) or Diwali sale. Only you see this." } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "active", type: "checkbox", defaultValue: true, admin: { width: "30%" } },
        {
          name: "validUntil",
          type: "date",
          label: "Works until (optional)",
          admin: { width: "35%", date: { pickerAppearance: "dayAndTime" }, description: "Leave empty for no end date." },
        },
        {
          name: "commissionPercent",
          type: "number",
          min: 0,
          max: 100,
          defaultValue: 0,
          label: "Affiliate commission %",
          admin: { width: "35%", description: "Of the amount paid (shop orders). 0 for a plain coupon." },
        },
      ],
    },

    {
      name: "appliesTo",
      type: "radio",
      label: "Where does this code work?",
      defaultValue: "all",
      options: [
        { label: "Everything (the deal below), plus any product deals listed further down", value: "all" },
        { label: "Only the products listed below", value: "listed" },
      ],
    },
    {
      type: "collapsible",
      label: "Deal on everything",
      admin: { condition: (data) => (data?.appliesTo ?? "all") === "all", initCollapsed: false },
      fields: [
        {
          type: "row",
          fields: [
            {
              name: "discountType",
              type: "select",
              label: "Type of discount",
              defaultValue: "percent",
              options: DISCOUNT_TYPES.filter((t) => t.value !== "price"),
              admin: { width: "40%", description: "A special price only makes sense per product, so set that in the list below." },
            },
            {
              name: "discountPercent",
              type: "number",
              min: 0,
              max: 99,
              defaultValue: 10,
              label: "Discount %",
              admin: { width: "30%", condition: (data) => (data?.discountType ?? "percent") === "percent", description: "Up to 99%" },
            },
            {
              name: "discountAmount",
              type: "number",
              min: 0,
              label: "Amount off (₹)",
              admin: { width: "30%", condition: (data) => data?.discountType === "flat", description: "Taken off the price (never below ₹1)." },
            },
          ],
        },
      ],
    },
    {
      name: "productDeals",
      type: "array",
      label: "Product deals",
      labels: { singular: "Product deal", plural: "Product deals" },
      admin: {
        description:
          "A deal for a particular product or plan. It beats the 'Deal on everything' for that product. " +
          "Leave the product/plan box empty to cover every product in that group.",
        initCollapsed: false,
        components: { RowLabel: "@/components/admin/CouponDealRowLabel#CouponDealRowLabel" },
      },
      fields: [
        {
          type: "row",
          fields: [
            { name: "kind", type: "select", required: true, defaultValue: "shop", label: "Product type", options: RULE_KINDS, admin: { width: "40%" } },
            {
              name: "shopProduct",
              type: "relationship",
              relationTo: "products",
              label: "Product",
              admin: { width: "60%", condition: (_, row) => row?.kind === "shop", description: "Empty = every shop product" },
            },
            {
              name: "plannerPlan",
              type: "relationship",
              relationTo: "planner-plans",
              label: "Planner plan",
              admin: { width: "60%", condition: (_, row) => row?.kind === "planner", description: "Empty = every paid planner plan" },
            },
            {
              name: "invitePlan",
              type: "select",
              label: "Invite plan",
              options: PLAN_ORDER.map((p) => ({ label: p[0].toUpperCase() + p.slice(1), value: p })),
              admin: { width: "60%", condition: (_, row) => row?.kind === "invite", description: "Empty = every invite plan" },
            },
            {
              name: "workoutPlan",
              type: "relationship",
              relationTo: "workout-plans",
              label: "Workout plan",
              admin: { width: "60%", condition: (_, row) => row?.kind === "workout", description: "Empty = every paid workout plan" },
            },
          ],
        },
        {
          type: "row",
          fields: [
            { name: "type", type: "select", required: true, defaultValue: "percent", label: "Type of discount", options: DISCOUNT_TYPES, admin: { width: "50%" } },
            {
              name: "value",
              type: "number",
              required: true,
              min: 0,
              label: "Value",
              validate: (v: number | null | undefined, { siblingData }: { siblingData: { type?: string } }) => {
                if (v == null || !(v >= 0)) return "Enter a number";
                if (siblingData?.type === "percent" && v > 99) return "Up to 99%";
                if (siblingData?.type === "price" && v < 1) return "The special price must be at least ₹1";
                return true;
              },
              admin: { width: "50%", description: "% for a percentage, ₹ for a flat amount or a special price" },
            },
          ],
        },
      ],
    },

    {
      type: "collapsible",
      label: "Affiliate contact & payout",
      admin: { initCollapsed: true },
      fields: [
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
    },
  ],
};
