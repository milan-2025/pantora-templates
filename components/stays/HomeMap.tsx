"use client";
import { inr } from "@/lib/stays/core";
import MapView from "./MapView";

type Pt = { code: string; slug: string; title: string; approx: { lat: number; lng: number }; place: string; price: { from: number | null } | null; cover: { src: string } | null; maxGuests: number | null; bedrooms: number | null };
type Cfg = { tileUrl: string; attribution: string; defaultLat: number; defaultLng: number; defaultZoom: number };

/** Map of every listed stay at its approximate position, with price pins where prices are shown. */
export function HomeMap({ points, cfg, className = "h-[460px]" }: { points: Pt[]; cfg: Cfg; className?: string }) {
  return (
    <MapView
      cfg={cfg}
      className={className}
      points={points.map((p) => ({
        key: p.code, lat: p.approx.lat, lng: p.approx.lng, title: p.title, label: p.price?.from ? inr(p.price.from) : undefined,
        sub: [p.place, p.maxGuests ? `${p.maxGuests} guests` : "", p.bedrooms ? `${p.bedrooms} bedrooms` : ""].filter(Boolean).join(" · "),
        href: `/stay/${p.slug}`, image: p.cover?.src || null,
      }))}
    />
  );
}
