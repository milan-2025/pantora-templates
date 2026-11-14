import { APIError, type CollectionConfig } from "payload";
import { authenticated, nobody } from "@/lib/cms/access";

type BeforeChange = NonNullable<NonNullable<CollectionConfig["hooks"]>["beforeChange"]>[number];

/**
 * Package set by hand in /admin (no Razorpay payment): when an invite is switched to Paid, fill in the
 * package, paid date and expiry if they were left empty. Razorpay-confirmed payments also pass through here;
 * they already carry these values, so nothing changes for them.
 * Also sends the "your invite is live" email (live link + private edit link) when that box is ticked.
 */
const setPackageManually: BeforeChange = async ({ data, originalDoc, req, operation }) => {
  if (operation !== "update" || !data) return data;
  const status = data.paymentStatus ?? originalDoc?.paymentStatus;
  if (status === "paid" && originalDoc?.paymentStatus !== "paid") {
    if (!data.plan && !originalDoc?.plan) data.plan = "basic";
    if (!data.paidAt) data.paidAt = new Date().toISOString();
    if (!data.expiresAt) {
      // Loaded on demand so the Payload CLI (which loads this file) never imports server-only code.
      const { getPlanConfig } = await import("@/lib/invites");
      const { months } = await getPlanConfig(req.payload);
      const exp = new Date();
      exp.setMonth(exp.getMonth() + months);
      data.expiresAt = exp.toISOString();
    }
  }
  if (data.emailLive) {
    const id = originalDoc?.id;
    const full = id ? await req.payload.findByID({ collection: "invites", id, depth: 0, overrideAccess: true }) : null;
    if (!full) throw new APIError("Save the invite first.", 400);
    if (status !== "paid") throw new APIError("Set Payment status to Paid (live) before emailing the live link.", 400);
    const email = data.contactEmail ?? full.contactEmail;
    if (!email) throw new APIError("Add the couple's email under Payment details first.", 400);
    const { sendInviteLiveEmail, getPlanConfig } = await import("@/lib/invites");
    const { months } = await getPlanConfig(req.payload);
    await sendInviteLiveEmail({ ...full, contactEmail: email }, months);
    data.emailLive = false;
    data.lastEmailedAt = new Date().toISOString();
  }
  return data;
};

// Tick "Email the couple now" and save: sends them their draft link (with the promo code, if you typed one).
const emailCoupleNow: BeforeChange = async ({ data, originalDoc, req }) => {
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
};

const planOptions = [
  { label: "Basic", value: "basic" },
  { label: "Premium", value: "premium" },
  { label: "Royal", value: "royal" },
];

/** Wedding invites made with the invite maker (/shaadi). Created and edited through /api/shaadi, never the public Payload API. */
export const Invites: CollectionConfig = {
  slug: "invites",
  admin: {
    group: "Wedding invites",
    useAsTitle: "names",
    defaultColumns: ["names", "links", "paymentStatus", "plan", "amount", "contactEmail", "createdAt"],
    listSearchableFields: ["names", "slug", "contactEmail", "orderId"],
    description:
      "Every invite has Preview, Edit and Live links. To give a couple a package without an online payment: open the invite, set Payment status to Paid (live), choose the package and save.",
  },
  defaultSort: "-createdAt",
  access: { read: authenticated, create: nobody, update: authenticated, delete: authenticated },
  hooks: { beforeChange: [setPackageManually, emailCoupleNow] },
  fields: [
    {
      name: "links",
      type: "ui",
      label: "Links",
      admin: {
        components: {
          Field: "@/components/admin/InviteLinks#InviteLinksField",
          Cell: "@/components/admin/InviteLinks#InviteLinksCell",
        },
      },
    },
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
      type: "collapsible",
      label: "Package",
      admin: { initCollapsed: false, description: "Edit freely, with or without a payment. Changes apply to the couple's invite as soon as you save." },
      fields: [
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
              admin: { description: "Paid (live) makes the invite public and unlocks sharing." },
            },
            { name: "plan", type: "select", label: "Package bought", options: planOptions, admin: { description: "Upgrade or downgrade any time." } },
          ],
        },
        {
          type: "row",
          fields: [
            { name: "paidAt", type: "date", admin: { description: "Set automatically when marked Paid. You can change it." } },
            { name: "expiresAt", type: "date", admin: { description: "The invite stops showing after this date (set automatically when marked Paid). Change it to extend." } },
          ],
        },
        { name: "amount", type: "number", admin: { description: "Rupees received. Razorpay fills this in; type it yourself for cash, UPI or complimentary packages." } },
        { name: "manualNote", type: "textarea", label: "Admin note", admin: { description: "Optional, only you see it. E.g. “Paid ₹1,999 by UPI on 14 Nov” or “Complimentary”." } },
        { name: "emailLive", type: "checkbox", defaultValue: false, label: "Email the couple their live link and edit link", admin: { description: "Tick and save. Needs Payment status = Paid (live) and their email below." } },
      ],
    },
    {
      type: "collapsible",
      label: "Payment details",
      admin: { initCollapsed: true },
      fields: [
        { name: "contactEmail", type: "email" },
        { name: "promoCode", type: "text", admin: { readOnly: true } },
        { name: "orderId", type: "text", index: true, admin: { readOnly: true } },
        {
          name: "orderPlan",
          type: "select",
          options: planOptions,
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
