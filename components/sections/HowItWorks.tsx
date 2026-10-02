"use client";

import { useRef } from "react";
import { motion, useScroll, useSpring } from "motion/react";
import { Copy, Mail, ShoppingBag, Sparkles } from "lucide-react";
import { steps } from "@/lib/content";
import { Reveal } from "@/components/ui/Reveal";

const icons = [ShoppingBag, Mail, Copy, Sparkles];

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 60%"] });
  const progress = useSpring(scrollYProgress, { stiffness: 100, damping: 24 });

  return (
    <section className="bg-teal px-4 py-20 text-cream md:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-14 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-marigold">How it works</p>
          <h2 className="font-display text-4xl text-cream md:text-6xl">Ready in about two minutes</h2>
        </Reveal>

        <div ref={ref} className="relative">
          {/* connector line: vertical on mobile, horizontal on desktop */}
          <div className="absolute left-7 top-0 h-full w-0.5 bg-cream/20 md:left-0 md:top-7 md:h-0.5 md:w-full" />
          <motion.div style={{ scaleY: progress }} className="absolute left-7 top-0 h-full w-0.5 origin-top bg-marigold md:hidden" />
          <motion.div style={{ scaleX: progress }} className="absolute left-0 top-7 hidden h-0.5 w-full origin-left bg-marigold md:block" />

          <div className="relative grid gap-10 md:grid-cols-4 md:gap-6">
            {steps.map((s, i) => {
              const Icon = icons[i];
              return (
                <Reveal key={s.title} delay={i * 0.12} className="flex gap-5 md:block">
                  <motion.div
                    whileInView={{ scale: [0.5, 1.12, 1] }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.15 + i * 0.15, duration: 0.5 }}
                    className="relative z-10 grid size-14 shrink-0 place-items-center rounded-full bg-cream text-teal shadow-lift"
                  >
                    <Icon className="size-6" strokeWidth={2} />
                  </motion.div>
                  <div className="md:mt-6">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-marigold">Step {i + 1}</div>
                    <h3 className="mt-1 font-display text-2xl text-cream">{s.title}</h3>
                    <p className="mt-1 text-cream/80">{s.text}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
