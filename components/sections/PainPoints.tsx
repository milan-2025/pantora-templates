"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { painPoints } from "@/lib/content";
import { Reveal } from "@/components/ui/Reveal";

// Where each bubble starts (messy) before scrolling snaps it into the grid.
const chaos = [
  { x: -60, y: -90, r: -18 },
  { x: 80, y: 40, r: 14 },
  { x: -90, y: 60, r: 10 },
  { x: 70, y: -70, r: -12 },
  { x: -40, y: 110, r: 20 },
  { x: 100, y: -30, r: -22 },
];

function Bubble({ i, progress }: { i: number; progress: MotionValue<number> }) {
  const p = painPoints[i];
  const c = chaos[i % chaos.length];
  const x = useTransform(progress, [0, 1], [c.x, 0]);
  const y = useTransform(progress, [0, 1], [c.y, 0]);
  const rotate = useTransform(progress, [0, 1], [c.r, 0]);
  const strike = useTransform(progress, [0.75, 1], ["0%", "100%"]);

  return (
    <motion.div style={{ x, y, rotate }} className={`relative rounded-2xl rounded-bl-sm ${p.color} p-5 shadow-lift`}>
      <div className="mb-1 text-3xl">{p.emoji}</div>
      <p className="relative inline text-lg font-semibold leading-snug text-plum">
        {p.text}
        <motion.span
          aria-hidden
          style={{ width: strike }}
          className="absolute left-0 top-1/2 h-[2.5px] -translate-y-1/2 rounded-full bg-coral"
        />
      </p>
    </motion.div>
  );
}

export function PainPoints() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const sortedOpacity = useTransform(scrollYProgress, [0.85, 1], [0, 1]);
  const sortedScale = useTransform(scrollYProgress, [0.85, 1], [0.5, 1]);

  return (
    <section className="bg-plum px-4 py-20 text-cream md:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto mb-14 max-w-2xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-marigold">Sound familiar?</p>
          <h2 className="font-display text-4xl leading-tight text-cream md:text-6xl">
            Wedding planning can feel like <span className="italic text-coral">chaos</span>.
          </h2>
        </Reveal>

        <div ref={ref} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {painPoints.map((_, i) => (
            <Bubble key={i} i={i} progress={scrollYProgress} />
          ))}
        </div>

        <motion.div style={{ opacity: sortedOpacity, scale: sortedScale }} className="mt-14 text-center">
          <span className="inline-flex items-center gap-3 rounded-full bg-marigold px-7 py-3.5 font-display text-2xl text-plum shadow-lift md:text-3xl">
            One sheet. Everything sorted.
          </span>
        </motion.div>
      </div>
    </section>
  );
}
