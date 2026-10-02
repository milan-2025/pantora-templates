"use client";

import { motion } from "motion/react";

/** Hand-drawn underline that draws itself when scrolled into view. */
export function Squiggle({ className = "", color = "var(--marigold)" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 300 20" fill="none" preserveAspectRatio="none" className={className} aria-hidden>
      <motion.path
        d="M2 14 C 40 6, 70 18, 110 11 S 180 5, 220 12 S 280 15, 298 8"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease: "easeInOut", delay: 0.3 }}
      />
    </svg>
  );
}

/** The brand's four-point "spark of possibility". */
export function Sparkle({ className = "", fill = "var(--marigold)" }: { className?: string; fill?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 0 C13 7, 17 11, 24 12 C17 13, 13 17, 12 24 C11 17, 7 13, 0 12 C7 11, 11 7, 12 0Z" fill={fill} />
    </svg>
  );
}
