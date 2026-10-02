"use client";

import Link from "next/link";
import { motion } from "motion/react";

/**
 * Pandora Templates gift-box mark: box with an open lid and a spark.
 * `animated` plays the lid-opening moment ("Open the box. Everything's ready.").
 */
export function LogoMark({
  className = "size-9",
  box = "var(--plum)",
  spark = "var(--marigold)",
  animated = false,
}: {
  className?: string;
  box?: string;
  spark?: string;
  animated?: boolean;
}) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      {/* box body */}
      <rect x="6" y="17" width="24" height="19" rx="4" fill={box} />
      {/* lid, hinged at its left edge */}
      <motion.rect
        x="3"
        y="9"
        width="25"
        height="6.5"
        rx="2.2"
        fill={box}
        style={{ originX: 0, originY: 1 }}
        initial={animated ? { rotate: 0, y: 4 } : false}
        whileInView={animated ? { rotate: -18, y: 0 } : undefined}
        animate={animated ? undefined : { rotate: -18 }}
        viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 120, damping: 9, delay: 0.2 }}
      />
      {/* spark */}
      <motion.path
        d="M32 2 C32.6 6.2 34.3 7.9 38.5 8.5 C34.3 9.1 32.6 10.8 32 15 C31.4 10.8 29.7 9.1 25.5 8.5 C29.7 7.9 31.4 6.2 32 2Z"
        fill={spark}
        initial={animated ? { scale: 0, rotate: -90 } : false}
        whileInView={animated ? { scale: 1, rotate: 0 } : undefined}
        viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 200, damping: 10, delay: 0.55 }}
      />
    </svg>
  );
}

export function Logo({ tone = "plum" }: { tone?: "plum" | "cream" }) {
  const color = tone === "cream" ? "var(--cream)" : "var(--plum)";
  return (
    <Link href="/" aria-label="Pandora Templates home" className="flex items-center gap-2.5" style={{ color }}>
      <LogoMark box={color} className="size-9" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.45rem]">Pandora</span>
        <span className="mt-0.5 text-[0.6rem] font-medium tracking-[0.38em]">TEMPLATES</span>
      </span>
    </Link>
  );
}
