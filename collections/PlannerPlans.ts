import type { CollectionConfig, Field } from "payload";
import { authenticated } from "@/lib/cms/access";
import { LIMITS } from "@/lib/planner/core";

const limitFields: Field[] = Object.entries(LIMITS).map(([name, label]) => ({
  name,
  type: "number",
  label,
  min: 0,
  admin: { width: "25%", placeholder: "Unlimited" },
}));

/**
 * Plans for the online wedding planner (/planner): the free trial and the paid plans.
 * Every limit and price is read live, so a change here applies at once to every planner on the plan.
 */
export const PlannerPlans: CollectionConfig = {
  slug: "planner-plans",
  labels: { singular: "Planner plan", plural: "Planner plans" },
  admin: {
    group: "Wedding planner",
    useAsTitle: "name",
    defaultColumns: ["name", "isTrial", "price", "durationDays", "collaborators", "active", "sortOrder"],
    description:
      "The free trial and the paid plans for the online wedding planner. Changes apply immediately to everyone on the plan. Leave a limit empty for unlimited. Exactly one plan should be ticked as the free trial.",
  },
  defaultSort: "sortOrder",
  access: { read: authenticated, create: authenticated, update: authenticated, delete: authenticated },
  fields: [
    {
      type: "row",
      fields: [
        { name: "name", type: "text", required: true, label: "Name shown to customers", admin: { width: "40%" } },
        {
          name: "planId",
          type: "text",
          required: true,
          unique: true,
          index: true,
          label: "Plan code",
          admin: { width: "30%", description: "Short code, e.g. family. Don't change it once people have bought the plan." },
        },
        { name: "sortOrder", type: "number", defaultValue: 10, admin: { width: "30%", description: "Lower shows first." } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "isTrial", type: "checkbox", label: "This is the free trial", defaultValue: false, admin: { description: "New sign-ups start on this plan." } },
        { name: "active", type: "checkbox", label: "Show on the upgrade screen", defaultValue: true, admin: { description: "Untick to stop selling it. People already on it keep it." } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "price", type: "number", min: 0, defaultValue: 0, label: "Price (₹, incl. GST)", admin: { width: "33%" } },
        { name: "durationDays", type: "number", required: true, min: 1, defaultValue: 365, label: "Valid for (days)", admin: { width: "33%", description: "Trial length for the trial plan, e.g. 7 or 14." } },
        { name: "collaborators", type: "number", min: 0, defaultValue: 0, label: "Collaborators allowed", admin: { width: "33%", description: "Extra family emails the owner can invite (0 = none)." } },
      ],
    },
    { name: "tagline", type: "text", label: "Short line under the name" },
    { name: "badge", type: "text", label: "Badge (optional)", admin: { description: "E.g. “Most chosen”." } },
    { name: "features", type: "array", label: "What's included (one line each)", fields: [{ name: "text", type: "text", required: true }] },
    {
      name: "limits",
      type: "group",
      label: "Limits (empty = unlimited)",
      admin: { description: "Most rows a planner on this plan can have in each list. People already above a limit (after a downgrade) can still edit and delete, just not add more." },
      fields: [{ type: "row", fields: limitFields }],
    },
  ],
};
