/* eslint-disable @next/next/no-img-element -- Cloudinary photos, resized in the URL */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Check } from "lucide-react";
import { getPayloadClient } from "@/lib/cms/queries";
import { getPublicSite, type PublicSite } from "@/lib/hostbook/server";
import { SITE_PATH, listingIdFromPath, listingPath } from "@/lib/hostbook/site";
import { Facts, SiteFooter, SiteHeader, cld, siteName } from "@/components/hostbook/site/SiteParts";
import { BookBox } from "@/components/hostbook/site/BookBox";

export const revalidate = 60;

type Args = { params: Promise<{ slug: string; listing: string }> };

async function load(args: Args) {
  const { slug, listing } = await args.params;
  const s = await getPublicSite(await getPayloadClient(), slug);
  const l = s?.listings.find((x) => x.id === listingIdFromPath(listing));
  return s && l ? { s, l, path: listing } : null;
}

export async function generateMetadata(args: Args): Promise<Metadata> {
  const d = await load(args);
  if (!d) return { title: "Not found", robots: { index: false } };
  const { s, l } = d;
  const title = `${l.name} · ${siteName(s)}`;
  const description = (l.headline || l.description || `Book ${l.name} directly with the host on WhatsApp.`).replace(/\s+/g, " ").slice(0, 155);
  const url = `${SITE_PATH}/${s.slug}/${listingPath(l)}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", siteName: siteName(s), ...(l.photos[0] ? { images: [{ url: cld(l.photos[0], 1200) }] } : {}) },
    twitter: { card: l.photos[0] ? "summary_large_image" : "summary" },
  };
}

const jsonLd = (s: PublicSite, l: PublicSite["listings"][number], url: string) => ({
  "@context": "https://schema.org",
  "@type": "LodgingBusiness",
  name: l.name,
  description: l.headline || l.description.slice(0, 300) || undefined,
  url,
  image: l.photos.slice(0, 5).map((p) => cld(p, 1200)),
  address: { "@type": "PostalAddress", addressLocality: l.city || s.city || undefined, addressCountry: "IN" },
  ...(l.price ? { priceRange: `₹${l.price.toLocaleString("en-IN")} per night` } : {}),
  ...(l.amenities.length ? { amenityFeature: l.amenities.map((a) => ({ "@type": "LocationFeatureSpecification", name: a, value: true })) } : {}),
});

/** One place on a host's booking website, with photos, details, free dates and the WhatsApp enquiry box. */
export default async function HostListing(args: Args) {
  const d = await load(args);
  if (!d) notFound();
  const { s, l, path } = d;
  const canonical = listingPath(l);
  if (path !== canonical) permanentRedirect(`${SITE_PATH}/${s.slug}/${canonical}`); // renamed listings keep working
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const url = `${site}${SITE_PATH}/${s.slug}/${canonical}`;
  return (
    <div className="min-h-dvh bg-sand text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(s, l, url)).replace(/</g, "\\u003c") }} />
      <SiteHeader s={s} />
      <main className="mx-auto max-w-5xl px-4 pt-6">
        <p className="text-sm text-muted">
          <Link href={`${SITE_PATH}/${s.slug}`} className="hover:text-ink">{siteName(s)}</Link> › {l.name}
        </p>
        <h1 className="mt-2 font-serif text-4xl leading-tight md:text-5xl">{l.name}</h1>
        {l.headline ? <p className="mt-2 text-lg text-muted">{l.headline}</p> : null}
        <Facts l={l} className="mt-3" />

        {l.photos.length ? (
          <div className="no-scrollbar mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto rounded-3xl">
            {l.photos.map((p, i) => (
              <img key={p} src={cld(p, 1400)} alt={`${l.name}, photo ${i + 1}`} loading={i ? "lazy" : "eager"} className="h-72 w-[85%] shrink-0 snap-center rounded-3xl object-cover sm:h-96 sm:w-[70%]" />
            ))}
          </div>
        ) : null}

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            {l.description ? (
              <section>
                <h2 className="font-serif text-2xl">About this place</h2>
                <p className="mt-3 whitespace-pre-line leading-relaxed">{l.description}</p>
              </section>
            ) : null}
            {l.amenities.length ? (
              <section className="mt-8">
                <h2 className="font-serif text-2xl">What this place offers</h2>
                <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  {l.amenities.map((a) => (
                    <li key={a} className="flex items-center gap-2"><Check className="size-4 text-teal" /> {a}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            {l.checkIn || l.checkOut || l.rules ? (
              <section className="mt-8">
                <h2 className="font-serif text-2xl">Good to know</h2>
                {l.checkIn || l.checkOut ? <p className="mt-3 text-sm">Check-in {l.checkIn || "as agreed"} · Check-out {l.checkOut || "as agreed"}</p> : null}
                {l.rules ? <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{l.rules}</p> : null}
              </section>
            ) : null}
          </div>
          <div className="lg:sticky lg:top-20 lg:self-start">
            <BookBox slug={s.slug} listingId={l.id} listing={l.name} site={siteName(s)} whatsapp={s.site.whatsapp} busy={l.busy} price={l.price} maxGuests={l.maxGuests} url={url} />
          </div>
        </div>
      </main>
      <SiteFooter s={s} />
    </div>
  );
}
