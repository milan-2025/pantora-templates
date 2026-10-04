"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ShoppingBag, X } from "lucide-react";
import { useLiveData } from "./LiveData";

// A once-per-second clock. Null during server render, so the countdown only appears in the browser.
const subscribeClock = (cb: () => void) => {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
};
const readClock = () => Math.floor(Date.now() / 1000) * 1000;
const readServerClock = () => null;

function useNow() {
  return useSyncExternalStore(subscribeClock, readClock, readServerClock);
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Counts down to the real offer end date set in the admin.
 * Renders nothing when there's no active offer or no end date.
 */
export function Countdown({ variant = "chip", enabled = true }: { variant?: "chip" | "block"; enabled?: boolean }) {
  const live = useLiveData();
  const now = useNow();
  if (!enabled || !live?.offerActive || !live.endsAt || now === null) return null;

  const left = new Date(live.endsAt).getTime() - now;
  if (left <= 0) return null;

  const d = Math.floor(left / 86_400_000);
  const h = Math.floor((left % 86_400_000) / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  const units = [...(d > 0 ? [[d, "days"] as const] : []), [h, "hrs"] as const, [m, "min"] as const, [s, "sec"] as const];

  if (variant === "chip") {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-blush px-4 py-1.5 text-sm font-medium text-plum">
        <span className="size-2 animate-pulse rounded-full bg-coral" />
        Offer price ends in{" "}
        <span className="font-semibold tabular-nums">
          {d > 0 && `${d}d `}
          {pad(h)}:{pad(m)}:{pad(s)}
        </span>
      </div>
    );
  }

  return (
    <div className="text-center">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-coral">Offer price ends in</p>
      <div className="flex justify-center gap-2">
        {units.map(([v, label]) => (
          <div key={label} className="min-w-16 rounded-2xl bg-plum px-3 py-2 text-cream">
            <div className="font-display text-3xl tabular-nums">{pad(v)}</div>
            <div className="text-[10px] uppercase tracking-widest text-cream/70">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** "147 of 200 sold at the offer price", from real paid orders. Needs a cap set in the admin. */
export function StockBar({ enabled = true, tone = "light" }: { enabled?: boolean; tone?: "light" | "dark" }) {
  const live = useLiveData();
  if (!enabled || !live?.offerActive || !live.cap) return null;
  const pct = Math.min(100, (live.sold / live.cap) * 100);
  const left = Math.max(0, live.cap - live.sold);

  return (
    <div className="w-full">
      <div className={`mb-1.5 flex justify-between text-sm ${tone === "dark" ? "text-cream/85" : "text-charcoal/80"}`}>
        <span>
          <span className="font-semibold">{live.sold}</span> of {live.cap} sold at the offer price
        </span>
        <span className="font-semibold">{left} left</span>
      </div>
      <div className={`h-2.5 overflow-hidden rounded-full ${tone === "dark" ? "bg-cream/15" : "bg-lavender"}`}>
        <motion.div
          className="h-full rounded-full bg-[linear-gradient(90deg,var(--coral),var(--marigold))]"
          initial={{ width: 0 }}
          whileInView={{ width: `${Math.max(pct, 2)}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function timeAgo(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

/**
 * Small bottom-left popup cycling through REAL recent paid orders (first name + city).
 * Shows nothing if there are no recent orders.
 */
export function RecentPurchases({ enabled = true, productName }: { enabled?: boolean; productName: string }) {
  const live = useLiveData();
  const [index, setIndex] = useState(-1);
  const [dismissed, setDismissed] = useState(false);
  const recent = live?.recent ?? [];

  useEffect(() => {
    if (!enabled || dismissed || recent.length === 0) return;
    let i = 0;
    // first popup after 8s, then show each for 6s with 14s gaps
    const show = () => setIndex(i++ % recent.length);
    const hide = () => setIndex(-1);
    const timers: ReturnType<typeof setTimeout>[] = [];
    const cycle = () => {
      show();
      timers.push(setTimeout(hide, 6000));
      timers.push(setTimeout(cycle, 20000));
    };
    timers.push(setTimeout(cycle, 8000));
    return () => timers.forEach(clearTimeout);
  }, [enabled, dismissed, recent.length]);

  const p = index >= 0 ? recent[index] : null;

  return (
    <AnimatePresence>
      {p && !dismissed && (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="fixed bottom-24 left-4 z-40 flex max-w-[calc(100vw-6rem)] items-center gap-3 rounded-2xl bg-paper py-3 pl-3 pr-9 shadow-lift sm:max-w-xs md:bottom-6"
          role="status"
        >
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-mint text-teal">
            <ShoppingBag className="size-5" />
          </div>
          <div className="text-sm leading-snug">
            <div className="font-semibold text-plum">
              {p.firstName}
              {p.city ? ` from ${p.city}` : ""}
            </div>
            <div className="text-charcoal/70">
              bought {productName} · {timeAgo(p.at)}
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Hide purchase notifications"
            className="absolute right-2 top-2 rounded-full p-1 text-charcoal/40 hover:text-plum"
          >
            <X className="size-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
