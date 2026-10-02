"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { buttonClasses } from "@/components/ui/Button";
import { Logo } from "@/components/Logo";

export { Logo };

export function Nav() {
  const { scrollY } = useScroll();
  const bg = useTransform(scrollY, [0, 80], ["rgba(251,245,234,0)", "rgba(251,245,234,0.92)"]);
  const shadow = useTransform(scrollY, [0, 80], ["0 0 0 rgba(59,31,74,0)", "0 8px 24px -16px rgba(59,31,74,0.35)"]);

  return (
    <motion.header style={{ backgroundColor: bg, boxShadow: shadow }} className="fixed inset-x-0 top-0 z-50 backdrop-blur-sm">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Logo />
        <div className="flex items-center gap-7">
          <div className="hidden gap-7 text-sm font-medium text-plum md:flex">
            <a href="#inside" className="transition-colors hover:text-teal">What&apos;s inside</a>
            <a href="#pricing" className="transition-colors hover:text-teal">Pricing</a>
            <a href="#faq" className="transition-colors hover:text-teal">FAQ</a>
          </div>
          <Link href="/checkout" className={buttonClasses({ className: "px-4! py-2! text-sm" })}>
            Buy now
          </Link>
        </div>
      </nav>
    </motion.header>
  );
}
