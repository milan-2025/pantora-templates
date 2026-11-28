import type { CollectionConfig } from "payload";
import { authenticated } from "@/lib/cms/access";
import { REVIEW_PRODUCTS } from "@/lib/reviews";

/**
 * Real customer reviews for the app pages (invite maker, photo sharing, workout, HostBook, LeadFlow).
 * A page shows the ticked reviews for its product, newest order first, and hides the section when there are none.
 * Only add words customers actually said, with their permission.
 */
export const Reviews: CollectionConfig = {
  slug: "reviews",
  labels: { singular: "Review", plural: "Reviews" },
  admin: {
    group: "Content",
    useAsTitle: "name",
    defaultColumns: ["name", "product", "show", "quote"],
    description: "Real words from real customers, shown on each app's page. The online planner's reviews stay under Wedding planner → Landing page.",
  },
  defaultSort: "order",
  access: { read: authenticated, create: authenticated, update: authenticated, delete: authenticated },
  fields: [
    { name: "product", type: "select", required: true, options: REVIEW_PRODUCTS.map((p) => ({ label: p.label, value: p.key })) },
    {
      type: "row",
      fields: [
        { name: "name", type: "text", required: true, admin: { width: "50%", description: "First name, or first name + initial" } },
        { name: "detail", type: "text", admin: { width: "50%", description: "e.g. Bride · Jaipur · Feb 2027, or Host · 3 homestays in Manali" } },
      ],
    },
    { name: "quote", type: "textarea", required: true, maxLength: 400 },
    { name: "show", type: "checkbox", defaultValue: true, label: "Show on the page", admin: { position: "sidebar" } },
    { name: "order", type: "number", defaultValue: 0, admin: { position: "sidebar", description: "Lower numbers show first" } },
  ],
};
