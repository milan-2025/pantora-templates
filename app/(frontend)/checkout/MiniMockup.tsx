"use client";

import { useEffect, useState } from "react";
import { MOCKUP_SHEETS, SpreadsheetMockup, type MockupTab } from "@/components/SpreadsheetMockup";

/** Small auto-cycling preview of the sheet for the order summary (used when the product has no card image). */
export function MiniMockup() {
  const [tab, setTab] = useState<MockupTab>("dashboard");
  useEffect(() => {
    const id = setInterval(() => {
      setTab((t) => MOCKUP_SHEETS[(MOCKUP_SHEETS.findIndex((x) => x.id === t) + 1) % MOCKUP_SHEETS.length].id);
    }, 3000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="pointer-events-none origin-top select-none" aria-hidden>
      <SpreadsheetMockup active={tab} className="shadow-soft!" />
    </div>
  );
}
