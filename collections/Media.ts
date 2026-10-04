import type { CollectionConfig } from "payload";
import { anyone, authenticated } from "@/lib/cms/access";

/** Public images & videos used on the website. */
export const Media: CollectionConfig = {
  slug: "media",
  labels: { singular: "Image / video", plural: "Images & videos" },
  admin: { group: "Content", description: "Upload images and videos here, then pick them on any page." },
  access: { read: anyone, create: authenticated, update: authenticated, delete: authenticated },
  upload: {
    mimeTypes: ["image/*", "video/*"],
    adminThumbnail: "card",
    focalPoint: true,
    imageSizes: [
      { name: "card", width: 800 },
      { name: "large", width: 1600 },
    ],
  },
  fields: [
    {
      name: "alt",
      type: "text",
      required: true,
      admin: { description: "Short description of the image, for accessibility and Google." },
    },
  ],
};
