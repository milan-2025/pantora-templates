import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PropertyDetail } from "@/components/stays/PropertyDetail";
import { loadShare } from "@/lib/stays/pages";
import { propertyMetadata } from "@/lib/stays/seo";

export const dynamic = "force-dynamic";

/**
 * Share link (/stay/s/<token>). The token decides whether prices show (enforced on the server, the price is not
 * in the page at all when hidden), works for unlisted properties, and stops working when revoked.
 * Never indexed by search engines.
 */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const data = await loadShare((await params).token);
  if (!data) return { title: "Link not available", robots: { index: false, follow: false } };
  return propertyMetadata(data.property, data.site.settings, null, false);
}

export default async function SharedStayPage({ params }: { params: Promise<{ token: string }> }) {
  const data = await loadShare((await params).token);
  if (!data) notFound();
  return <PropertyDetail property={data.property} site={data.site.settings} similar={data.similar} shareId={data.shareId} />;
}
