"use client";

import { useState } from "react";
import { SmartLink } from "@/components/ui/SmartLink";
import { usePathname } from "next/navigation";
import { motion, useScroll, useTransform } from "motion/react";
import { Menu, X } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { Logo } from "@/components/Logo";

export type NavLink = { label: string; url: string };

export function Nav({ links, cta }: { links: NavLink[]; cta?: NavLink | null }) {
  const { scrollY } = useScroll();
  const bg = useTransform(scrollY, [0, 80], ["rgba(251,245,234,0)", "rgba(251,245,234,0.92)"]);
  const shadow = useTransform(scrollY, [0, 80], ["0 0 0 rgba(59,31,74,0)", "0 8px 24px -16px rgba(59,31,74,0.35)"]);
  const pathname = usePathname();
  // The phone menu remembers the page it was opened on, so it closes by itself after navigating.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (next: boolean | ((o: boolean) => boolean)) =>
    setOpenOn((typeof next === "function" ? next(open) : next) ? pathname : null);

  return (
    <motion.header style={{ backgroundColor: open ? "#FBF5EA" : bg, boxShadow: shadow }} className="fixed inset-x-0 top-0 z-50 backdrop-blur-sm">
      <nav aria-label="Main" className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Logo />
        <div className="flex items-center gap-3 lg:gap-7">
          {!!links.length && (
            <div className="hidden gap-6 text-sm font-medium text-plum lg:flex">
              {links.map((l) => (
                <SmartLink key={l.url + l.label} href={l.url} className="transition-colors hover:text-teal">
                  {l.label}
                </SmartLink>
              ))}
            </div>
          )}
          {cta?.url && (
            <SmartLink href={cta.url} className={buttonClasses({ className: "px-4! py-2! text-sm whitespace-nowrap" })}>
              {cta.label}
            </SmartLink>
          )}
          {!!links.length && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              className="grid size-10 place-items-center rounded-full text-plum transition-colors hover:bg-plum/5 lg:hidden"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          )}
        </div>
      </nav>
      {open && !!links.length && (
        <div id="mobile-menu" className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-plum/10 bg-cream px-4 pb-4 shadow-lift lg:hidden">
          <ul className="mx-auto grid max-w-6xl gap-1 pt-2 text-base font-medium text-plum">
            {links.map((l) => (
              <li key={l.url + l.label}>
                <SmartLink href={l.url} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2.5 hover:bg-plum/5">
                  {l.label}
                </SmartLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.header>
  );
}
