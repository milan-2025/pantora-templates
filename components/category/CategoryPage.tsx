import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/SiteShell";
import { JsonLd } from "@/components/JsonLd";
import { LinkCards } from "@/components/sections/LinkCards";
import { CategoryTiles } from "@/components/sections/CategoryTiles";
import { FeatureIcon } from "@/components/ui/FeatureIcon";
import { getCatalogue } from "@/lib/cms/queries";
import { DEFAULT_SHARE_IMAGE } from "@/lib/cms/seo";
import { categoryByKey, type CategoryKey } from "@/lib/siteLinks";
import { breadcrumbJsonLd, siteUrl } from "@/lib/structuredData";

/** Search and share details for a category page (/weddings, /self-improvement, /business, /hospitality). */
export function categoryMetadata(key: CategoryKey): Metadata {
  const c = categoryByKey(key)!;
  const title = `${c.label}: apps and templates`;
  return {
    title,
    description: c.description,
    alternates: { canonical: c.url },
    openGraph: { title, description: c.description, url: c.url, images: [DEFAULT_SHARE_IMAGE] },
    twitter: { card: "summary_large_image" },
  };
}

/**
 * A category's page: its apps, then its templates, then the other categories. Everything on it comes from the
 * link map (lib/siteLinks.ts) and the products in the admin, so a new product appears here by itself.
 */
export async function CategoryPage({ categoryKey }: { categoryKey: CategoryKey }) {
  const catalogue = await getCatalogue();
  const group = catalogue.find((g) => g.category.key === categoryKey);
  if (!group) notFound();
  const { category: c, apps, templates, tools } = group;
  const accent = { color: c.accent, tint: c.tint };
  const all = [...apps, ...templates, ...tools];

  return (
    <SiteShell>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: c.label, path: c.url },
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: c.label,
          itemListElement: all.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.title, url: `${siteUrl()}${item.url}` })),
        }}
      />
      <section className="px-4 pb-14 pt-32 md:pb-20 md:pt-40" style={{ background: `linear-gradient(180deg, ${c.tint} 0%, var(--cream) 100%)` }}>
        <div className="mx-auto max-w-3xl text-center">
          <span className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-paper shadow-sm" style={{ color: c.accent }}>
            <FeatureIcon name={c.icon} className="size-7" />
          </span>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: c.accent }}>
            {c.tagline}
          </p>
          <h1 className="font-display text-5xl leading-tight md:text-6xl">{c.label}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-charcoal/75">{c.description}</p>
        </div>
      </section>
      <LinkCards
        id="apps"
        eyebrow="Software"
        heading={apps.length === 1 ? "The app" : "Apps"}
        text="Online tools you open on any phone or laptop. Start free, and your whole family or team can join."
        cards={apps.map((a) => ({ title: a.title, text: a.text, url: a.url, cta: a.cta, icon: a.icon }))}
        accent={accent}
      />
      <LinkCards
        id="templates"
        eyebrow="Templates"
        heading="Ready-made sheets"
        text="Buy once and keep it: Excel and Google Sheets files with the formulas already built in."
        cards={templates.map((t) => ({ title: t.title, text: t.text, url: t.url, cta: t.cta, icon: t.icon, image: t.image }))}
        tone="sand"
        accent={accent}
      />
      <LinkCards
        id="free-tools"
        eyebrow="Free tools"
        heading="Free calculators"
        text="No sign-up: put in your numbers and get the answer straight away."
        cards={tools.map((t) => ({ title: t.title, text: t.text, url: t.url, cta: t.cta, icon: t.icon }))}
        accent={accent}
      />
      <CategoryTiles
        id="more"
        eyebrow="More from Pandora Templates"
        heading="Other categories"
        groups={catalogue.filter((g) => g.category.key !== categoryKey)}
      />
    </SiteShell>
  );
}
