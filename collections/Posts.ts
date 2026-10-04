import type { CollectionConfig } from "payload";
import { authenticated, formatSlug, publishedOrAuthenticated } from "@/lib/cms/access";
import { revalidateAfterChange, revalidateAfterDelete } from "@/lib/cms/revalidate";

const paths = (d: Record<string, unknown>) => ["/blog", ...(d.slug ? [`/blog/${d.slug}`] : [])];

export const Posts: CollectionConfig = {
  slug: "posts",
  labels: { singular: "Blog post", plural: "Blog posts" },
  admin: {
    group: "Content",
    useAsTitle: "title",
    defaultColumns: ["title", "publishedAt", "_status"],
    preview: (doc) => `/blog/${doc.slug}`,
  },
  versions: { drafts: true },
  access: { read: publishedOrAuthenticated, create: authenticated, update: authenticated, delete: authenticated },
  hooks: { afterChange: [revalidateAfterChange(paths)], afterDelete: [revalidateAfterDelete(paths)] },
  defaultSort: "-publishedAt",
  fields: [
    { name: "title", type: "text", required: true },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      hooks: { beforeValidate: [formatSlug] },
      validate: (v: string | null | undefined) =>
        (!!v && /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(v)) || "Use lowercase letters, numbers, - or _ only",
      admin: { position: "sidebar", description: "Address: /blog/<slug>" },
    },
    { name: "publishedAt", type: "date", admin: { position: "sidebar" }, defaultValue: () => new Date().toISOString() },
    { name: "author", type: "text", admin: { position: "sidebar" }, defaultValue: "Pandora Templates" },
    { name: "excerpt", type: "textarea", admin: { description: "Short summary shown on the blog list and in Google" } },
    { name: "coverImage", type: "upload", relationTo: "media" },
    { name: "content", type: "richText", required: true },
    {
      name: "seo",
      type: "group",
      label: "SEO",
      fields: [
        { name: "title", type: "text" },
        { name: "description", type: "textarea" },
      ],
    },
  ],
};
