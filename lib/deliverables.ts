import type { Product } from "@/payload-types";

/** One extra file and/or link from a product's "More files & links" list. */
export type ExtraItem = { id: string; label: string; hasFile: boolean; link: string | null };

/** The extra files/links a buyer gets with a product (rows with neither are skipped). */
export function extraItems(product: Product | null | undefined): ExtraItem[] {
  return (product?.extraFiles ?? [])
    .map((row, i) => ({
      id: row.id ?? String(i),
      label: row.label?.trim() || `File ${i + 1}`,
      hasFile: Boolean(row.file),
      link: row.link?.trim() || null,
    }))
    .filter((x) => x.hasFile || x.link);
}

/** Download link for a product file. `addonId` for an add-on, `extraId` for a row of "More files & links". */
export function downloadPath(orderId: string, opts: { addonId?: string; extraId?: string } = {}) {
  const q = new URLSearchParams();
  if (opts.addonId) q.set("item", `addon-${opts.addonId}`);
  if (opts.extraId) q.set("file", opts.extraId);
  const qs = q.toString();
  return `/api/download/${encodeURIComponent(orderId)}${qs ? `?${qs}` : ""}`;
}
