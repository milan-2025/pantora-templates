import type { CollectionConfig } from "payload";
import { authenticated } from "@/lib/cms/access";
import { verifyDownload } from "@/lib/cms/downloadToken";

/**
 * The paid files buyers download (e.g. the .xlsx). Never public:
 * admins can open them, and buyers get a short-lived signed link from /api/download/<orderId>.
 */
export const ProductFiles: CollectionConfig = {
  slug: "product-files",
  labels: { singular: "Product file", plural: "Product files (paid downloads)" },
  admin: {
    group: "Shop",
    description: "Upload the file customers receive after paying. These files are private.",
  },
  access: {
    read: ({ req }) => {
      if (req.user) return true;
      const filename = decodeURIComponent(new URL(req.url ?? "http://x").pathname.split("/").pop() ?? "");
      return verifyDownload(filename, req.searchParams.get("exp"), req.searchParams.get("sig"));
    },
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  upload: true,
  fields: [{ name: "note", type: "text", admin: { description: "Optional note, e.g. version number" } }],
};
