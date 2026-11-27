"use client";
/** The app's data: who is signed in, their plan, and every record of the current host account (kept on this device too). */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { FeatureKey, Kind, StaffPerm } from "@/lib/hostbook/features";
import type { CheckinField, Rec } from "@/lib/hostbook/core";
import { api, ApiError, session } from "./api";

export type PlanV = { id: string; planId: string; name: string; price: number; isFree: boolean; listings: number; staff: number; idDays: number; hostChoosesIdDays: boolean; features: FeatureKey[]; tagline: string; badge: string; highlights: string[] };
export type StaffV = { email: string; name: string; phone: string; perms: StaffPerm[]; listings: string[] };
export type Me = {
  email: string; role: "owner" | "staff"; perms: StaffPerm[]; listingsAllowed: string[] | null; hasPassword: boolean;
  teams: { id: string; name: string; role: string }[];
  account: { id: string; business: string; phone: string; city: string; ownerEmail: string; logoUrl: string; idDays: number; digestOn: boolean; extraListings: number; staff: StaffV[]; staysLinked: boolean; checkinRequired: CheckinField[]; checkinAllGuests: boolean };
  access: { plan: PlanV; paidPlan: PlanV | null; expiresAt: string | null; viaStays: boolean; listingLimit: number; staffLimit: number; idDays: number; features: FeatureKey[] };
  extraListingPrice: number; whatsapp: string;
};

type Toast = { id: number; text: string; tone: "ok" | "bad" };
type Store = {
  me: Me; items: Rec[]; byId: Map<string, Rec>; of: (k: Kind) => Rec[]; offline: boolean; defaultTemplates: { name: string; body: string }[];
  has: (f: FeatureKey) => boolean; can: (p: StaffPerm | "owner") => boolean;
  save: (kind: Kind, data: Record<string, unknown>, id?: string) => Promise<Rec>;
  remove: (id: string) => Promise<void>;
  put: (r: Rec) => void;
  refresh: () => Promise<void>;
  reloadMe: () => Promise<void>;
  toast: (text: string, tone?: "ok" | "bad") => void;
  upsell: (feature?: FeatureKey | "listings" | "staff") => void;
  upsellFor: FeatureKey | "listings" | "staff" | null; closeUpsell: () => void;
};
const Ctx = createContext<Store | null>(null);
export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside provider");
  return s;
};

export function StoreProvider({ me: initialMe, children }: { me: Me; children: React.ReactNode }) {
  const [me, setMe] = useState(initialMe);
  const acct = me.account.id;
  const [cached] = useState(() => session.cache(acct));
  const [items, setItems] = useState<Rec[]>(cached?.items ?? []);
  const [defaultTemplates, setDefaults] = useState<{ name: string; body: string }[]>(cached?.defaultTemplates ?? []);
  const [offline, setOffline] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [upsellFor, setUpsell] = useState<Store["upsellFor"]>(null);
  const since = useRef<number>(cached?.now ?? 0);

  const toast = useCallback((text: string, tone: "ok" | "bad" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ items: (Rec & { deleted?: boolean })[]; now: number; defaultTemplates: { name: string; body: string }[] }>(`items?since=${since.current}`);
      setOffline(false);
      setItems((prev) => {
        let next: Rec[];
        if (!since.current) next = r.items;
        else {
          const map = new Map(prev.map((x) => [x.id, x]));
          for (const x of r.items) { if (x.deleted) map.delete(x.id); else map.set(x.id, x); }
          next = [...map.values()];
        }
        session.saveCache(acct, { items: next, now: r.now, defaultTemplates: r.defaultTemplates });
        return next;
      });
      setDefaults(r.defaultTemplates);
      since.current = r.now;
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) setOffline(true);
      else throw e;
    }
  }, [acct]);

  const reloadMe = useCallback(async () => {
    const m = await api<Me & { token?: string }>("me");
    if (m.token) session.setToken(m.token);
    setMe(m);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load from the server
    refresh().catch((e) => toast(e.message, "bad"));
    const onFocus = () => { if (document.visibilityState === "visible") refresh().catch(() => null); };
    document.addEventListener("visibilitychange", onFocus);
    const t = setInterval(onFocus, 60_000);
    return () => { document.removeEventListener("visibilitychange", onFocus); clearInterval(t); };
  }, [refresh, toast]);

  const put = useCallback((r: Rec) => setItems((prev) => {
    const next = prev.some((x) => x.id === r.id) ? prev.map((x) => (x.id === r.id ? r : x)) : [...prev, r];
    session.saveCache(acct, { items: next, now: since.current, defaultTemplates });
    return next;
  }), [acct, defaultTemplates]);

  const feats = useMemo(() => new Set(me.access.features), [me.access.features]);
  const has = useCallback((f: FeatureKey) => feats.has(f), [feats]);
  const can = useCallback((p: StaffPerm | "owner") => (p === "owner" ? me.role === "owner" : me.role === "owner" || me.perms.includes(p)), [me.role, me.perms]);

  const save = useCallback(async (kind: Kind, data: Record<string, unknown>, id?: string) => {
    try {
      const r = await api<{ item: Rec }>("items", { body: { kind, id, data } });
      put(r.item);
      return r.item;
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) setUpsell((e.extra.feature as FeatureKey) ?? (e.extra.reason as "listings") ?? null);
      throw e;
    }
  }, [put]);
  const remove = useCallback(async (id: string) => {
    await api("items", { method: "DELETE", body: { id } });
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const byId = useMemo(() => new Map(items.map((x) => [x.id, x])), [items]);
  const groups = useMemo(() => {
    const g = new Map<string, Rec[]>();
    for (const x of items) { const l = g.get(x.kind) ?? []; l.push(x); g.set(x.kind, l); }
    return g;
  }, [items]);
  const of = useCallback((k: Kind) => groups.get(k) ?? [], [groups]);

  const value: Store = {
    me, items, byId, of, offline, defaultTemplates, has, can, save, remove, put, refresh, reloadMe, toast,
    upsell: (f) => setUpsell(f ?? "listings"), upsellFor, closeUpsell: () => setUpsell(null),
  };
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto rounded-full px-4 py-2 text-sm font-medium shadow-lg ${t.tone === "bad" ? "bg-rust text-white" : "bg-ink text-white"}`}>{t.text}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

/* ---------- small lookups used across screens ---------- */
export function useLookups() {
  const { of, byId } = useStore();
  const listings = of("listing").filter((l) => !l.archived).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const listingName = (id: string) => String(byId.get(id)?.name ?? "—");
  const guestName = (b: Rec) => (b.guestId && byId.get(b.guestId)?.name) || b.guestName || (b.status === "blocked" ? "Blocked" : "Guest");
  return { listings, listingName, guestName };
}
