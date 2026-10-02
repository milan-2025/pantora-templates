"use client";

import { motion } from "motion/react";
import { ButtonLink } from "@/components/ui/Button";
import { VideoSlot } from "@/components/ui/VideoSlot";
import { LogoMark } from "@/components/Logo";
import { formatINR, product } from "@/lib/content";

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden px-4 py-24 md:py-32">
      <VideoSlot src="/videos/final-cta.mp4" label="final-cta.mp4" className="absolute inset-0" />
      <div className="absolute inset-0 bg-plum/65" />
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 80, damping: 16 }}
        className="relative mx-auto max-w-3xl rounded-[2rem] bg-cream p-8 text-center shadow-lift md:p-14"
      >
        {/* the brand moment: the box opens */}
        <LogoMark className="mx-auto mb-6 size-20" animated />
        <h2 className="font-display text-4xl leading-tight md:text-6xl">
          Open the box.
          <br />
          <span className="italic text-marigold">Everything&apos;s ready.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-lg text-charcoal/75">
          Spend less time chasing details and more time enjoying the run-up to your big day.
        </p>
        <ButtonLink href="/checkout" size="lg" className="mt-8">
          Get the planner · {formatINR(product.price)}
        </ButtonLink>
      </motion.div>
    </section>
  );
}
