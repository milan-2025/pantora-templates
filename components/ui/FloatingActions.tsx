"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { MessageCircle } from "lucide-react";
import { formatINR, product, whatsappLink } from "@/lib/content";

/** WhatsApp bubble + mobile sticky buy bar (appears after the hero). */
export function FloatingActions() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const pricing = document.getElementById("pricing");
      const pastHero = window.scrollY > window.innerHeight * 0.8;
      // hide the bar while the pricing card itself is on screen
      const r = pricing?.getBoundingClientRect();
      const pricingVisible = r ? r.top < window.innerHeight && r.bottom > 0 : false;
      setShow(pastHero && !pricingVisible);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <motion.a
        href={whatsappLink()}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
        initial={{ scale: 0 }}
        animate={{ scale: 1, bottom: show ? 92 : 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="fixed right-4 z-40 grid size-14 place-items-center rounded-full bg-teal text-cream shadow-lift transition-transform hover:scale-105 md:bottom-6! md:right-6"
      >
        <MessageCircle className="size-7" strokeWidth={2.5} />
      </motion.a>

      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ y: 120 }}
            animate={{ y: 0 }}
            exit={{ y: 120 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="fixed inset-x-0 bottom-0 z-40 border-t border-plum/10 bg-cream/95 px-4 py-3 shadow-[0_-8px_24px_-12px_rgb(59_31_74/0.25)] backdrop-blur md:hidden"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="leading-tight">
                <div className="font-display text-2xl text-plum">{formatINR(product.price)}</div>
                <div className="text-xs text-charcoal/70">One-time · Instant download</div>
              </div>
              <Link
                href="/checkout"
                className="rounded-full bg-marigold px-5 py-3 text-sm font-semibold text-plum shadow-soft active:scale-95"
              >
                Get the planner →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
