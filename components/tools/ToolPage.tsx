import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteShell } from "@/components/SiteShell";
import { JsonLd } from "@/components/JsonLd";
import { FAQ } from "@/components/sections/FAQ";
import { LinkCards } from "@/components/sections/LinkCards";
import { FeatureIcon } from "@/components/ui/FeatureIcon";
import { DEFAULT_SHARE_IMAGE } from "@/lib/cms/seo";
import { FREE_TOOLS, categoryByKey, relatedLandingPages, type FreeTool } from "@/lib/siteLinks";
import { breadcrumbJsonLd, siteUrl } from "@/lib/structuredData";

const tool = (key: FreeTool["key"]) => FREE_TOOLS.find((t) => t.key === key)!;

/** Search and share details for a free calculator page. */
export function toolMetadata(key: FreeTool["key"], title: string): Metadata {
  const t = tool(key);
  return {
    title,
    description: t.description,
    alternates: { canonical: t.url },
    openGraph: { title, description: t.description, url: t.url, images: [DEFAULT_SHARE_IMAGE] },
    twitter: { card: "summary_large_image" },
  };
}

/** A free calculator's page: heading, the calculator, a short guide, FAQ and the category's apps. */
export function ToolPage({
  toolKey, eyebrow, heading, intro, children, guide, faq,
}: {
  toolKey: FreeTool["key"];
  eyebrow: string;
  heading: string;
  intro: string;
  children: ReactNode;
  guide: { title: string; text: string }[];
  faq: { question: string; answer: string }[];
}) {
  const t = tool(toolKey);
  const c = categoryByKey(t.category)!;
  return (
    <SiteShell>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: c.label, path: c.url },
          { name: t.label, path: t.url },
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: t.label,
          url: `${siteUrl()}${t.url}`,
          description: t.description,
          applicationCategory: "FinanceApplication",
          operatingSystem: "Web",
          isAccessibleForFree: true,
          offers: { "@type": "Offer", price: 0, priceCurrency: "INR" },
          publisher: { "@type": "Organization", name: "Pandora Templates", url: siteUrl() },
        }}
      />
      <section className="px-4 pb-10 pt-32 md:pt-40" style={{ background: `linear-gradient(180deg, ${c.tint} 0%, var(--cream) 100%)` }}>
        <div className="mx-auto max-w-3xl text-center">
          <span className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-paper shadow-sm" style={{ color: c.accent }}>
            <FeatureIcon name={t.icon} className="size-7" />
          </span>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: c.accent }}>
            {eyebrow}
          </p>
          <h1 className="font-display text-4xl leading-tight md:text-6xl">{heading}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-charcoal/75">{intro}</p>
        </div>
      </section>
      <section className="px-4 pb-16">
        <div className="mx-auto max-w-6xl">{children}</div>
      </section>
      <section className="bg-sand px-4 py-16 md:py-20">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
          {guide.map((g) => (
            <div key={g.title}>
              <h2 className="font-display text-2xl">{g.title}</h2>
              <p className="mt-2 text-charcoal/75">{g.text}</p>
            </div>
          ))}
        </div>
      </section>
      <FAQ eyebrow="Questions" heading="Good to know" items={faq} />
      <LinkCards
        eyebrow="Next step"
        heading="Do the rest in an app"
        cards={relatedLandingPages(t.category).map((p) => ({ title: p.label, text: p.description, url: p.url, cta: p.cta, icon: p.icon }))}
        accent={{ color: c.accent, tint: c.tint }}
      />
    </SiteShell>
  );
}
