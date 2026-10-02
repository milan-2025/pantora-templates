"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { SpreadsheetMockup } from "@/components/SpreadsheetMockup";
import { VideoSlot } from "@/components/ui/VideoSlot";
import { Squiggle } from "@/components/ui/Squiggle";
import { showcaseTabs, type ShowcaseTabId } from "@/lib/content";

const TAB_MS = 5000;

/**
 * Product tour: tabs auto-advance while the section is on screen,
 * and stop auto-advancing once the visitor picks a tab themselves.
 */
export function Showcase() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const [active, setActive] = useState<ShowcaseTabId>("budget");
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!inView || !auto) return;
    const id = setTimeout(() => {
      const i = showcaseTabs.findIndex((t) => t.id === active);
      setActive(showcaseTabs[(i + 1) % showcaseTabs.length].id);
    }, TAB_MS);
    return () => clearTimeout(id);
  }, [inView, auto, active]);

  const pick = (id: ShowcaseTabId) => {
    setAuto(false);
    setActive(id);
  };

  const current = showcaseTabs.find((t) => t.id === active)!;
  const index = showcaseTabs.findIndex((t) => t.id === active);

  return (
    <section id="inside" ref={ref} className="scroll-mt-20 bg-cream px-4 py-20 md:py-28">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-10 text-center md:mb-12">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-teal">What&apos;s inside</p>
          <h2 className="font-display text-4xl md:text-6xl">
            Five tabs.{" "}
            <span className="relative inline-block italic">
              Zero stress.
              <Squiggle className="absolute -bottom-2 left-0 h-3 w-full" />
            </span>
          </h2>
        </div>

        {/* tab pills */}
        <div className="mb-10 flex flex-wrap justify-center gap-2 md:mb-14">
          {showcaseTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => pick(t.id)}
              className={`relative overflow-hidden rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                active === t.id ? "text-plum shadow-soft" : "bg-paper text-charcoal/70 ring-1 ring-plum/10 hover:text-plum"
              }`}
            >
              {active === t.id && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-full bg-marigold"
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                />
              )}
              {/* auto-advance timer */}
              {active === t.id && auto && inView && (
                <motion.span
                  key={`timer-${t.id}`}
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
          <div className="order-2 lg:order-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 30 }}
                transition={{ duration: 0.25 }}
              >
                <div className="mb-3 text-sm font-semibold tracking-widest text-coral">
                  0{index + 1} / 0{showcaseTabs.length}
                </div>
                <h3 className="mb-4 font-display text-3xl md:text-5xl">{current.headline}</h3>
                <p className="mb-6 max-w-md text-lg leading-relaxed text-charcoal/80">{current.text}</p>
                <VideoSlot
                  src={current.video}
                  label={current.video.split("/").pop()}
                  className="aspect-video w-full max-w-md rounded-2xl shadow-lift"
                />
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="order-1 px-1 pb-2 lg:order-2">
            <SpreadsheetMockup active={active} onTabChange={pick} />
            <div className="mt-6 flex justify-center gap-2">
              {showcaseTabs.map((t) => (
                <motion.button
                  key={t.id}
                  aria-label={`Show ${t.label}`}
                  onClick={() => pick(t.id)}
                  animate={{ width: active === t.id ? 32 : 10, backgroundColor: active === t.id ? "#3b1f4a" : "#ebe2ef" }}
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
