"use client";

import { motion } from "motion/react";
import { Check } from "lucide-react";
import { MediaSlot } from "@/components/ui/MediaSlot";
import { Reveal } from "@/components/ui/Reveal";
import { SpreadsheetMockup } from "@/components/SpreadsheetMockup";
import { previewTabIndex, sheetPreview } from "@/lib/sheetPreview";
import type { LandingProps } from "@/components/landing/types";

const GLOWS = ["bg-sand", "bg-mint", "bg-blush", "bg-lavender"];

/** 3–4 big features, alternating image/text. Images come from the admin; the live mockup is the fallback. */
export function FeatureHighlights({ product }: LandingProps) {
  const h = product.highlights ?? {};
  const items = h.items ?? [];
  if (!items.length) return null;
  const preview = sheetPreview(product);

  return (
    <section className="overflow-hidden bg-paper px-4 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        {(h.heading || h.eyebrow) && (
          <Reveal className="mx-auto mb-16 max-w-2xl text-center md:mb-20">
            {h.eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-coral">{h.eyebrow}</p>}
            <h2 className="font-display text-4xl md:text-6xl">
              {h.heading} {h.headingAccent && <span className="italic text-teal">{h.headingAccent}</span>}
            </h2>
          </Reveal>
        )}

        <div className="space-y-20 md:space-y-28">
          {items.map((item, i) => {
            const flip = i % 2 === 1;
            return (
              <div key={item.id ?? i} className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
                <motion.div
                  className={`relative min-w-0 ${flip ? "md:order-2" : ""}`}
                  initial={{ opacity: 0, x: flip ? 40 : -40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ type: "spring", stiffness: 70, damping: 16 }}
                >
                  <div aria-hidden className={`absolute -inset-4 -z-0 rounded-[2.5rem] ${GLOWS[i % GLOWS.length]} md:-inset-6`} />
                  <MediaSlot
                    media={item.image}
                    className="relative aspect-[4/3] w-full rounded-3xl shadow-lift"
                    fallback={
                      <div className="pointer-events-none relative" aria-hidden>
                        <SpreadsheetMockup
                          preview={preview}
                          active={previewTabIndex(item.mockup ?? "dashboard", preview.sheets.length)}
                        />
                      </div>
                    }
                  />
                </motion.div>

                <Reveal delay={0.1} className={`min-w-0 ${flip ? "md:order-1" : ""}`}>
                  <div className="mb-4 font-display text-6xl leading-none text-marigold/60">{String(i + 1).padStart(2, "0")}</div>
                  <h3 className="mb-4 font-display text-3xl md:text-4xl">{item.title}</h3>
                  {item.text && <p className="mb-6 text-lg leading-relaxed text-charcoal/80">{item.text}</p>}
                  {!!item.bullets?.length && (
                    <ul className="space-y-2.5">
                      {item.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-3 text-charcoal">
                          <Check className="mt-0.5 size-5 shrink-0 rounded-full bg-mint p-1 text-teal" strokeWidth={3.5} />
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </Reveal>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
