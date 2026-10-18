"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowDown, Check } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Sparkle, Squiggle } from "@/components/ui/Squiggle";
import { MediaSlot } from "@/components/ui/MediaSlot";
import { SpreadsheetMockup } from "@/components/SpreadsheetMockup";
import { sheetPreview } from "@/lib/sheetPreview";
import { Countdown, SoldCounter } from "@/components/landing/OfferWidgets";
import { useCurrentPrice } from "@/components/landing/LiveData";
import { checkoutHref, type LandingProps } from "@/components/landing/types";
import { formatINR } from "@/lib/format";

export function Hero({ product, offer }: LandingProps) {
  const hero = product.hero ?? {};
  const current = useCurrentPrice(offer);
  const preview = sheetPreview(product);
  const sheetCount = preview.sheets.length;
  const [tab, setTab] = useState(0);
  const [paused, setPaused] = useState(false);
  const words = (hero.headline || product.name).split(" ");

  // Auto-cycle the mockup tabs until the visitor clicks one.
  useEffect(() => {
    if (paused || sheetCount < 2) return;
    const id = setInterval(() => setTab((t) => (t + 1) % sheetCount), 3800);
    return () => clearInterval(id);
  }, [paused, sheetCount]);

  return (
    <section className="bg-glow relative overflow-hidden px-4 pb-20 pt-28 md:pb-28 md:pt-36">
      <Sparkle className="absolute left-[6%] top-32 size-6 animate-twinkle md:size-8" />
      <Sparkle className="absolute right-[7%] top-24 size-4 animate-twinkle [animation-delay:1.2s]" fill="var(--coral)" />
      <Sparkle className="absolute bottom-16 left-[45%] hidden size-5 animate-twinkle [animation-delay:.6s] md:block" fill="var(--teal)" />

      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
        {/* copy */}
        <div className="relative z-10 min-w-0 text-center lg:text-left">
          {hero.eyebrow && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-6 inline-flex max-w-full items-center gap-2 rounded-full bg-paper px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-teal shadow-soft sm:text-xs sm:tracking-[0.18em]"
            >
              <span className="size-1.5 shrink-0 rounded-full bg-coral" />
              {hero.eyebrow}
            </motion.div>
          )}

          <h1 className="font-display text-[2.9rem] leading-[1.02] tracking-tight sm:text-7xl lg:text-[5.2rem]">
            {words.map((w, i) => (
              <motion.span
                key={`${w}-${i}`}
                className="mr-[0.22em] inline-block"
                initial={{ opacity: 0, y: 50, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ type: "spring", stiffness: 110, damping: 16, delay: 0.2 + i * 0.12 }}
              >
                {w}
              </motion.span>
            ))}
            {hero.headlineAccent && (
              <>
                <br />
                <motion.span
                  className="relative inline-block italic text-marigold"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 160, damping: 12, delay: 0.2 + words.length * 0.12 + 0.1 }}
                >
                  {hero.headlineAccent}
                  <Squiggle className="absolute -bottom-2 left-0 h-3 w-full" color="var(--coral)" />
                </motion.span>
              </>
            )}
          </h1>

          {(hero.subheadline || product.tagline) && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-charcoal/80 lg:mx-0"
            >
              {hero.subheadline || product.tagline}
            </motion.p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.05 }}
            className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start"
          >
            <ButtonLink href={checkoutHref(product)} size="lg">
              {hero.ctaLabel || "Buy now"} · {formatINR(current.price)}
              {current.active && <s className="text-sm font-normal opacity-60">{formatINR(current.regularPrice)}</s>}
            </ButtonLink>
            <ButtonLink href="#inside" size="lg" variant="outline">
              See inside <ArrowDown className="size-4" />
            </ButtonLink>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.15 }}
            className="mt-5 flex flex-col items-center gap-3 lg:items-start"
          >
            <Countdown enabled={offer.showCountdown} />
            <SoldCounter />
          </motion.div>

          {!!hero.trustPoints?.length && (
            <motion.ul
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.1, delayChildren: 1.2 } } }}
              className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-medium text-charcoal/80 lg:justify-start"
            >
              {hero.trustPoints.map((t) => (
                <motion.li
                  key={t}
                  variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                  className="flex items-center gap-1.5"
                >
                  <Check className="size-4 rounded-full bg-teal p-0.5 text-cream" strokeWidth={3.5} /> {t}
                </motion.li>
              ))}
            </motion.ul>
          )}

          {product.audienceLine && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.4 }}
              className="mx-auto mt-6 max-w-xl border-l-2 border-marigold pl-4 text-left text-sm leading-relaxed text-charcoal/70 lg:mx-0"
            >
              {product.audienceLine}
            </motion.p>
          )}
        </div>

        {/* visual: optional media card behind the live mockup */}
        <motion.div
          className="relative mx-auto w-full min-w-0 max-w-lg"
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 60, damping: 16, delay: 0.4 }}
        >
          <MediaSlot
            media={hero.media}
            priority
            decorative
            className="absolute -right-3 -top-8 h-[85%] w-[80%] rotate-3 rounded-[2rem] shadow-lift md:-right-10"
            fallback={
              <div
                aria-hidden
                className="bg-grid absolute -right-3 -top-8 h-[85%] w-[80%] rotate-3 rounded-[2rem] bg-lavender/70 md:-right-10"
              />
            }
          />
          <div className="relative animate-float" onPointerDown={() => setPaused(true)}>
            <SpreadsheetMockup preview={preview} active={tab} onTabChange={setTab} className="-rotate-1" />
          </div>
          {hero.badge && (
            <motion.div
              className="absolute -bottom-6 -left-3 flex items-center gap-2 rounded-2xl bg-paper px-4 py-2.5 text-sm font-semibold text-plum shadow-lift md:-left-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: [0, -6, 0] }}
              transition={{ opacity: { delay: 1.3 }, y: { duration: 4, repeat: Infinity, delay: 1.3 } }}
            >
              <Sparkle className="size-4" /> {hero.badge}
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
