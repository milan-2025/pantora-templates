"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type RecentPurchase = { firstName: string; city: string; at: string };
export type LiveData = {
  offerActive: boolean;
  price: number;
  /** Fixed end date of the offer price, if any. */
  endsAt: string | null;
  /** This visitor's quick-order bonus (window from their first visit), if one is running. */
  bonus: { active: boolean; title: string; endsAt: string | null } | null;
  /** Real total sales (website paid orders + genuine earlier sales), when the counter is on. */
  sold: { count: number; text: string } | null;
  recent: RecentPurchase[];
};

const Ctx = createContext<LiveData | null>(null);

/**
 * Pages are cached for speed, so real-time data (this visitor's bonus timer, recent purchases)
 * are fetched from /api/live/<slug> in the browser and refreshed every minute.
 */
export function LiveDataProvider({ slug, initial, children }: { slug: string; initial: LiveData; children: React.ReactNode }) {
  const [data, setData] = useState<LiveData>(initial);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/live/${encodeURIComponent(slug)}`, { cache: "no-store" });
        if (res.ok && alive) setData(await res.json());
      } catch {
        // keep the last known values
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [slug]);

  // The moment the offer price or this visitor's bonus window ends, refresh so the page updates straight away.
  const nextChange = [data.offerActive ? data.endsAt : null, data.bonus?.active ? data.bonus.endsAt : null]
    .filter((d): d is string => Boolean(d))
    .map((d) => new Date(d).getTime())
    .sort((a, b) => a - b)[0];
  useEffect(() => {
    if (!nextChange) return;
    const ms = nextChange - Date.now() + 1000;
    if (ms <= 0 || ms > 2_147_000_000) return;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/live/${encodeURIComponent(slug)}`, { cache: "no-store" });
        if (res.ok) setData(await res.json());
      } catch {
        // the minute-by-minute refresh will catch up
      }
    }, ms);
    return () => clearTimeout(t);
  }, [nextChange, slug]);

  return <Ctx.Provider value={data}>{children}</Ctx.Provider>;
}

export function useLiveData() {
  return useContext(Ctx);
}

/** Current price + whether the offer is on, preferring live data over the cached page. */
export function useCurrentPrice(fallback: { active: boolean; price: number; regularPrice: number }) {
  const live = useContext(Ctx);
  return {
    active: live ? live.offerActive : fallback.active,
    price: live ? live.price : fallback.price,
    regularPrice: fallback.regularPrice,
  };
}
