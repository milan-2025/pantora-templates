"use client";

import { useEffect, useState } from "react";

/**
 * A call-to-action fixed to the bottom of the screen on phones (hidden on wide screens). It shows once the visitor
 * scrolls past the first screen and hides while an element marked data-pt-final (e.g. the plans) or the footer is in view.
 */
export function StickyCta({ label, href, bg, fg = "#fff" }: { label: string; href: string; bg: string; fg?: string }) {
  const [past, setPast] = useState(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const onScroll = () => setPast(window.scrollY > window.innerHeight * 0.8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    // Each callback reports only the targets that changed, so remember which are in view.
    const seen = new Set<Element>();
    const io = new IntersectionObserver((es) => { es.forEach((e) => (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target))); setHidden(seen.size > 0); });
    document.querySelectorAll("[data-pt-final],footer").forEach((e) => io.observe(e));
    return () => { window.removeEventListener("scroll", onScroll); io.disconnect(); };
  }, []);
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-black/10 bg-white/95 px-3.5 pt-2.5 backdrop-blur transition-transform duration-300 md:hidden"
      style={{ paddingBottom: "calc(10px + env(safe-area-inset-bottom))", transform: past && !hidden ? "none" : "translateY(110%)" }}
      aria-hidden={!(past && !hidden)}
    >
      <a href={href} tabIndex={past && !hidden ? 0 : -1} className="block rounded-full py-3.5 text-center font-bold" style={{ background: bg, color: fg }}>
        {label}
      </a>
    </div>
  );
}
