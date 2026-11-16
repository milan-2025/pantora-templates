import type { CollectionConfig } from "payload";
import { authenticated } from "@/lib/cms/access";

type BeforeChange = NonNullable<NonNullable<CollectionConfig["hooks"]>["beforeChange"]>[number];

const relId = (v: unknown) => (v && typeof v === "object" ? String((v as { id?: unknown }).id ?? "") : v ? String(v) : "");

/**
 * Changing a customer's plan in /admin: if you didn't also type a new expiry date, the plan's
 * "valid for (days)" starts today. Moving someone from the trial to a paid plan marks them Paid.
 * Emails are always stored in lower case so sign-in matches.
 */
const adminPlanChange: BeforeChange = async ({ data, originalDoc, req, operation }) => {
  if (!data) return data;
  if (typeof data.ownerEmail === "string") data.ownerEmail = data.ownerEmail.trim().toLowerCase();
  if (Array.isArray(data.collaborators)) {
    data.collaborators = (data.collaborators as { email?: string; role?: string }[]).map((c) => ({ ...c, email: String(c.email ?? "").trim().toLowerCase() }));
  }
  const newPlan = relId(data.plan);
  const oldPlan = relId(originalDoc?.plan);
  if (!newPlan || newPlan === oldPlan) return data;
  const expiryTyped =
    operation === "create" ? Boolean(data.expiresAt) : data.expiresAt !== undefined && data.expiresAt !== (originalDoc?.expiresAt ?? null);
  const plan = await req.payload.findByID({ collection: "planner-plans", id: newPlan, depth: 0, overrideAccess: true }).catch(() => null);
  if (!plan) return data;
  if (!expiryTyped) data.expiresAt = new Date(Date.now() + (plan.durationDays ?? 365) * 864e5).toISOString();
  const status = data.status ?? originalDoc?.status;
  if (!plan.isTrial && (status === "trial" || !status)) data.status = "paid";
  if (data.status === "paid" && !data.paidAt && !originalDoc?.paidAt) data.paidAt = new Date().toISOString();
  return data;
};

/** One wedding plan per row: the couple's data, plan, validity and collaborators. */
export const Planners: CollectionConfig = {
  slug: "planners",
  labels: { singular: "Customer planner", plural: "Customer planners" },
  admin: {
    group: "Wedding planner",
    useAsTitle: "names",
    defaultColumns: ["names", "ownerEmail", "plan", "status", "expiresAt", "guestCount", "lastActivityAt"],
    listSearchableFields: ["names", "ownerEmail", "orderId"],
    description:
      "Every customer's planner. To change a plan or extend validity: open it, pick the plan and/or type a new expiry date, and save. Changing the plan alone restarts its validity from today.",
  },
  defaultSort: "-createdAt",
  access: { read: authenticated, create: authenticated, update: authenticated, delete: authenticated },
  hooks: { beforeChange: [adminPlanChange] },
  fields: [
    {
      name: "supportLink",
      type: "ui",
      label: "Open",
      admin: { components: { Field: "@/components/admin/PlannerLinks#PlannerLinksField", Cell: "@/components/admin/PlannerLinks#PlannerLinksCell" } },
    },
    { name: "names", type: "text", admin: { readOnly: true, description: "From the couple's details in the planner." } },
    { name: "ownerEmail", type: "email", required: true, index: true, label: "Owner email", admin: { description: "Signs in with this email. Change it to transfer the planner." } },
    {
      type: "collapsible",
      label: "Plan & validity",
      admin: { initCollapsed: false },
      fields: [
        {
          type: "row",
          fields: [
            { name: "plan", type: "relationship", relationTo: "planner-plans", required: true, admin: { width: "34%" } },
            {
              name: "status",
              type: "select",
              defaultValue: "trial",
              index: true,
              options: [
                { label: "Free trial", value: "trial" },
                { label: "Paid", value: "paid" },
                { label: "Suspended (read-only)", value: "suspended" },
              ],
              admin: { width: "33%" },
            },
            { name: "expiresAt", type: "date", label: "Valid until", admin: { width: "33%", date: { pickerAppearance: "dayAndTime" }, description: "After this the planner turns read-only until they upgrade or renew." } },
          ],
        },
        {
          type: "row",
          fields: [
            { name: "paidAt", type: "date", admin: { width: "34%" } },
            { name: "amount", type: "number", label: "Amount received (₹)", admin: { width: "33%" } },
            { name: "promoCode", type: "text", admin: { width: "33%", readOnly: true } },
          ],
        },
        { name: "source", type: "text", label: "Came from", admin: { readOnly: true, description: "The ad or link that brought them (utm_source / campaign / content), when known." } },
        { name: "adminNote", type: "textarea", label: "Admin note", admin: { description: "Only you see this. E.g. “Paid ₹1,499 by UPI”." } },
      ],
    },
    {
      name: "collaborators",
      type: "array",
      labels: { singular: "Collaborator", plural: "Collaborators" },
      admin: { description: "Family members who can open this planner with their own email. The plan decides how many the owner may add themselves; you can add more here." },
      fields: [
        {
          type: "row",
          fields: [
            { name: "email", type: "email", required: true },
            { name: "role", type: "select", defaultValue: "editor", options: [{ label: "Can edit", value: "editor" }, { label: "View only", value: "viewer" }] },
            { name: "addedAt", type: "date", admin: { readOnly: true } },
          ],
        },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "guestCount", type: "number", admin: { readOnly: true } },
        { name: "lastActivityAt", type: "date", admin: { readOnly: true } },
        { name: "rev", type: "number", defaultValue: 0, label: "Saves", admin: { readOnly: true, description: "Increases with every save." } },
      ],
    },
    {
      type: "collapsible",
      label: "Payment details",
      admin: { initCollapsed: true },
      fields: [
        { name: "orderId", type: "text", index: true, admin: { readOnly: true } },
        { name: "orderPlan", type: "relationship", relationTo: "planner-plans", admin: { readOnly: true, description: "Plan being paid for; becomes the plan once payment is confirmed." } },
        { name: "orderAmount", type: "number", admin: { readOnly: true } },
        { name: "paymentId", type: "text", admin: { readOnly: true } },
        { name: "orderPaid", type: "checkbox", defaultValue: false, admin: { readOnly: true, description: "Ticked once this order's payment was applied." } },
      ],
    },
    // The whole planner (guests, budget, vendors…). Large, so hidden from the admin form.
    { name: "state", type: "json", admin: { hidden: true } },
  ],
};
