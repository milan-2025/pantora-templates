"use client";

import { useEffect, useRef, useState } from "react";
import { SmartLink } from "@/components/ui/SmartLink";
import { usePathname } from "next/navigation";
import { motion, useScroll, useTransform } from "motion/react";
import { ChevronDown, Menu, X } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { Logo } from "@/components/Logo";

export type NavLink = { label: string; url: string };
/** One category in the Products menu: its page, colour and the apps/templates in it. */
export type MenuGroup = { label: string; url: string; accent: string; items: { title: string; url: string; kind: "app" | "template" | "tool" }[] };

export function Nav({ links, cta, menu = [] }: { links: NavLink[]; cta?: NavLink | null; menu?: MenuGroup[] }) {
  const { scrollY } = useScroll();
  const bg = useTransform(scrollY, [0, 80], ["rgba(251,245,234,0)", "rgba(251,245,234,0.92)"]);
  const shadow = useTransform(scrollY, [0, 80], ["0 0 0 rgba(59,31,74,0)", "0 8px 24px -16px rgba(59,31,74,0.35)"]);
  const pathname = usePathname();
  // The phone menu remembers the page it was opened on, so it closes by itself after navigating.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (next: boolean | ((o: boolean) => boolean)) =>
    setOpenOn((typeof next === "function" ? next(open) : next) ? pathname : null);
  // The desktop Products panel, also keyed by page so it closes after a click.
  const [productsOn, setProductsOn] = useState<string | null>(null);
  const productsOpen = productsOn === pathname;
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!productsOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !panelRef.current?.contains(e.target as Node)) setProductsOn(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [productsOpen]);
  const groups = menu.filter((g) => g.items.length);
  const hasMenu = !!links.length || !!groups.length;

  return (
    <motion.header style={{ backgroundColor: open ? "#FBF5EA" : bg, boxShadow: shadow }} className="fixed inset-x-0 top-0 z-50 backdrop-blur-sm">
      <nav aria-label="Main" className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Logo />
        <div className="flex items-center gap-3 lg:gap-7">
          {hasMenu && (
            <div className="hidden items-center gap-6 text-sm font-medium text-plum lg:flex">
              {!!groups.length && (
                <div ref={panelRef}>
                  <button
                    type="button"
                    onClick={() => setProductsOn(productsOpen ? null : pathname)}
                    aria-expanded={productsOpen}
                    aria-controls="products-menu"
                    className="flex items-center gap-1 transition-colors hover:text-teal"
                  >
                    Products <ChevronDown className={`size-4 transition-transform ${productsOpen ? "rotate-180" : ""}`} />
                  </button>
                  {productsOpen && (
                    <div
                      id="products-menu"
                      className="absolute inset-x-4 top-full mt-1 grid grid-cols-4 gap-6 rounded-3xl border border-plum/10 bg-cream p-6 shadow-lift"
                    >
                      {groups.map((g) => (
                        <div key={g.url} className="min-w-0">
                          <SmartLink href={g.url} onClick={() => setProductsOn(null)} className="mb-3 block border-b-2 pb-2 font-semibold" style={{ borderColor: g.accent, color: g.accent }}>
                            {g.label}
                          </SmartLink>
                          <ul className="grid gap-2">
                            {g.items.map((i) => (
                              <li key={i.url}>
                                <SmartLink href={i.url} onClick={() => setProductsOn(null)} className="block leading-snug text-plum hover:text-teal">
                                  {i.title}
                                  <span className="block text-[0.7rem] font-semibold uppercase tracking-wider text-charcoal/45">{i.kind === "app" ? "App" : i.kind === "tool" ? "Free tool" : "Template"}</span>
                                </SmartLink>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
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
          {hasMenu && (
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
      {open && hasMenu && (
        <div id="mobile-menu" className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-plum/10 bg-cream px-4 pb-4 shadow-lift lg:hidden">
          {!!groups.length && (
            <div className="mx-auto max-w-6xl pt-2">
              <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.18em] text-charcoal/50">Products</p>
              {groups.map((g) => (
                <details key={g.url} className="group rounded-xl">
                  <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-3 py-2.5 text-base font-semibold hover:bg-plum/5" style={{ color: g.accent }}>
                    {g.label}
                    <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <ul className="grid gap-0.5 pb-2 pl-3">
                    {g.items.map((i) => (
                      <li key={i.url}>
                        <SmartLink href={i.url} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 text-plum hover:bg-plum/5">
                          {i.title}
                        </SmartLink>
                      </li>
                    ))}
                    <li>
                      <SmartLink href={g.url} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 text-sm font-semibold" style={{ color: g.accent }}>
                        See all {g.label} →
                      </SmartLink>
                    </li>
                  </ul>
                </details>
              ))}
            </div>
          )}
          <ul className="mx-auto grid max-w-6xl gap-1 border-t border-plum/10 pt-2 text-base font-medium text-plum">
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
