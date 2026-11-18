import type { Metadata } from "next";
import { Header } from "@/components/stays/ui";
import { SearchApp } from "@/components/stays/SearchApp";
import { loadSite } from "@/lib/stays/pages";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await loadSite();
  return { title: `Search stays | ${settings.siteName}`, description: settings.seo.description, alternates: { canonical: "/stays/search" } };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const initial = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] || "" : v || ""]));
  const { settings, amenities } = await loadSite();
  return (
    <>
      <Header site={settings} active="search" />
      <SearchApp initial={initial} types={settings.propertyTypes} categories={settings.categories} features={settings.features} amenities={amenities} cfg={settings.map} />
    </>
  );
}
