import type { CollectionConfig } from "payload";
import { authenticated, formatSlug, publishedOrAuthenticated, validateSlug } from "@/lib/cms/access";
import { revalidateAfterChange, revalidateAfterDelete, slugPaths } from "@/lib/cms/revalidate";
import { pageBlocks } from "@/blocks";

export const Pages: CollectionConfig = {
  slug: "pages",
  admin: {
    group: "Content",
    useAsTitle: "title",
    defaultColumns: ["title", "slug", "_status", "updatedAt"],
    description: "Build any page from blocks. The page with slug 'home' is the homepage.",
    preview: (doc) => (doc.slug === "home" ? "/" : `/${doc.slug}`),
  },
  versions: { drafts: true },
  access: { read: publishedOrAuthenticated, create: authenticated, update: authenticated, delete: authenticated },
  hooks: {
    afterChange: [revalidateAfterChange(slugPaths())],
    afterDelete: [revalidateAfterDelete(slugPaths())],
  },
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "Content",
          fields: [
            { name: "title", type: "text", required: true },
            {
              name: "slug",
              type: "text",
              required: true,
              unique: true,
              index: true,
              validate: validateSlug,
              hooks: { beforeValidate: [formatSlug] },
              admin: {
                description:
                  "Page address, e.g. ultimateweddingplanner → pandoratemplates.com/ultimateweddingplanner. Use 'home' for the homepage.",
              },
            },
            { name: "layout", type: "blocks", label: "Page sections", blocks: pageBlocks },
          ],
        },
        {
          name: "seo",
          label: "SEO",
          fields: [
            { name: "title", type: "text" },
            { name: "description", type: "textarea" },
            { name: "image", type: "upload", relationTo: "media" },
          ],
        },
      ],
    },
  ],
};
