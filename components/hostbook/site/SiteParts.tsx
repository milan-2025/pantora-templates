/* eslint-disable @next/next/no-img-element -- photos are Cloudinary URLs already resized by cld() */
import Link from "next/link";
import { AtSign, BedDouble, Bath, Users, MapPin, MessageCircle } from "lucide-react";
import type { PublicSite } from "@/lib/hostbook/server";
import { SITE_PATH, listingPath, type PublicListing } from "@/lib/hostbook/site";

/** A Cloudinary photo resized for the screen (automatic format and quality). */
export const cld = (url: string, w: number) => url.replace("/image/upload/", `/image/upload/f_auto,q_auto,c_limit,w_${w}/`);

export const siteName = (s: PublicSite) => s.site.title || s.business || "Our stays";

export function SiteHeader({ s }: { s: PublicSite }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-sand/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href={`${SITE_PATH}/${s.slug}`} className="flex min-w-0 items-center gap-2 font-serif text-xl">
          {s.logoUrl ? <img src={s.logoUrl} alt="" className="size-8 rounded-lg object-cover" /> : null}
          <span className="truncate">{siteName(s)}</span>
        </Link>
        <a
          href={`https://wa.me/${s.site.whatsapp}?text=${encodeURIComponent(`Hi ${siteName(s)}! I have a question about a stay.`)}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-teal px-4 py-2 text-sm font-semibold text-sand"
        >
          <MessageCircle className="size-4" /> WhatsApp
        </a>
      </div>
    </header>
  );
}

export function Facts({ l, className = "" }: { l: PublicListing; className?: string }) {
  const facts = [
    l.maxGuests ? { icon: Users, text: `${l.maxGuests} guest${l.maxGuests === 1 ? "" : "s"}` } : null,
    l.bedrooms ? { icon: BedDouble, text: `${l.bedrooms} bedroom${l.bedrooms === 1 ? "" : "s"}` } : null,
    l.bathrooms ? { icon: Bath, text: `${l.bathrooms} bathroom${l.bathrooms === 1 ? "" : "s"}` } : null,
    l.area || l.city ? { icon: MapPin, text: [l.area, l.city].filter(Boolean).join(", ") } : null,
  ].filter(Boolean) as { icon: typeof Users; text: string }[];
  if (!facts.length) return null;
  return (
    <ul className={`flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted ${className}`}>
      {facts.map((f) => (
        <li key={f.text} className="inline-flex items-center gap-1.5">
          <f.icon className="size-4" /> {f.text}
        </li>
      ))}
    </ul>
  );
}

export const priceText = (l: PublicListing) => (l.price ? `₹${l.price.toLocaleString("en-IN")}` : "");

export function ListingCard({ s, l }: { s: PublicSite; l: PublicListing }) {
  return (
    <Link href={`${SITE_PATH}/${s.slug}/${listingPath(l)}`} className="group block overflow-hidden rounded-3xl border border-line bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="aspect-[4/3] bg-mist">
        {l.photos[0] ? <img src={cld(l.photos[0], 800)} alt={l.name} loading="lazy" className="size-full object-cover" /> : null}
      </div>
      <div className="p-5">
        <h3 className="font-serif text-2xl leading-snug">{l.name}</h3>
        {l.headline ? <p className="mt-1 text-sm text-muted">{l.headline}</p> : null}
        <Facts l={l} className="mt-3" />
        <p className="mt-4 flex items-baseline justify-between gap-2">
          {l.price ? (
            <span>
              <b className="text-lg">{priceText(l)}</b> <span className="text-sm text-muted">/ night</span>
            </span>
          ) : (
            <span className="text-sm text-muted">Ask for the price</span>
          )}
          <span className="text-sm font-semibold text-teal group-hover:underline">See dates →</span>
        </p>
      </div>
    </Link>
  );
}

export function SiteFooter({ s }: { s: PublicSite }) {
  return (
    <footer className="mt-16 border-t border-line bg-white/60">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>© {new Date().getFullYear()} {siteName(s)}</span>
          {s.site.instagram ? (
            <a href={`https://instagram.com/${s.site.instagram}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-ink">
              <AtSign className="size-4" /> @{s.site.instagram}
            </a>
          ) : null}
          <a href={`https://wa.me/${s.site.whatsapp}`} className="hover:text-ink">
            WhatsApp +{s.site.whatsapp}
          </a>
        </div>
        {!s.branded ? (
          <Link href="/hostbook?utm_source=host-site&utm_medium=footer" className="hover:text-ink">
            Booking website made with <b className="text-teal">HostBook</b>
          </Link>
        ) : null}
      </div>
    </footer>
  );
}
