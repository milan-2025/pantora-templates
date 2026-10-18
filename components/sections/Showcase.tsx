"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { SpreadsheetMockup } from "@/components/SpreadsheetMockup";
import { previewTabIndex, sheetPreview } from "@/lib/sheetPreview";
import { MediaSlot } from "@/components/ui/MediaSlot";
import { Squiggle } from "@/components/ui/Squiggle";
import type { LandingProps } from "@/components/landing/types";

const TAB_MS = 5000;

/**
 * Product tour: tabs auto-advance while the section is on screen,
 * and stop auto-advancing once the visitor picks a tab themselves.
 */
export function Showcase({ product }: LandingProps) {
  const showcase = product.showcase ?? {};
  const tabs = showcase.tabs ?? [];
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!inView || !auto || tabs.length < 2) return;
    const id = setTimeout(() => setIndex((i) => (i + 1) % tabs.length), TAB_MS);
    return () => clearTimeout(id);
  }, [inView, auto, index, tabs.length]);

  if (!tabs.length) return null;
  const current = tabs[Math.min(index, tabs.length - 1)];

  const pick = (i: number) => {
    setAuto(false);
    setIndex(i);
  };
  const preview = sheetPreview(product);
  const sheetOf = (mockup: string | null | undefined) => previewTabIndex(mockup, preview.sheets.length);
  const pickBySheet = (sheet: number) => {
    const i = tabs.findIndex((t) => sheetOf(t.mockup) === sheet);
    if (i >= 0) pick(i);
  };

  return (
    <section id="inside" ref={ref} className="scroll-mt-20 bg-cream px-4 py-20 md:py-28">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-10 text-center md:mb-12">
          {showcase.eyebrow && (
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-teal">{showcase.eyebrow}</p>
          )}
          <h2 className="font-display text-4xl md:text-6xl">
            {showcase.heading}{" "}
            {showcase.headingAccent && (
              <span className="relative inline-block italic">
                {showcase.headingAccent}
                <Squiggle className="absolute -bottom-2 left-0 h-3 w-full" />
              </span>
            )}
          </h2>
        </div>

        {/* tab pills */}
        <div className="mb-10 flex flex-wrap justify-center gap-2 md:mb-14">
          {tabs.map((t, i) => (
            <button
              key={t.id ?? i}
              onClick={() => pick(i)}
              className={`relative overflow-hidden rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                i === index ? "text-plum shadow-soft" : "bg-paper text-charcoal/70 ring-1 ring-plum/10 hover:text-plum"
              }`}
            >
              {i === index && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-full bg-marigold"
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                />
              )}
              {/* auto-advance timer */}
              {i === index && auto && inView && (
                <motion.span
                  key={`timer-${i}`}
                  className="absolute bottom-0 left-0 h-[3px] bg-plum/40"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: TAB_MS / 1000, ease: "linear" }}
                />
              )}
              <span className="relative">
                {t.emoji} {t.label}
              </span>
            </button>
          ))}
        </div>

        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="order-2 min-w-0 lg:order-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 30 }}
                transition={{ duration: 0.25 }}
              >
                <div className="mb-3 text-sm font-semibold tracking-widest text-coral">
                  {String(index + 1).padStart(2, "0")} / {String(tabs.length).padStart(2, "0")}
                </div>
                {current.headline && <h3 className="mb-4 font-display text-3xl md:text-5xl">{current.headline}</h3>}
                {current.text && <p className="max-w-md text-lg leading-relaxed text-charcoal/80">{current.text}</p>}
                {/* Only rendered when an image/video is uploaded for this tab. */}
                <MediaSlot media={current.media} className="mt-6 aspect-video w-full max-w-md rounded-2xl shadow-lift" />
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="order-1 min-w-0 px-1 pb-2 lg:order-2">
            <SpreadsheetMockup preview={preview} active={sheetOf(current.mockup)} onTabChange={pickBySheet} />
            <div className="mt-6 flex justify-center gap-2">
              {tabs.map((t, i) => (
                <motion.button
                  key={t.id ?? i}
                  aria-label={`Show ${t.label}`}
                  onClick={() => pick(i)}
                  animate={{ width: i === index ? 32 : 10, backgroundColor: i === index ? "#3b1f4a" : "#ebe2ef" }}
                  className="h-2.5 rounded-full"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
