/**
 * One-off: gives the Wedding Planner its animated sheet preview in an existing database
 * (the preview moved from code into the admin). Leaves it alone if it already has one.
 *   npm run fill-preview
 */
import { getPayload } from "payload";
import config from "@payload-config";
import { WEDDING_PREVIEW } from "../lib/sheetPreview";

const payload = await getPayload({ config });
const found = await payload.find({ collection: "products", where: { slug: { equals: "wedding_planner" } }, limit: 1, depth: 0 });
const product = found.docs[0];

if (!product) {
  console.log("No product with the slug wedding_planner; nothing to do.");
} else if (product.preview?.sheets?.length) {
  console.log("The Wedding Planner already has a sheet preview; nothing changed.");
} else {
  await payload.update({
    collection: "products",
    id: product.id,
    data: { preview: WEDDING_PREVIEW, ...(product._status === "published" ? { _status: "published" as const } : {}) },
    context: { disableRevalidate: true },
  });
  console.log("Added the sheet preview to the Wedding Planner.");
}
process.exit(0);
