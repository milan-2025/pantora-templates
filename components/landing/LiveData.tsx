"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { REF_COOKIE } from "@/lib/referral";

export type RecentPurchase = { firstName: string; city: string; at: string };
export type LiveData = {
  offerActive: boolean;
  /** What this visitor pays for the product: the offer price, minus their referral discount if they came via ?ref=CODE. */
  price: number;
  regularPrice: number;
  /** Set when the visitor came via an affiliate's ?ref=CODE link and that code gives a discount. */
  referral: { code: string; discountPercent: number; priceBefore: number } | null;
  /** Fixed end date of the offer price, if any. */
  endsAt: string | null;
  /** This visitor's quick-order bonus (window from their first visit), if one is running. */
  bonus: { active: boolean; title: string; endsAt: string | null; restartsAt: string | null } | null;
  /** Real total sales (website paid orders + genuine earlier sales), when the counter is on. */
  sold: { count: number; text: string } | null;
  recent: RecentPurchase[];
};

const Ctx = createContext<LiveData | null>(null);
/** True until the first live data arrives for a visitor with a referral code, so the price doesn't flash. */
const PendingCtx = createContext(false);

const noSubscribe = () => () => {};
const validRef = (v: string | null | undefined) => (v && /^[A-Za-z0-9_-]{3,30}$/.test(v) ? v : null);
/** Whether this visitor has a referral code (in the link or remembered from an earlier visit). */
const readHasRef = () =>
  Boolean(validRef(new URLSearchParams(window.location.search).get("ref"))) ||
  document.cookie.split("; ").some((c) => c.startsWith(`${REF_COOKIE}=`));

/** /api/live/<slug>, passing on an affiliate's ?ref=CODE so the page shows their referral price. */
function liveUrl(slug: string) {
  const ref = validRef(new URLSearchParams(window.location.search).get("ref"));
  const qs = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  return `/api/live/${encodeURIComponent(slug)}${qs}`;
}

/**
 * Pages are cached for speed, so real-time data (this visitor's bonus timer, recent purchases)
 * are fetched from /api/live/<slug> in the browser and refreshed every minute.
 */
export function LiveDataProvider({ slug, initial, children }: { slug: string; initial: LiveData; children: React.ReactNode }) {
  const [data, setData] = useState<LiveData>(initial);
  const [loaded, setLoaded] = useState(false);
  const hasRef = useSyncExternalStore(noSubscribe, readHasRef, () => false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(liveUrl(slug), { cache: "no-store" });
        if (res.ok && alive) setData(await res.json());
      } catch {
        // keep the last known values
      } finally {
        if (alive) setLoaded(true);
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
  const nextChange = [
    data.offerActive ? data.endsAt : null,
    data.bonus?.active ? data.bonus.endsAt : null,
    data.bonus && !data.bonus.active ? data.bonus.restartsAt : null,
  ]
    .filter((d): d is string => Boolean(d))
    .map((d) => new Date(d).getTime())
    .sort((a, b) => a - b)[0];
  useEffect(() => {
    if (!nextChange) return;
    const ms = nextChange - Date.now() + 1000;
    if (ms <= 0 || ms > 2_147_000_000) return;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(liveUrl(slug), { cache: "no-store" });
        if (res.ok) setData(await res.json());
      } catch {
        // the minute-by-minute refresh will catch up
      }
    }, ms);
    return () => clearTimeout(t);
  }, [nextChange, slug]);

  return (
    <Ctx.Provider value={data}>
      <PendingCtx.Provider value={hasRef && !loaded}>{children}</PendingCtx.Provider>
    </Ctx.Provider>
  );
}

export function useLiveData() {
  return useContext(Ctx);
}

/**
 * Current price, preferring live data over the cached page. `active` is true whenever the price is
 * below the regular price (a running offer and/or the visitor's referral discount).
 */
export function useCurrentPrice(fallback: { active: boolean; price: number; regularPrice: number }) {
  const live = useContext(Ctx);
  const pending = useContext(PendingCtx);
  const price = live ? live.price : fallback.price;
  const regularPrice = live?.regularPrice ?? fallback.regularPrice;
  return {
    active: live ? (live.offerActive || Boolean(live.referral)) && price < regularPrice : fallback.active,
    price,
    regularPrice,
    referral: live?.referral ?? null,
    /** Hide the price (keep its space) while a referral visitor's price is still loading. */
    pending,
  };
}
