"use client";
/**
 * Stays map (Leaflet + OpenStreetMap tiles, free). Public maps get approximate positions only (the API never sends
 * exact ones) and draw an area circle; the admin map shows exact pins. Marker labels are built with textContent,
 * never HTML strings, so titles can't inject markup.
 */
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";

export type MapPoint = {
  key: string; lat: number; lng: number; label?: string; title: string; sub?: string; href?: string; image?: string | null;
  tone?: "default" | "muted" | "warn";
};
type MapCfg = { tileUrl: string; attribution: string; defaultLat: number; defaultLng: number; defaultZoom: number };

export default function MapView({
  points, cfg, mode = "public", className = "h-[420px]", onBounds, picker, fit = true, selected, onSelect, showCard = true,
}: {
  points: MapPoint[];
  cfg: MapCfg;
  mode?: "public" | "admin";
  className?: string;
  /** Called (debounced) after the user pans/zooms: [south, west, north, east]. */
  onBounds?: (b: [number, number, number, number]) => void;
  /** Admin location picker: one draggable pin; tapping the map moves it. */
  picker?: { lat: number | null; lng: number | null; onChange: (lat: number, lng: number) => void };
  fit?: boolean;
  selected?: string | null;
  onSelect?: (key: string | null) => void;
  showCard?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const pickPin = useRef<Leaflet.Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const userMoved = useRef(false);
  const cb = useRef({ onBounds, onSelect, picker });
  useEffect(() => { cb.current = { onBounds, onSelect, picker }; });
  const active = selected !== undefined ? selected : sel;

  // create the map once
  useEffect(() => {
    let cancelled = false;
    let t: ReturnType<typeof setTimeout>;
    import("leaflet").then((mod) => {
      if (cancelled || !box.current || map.current) return;
      const Lf = (mod as unknown as { default?: typeof Leaflet }).default || (mod as unknown as typeof Leaflet);
      L.current = Lf;
      const m = Lf.map(box.current, { zoomControl: true, scrollWheelZoom: mode === "admin" || !!picker, attributionControl: true })
        .setView([cfg.defaultLat, cfg.defaultLng], cfg.defaultZoom);
      Lf.tileLayer(cfg.tileUrl, { attribution: cfg.attribution, maxZoom: 19, subdomains: "abc" }).addTo(m);
      layer.current = Lf.layerGroup().addTo(m);
      m.on("movestart", (e: Leaflet.LeafletEvent & { hard?: boolean }) => { if (!e.hard) userMoved.current = true; });
      m.on("moveend", () => {
        clearTimeout(t);
        t = setTimeout(() => {
          if (!userMoved.current || !cb.current.onBounds) return;
          const b = m.getBounds();
          cb.current.onBounds([b.getSouth(), b.getWest(), b.getNorth(), b.getEast()]);
        }, 450);
      });
      m.on("click", (e: Leaflet.LeafletMouseEvent) => {
        if (cb.current.picker) cb.current.picker.onChange(Math.round(e.latlng.lat * 1e5) / 1e5, Math.round(e.latlng.lng * 1e5) / 1e5);
        else { setSel(null); cb.current.onSelect?.(null); }
      });
      map.current = m;
      setReady(true);
    });
    return () => {
      cancelled = true;
      clearTimeout(t);
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // draw markers
  useEffect(() => {
    const Lf = L.current, m = map.current, g = layer.current;
    if (!ready || !Lf || !m || !g) return;
    g.clearLayers();
    for (const p of points) {
      const el = document.createElement("div");
      const isActive = p.key === active;
      if (p.label) {
        el.className = `s-pin${isActive ? " is-active" : ""}`;
        el.textContent = p.label;
      } else {
        el.className = "s-pin-dot";
        if (p.tone === "muted") el.style.background = "#9a8fa3";
        if (p.tone === "warn") el.style.background = "#e0675a";
        if (isActive) el.style.background = "#f2a93b";
      }
      const icon = Lf.divIcon({ html: el, className: "", iconSize: [0, 0] });
      const mk = Lf.marker([p.lat, p.lng], { icon, title: p.title, keyboard: true, riseOnHover: true, zIndexOffset: isActive ? 1000 : 0 });
      mk.on("click", (e: Leaflet.LeafletMouseEvent) => {
        Lf.DomEvent.stopPropagation(e);
        setSel(p.key);
        cb.current.onSelect?.(p.key);
      });
      g.addLayer(mk);
      if (mode === "public" && isActive) g.addLayer(Lf.circle([p.lat, p.lng], { radius: 650, color: "#3b1f4a", weight: 1, fillOpacity: 0.08 }));
    }
    if (fit && points.length && !userMoved.current && !picker) {
      const b = Lf.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
      m.fitBounds(b.pad(0.2), { maxZoom: 14, animate: false });
    }
  }, [ready, points, active, mode, fit, picker]);

  // location picker pin
  useEffect(() => {
    const Lf = L.current, m = map.current;
    if (!ready || !Lf || !m || !picker) return;
    if (picker.lat === null || picker.lng === null) { pickPin.current?.remove(); pickPin.current = null; return; }
    const pos: [number, number] = [picker.lat, picker.lng];
    if (!pickPin.current) {
      const el = document.createElement("div");
      el.className = "s-pin-dot";
      el.style.background = "#e0675a";
      pickPin.current = Lf.marker(pos, { draggable: true, icon: Lf.divIcon({ html: el, className: "", iconSize: [0, 0] }) }).addTo(m);
      pickPin.current.on("dragend", () => {
        const ll = pickPin.current!.getLatLng();
        cb.current.picker?.onChange(Math.round(ll.lat * 1e5) / 1e5, Math.round(ll.lng * 1e5) / 1e5);
      });
      m.setView(pos, Math.max(m.getZoom(), 15), { animate: false });
    } else pickPin.current.setLatLng(pos);
  }, [ready, picker, picker?.lat, picker?.lng]);

  const cur = points.find((p) => p.key === active);
  return (
    <div className={`relative isolate overflow-hidden rounded-2xl border border-line ${className}`}>
      <div ref={box} className="absolute inset-0" role="region" aria-label="Map" />
      {!ready && <div className="s-skeleton absolute inset-0 !rounded-none" />}
      {cur && !picker && showCard && (
        <div className="absolute inset-x-3 bottom-3 z-[500] flex gap-3 rounded-2xl bg-white p-2.5 shadow-lift sm:left-auto sm:w-80">
          {cur.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cur.image} alt="" className="size-20 shrink-0 rounded-xl object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-plum">{cur.title}</p>
            {cur.sub && <p className="mt-0.5 line-clamp-3 whitespace-pre-line text-xs text-muted">{cur.sub}</p>}
            {cur.href && <a href={cur.href} className="s-btn s-btn-primary s-btn-sm mt-2">View details</a>}
          </div>
          <button type="button" onClick={() => { setSel(null); onSelect?.(null); }} className="absolute right-2 top-2 rounded-full px-2 text-muted hover:text-plum" aria-label="Close">×</button>
        </div>
      )}
      {mode === "public" && (
        <p className="pointer-events-none absolute right-3 top-3 z-[500] rounded-full bg-white/90 px-2.5 py-1 text-[11px] text-muted shadow-soft">Locations are approximate</p>
      )}
    </div>
  );
}
