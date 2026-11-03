"use client";

import { motion } from "motion/react";
import { ButtonLink } from "@/components/ui/Button";
import { MediaSlot } from "@/components/ui/MediaSlot";
import { LogoMark } from "@/components/Logo";
import { useCurrentPrice } from "@/components/landing/LiveData";
import { checkoutHref, type LandingProps } from "@/components/landing/types";
import { formatINR } from "@/lib/format";

export function FinalCTA({ product, offer }: LandingProps) {
  const cta = product.finalCta ?? {};
  const { price, pending } = useCurrentPrice(offer);
  if (!cta.heading) return null;

  return (
    <section className="relative overflow-hidden bg-plum px-4 py-24 md:py-32">
      <MediaSlot media={cta.media} decorative className="absolute inset-0" sizes="100vw" />
      <div className="absolute inset-0 bg-plum/65" />
      <div aria-hidden className="pointer-events-none absolute -left-24 top-0 size-96 rounded-full bg-marigold/15 blur-3xl" />
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 80, damping: 16 }}
        className="relative mx-auto max-w-3xl rounded-4xl bg-cream p-8 text-center shadow-lift md:p-14"
      >
        {/* the brand moment: the box opens */}
        <LogoMark className="mx-auto mb-6 size-20" animated />
        <h2 className="font-display text-4xl leading-tight md:text-6xl">
          {cta.heading}
          {cta.headingAccent && (
            <>
              <br />
              <span className="italic text-marigold">{cta.headingAccent}</span>
            </>
          )}
        </h2>
        {cta.text && <p className="mx-auto mt-5 max-w-lg text-lg text-charcoal/75">{cta.text}</p>}
        <ButtonLink href={checkoutHref(product)} size="lg" className="mt-8">
          {cta.buttonLabel || "Get it now"} ·{" "}
          <span className={`transition-opacity ${pending ? "opacity-0" : ""}`}>{formatINR(price)}</span>
        </ButtonLink>
      </motion.div>
    </section>
  );
}
