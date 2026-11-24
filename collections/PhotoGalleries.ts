import type { CollectionConfig } from "payload";
import { authenticated, nobody } from "@/lib/cms/access";

type BeforeChange = NonNullable<NonNullable<CollectionConfig["hooks"]>["beforeChange"]>[number];
type AfterDelete = NonNullable<NonNullable<CollectionConfig["hooks"]>["afterDelete"]>[number];

/** A plan set by hand in /admin (no online payment): fill in the paid date and expiry if they were left empty. */
const setPlanManually: BeforeChange = async ({ data, originalDoc, req, operation }) => {
  if (operation !== "update" || !data) return data;
  const status = data.paymentStatus ?? originalDoc?.paymentStatus;
  const plan = data.plan ?? originalDoc?.plan;
  if (status === "paid" && originalDoc?.paymentStatus !== "paid") {
    if (!plan || plan === "free") data.plan = "basic";
    if (!data.paidAt) data.paidAt = new Date().toISOString();
    if (!data.expiresAt || data.expiresAt === originalDoc?.expiresAt) {
      // Loaded on demand so the Payload CLI (which loads this file) never imports server-only code.
      const { getPhotoPlans } = await import("@/lib/photos/plans");
      const { plans } = await getPhotoPlans(req.payload);
      const months = plans.find((p) => p.id === (data.plan ?? plan))?.months ?? 12;
      const exp = new Date();
      exp.setMonth(exp.getMonth() + months);
      data.expiresAt = exp.toISOString();
    }
    data.state = "active";
  }
  return data;
};

/** Deleting a gallery in /admin also deletes its photos and videos from storage. */
const removeFiles: AfterDelete = async ({ doc, req }) => {
  const { purgeGalleryFiles } = await import("@/lib/photos/server");
  await purgeGalleryFiles(req.payload, String(doc.id)).catch((e) => console.error("[photos] purge after delete", e));
};

/** Wedding photo galleries (/photos). Created and changed through /api/photos, never the public Payload API. */
export const PhotoGalleries: CollectionConfig = {
  slug: "photo-galleries",
  labels: { singular: "Photo gallery", plural: "Photo galleries" },
  admin: {
    group: "Wedding photos",
    useAsTitle: "names",
    defaultColumns: ["names", "slug", "plan", "paymentStatus", "photoCount", "storageMb", "expiresAt", "contactEmail"],
    listSearchableFields: ["names", "slug", "contactEmail", "orderId"],
    description:
      "Guests open pandoratemplates.com/p/<link>. To give a couple a plan without an online payment: open the gallery, set Payment status to Paid, choose the plan and save. Deleting a gallery deletes its files too.",
  },
  defaultSort: "-createdAt",
  access: { read: authenticated, create: nobody, update: authenticated, delete: authenticated },
  hooks: { beforeChange: [setPlanManually], afterDelete: [removeFiles] },
  fields: [
    {
      type: "row",
      fields: [
        { name: "names", type: "text", required: true, label: "Couple", admin: { width: "50%" } },
        { name: "slug", type: "text", required: true, unique: true, index: true, label: "Link (after /p/)", admin: { width: "50%" } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "contactEmail", type: "email", index: true, admin: { width: "50%" } },
        { name: "phone", type: "text", admin: { width: "25%" } },
        { name: "weddingDate", type: "date", admin: { width: "25%", date: { pickerAppearance: "dayOnly" } } },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "plan",
          type: "select",
          defaultValue: "free",
          options: [
            { label: "Free", value: "free" },
            { label: "Basic", value: "basic" },
            { label: "Premium", value: "premium" },
            { label: "Royal", value: "royal" },
          ],
          admin: { width: "25%" },
        },
        {
          name: "paymentStatus",
          type: "select",
          defaultValue: "unpaid",
          options: [
            { label: "Not paid (free)", value: "unpaid" },
            { label: "Paid", value: "paid" },
          ],
          admin: { width: "25%" },
        },
        { name: "expiresAt", type: "date", label: "Online until", admin: { width: "25%" } },
        {
          name: "state",
          type: "select",
          defaultValue: "active",
          options: [
            { label: "Active", value: "active" },
            { label: "Expired (hidden from guests)", value: "expired" },
            { label: "Files deleted", value: "purged" },
          ],
          admin: { width: "25%" },
        },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "photoCount", type: "number", defaultValue: 0, admin: { width: "25%", readOnly: true } },
        { name: "videoCount", type: "number", defaultValue: 0, admin: { width: "25%", readOnly: true } },
        { name: "storageMb", type: "number", defaultValue: 0, label: "Storage used (MB)", admin: { width: "25%", readOnly: true } },
        { name: "videoMb", type: "number", defaultValue: 0, label: "Of which video (MB)", admin: { width: "25%", readOnly: true } },
      ],
    },
    {
      type: "collapsible",
      label: "Gallery settings (the couple changes these)",
      admin: { initCollapsed: true },
      fields: [
        { name: "albums", type: "json", admin: { description: "[{ id, name }] in the order guests see them." } },
        { name: "cover", type: "text", label: "Cover photo (item id)" },
        { name: "message", type: "textarea", label: "Message to guests" },
        { name: "pinHash", type: "text", label: "Guest PIN (hashed)", admin: { readOnly: true, description: "Set by the couple. Empty = no PIN." } },
        { name: "guestUploads", type: "checkbox", defaultValue: false, label: "Guests may add photos" },
        { name: "allowDownload", type: "checkbox", defaultValue: true, label: "Guests may download photos" },
        { name: "inviteSlug", type: "text", label: "Linked wedding invite (its link)" },
      ],
    },
    {
      type: "collapsible",
      label: "Payment details",
      admin: { initCollapsed: true },
      fields: [
        { name: "orderId", type: "text", index: true, admin: { readOnly: true } },
        { name: "orderPlan", type: "text", admin: { readOnly: true, description: "The plan (or 'renew') being paid for in the last order." } },
        { name: "amount", type: "number", admin: { readOnly: true } },
        { name: "promoCode", type: "text", admin: { readOnly: true } },
        { name: "paymentId", type: "text", admin: { readOnly: true } },
        { name: "lastPaidOrder", type: "text", admin: { readOnly: true } },
        { name: "paidAt", type: "date", admin: { readOnly: true } },
      ],
    },
    {
      type: "collapsible",
      label: "Internal",
      admin: { initCollapsed: true },
      fields: [
        { name: "editToken", type: "text", index: true, admin: { readOnly: true, description: "The couple's private key. Never share it." } },
        { name: "reminderSentAt", type: "date", admin: { readOnly: true } },
        { name: "purgedAt", type: "date", admin: { readOnly: true } },
        { name: "source", type: "text", admin: { readOnly: true } },
      ],
    },
  ],
};
