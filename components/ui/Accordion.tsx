"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";

type Item = { q: string; a: string };

export function Accordion({ items }: { items: Item[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={item.q}
            className={`card rounded-2xl transition-shadow ${isOpen ? "shadow-lift" : ""}`}
          >
            <button
              className="flex w-full items-center justify-between gap-4 p-5 text-left text-base font-semibold text-plum md:text-lg"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
            >
              {item.q}
              <motion.span
                animate={{ rotate: isOpen ? 45 : 0 }}
                className={`grid size-8 shrink-0 place-items-center rounded-full transition-colors ${
                  isOpen ? "bg-marigold text-plum" : "bg-lavender text-plum"
                }`}
              >
                <Plus className="size-4" strokeWidth={2.5} />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <p className="px-5 pb-5 leading-relaxed text-charcoal/80">{item.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
