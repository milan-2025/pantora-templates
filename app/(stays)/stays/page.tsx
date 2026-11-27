import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { browsingAdmin } from "@/lib/stays/server";
import { ArrowRight, Building2, Home, MessageCircle, Sparkles } from "lucide-react";
import { loadHome } from "@/lib/stays/pages";
import { CardGrid, Footer, Header } from "@/components/stays/ui";
import { SearchBar } from "@/components/stays/SearchBar";
import { HomeMap } from "@/components/stays/HomeMap";
import { waLink } from "@/lib/stays/core";
import { AppPixel } from "@/components/AppPixel";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await loadHome();
  const s = site.settings;
  return {
    title: `${s.seo.title} | ${s.siteName}`,
    description: s.seo.description,
    alternates: { canonical: "/stays" },
    openGraph: { title: s.seo.title, description: s.seo.description, siteName: s.siteName, images: s.seo.ogImage ? [s.seo.ogImage] : undefined },
  };
}

export default async function StaysHome() {
  const admin = await browsingAdmin(await headers());
  const { site, featured, recent, destinations, total, mapPoints } = await loadHome(admin);
  const s = site.settings;
  const wa = waLink(s.whatsappNumber, s.templates.general);
  return (
    <>
      {!admin && <AppPixel product="stays" />}
      <Header site={s} active="home" admin={!!admin} />
      <main>
        <section className="relative overflow-hidden">
          <div className="mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 sm:pt-20">
            <p className="s-chip !bg-neutral-100 !text-charcoal"><Sparkles className="size-3.5" /> {total} handpicked stay{total === 1 ? "" : "s"}</p>
            <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.05] sm:text-6xl">Find a stay that feels like it was <em className="text-coral">kept for you</em>.</h1>
            <p className="mt-4 max-w-xl text-lg text-muted">{s.tagline}</p>
            <div className="mt-8 max-w-5xl"><SearchBar types={s.propertyTypes} /></div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 sm:px-6" aria-label="Browse by type">
          <div className="s-scroll-x -mx-4 flex gap-2 px-4 pb-2">
            {s.propertyTypes.map((t) => (
              <Link key={t} href={`/stays/search?type=${encodeURIComponent(t)}`} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-plum hover:border-plum">
                {/villa|house|farm/i.test(t) ? <Home className="size-4" /> : <Building2 className="size-4" />}{t}
              </Link>
            ))}
            {s.categories.map((c) => (
              <Link key={c} href={`/stays/search?category=${encodeURIComponent(c)}`} className="inline-flex shrink-0 items-center rounded-full bg-lavender px-4 py-2 text-sm font-medium text-plum hover:bg-plum hover:text-white">{c}</Link>
            ))}
          </div>
        </section>

        {featured.length > 0 && (
          <section className="mx-auto mt-12 max-w-7xl px-4 sm:px-6">
            <SectionHead title="Featured stays" href="/stays/search?featured=1" />
            <CardGrid cards={featured} />
          </section>
        )}

        {destinations.length > 0 && (
          <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-6">
            <SectionHead title="Popular destinations" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {destinations.map((d) => (
                <Link key={d.city} href={`/stays/search?city=${encodeURIComponent(d.city)}`} className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-plum">
                  {d.cover && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.cover.src} alt="" loading="lazy" className="size-full object-cover opacity-75 transition duration-500 group-hover:scale-105 group-hover:opacity-90" />
                  )}
                  <span className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute bottom-3 left-3 text-white">
                    <span className="block font-display text-2xl leading-none">{d.city}</span>
                    <span className="text-xs opacity-90">{d.count} stay{d.count === 1 ? "" : "s"}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {recent.length > 0 && (
          <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-6">
            <SectionHead title="Recently added" href="/stays/search?sort=newest" />
            <CardGrid cards={recent} />
          </section>
        )}

        {mapPoints.length > 0 && (
          <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-6">
            <SectionHead title="Explore on the map" href="/stays/search?view=map" />
            <HomeMap points={mapPoints} cfg={s.map} />
          </section>
        )}

        {total === 0 && (
          <section className="mx-auto mt-12 max-w-3xl px-4 text-center">
            <div className="s-card rounded-3xl p-10">
              <h2 className="font-display text-3xl">New stays are on their way</h2>
              <p className="mt-2 text-muted">Tell us where and when, and we&apos;ll send you options on WhatsApp.</p>
              {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="s-btn s-btn-wa mt-6"><MessageCircle className="size-4" /> Message us</a>}
            </div>
          </section>
        )}

        <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6">
          <div className="grid items-center gap-6 overflow-hidden rounded-3xl bg-plum p-8 text-white sm:grid-cols-[1fr_auto] sm:p-12">
            <div>
              <h2 className="font-display text-3xl !text-white sm:text-4xl">Own a home guests would love?</h2>
              <p className="mt-2 max-w-xl text-white/80">List it with us. Upload photos once, keep your details private, and we&apos;ll bring you guests.</p>
            </div>
            <Link href="/stays/host" className="s-btn s-btn-accent">List your property <ArrowRight className="size-4" /></Link>
          </div>
        </section>
      </main>
      <Footer site={s} />
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" className="fixed bottom-5 right-5 z-40 grid size-14 place-items-center rounded-full bg-wa text-white shadow-lift" aria-label="Chat on WhatsApp">
          <MessageCircle className="size-6" />
        </a>
      )}
    </>
  );
}

function SectionHead({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <h2 className="font-display text-3xl">{title}</h2>
      {href && <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-plum hover:underline">See all <ArrowRight className="size-4" /></Link>}
    </div>
  );
}
