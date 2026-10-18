"use client";

import { useEffect, useState } from "react";
import { SpreadsheetMockup } from "@/components/SpreadsheetMockup";
import type { SheetPreview } from "@/lib/sheetPreview";

/** Small auto-cycling preview of the sheet for the order summary (used when the product has no card image). */
export function MiniMockup({ preview }: { preview: SheetPreview }) {
  const count = preview.sheets.length;
  const [tab, setTab] = useState(count - 1);
  useEffect(() => {
    if (count < 2) return;
    const id = setInterval(() => setTab((t) => (t + 1) % count), 3000);
    return () => clearInterval(id);
  }, [count]);
  return (
    <div className="pointer-events-none origin-top select-none" aria-hidden>
      <SpreadsheetMockup preview={preview} active={tab} className="shadow-soft!" />
    </div>
  );
}
