import { APIError, type CollectionConfig } from "payload";
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
  hooks: {
    // Tick "Email the couple now" and save: sends them their draft link (with the promo code, if you typed one).
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        if (!data?.emailNow) return data;
        const id = originalDoc?.id;
        const full = id ? await req.payload.findByID({ collection: "invites", id, depth: 0, overrideAccess: true }) : null;
        if (!full) throw new APIError("Save the invite first.", 400);
        if (full.paymentStatus === "paid") throw new APIError("This couple has already paid.", 400);
        const email = data.contactEmail ?? full.contactEmail;
        if (!email) throw new APIError("Add the couple's email under Payment details first.", 400);
        // Loaded on demand so the Payload CLI (which loads this file) never imports server-only code.
        const { emailCouple } = await import("@/lib/inviteEmail");
        await emailCouple(req.payload, { ...full, contactEmail: email }, { kind: "reminder", promo: data.emailPromo ?? undefined });
        data.emailNow = false;
        data.lastEmailedAt = new Date().toISOString();
        data.reminderCount = (full.reminderCount ?? 0) + 1;
        return data;
      },
    ],
  },
  fields: [
    {
      type: "collapsible",
      label: "Email the couple",
      admin: { initCollapsed: false },
      fields: [
        { name: "emailNow", type: "checkbox", defaultValue: false, label: "Email the couple now", admin: { description: "Tick this and save to send them a reminder with a link to finish their invite. Needs their email below." } },
        { name: "emailPromo", type: "text", label: "Promo code to include (optional)", admin: { description: "An active code from Affiliates, e.g. SHAADI20. Leave empty to use the default from Invite plans & prices." } },
        { name: "lastEmailedAt", type: "date", admin: { readOnly: true } },
        { name: "reminderCount", type: "number", defaultValue: 0, admin: { readOnly: true } },
      ],
    },
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
