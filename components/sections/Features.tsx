"use client";

import { motion } from "motion/react";
import { Reveal } from "@/components/ui/Reveal";
import { FeatureIcon, ICON_TINTS } from "@/components/ui/FeatureIcon";
import type { LandingProps } from "@/components/landing/types";

export function Features({ product }: LandingProps) {
  const f = product.features ?? {};
  const items = f.items ?? [];
  if (!items.length) return null;

  return (
    <section className="bg-grid px-4 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto mb-14 max-w-2xl text-center">
          {f.eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-teal">{f.eyebrow}</p>}
          <h2 className="font-display text-4xl md:text-6xl">
            {f.heading} {f.headingAccent && <span className="italic text-coral">{f.headingAccent}</span>}
          </h2>
          {product.audienceLine && (
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-charcoal/75">{product.audienceLine}</p>
          )}
        </Reveal>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <Reveal key={item.id ?? i} delay={i * 0.06}>
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="card group h-full rounded-3xl p-7 transition-shadow hover:shadow-lift"
              >
                <div
                  className={`mb-5 grid size-12 place-items-center rounded-2xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 ${ICON_TINTS[i % ICON_TINTS.length]}`}
                >
                  <FeatureIcon name={item.icon} className="size-6" />
                </div>
                <h3 className="mb-2 font-display text-2xl">{item.title}</h3>
                {item.text && <p className="leading-relaxed text-charcoal/75">{item.text}</p>}
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
