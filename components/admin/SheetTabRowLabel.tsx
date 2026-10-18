"use client";

import { useRowLabel } from "@payloadcms/ui";

/** "Tab 1 · 💰 Budget" in the Sheet preview list, so the "which tab" pickers elsewhere are easy to match up. */
export function SheetTabRowLabel() {
  const { data, rowNumber } = useRowLabel<{ label?: string; emoji?: string }>();
  const name = [data?.emoji, data?.label].filter(Boolean).join(" ") || "New tab";
  return <span>{`Tab ${(rowNumber ?? 0) + 1} · ${name}`}</span>;
}
