import { ArrowRight } from "lucide-react";
import { SmartLink } from "@/components/ui/SmartLink";
import { FeatureIcon } from "@/components/ui/FeatureIcon";
import { Reveal } from "@/components/ui/Reveal";
import type { CatalogueGroup } from "@/lib/cms/queries";

/**
 * One tile per category (Weddings, Self-Improvement, Business, Hospitality), each in its accent colour, listing
 * its apps and templates and linking to the category page. Used by the homepage "Our products" block and at
 * the bottom of each category page (for the other categories).
 */
export function CategoryTiles({
  id,
  eyebrow,
  heading,
  text,
  groups,
  tone = "light",
}: {
  id?: string;
  eyebrow?: string | null;
  heading?: string | null;
  text?: string | null;
  groups: CatalogueGroup[];
  tone?: "light" | "sand";
}) {
  const shown = groups.filter((g) => g.apps.length || g.templates.length);
  if (!shown.length) return null;
  return (
    <section id={id} className={`scroll-mt-16 px-4 py-20 md:py-24 first:pt-32 ${tone === "sand" ? "bg-sand" : ""}`}>
      <div className="mx-auto max-w-6xl">
        {(eyebrow || heading || text) && (
          <Reveal className="mx-auto mb-12 max-w-2xl text-center">
            {eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-teal">{eyebrow}</p>}
            {heading && <h2 className="font-display text-4xl md:text-5xl">{heading}</h2>}
            {text && <p className="mt-4 text-lg text-charcoal/75">{text}</p>}
          </Reveal>
        )}
        <div className={`grid gap-6 sm:grid-cols-2 ${shown.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          {shown.map(({ category: c, apps, templates }, i) => (
            <Reveal key={c.key} delay={Math.min(i, 5) * 0.06} className="min-w-0">
              <div className="card flex h-full flex-col overflow-hidden rounded-3xl" style={{ borderTop: `4px solid ${c.accent}` }}>
                <div className="flex flex-1 flex-col p-6">
                  <span className="mb-4 grid size-12 place-items-center rounded-2xl" style={{ background: c.tint, color: c.accent }}>
                    <FeatureIcon name={c.icon} className="size-6" />
                  </span>
                  <h3 className="font-display text-2xl leading-snug">
                    <SmartLink href={c.url} className="hover:underline">
                      {c.label}
                    </SmartLink>
                  </h3>
                  <p className="mt-1 text-sm text-charcoal/70">{c.tagline}</p>
                  <ul className="mt-4 grid flex-1 content-start gap-2 text-[0.95rem]">
                    {[...apps, ...templates].map((item) => (
                      <li key={item.url}>
                        <SmartLink href={item.url} title={item.text} className="group/i flex items-baseline justify-between gap-2 text-plum hover:underline">
                          <span>{item.title}</span>
                          <span className="shrink-0 text-[0.7rem] font-semibold uppercase tracking-wider text-charcoal/50">{item.kind === "app" ? "App" : "Template"}</span>
                        </SmartLink>
                      </li>
                    ))}
                  </ul>
                  <SmartLink href={c.url} className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: c.accent }}>
                    Explore {c.label} <ArrowRight className="size-4" />
                  </SmartLink>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
