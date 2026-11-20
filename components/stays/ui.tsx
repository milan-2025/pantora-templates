/** Stays: presentational pieces shared by the public pages (no hooks, so they render on the server too). */
import Link from "next/link";
import { SmartLink } from "@/components/ui/SmartLink";
import { Bath, BedDouble, Eye, MapPin, MessageCircle, Phone, Sparkles, Users } from "lucide-react";
import { inr, waLink, waNumber } from "@/lib/stays/core";
import { LANDING_PAGES } from "@/lib/siteLinks";
import { CardCarousel } from "./Gallery";
import type { AdminExtras, PublicCard } from "@/lib/stays/views";

type Card = PublicCard & { admin?: AdminExtras };

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

/** One-tap WhatsApp and phone call buttons for a number (admin use). */
export function ContactButtons({ phone, greet = "", size = "sm" }: { phone: string; greet?: string; size?: "sm" | "xs" }) {
  const n = waNumber(phone);
  if (!n) return phone ? <span className="text-xs text-muted">{phone}</span> : null;
  const cls = size === "xs" ? "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold" : "s-btn s-btn-sm";
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      <a href={waLink(n, greet)} target="_blank" rel="noopener noreferrer" className={`${cls} bg-wa text-white hover:opacity-90`} aria-label={`WhatsApp ${phone}`}><MessageCircle className="size-3.5" /> WhatsApp</a>
      <a href={`tel:+${n}`} className={`${cls} border border-line bg-white text-plum hover:bg-plum/5`} aria-label={`Call ${phone}`}><Phone className="size-3.5" /> Call</a>
    </span>
  );
}

/** Banner shown on every guest page while the admin browsing view is on. */
export function AdminBar() {
  return (
    <div className="bg-plum text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm sm:px-6">
        <span className="inline-flex items-center gap-1.5 font-semibold"><Eye className="size-4 text-marigold" /> Admin view</span>
        <span className="text-white/75">Only you see this: all properties, host details and contacts.</span>
        <span className="ml-auto flex gap-3">
          <Link href="/stays/admin" prefetch={false} className="underline">Dashboard</Link>
          {/* A plain link on purpose: this is an API route (never prefetched) that clears the admin-view cookie. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/api/stays/admin?a=browse_off" className="font-semibold text-marigold underline">Exit admin view</a>
        </span>
      </div>
    </div>
  );
}

export function Header({ site, active, admin = false }: { site: SiteInfo; active?: "home" | "search" | "host"; admin?: boolean }) {
  const link = (href: string, label: string, on: boolean) => (
    <Link href={href} className={`rounded-full px-3 py-2 text-sm font-medium ${on ? "bg-plum text-white" : "text-plum hover:bg-plum/5"}`}>
      {label}
    </Link>
  );
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      {admin && <AdminBar />}
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
    <footer className="mt-20 border-t border-line bg-white">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
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
          <p className="font-semibold text-plum">More from Pandora</p>
          <ul className="mt-2 space-y-1.5 text-muted">
            <li><Link href="/" className="hover:text-plum">Pandora Templates</Link></li>
            {LANDING_PAGES.filter((p) => p.key !== "stays").map((p) => (
              <li key={p.key}><SmartLink href={p.url} className="hover:text-plum">{p.label}</SmartLink></li>
            ))}
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

export function PropertyCard({ card, href, priority = false }: { card: Card; href?: string; priority?: boolean }) {
  const url = href || `/stay/${card.slug}`;
  return (
    <article data-code={card.code} className="group relative flex flex-col">
      <div className="relative">
        {card.images && card.images.length > 1 ? (
          <CardCarousel images={card.images} href={url} title={card.title} priority={priority} />
        ) : (
          <Link href={url} className="relative block aspect-[4/3] overflow-hidden rounded-2xl bg-neutral-100" aria-label={card.title}>
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
          {card.featured && <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-charcoal shadow-soft">Featured</span>}
          {card.availability !== "available" && (
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${card.availability === "unavailable" ? "bg-charcoal text-white" : "bg-white text-plum"}`}>{card.availabilityLabel}</span>
          )}
        </div>
          </Link>
        )}
        {card.images && card.images.length > 1 && (
          <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
            {card.featured && <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-charcoal shadow-soft">Featured</span>}
            {card.availability !== "available" && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${card.availability === "unavailable" ? "bg-charcoal text-white" : "bg-white text-charcoal"}`}>{card.availabilityLabel}</span>}
          </div>
        )}
      </div>
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
        {card.admin && <CardAdmin a={card.admin} title={card.title} code={card.code} />}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <PriceLine price={card.price} />
          <Link href={url} className="s-btn s-btn-ghost s-btn-sm ml-auto">View details</Link>
        </div>
      </div>
    </article>
  );
}

export function CardGrid({ cards, hrefFor }: { cards: Card[]; hrefFor?: (c: Card) => string }) {
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

/** Admin browsing view: status and host contact on each card. */
function CardAdmin({ a, title, code }: { a: AdminExtras; title: string; code: string }) {
  const live = a.status === "published" && a.visibility === "public";
  const who = a.host ? a.host.name : a.ownership === "own" ? "Own property" : "No host set";
  const phone = a.host?.whatsapp || a.host?.phone || "";
  return (
    <div className="mt-2 rounded-xl bg-lavender/60 p-2 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        {!live && <span className="rounded-full bg-plum px-2 py-0.5 font-semibold text-white">{a.statusLabel}{a.visibility !== "public" ? ` · ${a.visibility}` : ""}</span>}
        {!a.showPrice && <span className="rounded-full bg-white px-2 py-0.5 text-plum">price hidden for guests</span>}
      </div>
      <div className="mt-1 text-plum">
        Landing {inr(a.landing.weekday) || "—"} / {inr(a.landing.weekend) || "—"} · <span className={a.margins.negative ? "text-coral" : "font-semibold text-teal"}>Margin {a.margins.weekday !== null ? inr(a.margins.weekday) : "—"} / {a.margins.weekend !== null ? inr(a.margins.weekend) : "—"}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-plum">{who}</span>
        {phone && <span className="text-muted">{phone}</span>}
      </div>
      {phone && <div className="mt-1.5"><ContactButtons phone={phone} size="xs" greet={`Hi ${a.host?.name || ""}, about ${title} (${code}):`} /></div>}
    </div>
  );
}
