"use client";
/** Search results: combined filters, sorting, list / map views and "search as I move the map". */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { List, Map as MapIcon, SlidersHorizontal, X } from "lucide-react";
import type { PublicCard } from "@/lib/stays/views";
import { inr } from "@/lib/stays/core";
import { CardGrid, CardSkeletons } from "./ui";
import MapView from "./MapView";

type Amenity = { key: string; label: string; category: string };
type Cfg = { tileUrl: string; attribution: string; defaultLat: number; defaultLng: number; defaultZoom: number };
type Result = { total: number; page: number; pages: number; results: PublicCard[] };

const FILTER_KEYS = ["q", "city", "locality", "type", "category", "guests", "bedrooms", "bathrooms", "beds", "minPrice", "maxPrice", "priceBasis", "amenities", "features", "featured", "sort", "bbox", "page"] as const;
type F = Partial<Record<(typeof FILTER_KEYS)[number], string>>;

const SORTS: [string, string][] = [["recommended", "Recommended"], ["price_asc", "Lowest price"], ["price_desc", "Highest price"], ["newest", "Recently added"], ["updated", "Recently updated"], ["bedrooms", "Most bedrooms"], ["guests", "Most guests"]];

export function SearchApp({ initial, types, categories, features, amenities, cfg }: { initial: Record<string, string>; types: string[]; categories: string[]; features: string[]; amenities: Amenity[]; cfg: Cfg }) {
  const [f, setF] = useState<F>(() => Object.fromEntries(FILTER_KEYS.filter((k) => initial[k]).map((k) => [k, initial[k]])));
  const [view, setView] = useState<"list" | "map">(initial.view === "map" ? "map" : "list");
  const [data, setData] = useState<Result | null>(null);
  const [mapPts, setMapPts] = useState<PublicCard[]>([]);
  const [err, setErr] = useState("");
  const [panel, setPanel] = useState(false);
  const [follow, setFollow] = useState(!!initial.bbox);
  const [hover, setHover] = useState<string | null>(null);
  const reqId = useRef(0);

  const qs = useMemo(() => {
    const q = new URLSearchParams();
    for (const k of FILTER_KEYS) if (f[k]) q.set(k, f[k]!);
    return q;
  }, [f]);

  useEffect(() => {
    const id = ++reqId.current;
    const url = new URLSearchParams(qs);
    if (view === "map") url.set("view", "map");
    window.history.replaceState(null, "", `/stays/search${url.size ? `?${url}` : ""}`);
    fetch(`/api/stays/public?a=search&${qs}`).then((r) => r.json()).then((d) => { if (id === reqId.current) { setData(d); setErr(""); } }).catch(() => id === reqId.current && setErr("Couldn't load stays. Check your connection and try again."));
    const mq = new URLSearchParams(qs);
    mq.delete("bbox"); mq.delete("page");
    fetch(`/api/stays/public?a=map&${mq}`).then((r) => r.json()).then((d) => { if (id === reqId.current) setMapPts(d); }).catch(() => {});
  }, [qs, view]);

  const set = useCallback((patch: F) => setF((cur) => {
    const next: F = { ...cur, ...patch };
    if (!("page" in patch)) delete next.page;
    for (const k of Object.keys(next) as (keyof F)[]) if (!next[k]) delete next[k];
    return next;
  }), []);
  const listOf = (k: "amenities" | "features") => (f[k] ? f[k]!.split(",") : []);
  const toggle = (k: "amenities" | "features", v: string) => {
    const cur = listOf(k);
    set({ [k]: (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(",") });
  };
  const active = FILTER_KEYS.filter((k) => f[k] && !["sort", "page", "priceBasis", "bbox", "q"].includes(k)).length;

  const points = useMemo(() => mapPts.filter((c) => c.approx).map((c) => ({
    key: c.code, lat: c.approx!.lat, lng: c.approx!.lng, title: c.title, label: c.price?.from ? inr(c.price.from) : undefined,
    sub: c.place, href: `/stay/${c.slug}`, image: c.cover?.src || null,
  })), [mapPts]);

  const filters = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <Field label="City"><input className="s-input" value={f.city || ""} onChange={(e) => set({ city: e.target.value })} placeholder="Any city" /></Field>
        <Field label="Area / society"><input className="s-input" value={f.locality || ""} onChange={(e) => set({ locality: e.target.value })} placeholder="Any area" /></Field>
        <Field label="Property type">
          <select className="s-input" value={f.type || ""} onChange={(e) => set({ type: e.target.value })}><option value="">Any</option>{types.map((t) => <option key={t}>{t}</option>)}</select>
        </Field>
        <Field label="Category">
          <select className="s-input" value={f.category || ""} onChange={(e) => set({ category: e.target.value })}><option value="">Any</option>{categories.map((t) => <option key={t}>{t}</option>)}</select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([["guests", "Guests"], ["bedrooms", "Bedrooms"], ["bathrooms", "Bathrooms"], ["beds", "Beds"]] as const).map(([k, l]) => (
          <Field key={k} label={`${l} (min)`}>
            <select className="s-input" value={f[k] || ""} onChange={(e) => set({ [k]: e.target.value })}>
              <option value="">Any</option>{[1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20].map((n) => <option key={n} value={n}>{n}+</option>)}
            </select>
          </Field>
        ))}
      </div>
      <div>
        <p className="s-label">Price per night</p>
        <div className="grid grid-cols-3 gap-3">
          <input className="s-input" inputMode="numeric" placeholder="Min ₹" value={f.minPrice || ""} onChange={(e) => set({ minPrice: e.target.value.replace(/\D/g, "") })} aria-label="Minimum price" />
          <input className="s-input" inputMode="numeric" placeholder="Max ₹" value={f.maxPrice || ""} onChange={(e) => set({ maxPrice: e.target.value.replace(/\D/g, "") })} aria-label="Maximum price" />
          <select className="s-input" value={f.priceBasis || "from"} onChange={(e) => set({ priceBasis: e.target.value === "from" ? "" : e.target.value })} aria-label="Which price">
            <option value="from">Lowest</option><option value="weekday">Weekday</option><option value="weekend">Weekend</option>
          </select>
        </div>
        <p className="s-hint">Stays that only share prices on request are hidden while a price range is set.</p>
      </div>
      <div>
        <p className="s-label">Amenities</p>
        <div className="flex flex-wrap gap-2">
          {amenities.map((a) => (
            <button key={a.key} type="button" onClick={() => toggle("amenities", a.key)} aria-pressed={listOf("amenities").includes(a.key)} className={`rounded-full border px-3 py-1.5 text-sm ${listOf("amenities").includes(a.key) ? "border-plum bg-plum text-white" : "border-line bg-white text-plum"}`}>{a.label}</button>
          ))}
        </div>
      </div>
      {features.length > 0 && (
        <div>
          <p className="s-label">Standout features</p>
          <div className="flex flex-wrap gap-2">
            {features.map((x) => (
              <button key={x} type="button" onClick={() => toggle("features", x)} aria-pressed={listOf("features").includes(x)} className={`rounded-full border px-3 py-1.5 text-sm ${listOf("features").includes(x) ? "border-teal bg-teal text-white" : "border-line bg-white text-plum"}`}>{x}</button>
            ))}
          </div>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.featured === "1"} onChange={(e) => set({ featured: e.target.checked ? "1" : "" })} className="size-4 accent-plum" /> Featured stays only</label>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-16 pt-4 sm:px-6">
      <div className="sticky top-16 z-30 -mx-4 flex flex-wrap items-center gap-2 border-b border-line bg-cream/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <input className="s-input !w-auto min-w-0 flex-1 sm:max-w-sm" value={f.q || ""} onChange={(e) => set({ q: e.target.value })} placeholder="Search stays, areas or IDs" aria-label="Search" />
        <button type="button" onClick={() => setPanel(true)} className="s-btn s-btn-ghost s-btn-sm"><SlidersHorizontal className="size-4" /> Filters{active ? ` (${active})` : ""}</button>
        <select className="s-input !w-auto !min-h-0 !py-1.5 text-sm" value={f.sort || "recommended"} onChange={(e) => set({ sort: e.target.value === "recommended" ? "" : e.target.value })} aria-label="Sort by">
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {(active > 0 || f.q || f.bbox) && <button type="button" onClick={() => { setF({}); setFollow(false); }} className="text-sm font-medium text-plum underline">Clear all</button>}
        <div className="ml-auto flex rounded-full border border-line bg-white p-0.5 lg:hidden">
          <button type="button" onClick={() => setView("list")} className={`rounded-full px-3 py-1.5 text-sm ${view === "list" ? "bg-plum text-white" : "text-plum"}`} aria-pressed={view === "list"}><List className="inline size-4" /> List</button>
          <button type="button" onClick={() => setView("map")} className={`rounded-full px-3 py-1.5 text-sm ${view === "map" ? "bg-plum text-white" : "text-plum"}`} aria-pressed={view === "map"}><MapIcon className="inline size-4" /> Map</button>
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,42%)]">
        <div className={view === "map" ? "hidden lg:block" : ""}>
          <p className="mb-4 text-sm text-muted" aria-live="polite">{data ? `${data.total} stay${data.total === 1 ? "" : "s"}${f.bbox ? " in this map area" : ""}` : "Loading stays…"}</p>
          {err && <p className="rounded-2xl bg-blush p-4 text-sm text-coral" role="alert">{err}</p>}
          {!data && !err && <CardSkeletons n={6} />}
          {data && data.results.length === 0 && (
            <div className="s-card rounded-3xl p-10 text-center">
              <p className="font-display text-2xl text-plum">No stays match all of that</p>
              <p className="mt-2 text-sm text-muted">Try removing a filter or zooming the map out.</p>
              <button type="button" onClick={() => { setF({}); setFollow(false); }} className="s-btn s-btn-primary mt-5">Clear all filters</button>
            </div>
          )}
          {data && data.results.length > 0 && (
            <div onMouseLeave={() => setHover(null)}>
              <div className="[&_.grid]:xl:grid-cols-2 [&_.grid]:2xl:grid-cols-3" onMouseOver={(e) => { const code = (e.target as HTMLElement).closest("[data-code]")?.getAttribute("data-code"); if (code) setHover(code); }}>
                <CardGrid cards={data.results} />
              </div>
              {data.pages > 1 && (
                <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pages">
                  <button type="button" disabled={data.page <= 1} onClick={() => { set({ page: String(data.page - 1) }); window.scrollTo({ top: 0 }); }} className="s-btn s-btn-ghost s-btn-sm">Previous</button>
                  <span className="text-sm text-muted">Page {data.page} of {data.pages}</span>
                  <button type="button" disabled={data.page >= data.pages} onClick={() => { set({ page: String(data.page + 1) }); window.scrollTo({ top: 0 }); }} className="s-btn s-btn-ghost s-btn-sm">Next</button>
                </nav>
              )}
            </div>
          )}
        </div>
        <div className={`${view === "list" ? "hidden lg:block" : ""}`}>
          <div className="lg:sticky lg:top-36">
            <MapView
              cfg={cfg}
              points={points}
              className="h-[calc(100dvh-11rem)] min-h-[420px]"
              fit={!follow}
              selected={hover}
              onSelect={setHover}
              onBounds={(b) => { if (follow) set({ bbox: b.map((x) => x.toFixed(4)).join(",") }); }}
            />
            <label className="mt-2 flex items-center gap-2 text-sm text-plum">
              <input type="checkbox" className="size-4 accent-plum" checked={follow} onChange={(e) => { setFollow(e.target.checked); if (!e.target.checked) set({ bbox: "" }); }} />
              Search as I move the map
            </label>
          </div>
        </div>
      </div>

      {panel && (
        <div className="fixed inset-0 z-50 flex justify-end bg-plum/40" onClick={() => setPanel(false)}>
          <div className="flex h-full w-full max-w-md flex-col bg-paper shadow-lift" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Filters">
            <div className="flex items-center justify-between border-b border-line p-4">
              <h2 className="font-display text-2xl">Filters</h2>
              <button type="button" onClick={() => setPanel(false)} className="rounded-full p-2 hover:bg-plum/5" aria-label="Close"><X className="size-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{filters}</div>
            <div className="flex items-center justify-between gap-3 border-t border-line p-4">
              <button type="button" onClick={() => setF((x) => ({ q: x.q, sort: x.sort }))} className="text-sm font-medium text-plum underline">Clear filters</button>
              <button type="button" onClick={() => setPanel(false)} className="s-btn s-btn-primary">Show {data ? data.total : ""} stays</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="s-label">{label}</span>{children}</label>;
}
