import { Accordion } from "@/components/ui/Accordion";
import { Reveal } from "@/components/ui/Reveal";

type Item = { question: string; answer: string };

/** FAQ accordion + FAQPage structured data for Google. Used by product pages and the FAQ page block. */
export function FAQ({
  eyebrow,
  heading,
  items,
  whatsappHref,
  id = "faq",
}: {
  eyebrow?: string | null;
  heading?: string | null;
  items: Item[];
  whatsappHref?: string | null;
  id?: string;
}) {
  if (!items.length) return null;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  return (
    <section id={id} className="bg-grid scroll-mt-16 px-4 py-20 md:py-28">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="mx-auto max-w-3xl">
        <Reveal className="mb-12 text-center">
          {eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-teal">{eyebrow}</p>}
          {heading && <h2 className="font-display text-4xl md:text-6xl">{heading}</h2>}
        </Reveal>
        <Accordion items={items.map((i) => ({ q: i.question, a: i.answer }))} />
        {whatsappHref && (
          <p className="mt-10 text-center text-lg text-charcoal/80">
            Still unsure?{" "}
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-teal underline decoration-marigold decoration-2 underline-offset-4"
            >
              Ask us on WhatsApp →
            </a>
          </p>
        )}
      </div>
    </section>
  );
}
