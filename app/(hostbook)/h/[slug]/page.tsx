/* eslint-disable @next/next/no-img-element -- Cloudinary photos, resized in the URL */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPayloadClient } from "@/lib/cms/queries";
import { getPublicSite } from "@/lib/hostbook/server";
import { SITE_PATH } from "@/lib/hostbook/site";
import { ListingCard, SiteFooter, SiteHeader, cld, siteName } from "@/components/hostbook/site/SiteParts";

// Availability changes with every booking, so the page is rebuilt at most once a minute.
export const revalidate = 60;

type Args = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const s = await getPublicSite(await getPayloadClient(), (await params).slug);
  if (!s) return { title: "Not found", robots: { index: false } };
  const title = s.site.tagline ? `${siteName(s)}: ${s.site.tagline}` : siteName(s);
  const description = (s.site.about || s.site.tagline || `Book ${siteName(s)} directly with the host on WhatsApp.`).slice(0, 155);
  const image = s.site.heroUrl || s.listings.find((l) => l.photos[0])?.photos[0];
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `${SITE_PATH}/${s.slug}` },
    openGraph: { title, description, url: `${SITE_PATH}/${s.slug}`, type: "website", siteName: siteName(s), ...(image ? { images: [{ url: cld(image, 1200) }] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary" },
  };
}

/** pandoratemplates.com/h/<name>: a host's booking website (HostBook → Website). */
export default async function HostSite({ params }: Args) {
  const s = await getPublicSite(await getPayloadClient(), (await params).slug);
  if (!s) notFound();
  const hero = s.site.heroUrl || s.listings.find((l) => l.photos[0])?.photos[0];
  return (
    <div className="min-h-dvh bg-sand text-ink">
      <SiteHeader s={s} />
      <section className="relative">
        {hero ? <img src={cld(hero, 1800)} alt="" className="h-[46vh] min-h-72 w-full object-cover" /> : <div className="h-40 bg-mist" />}
        <div className="mx-auto -mt-20 max-w-5xl px-4">
          <div className="relative rounded-3xl bg-white p-6 shadow-sm md:p-8">
            <h1 className="font-serif text-4xl leading-tight md:text-5xl">{siteName(s)}</h1>
            {s.site.tagline ? <p className="mt-2 text-lg text-muted">{s.site.tagline}</p> : null}
            {s.site.about ? <p className="mt-4 whitespace-pre-line leading-relaxed">{s.site.about}</p> : null}
          </div>
        </div>
      </section>
      <main className="mx-auto max-w-5xl px-4 pt-10">
        <h2 className="font-serif text-3xl">{s.listings.length === 1 ? "Our place" : "Our places"}</h2>
        {s.listings.length ? (
          <div className="mt-5 grid gap-6 sm:grid-cols-2">{s.listings.map((l) => <ListingCard key={l.id} s={s} l={l} />)}</div>
        ) : (
          <p className="mt-4 text-muted">New places are coming soon. Message us on WhatsApp to ask about dates.</p>
        )}
      </main>
      <SiteFooter s={s} />
    </div>
  );
}
