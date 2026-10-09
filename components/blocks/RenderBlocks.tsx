import Link from "next/link";
import { RichText } from "@payloadcms/richtext-lexical/react";
import type { Page, SiteSetting } from "@/payload-types";
import { getPayloadClient, getProducts } from "@/lib/cms/queries";
import { getOfferState } from "@/lib/pricing";
import { formatINR, mediaDoc, whatsappLink } from "@/lib/format";
import { buttonClasses } from "@/components/ui/Button";
import { MediaSlot } from "@/components/ui/MediaSlot";
import { Reveal } from "@/components/ui/Reveal";
import { Sparkle } from "@/components/ui/Squiggle";
import { FeatureIcon, ICON_TINTS } from "@/components/ui/FeatureIcon";
import { FAQ } from "@/components/sections/FAQ";
import { Testimonials } from "@/components/sections/Testimonials";
import { ContactSection } from "@/components/sections/ContactSection";
import { HtmlEmbed } from "./HtmlEmbed";

type Block = NonNullable<Page["layout"]>[number];
type BlockOf<T extends Block["blockType"]> = Extract<Block, { blockType: T }>;

/** Renders the page-builder sections an editor stacked in the admin. */
export async function RenderBlocks({ blocks, settings }: { blocks: Page["layout"]; settings: SiteSetting }) {
  if (!blocks?.length) return null;
  return (
    <>
      {blocks.map((block, i) => {
        const key = block.id ?? `${block.blockType}-${i}`;
        switch (block.blockType) {
          case "hero":
            return <HeroBlock key={key} block={block} first={i === 0} />;
          case "richText":
            return <RichTextBlock key={key} block={block} />;
          case "imageText":
            return <ImageTextBlock key={key} block={block} />;
          case "featureGrid":
            return <FeatureGridBlock key={key} block={block} />;
          case "productCards":
            return <ProductCardsBlock key={key} block={block} />;
          case "cta":
            return <CtaBlock key={key} block={block} />;
          case "faq":
            return (
              <FAQ
                key={key}
                id={`faq-${i}`}
                heading={block.heading}
                items={block.items ?? []}
                whatsappHref={whatsappLink(settings.whatsappNumber, settings.whatsappMessage)}
              />
            );
          case "testimonials":
            return <Testimonials key={key} heading={block.heading} items={block.items ?? []} />;
          case "contactForm":
            return (
              <ContactSection
                key={key}
                heading={block.heading}
                text={block.text}
                whatsappHref={whatsappLink(settings.whatsappNumber, settings.whatsappMessage)}
                email={settings.supportEmail}
              />
            );
          case "video":
            return <VideoBlock key={key} block={block} />;
          case "html":
            return <HtmlEmbed key={key} html={block.html} mode={block.mode ?? "isolated"} width={block.width ?? "full"} />;
          default:
            return null;
        }
      })}
    </>
  );
}

function Btn({ label, url, variant }: { label?: string | null; url?: string | null; variant?: "primary" | "outline" | "plum" }) {
  if (!label || !url) return null;
  return (
    <Link href={url} className={buttonClasses({ variant, size: "lg" })}>
      {label}
    </Link>
  );
}

function HeroBlock({ block, first }: { block: BlockOf<"hero">; first: boolean }) {
  const hasImage = Boolean(mediaDoc(block.image));
  return (
    <section className={`bg-glow relative overflow-hidden px-4 pb-20 ${first ? "pt-32 md:pt-40" : "pt-20"} md:pb-28`}>
      <Sparkle className="absolute left-[6%] top-32 size-6 animate-twinkle" />
      <Sparkle className="absolute right-[8%] top-28 size-4 animate-twinkle [animation-delay:1s]" fill="var(--coral)" />
      <div className={`mx-auto grid max-w-6xl items-center gap-12 ${hasImage ? "lg:grid-cols-2" : ""}`}>
        <Reveal className={`min-w-0 ${hasImage ? "text-center lg:text-left" : "mx-auto max-w-3xl text-center"}`}>
          {block.eyebrow && <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-teal">{block.eyebrow}</p>}
          <h1 className="font-display text-5xl leading-[1.04] md:text-7xl">
            {block.heading}
            {block.headingAccent && (
              <>
                {" "}
                <span className="italic text-marigold">{block.headingAccent}</span>
              </>
            )}
          </h1>
          {block.text && <p className="mt-6 text-lg leading-relaxed text-charcoal/80">{block.text}</p>}
          {(block.primaryLabel || block.secondaryLabel) && (
            <div className={`mt-9 flex flex-col gap-3 sm:flex-row ${hasImage ? "items-center sm:justify-center lg:justify-start" : "items-center justify-center"}`}>
              <Btn label={block.primaryLabel} url={block.primaryUrl} />
              <Btn label={block.secondaryLabel} url={block.secondaryUrl} variant="outline" />
            </div>
          )}
        </Reveal>
        {hasImage && (
          <Reveal delay={0.15} className="min-w-0">
            <MediaSlot media={block.image} priority className="aspect-[4/3] w-full rounded-4xl shadow-lift" />
          </Reveal>
        )}
      </div>
    </section>
  );
}

function RichTextBlock({ block }: { block: BlockOf<"richText"> }) {
  return (
    <section className="px-4 py-14 md:py-20 first:pt-32">
      <Reveal className={`prose-pandora mx-auto ${block.width === "wide" ? "max-w-5xl" : "max-w-3xl"}`}>
        <RichText data={block.content} />
      </Reveal>
    </section>
  );
}

function ImageTextBlock({ block }: { block: BlockOf<"imageText"> }) {
  const right = block.imageSide === "right";
  return (
    <section className="overflow-hidden px-4 py-16 md:py-24 first:pt-32">
      <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2 md:gap-16">
        <Reveal className={`min-w-0 ${right ? "md:order-2" : ""}`}>
          <MediaSlot media={block.image} className="aspect-[4/3] w-full rounded-3xl shadow-lift" />
        </Reveal>
        <Reveal delay={0.1} className={`min-w-0 ${right ? "md:order-1" : ""}`}>
          {block.eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-coral">{block.eyebrow}</p>}
          {block.heading && <h2 className="mb-5 font-display text-4xl md:text-5xl">{block.heading}</h2>}
          {block.content && (
            <div className="prose-pandora">
              <RichText data={block.content} />
            </div>
          )}
          <div className="mt-7">
            <Btn label={block.buttonLabel} url={block.buttonUrl} />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function FeatureGridBlock({ block }: { block: BlockOf<"featureGrid"> }) {
  return (
    <section className="bg-grid px-4 py-20 md:py-28 first:pt-32">
      <div className="mx-auto max-w-6xl">
        {(block.heading || block.text) && (
          <Reveal className="mx-auto mb-14 max-w-2xl text-center">
            {block.heading && <h2 className="font-display text-4xl md:text-6xl">{block.heading}</h2>}
            {block.text && <p className="mt-4 text-lg text-charcoal/75">{block.text}</p>}
          </Reveal>
        )}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(block.items ?? []).map((item, i) => (
            <Reveal key={item.id ?? i} delay={i * 0.06}>
              <div className="card h-full rounded-3xl p-7">
                <div className={`mb-5 grid size-12 place-items-center rounded-2xl ${ICON_TINTS[i % ICON_TINTS.length]}`}>
                  <FeatureIcon name={item.icon} className="size-6" />
                </div>
                <h3 className="mb-2 font-display text-2xl">{item.title}</h3>
                {item.text && <p className="leading-relaxed text-charcoal/75">{item.text}</p>}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

async function ProductCardsBlock({ block }: { block: BlockOf<"productCards"> }) {
  const ids = (block.products ?? []).map((p) => (typeof p === "object" ? p.id : p));
  const products = await getProducts(ids);
  if (!products.length) return null;
  // Same offer rules as checkout (end date + sales limit), so cards never show an expired price.
  const payload = await getPayloadClient();
  const offers = await Promise.all(products.map((p) => getOfferState(payload, p)));
  return (
    <section id="products" className="scroll-mt-16 px-4 py-20 md:py-28 first:pt-32">
      <div className="mx-auto max-w-6xl">
        {(block.heading || block.text) && (
          <Reveal className="mx-auto mb-14 max-w-2xl text-center">
            {block.heading && <h2 className="font-display text-4xl md:text-6xl">{block.heading}</h2>}
            {block.text && <p className="mt-4 text-lg text-charcoal/75">{block.text}</p>}
          </Reveal>
        )}
        <div className="flex flex-wrap justify-center gap-8">
          {products.map((p, i) => (
            <Reveal key={p.id} delay={i * 0.08} className="w-full sm:w-[calc(50%-1rem)] lg:w-[calc((100%-4rem)/3)]">
              <Link href={`/${p.slug}`} className="card group block h-full overflow-hidden rounded-3xl transition-shadow hover:shadow-lift">
                <MediaSlot
                  media={p.cardImage}
                  className="aspect-[4/3] w-full"
                  sizes="(max-width: 768px) 100vw, 33vw"
                  fallback={
                    <div className="grid aspect-[4/3] w-full place-items-center bg-lavender">
                      <Sparkle className="size-12 transition-transform duration-500 group-hover:rotate-45 group-hover:scale-110" />
                    </div>
                  }
                />
                <div className="p-6">
                  {!!p.formats?.length && (
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal">{p.formats.join(" · ")}</p>
                  )}
                  <h3 className="font-display text-2xl">{p.name}</h3>
                  {p.tagline && <p className="mt-2 line-clamp-2 text-charcoal/70">{p.tagline}</p>}
                  <div className="mt-5 flex items-center justify-between">
                    <span className="font-display text-2xl text-plum">
                      {formatINR(offers[i].price)}
                      {offers[i].active && (
                        <s className="ml-2 font-sans text-sm text-charcoal/45">{formatINR(offers[i].regularPrice)}</s>
                      )}
                    </span>
                    <span className="text-sm font-semibold text-teal transition-transform group-hover:translate-x-1">View →</span>
                  </div>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const CTA_STYLES = {
  plum: { section: "bg-plum", heading: "text-cream", text: "text-cream/80", button: "primary" as const },
  teal: { section: "bg-teal", heading: "text-cream", text: "text-cream/80", button: "primary" as const },
  cream: { section: "bg-sand", heading: "", text: "text-charcoal/75", button: "plum" as const },
};

function CtaBlock({ block }: { block: BlockOf<"cta"> }) {
  const s = CTA_STYLES[block.style ?? "plum"];
  return (
    <section className={`relative overflow-hidden px-4 py-20 md:py-24 ${s.section}`}>
      <Sparkle className="absolute left-[8%] top-10 size-6 animate-twinkle" />
      <Reveal className="relative mx-auto max-w-3xl text-center">
        <h2 className={`font-display text-4xl md:text-5xl ${s.heading}`}>{block.heading}</h2>
        {block.text && <p className={`mx-auto mt-4 max-w-xl text-lg ${s.text}`}>{block.text}</p>}
        <div className="mt-8">
          <Btn label={block.buttonLabel} url={block.buttonUrl} variant={s.button} />
        </div>
      </Reveal>
    </section>
  );
}

function VideoBlock({ block }: { block: BlockOf<"video"> }) {
  return (
    <section className="px-4 py-14 md:py-20">
      <Reveal className="mx-auto max-w-5xl">
        <MediaSlot media={block.media} className="aspect-video w-full rounded-3xl shadow-lift" sizes="(max-width: 1024px) 100vw, 1024px" />
        {block.caption && <p className="mt-4 text-center text-sm text-charcoal/65">{block.caption}</p>}
      </Reveal>
    </section>
  );
}
