"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ShoppingBag, Users, X } from "lucide-react";
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
 * Countdown to a real deadline:
 *  - the quick-order bonus: "Order in the next 14:32 to get <bonus> free" (this visitor's window), or
 *  - the offer price's fixed end date, if there's no bonus running.
 * Renders nothing when there's no running deadline (it never sits at 00:00).
 */
export function Countdown({
  variant = "chip",
  enabled = true,
  className = "",
}: {
  variant?: "chip" | "block";
  /** Whether to show the offer end-date countdown (the bonus countdown always shows while it runs). */
  enabled?: boolean;
  className?: string;
}) {
  const live = useLiveData();
  const now = useNow();
  if (!live || now === null) return null;

  const bonus = live.bonus?.active && live.bonus.endsAt ? live.bonus : null;
  const target = bonus ? bonus.endsAt : enabled && live.offerActive ? live.endsAt : null;
  if (!target) return null;

  const left = new Date(target).getTime() - now;
  if (left <= 0) return null;

  const d = Math.floor(left / 86_400_000);
  const h = Math.floor((left % 86_400_000) / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  const units = [
    ...(d > 0 ? [[d, "days"] as const] : []),
    ...(d > 0 || h > 0 ? [[h, "hrs"] as const] : []),
    [m, "min"] as const,
    [s, "sec"] as const,
  ];
  const clock = `${d > 0 ? `${d}d ` : ""}${d > 0 || h > 0 ? `${pad(h)}:` : ""}${pad(m)}:${pad(s)}`;

  if (variant === "chip") {
    return (
      <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-0.5 rounded-full bg-blush px-4 py-1.5 text-sm font-medium text-plum">
        <span className="size-2 shrink-0 animate-pulse rounded-full bg-coral" />
        {bonus ? (
          <span>
            Order in the next <span className="font-semibold tabular-nums">{clock}</span> to get{" "}
            <span className="font-semibold">{bonus.title}</span> free
          </span>
        ) : (
          <span>
            Offer price ends in <span className="font-semibold tabular-nums">{clock}</span>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`text-center ${className}`}>
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-coral">
        {bonus ? "Free bonus if you order within" : "Offer price ends in"}
      </p>
      {bonus && <p className="mb-3 font-display text-lg text-plum">🎁 {bonus.title}</p>}
      <div className={`flex justify-center gap-2 ${bonus ? "" : "mt-2"}`}>
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

/** "1,240 couples are already planning with this sheet": counted from real sales. */
export function SoldCounter({ tone = "light", className = "" }: { tone?: "light" | "dark"; className?: string }) {
  const live = useLiveData();
  if (!live?.sold) return null;
  const n = live.sold.count.toLocaleString("en-IN");
  const [before, after] = live.sold.text.includes("{count}") ? live.sold.text.split("{count}", 2) : ["", ` ${live.sold.text}`];
  return (
    <div
      className={`inline-flex items-center gap-2 text-sm ${tone === "dark" ? "text-cream/90" : "text-charcoal/80"} ${className}`}
    >
      <Users className={`size-4 shrink-0 ${tone === "dark" ? "text-marigold" : "text-teal"}`} />
      <span>
        {before}
        <span className={`font-semibold ${tone === "dark" ? "text-cream" : "text-plum"}`}>{n}</span>
        {after}
      </span>
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
    // A new real buyer every ~4-6 seconds. With only a few real orders, slow down so the same
    // names don't repeat every few seconds.
    const SHOW_MS = 3500;
    const gap = () => (recent.length >= 4 ? 1000 + Math.random() * 1500 : 12000 + Math.random() * 6000);
    let last = -1;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const next = () => {
      let i = Math.floor(Math.random() * recent.length);
      if (recent.length > 1 && i === last) i = (i + 1) % recent.length; // never the same person twice in a row
      last = i;
      setIndex(i);
      timers.push(setTimeout(() => setIndex(-1), SHOW_MS));
      timers.push(setTimeout(next, SHOW_MS + gap()));
    };
    timers.push(setTimeout(next, 5000));
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
