/** Stays: presentational pieces shared by the public pages (no hooks, so they render on the server too). */
import Link from "next/link";
import { Bath, BedDouble, MapPin, Sparkles, Users } from "lucide-react";
import { inr } from "@/lib/stays/core";
import type { PublicCard } from "@/lib/stays/views";

export type SiteInfo = { siteName: string; tagline: string; logoUrl: string; whatsappNumber: string; contactNumber: string };

export function Brand({ site }: { site: Pick<SiteInfo, "siteName" | "logoUrl"> }) {
  return (
    <Link href="/stays" className="flex items-center gap-2 min-w-0" aria-label={`${site.siteName} home`}>
      {site.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={site.logoUrl} alt="" className="h-8 w-auto" />
      ) : (
        <span className="grid size-8 place-items-center rounded-xl bg-plum text-marigold font-display text-lg">{site.siteName.slice(0, 1)}</span>
      )}
      <span className="font-display text-xl text-plum truncate">{site.siteName}</span>
    </Link>
  );
}

export function Header({ site, active }: { site: SiteInfo; active?: "home" | "search" | "host" }) {
  const link = (href: string, label: string, on: boolean) => (
    <Link href={href} className={`rounded-full px-3 py-2 text-sm font-medium ${on ? "bg-plum text-white" : "text-plum hover:bg-plum/5"}`}>
      {label}
    </Link>
  );
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/90 backdrop-blur supports-[backdrop-filter]:bg-cream/75">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Brand site={site} />
        <nav className="flex items-center gap-1">
          <span className="hidden sm:inline-flex">{link("/stays/search", "Explore", active === "search")}</span>
          <span className="hidden sm:inline-flex">{link("/stays/search?view=map", "Map", false)}</span>
          {link("/stays/host", "List your property", active === "host")}
        </nav>
      </div>
    </header>
  );
}

export function Footer({ site }: { site: SiteInfo }) {
  return (
    <footer className="mt-20 border-t border-line bg-paper">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:grid-cols-3 sm:px-6">
        <div>
          <Brand site={site} />
          <p className="mt-3 max-w-xs text-sm text-muted">{site.tagline}</p>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-plum">Explore</p>
          <ul className="mt-2 space-y-1.5 text-muted">
            <li><Link href="/stays/search" className="hover:text-plum">All stays</Link></li>
            <li><Link href="/stays/search?view=map" className="hover:text-plum">Map</Link></li>
            <li><Link href="/stays/host" className="hover:text-plum">List your property</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-plum">Talk to us</p>
          <p className="mt-2 text-muted">Every enquiry is handled personally.</p>
          {site.contactNumber && <p className="mt-1 text-plum">{site.contactNumber}</p>}
        </div>
      </div>
      <p className="pb-8 text-center text-xs text-muted">© {new Date().getFullYear()} {site.siteName}</p>
    </footer>
  );
}

export function PriceLine({ price, size = "md" }: { price: PublicCard["price"]; size?: "md" | "lg" }) {
  if (!price || (!price.weekday && !price.weekend)) return null;
  const same = price.weekday && price.weekend && price.weekday === price.weekend;
  return (
    <p className={size === "lg" ? "text-lg" : "text-sm"}>
      {same || !price.weekend ? (
        <><span className="font-semibold text-plum">{inr(price.weekday || price.weekend)}</span> <span className="text-muted">/ night</span></>
      ) : (
        <>
          <span className="text-muted">from </span>
          <span className="font-semibold text-plum">{inr(price.from)}</span> <span className="text-muted">/ night</span>
        </>
      )}
    </p>
  );
}

const pill = (n: number | null, one: string, many: string) => (n === null || n === undefined ? null : `${n} ${n === 1 ? one : many}`);

export function Facts({ bedrooms, bathrooms, maxGuests, className = "" }: { bedrooms: number | null; bathrooms: number | null; maxGuests: number | null; className?: string }) {
  const items = [
    { icon: Users, text: pill(maxGuests, "guest", "guests") },
    { icon: BedDouble, text: pill(bedrooms, "bedroom", "bedrooms") },
    { icon: Bath, text: pill(bathrooms, "bath", "baths") },
  ].filter((x) => x.text);
  return (
    <ul className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted ${className}`}>
      {items.map(({ icon: I, text }) => (
        <li key={text} className="inline-flex items-center gap-1"><I className="size-4" aria-hidden />{text}</li>
      ))}
    </ul>
  );
}

export function PropertyCard({ card, href, priority = false }: { card: PublicCard; href?: string; priority?: boolean }) {
  const url = href || `/stay/${card.slug}`;
  return (
    <article data-code={card.code} className="group relative flex flex-col">
      <Link href={url} className="relative block aspect-[4/3] overflow-hidden rounded-2xl bg-sand" aria-label={card.title}>
        {card.cover ? (
          // Cloudinary already serves resized WebP/AVIF, so a plain responsive <img> is enough.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.cover.src}
            srcSet={card.cover.srcSet}
            sizes="(min-width: 1280px) 300px, (min-width: 640px) 45vw, 92vw"
            alt={card.cover.alt}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid size-full place-items-center text-plum/40"><Sparkles className="size-10" /></div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {card.featured && <span className="rounded-full bg-marigold px-2.5 py-1 text-xs font-semibold text-plum">Featured</span>}
          {card.availability !== "available" && (
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${card.availability === "unavailable" ? "bg-charcoal text-white" : "bg-white text-plum"}`}>{card.availabilityLabel}</span>
          )}
        </div>
      </Link>
      <div className="mt-3 flex flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-sans text-[15px] font-semibold leading-snug text-plum">
            <Link href={url} className="hover:underline">{card.title}</Link>
          </h3>
          <span className="shrink-0 text-[11px] font-medium text-muted">{card.code}</span>
        </div>
        <p className="flex items-center gap-1 text-sm text-muted"><MapPin className="size-3.5 shrink-0" aria-hidden /><span className="truncate">{card.place}</span></p>
        <Facts bedrooms={card.bedrooms} bathrooms={card.bathrooms} maxGuests={card.maxGuests} className="text-[13px]" />
        {card.features.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {card.features.map((f) => <span key={f} className="s-chip !bg-mint !text-teal !text-[11px]">{f}</span>)}
          </div>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <PriceLine price={card.price} />
          <Link href={url} className="s-btn s-btn-ghost s-btn-sm ml-auto">View details</Link>
        </div>
      </div>
    </article>
  );
}

export function CardGrid({ cards, hrefFor }: { cards: PublicCard[]; hrefFor?: (c: PublicCard) => string }) {
  return (
    <div className="grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cards.map((c, i) => <PropertyCard key={c.code} card={c} href={hrefFor?.(c)} priority={i < 4} />)}
    </div>
  );
}

export function CardSkeletons({ n = 8 }: { n?: number }) {
  return (
    <div className="grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <div key={i}>
          <div className="s-skeleton aspect-[4/3] !rounded-2xl" />
          <div className="s-skeleton mt-3 h-4 w-3/4" />
          <div className="s-skeleton mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
