"use client";

import { motion } from "motion/react";
import { Check, ShieldCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { Sparkle } from "@/components/ui/Squiggle";
import { LogoMark } from "@/components/Logo";
import { formatINR, product } from "@/lib/content";

export function Pricing() {
  const savings = product.compareAtPrice ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;

  return (
    <section id="pricing" className="relative scroll-mt-16 overflow-hidden bg-plum px-4 py-20 md:py-28">
      <Sparkle className="absolute left-[10%] top-20 size-6 animate-twinkle" />
      <Sparkle className="absolute bottom-24 right-[12%] size-8 animate-twinkle [animation-delay:.8s]" fill="var(--coral)" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-marigold/10 blur-3xl" />

      <div className="relative mx-auto max-w-lg">
        <Reveal className="mb-10 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-marigold">Simple pricing</p>
          <h2 className="font-display text-4xl text-cream md:text-6xl">One price. Everything included.</h2>
          <p className="mt-3 text-cream/75">Pay once and use it for the whole wedding, and the next one in the family too.</p>
        </Reveal>

        <Reveal>
          <div className="relative rounded-[2rem] bg-cream p-7 shadow-lift md:p-9">
            {savings > 0 && (
              <motion.div
                className="absolute -right-3 -top-4 rotate-6 rounded-full bg-coral px-4 py-1.5 text-sm font-semibold text-cream shadow-lift"
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 2.4, repeat: Infinity }}
              >
                Save {savings}%
              </motion.div>
            )}

            <div className="mb-6 flex items-center gap-3">
              <LogoMark className="size-11" animated />
              <div>
                <div className="font-display text-2xl text-plum">{product.name}</div>
                <div className="text-sm text-charcoal/65">{product.formats.join(" + ")} · Instant download</div>
              </div>
            </div>

            <div className="mb-7 flex items-end gap-3">
              <span className="font-display text-6xl leading-none text-plum md:text-7xl">{formatINR(product.price)}</span>
              {product.compareAtPrice && (
                <span className="mb-1 text-xl text-charcoal/45 line-through">{formatINR(product.compareAtPrice)}</span>
              )}
            </div>

            <ul className="mb-8 space-y-3">
              {product.includes.map((item, i) => (
                <motion.li
                  key={item}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.05 * i }}
                  className="flex items-start gap-3 text-charcoal"
                >
                  <Check className="mt-0.5 size-5 shrink-0 rounded-full bg-mint p-1 text-teal" strokeWidth={3.5} />
                  {item}
                </motion.li>
              ))}
            </ul>

            <ButtonLink href="/checkout" size="lg" className="w-full">
              Open the box: get instant access
            </ButtonLink>

            <div className="mt-5 flex items-center justify-center gap-2 text-sm text-charcoal/65">
              <ShieldCheck className="size-5 text-teal" /> Secure checkout · UPI, cards and netbanking
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
