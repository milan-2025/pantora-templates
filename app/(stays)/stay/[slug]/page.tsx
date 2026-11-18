import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { PropertyDetail } from "@/components/stays/PropertyDetail";
import { loadBySlug } from "@/lib/stays/pages";
import { jsonLd, propertyMetadata } from "@/lib/stays/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await loadBySlug((await params).slug);
  if (!data) return { title: "Stay not found", robots: { index: false } };
  return propertyMetadata(data.property, data.site.settings, `/stay/${data.canonical}`, true);
}

export default async function StayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await loadBySlug(slug);
  if (!data) notFound();
  if (decodeURIComponent(slug) !== data.canonical) permanentRedirect(`/stay/${data.canonical}`);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data.property, `/stay/${data.canonical}`) }} />
      <PropertyDetail property={data.property} site={data.site.settings} similar={data.similar} shareId={null} />
    </>
  );
}
