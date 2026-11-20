import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { PropertyDetail } from "@/components/stays/PropertyDetail";
import { loadBySlug } from "@/lib/stays/pages";
import { jsonLd, propertyMetadata } from "@/lib/stays/seo";
import { browsingAdmin } from "@/lib/stays/server";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd } from "@/lib/structuredData";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await loadBySlug((await params).slug, await browsingAdmin(await headers()));
  if (!data) return { title: "Stay not found", robots: { index: false } };
  return propertyMetadata(data.property, data.site.settings, `/stay/${data.canonical}`, data.indexable);
}

export default async function StayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Admin browsing view (switched on from the dashboard): any property, with private details.
  const admin = await browsingAdmin(await headers());
  const data = await loadBySlug(slug, admin);
  if (!data) notFound();
  if (decodeURIComponent(slug) !== data.canonical) permanentRedirect(`/stay/${data.canonical}`);
  return (
    <>
      {data.indexable && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data.property, `/stay/${data.canonical}`) }} />}
      {data.indexable && (
        <JsonLd
          data={breadcrumbJsonLd([
            { name: "Stays", path: "/stays" },
            { name: data.property.title, path: `/stay/${data.canonical}` },
          ])}
        />
      )}
      <PropertyDetail property={data.property} site={data.site.settings} similar={data.similar} shareId={null} admin={data.admin} />
    </>
  );
}
