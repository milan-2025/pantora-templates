import type { Metadata } from "next";
import { Header } from "@/components/stays/ui";
import { SearchApp } from "@/components/stays/SearchApp";
import { headers } from "next/headers";
import { loadSite } from "@/lib/stays/pages";
import { browsingAdmin } from "@/lib/stays/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await loadSite();
  return { title: `Search stays | ${settings.siteName}`, description: settings.seo.description, alternates: { canonical: "/stays/search" } };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const initial = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] || "" : v || ""]));
  const { settings, amenities } = await loadSite();
  const admin = !!(await browsingAdmin(await headers()));
  return (
    <>
      <Header site={settings} active="search" admin={admin} />
      <SearchApp admin={admin} initial={initial} types={settings.propertyTypes} categories={settings.categories} features={settings.features} amenities={amenities} cfg={settings.map} />
    </>
  );
}
