"use client";

import { useEffect, useState } from "react";
import { SpreadsheetMockup } from "@/components/SpreadsheetMockup";
import { showcaseTabs, type ShowcaseTabId } from "@/lib/content";

/** Small auto-cycling preview of the sheet for the order summary. */
export function MiniMockup() {
  const [tab, setTab] = useState<ShowcaseTabId>("dashboard");
  useEffect(() => {
    const id = setInterval(() => {
      setTab((t) => showcaseTabs[(showcaseTabs.findIndex((x) => x.id === t) + 1) % showcaseTabs.length].id);
    }, 3000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="pointer-events-none origin-top select-none" aria-hidden>
      <SpreadsheetMockup active={tab} className="shadow-soft!" />
    </div>
  );
}
