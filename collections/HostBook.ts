import type { CollectionConfig } from "payload";
import { authenticated, nobody } from "@/lib/cms/access";
import { FEATURES, STAFF_PERMS } from "@/lib/hostbook/features";

/*
 * Pandora HostBook (/hostbook): guest records, bookings, tasks and money for Airbnb / homestay hosts.
 * Everything lives under "HostBook" in /admin.
 * - HostBook plans: prices, limits and a tick list of features. Changes apply at once to every host on the plan.
 * - Host accounts: one per host business (owner email, plan, end date, extra listings, staff).
 * The host's own records (listings, bookings, guests, expenses…) are in the hb_items MongoDB collection, not in admin.
 */

const group = "HostBook";
const lower = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : v);

export const HostBookPlans: CollectionConfig = {
  slug: "hostbook-plans",
  labels: { singular: "HostBook plan", plural: "HostBook plans" },
  admin: {
    group,
    useAsTitle: "name",
    defaultColumns: ["name", "price", "listings", "staff", "idDays", "isFree", "active"],
    description:
      "Add, rename or change plans and tick which features each one has. Changes apply straight away to every host on the plan. " +
      "Taking a feature away only locks it: hosts keep their data. Exactly one plan should be ticked as free.",
  },
  defaultSort: "sortOrder",
  access: { read: authenticated, create: authenticated, update: authenticated, delete: authenticated },
  fields: [
    {
      type: "row",
      fields: [
        { name: "name", type: "text", required: true, admin: { width: "40%" } },
        { name: "planId", type: "text", required: true, unique: true, index: true, label: "Plan code", admin: { width: "30%", description: "E.g. pro. Don't change it once sold." } },
        { name: "sortOrder", type: "number", defaultValue: 10, admin: { width: "30%" } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "isFree", type: "checkbox", label: "This is the free plan", defaultValue: false },
        { name: "active", type: "checkbox", label: "Show on the plans page", defaultValue: true },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "price", type: "number", min: 0, defaultValue: 0, label: "Price (₹ a year, incl. GST)", admin: { width: "25%" } },
        { name: "listings", type: "number", min: 1, defaultValue: 1, label: "Listings included", admin: { width: "25%" } },
        { name: "staff", type: "number", min: 0, defaultValue: 1, label: "Staff / caretakers", admin: { width: "25%" } },
        { name: "idDays", type: "number", min: 1, max: 3650, defaultValue: 30, label: "Keep ID photos (days)", admin: { width: "25%", description: "Then they're deleted automatically." } },
      ],
    },
    { name: "hostChoosesIdDays", type: "checkbox", label: "Host can choose a shorter ID keep time", defaultValue: false },
    {
      name: "features",
      type: "select",
      hasMany: true,
      label: "Features on this plan",
      options: FEATURES.map((f) => ({ label: `${f.group}: ${f.label}`, value: f.key })),
      admin: { description: "Bookings, calendar, guest register and income & expenses are on every plan." },
    },
    { name: "tagline", type: "text" },
    { name: "badge", type: "text", admin: { description: "E.g. “Most popular”." } },
    { name: "highlights", type: "array", label: "Extra lines on the plans page (optional)", fields: [{ name: "text", type: "text", required: true }] },
  ],
};

export const HostBookAccounts: CollectionConfig = {
  slug: "hostbook-accounts",
  labels: { singular: "Host account", plural: "Host accounts" },
  admin: {
    group,
    useAsTitle: "ownerEmail",
    defaultColumns: ["ownerEmail", "business", "plan", "expiresAt", "extraListings", "staysHostId"],
    description: "One per host. To give someone a plan by hand, pick the plan and an end date. Extra listings are on top of the plan's own.",
  },
  access: { read: authenticated, create: authenticated, update: authenticated, delete: authenticated },
  hooks: {
    beforeChange: [({ data }) => {
      if (data && typeof data.ownerEmail === "string") data.ownerEmail = lower(data.ownerEmail);
      if (data && Array.isArray(data.staff)) data.staff = (data.staff as { email?: string }[]).map((s) => ({ ...s, email: lower(s.email ?? "") }));
      return data;
    }],
  },
  fields: [
    {
      type: "row",
      fields: [
        { name: "ownerEmail", type: "text", required: true, unique: true, index: true, admin: { width: "50%" } },
        { name: "business", type: "text", label: "Business name", admin: { width: "50%" } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "phone", type: "text", admin: { width: "34%" } },
        { name: "city", type: "text", admin: { width: "33%" } },
        { name: "source", type: "text", label: "Came from (UTM)", admin: { width: "33%", readOnly: true } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "plan", type: "relationship", relationTo: "hostbook-plans", admin: { width: "34%", description: "Empty = free plan" } },
        { name: "expiresAt", type: "date", label: "Paid plan ends", admin: { width: "33%", date: { pickerAppearance: "dayOnly" } } },
        { name: "extraListings", type: "number", min: 0, defaultValue: 0, admin: { width: "33%" } },
      ],
    },
    { name: "staysHostId", type: "text", index: true, label: "Pandora Stays host id", admin: { description: "Set when the host opened HostBook from the Stays host portal (gets the Stays plan free).", readOnly: true } },
    { name: "idDays", type: "number", min: 1, label: "Host's own ID keep time (days)", admin: { description: "Only used when the plan lets the host choose." } },
    { name: "logoUrl", type: "text", label: "Logo shown on guest pages" },
    {
      name: "staff",
      type: "array",
      labels: { singular: "Staff member", plural: "Staff" },
      fields: [
        {
          type: "row",
          fields: [
            { name: "email", type: "text", required: true, admin: { width: "40%" } },
            { name: "name", type: "text", admin: { width: "30%" } },
            { name: "phone", type: "text", admin: { width: "30%" } },
          ],
        },
        { name: "perms", type: "select", hasMany: true, options: STAFF_PERMS.map((p) => ({ label: p.label, value: p.key })) },
        { name: "listings", type: "json", admin: { description: "Listing ids this person can see. Empty = all." } },
      ],
    },
    { name: "orderId", type: "text", index: true, admin: { readOnly: true } },
    { name: "order", type: "json", admin: { readOnly: true } },
    { name: "lastPaidOrder", type: "text", admin: { readOnly: true } },
    { name: "paymentId", type: "text", admin: { readOnly: true } },
    { name: "reminderSentAt", type: "date", admin: { readOnly: true } },
    { name: "digestOn", type: "checkbox", defaultValue: true, label: "Daily task email" },
  ],
};

export const HostBookLogins: CollectionConfig = {
  slug: "hostbook-logins",
  admin: { hidden: true },
  access: { read: nobody, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: "email", type: "text", required: true, index: true },
    { name: "codeHash", type: "text", required: true },
    { name: "expiresAt", type: "date", required: true },
    { name: "attempts", type: "number", defaultValue: 0 },
  ],
};

export const HOSTBOOK_COLLECTIONS = [HostBookPlans, HostBookAccounts, HostBookLogins];
