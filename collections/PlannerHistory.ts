import type { CollectionConfig } from "payload";
import { authenticated, nobody } from "@/lib/cms/access";

/** Who changed what in each planner. Rows with a restore point can be rolled back from the app. */
export const PlannerHistory: CollectionConfig = {
  slug: "planner-history",
  labels: { singular: "Planner activity", plural: "Planner activity" },
  admin: {
    group: "Wedding planner",
    useAsTitle: "summary",
    defaultColumns: ["summary", "by", "planner", "hasSnapshot", "createdAt"],
    listSearchableFields: ["summary", "by"],
    description: "Every save in every planner. Customers see their own planner's activity and restore points in the app.",
  },
  defaultSort: "-createdAt",
  access: { read: authenticated, create: nobody, update: nobody, delete: authenticated },
  fields: [
    { name: "planner", type: "relationship", relationTo: "planners", required: true, index: true },
    { name: "rev", type: "number", required: true, index: true, label: "Save number" },
    { name: "by", type: "text", label: "Changed by" },
    { name: "summary", type: "text" },
    { name: "hasSnapshot", type: "checkbox", label: "Restore point", defaultValue: false, index: true },
    // The changes in this save (lets other devices catch up without downloading everything).
    { name: "ops", type: "json", admin: { hidden: true } },
    // The whole planner as it was just before this save.
    { name: "snapshot", type: "json", admin: { hidden: true } },
  ],
};
