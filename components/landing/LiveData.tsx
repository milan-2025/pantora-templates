"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type RecentPurchase = { firstName: string; city: string; at: string };
export type LiveData = {
  offerActive: boolean;
  price: number;
  sold: number;
  cap: number | null;
  endsAt: string | null;
  recent: RecentPurchase[];
};

const Ctx = createContext<LiveData | null>(null);

/**
 * Pages are cached for speed, so real-time numbers (offer sales, recent purchases)
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
