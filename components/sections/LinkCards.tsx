import type { Media } from "@/payload-types";
import { SmartLink } from "@/components/ui/SmartLink";
import { FeatureIcon, ICON_TINTS } from "@/components/ui/FeatureIcon";
import { MediaSlot } from "@/components/ui/MediaSlot";
import { Reveal } from "@/components/ui/Reveal";

export type LinkCard = {
  title: string;
  text?: string | null;
  url: string;
  cta?: string | null;
  icon?: string | null;
  image?: string | Media | null;
};

/**
 * A row of cards that each link to a product or landing page.
 * Used by the homepage "Our products" block and the "You might also like" strip on product pages.
 */
export function LinkCards({
  id,
  eyebrow,
  heading,
  text,
  cards,
  tone = "light",
}: {
  id?: string;
  eyebrow?: string | null;
  heading?: string | null;
  text?: string | null;
  cards: LinkCard[];
  tone?: "light" | "sand";
}) {
  if (!cards.length) return null;
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
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c, i) => (
            <Reveal key={c.url + c.title} delay={Math.min(i, 5) * 0.06} className="min-w-0">
              <SmartLink href={c.url} className="card group flex h-full flex-col overflow-hidden rounded-3xl transition-shadow hover:shadow-lift">
                {c.image ? (
                  <MediaSlot media={c.image} className="aspect-[16/9] w-full" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                ) : null}
                <div className="flex flex-1 flex-col p-6">
                  {!c.image && (
                    <span className={`mb-4 grid size-12 place-items-center rounded-2xl ${ICON_TINTS[i % ICON_TINTS.length]}`}>
                      <FeatureIcon name={c.icon} className="size-6" />
                    </span>
                  )}
                  <h3 className="font-display text-2xl leading-snug">{c.title}</h3>
                  {c.text && <p className="mt-2 flex-1 text-charcoal/70">{c.text}</p>}
                  <span className="mt-5 text-sm font-semibold text-teal transition-transform group-hover:translate-x-1">
                    {c.cta || "Learn more"} →
                  </span>
                </div>
              </SmartLink>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
