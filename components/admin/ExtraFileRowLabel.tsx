"use client";

import { useRowLabel } from "@payloadcms/ui";

/** Shows each extra file/link by its button text in the product's "More files & links" list. */
export function ExtraFileRowLabel() {
  const { data, rowNumber } = useRowLabel<{ label?: string }>();
  return <span>{data?.label || `File / link ${(rowNumber ?? 0) + 1}`}</span>;
}
