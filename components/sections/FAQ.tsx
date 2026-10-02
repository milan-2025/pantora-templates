import { Accordion } from "@/components/ui/Accordion";
import { Reveal } from "@/components/ui/Reveal";
import { faqs, whatsappLink } from "@/lib/content";

export function FAQ() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <section id="faq" className="scroll-mt-16 bg-grid px-4 py-20 md:py-28">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-3xl">
        <Reveal className="mb-12 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-teal">FAQ</p>
          <h2 className="font-display text-4xl md:text-6xl">Questions? We&apos;ve got answers.</h2>
        </Reveal>
        <Accordion items={faqs} />
        <p className="mt-10 text-center text-lg text-charcoal/80">
          Still unsure?{" "}
          <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="font-semibold text-teal underline decoration-marigold decoration-2 underline-offset-4">
            Ask us on WhatsApp →
          </a>
        </p>
      </div>
    </section>
  );
}
