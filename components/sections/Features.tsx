"use client";

import { motion } from "motion/react";
import { BellRing, Calculator, FileSpreadsheet, RefreshCw, Smartphone, Users } from "lucide-react";
import { features } from "@/lib/content";
import { Reveal } from "@/components/ui/Reveal";

const icons = { Calculator, Users, BellRing, FileSpreadsheet, Smartphone, RefreshCw };

export function Features() {
  return (
    <section className="bg-grid px-4 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto mb-14 max-w-2xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-teal">Made for Indian weddings</p>
          <h2 className="font-display text-4xl md:text-6xl">
            Everything you need. <span className="italic text-coral">Nothing you don&apos;t.</span>
          </h2>
        </Reveal>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => {
            const Icon = icons[f.icon];
            return (
              <Reveal key={f.title} delay={i * 0.06}>
                <motion.div
                  whileHover={{ y: -6 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="card group h-full rounded-3xl p-7 transition-shadow hover:shadow-lift"
                >
                  <div className={`mb-5 grid size-12 place-items-center rounded-2xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 ${f.color}`}>
                    <Icon className="size-6" strokeWidth={2} />
                  </div>
                  <h3 className="mb-2 font-display text-2xl">{f.title}</h3>
                  <p className="leading-relaxed text-charcoal/75">{f.text}</p>
                </motion.div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
