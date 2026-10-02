import { Star } from "lucide-react";
import { testimonials } from "@/lib/content";
import { Marquee } from "@/components/ui/Marquee";

const accents = ["border-t-coral", "border-t-teal", "border-t-marigold", "border-t-plum"];

function Card({ t, i }: { t: (typeof testimonials)[number]; i: number }) {
  return (
    <figure className={`card w-[300px] shrink-0 rounded-3xl border-t-4 p-6 md:w-[360px] ${accents[i % accents.length]}`}>
      <div className="mb-3 flex gap-0.5">
        {Array.from({ length: 5 }).map((_, k) => (
          <Star key={k} className="size-4 fill-marigold text-marigold" />
        ))}
      </div>
      <blockquote className="mb-4 font-display text-xl leading-snug text-plum">&ldquo;{t.text}&rdquo;</blockquote>
      <figcaption className="text-sm font-semibold text-plum">
        {t.name} <span className="font-normal text-charcoal/60">· {t.city}</span>
      </figcaption>
    </figure>
  );
}

export function Testimonials() {
  // Placeholder reviews ship with a visible dev badge so they're never mistaken for real ones.
  const hasPlaceholders = testimonials.some((t) => t.placeholder);
  return (
    <section className="overflow-hidden bg-cream py-20 md:py-28">
      <div className="mb-12 px-4 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-coral">Kind words</p>
        <h2 className="font-display text-4xl md:text-6xl">Loved by couples across India</h2>
        {hasPlaceholders && process.env.NODE_ENV === "development" && (
          <p className="mt-3 inline-block rounded bg-blush px-2 py-1 font-mono text-xs">
            DEV: placeholder testimonials. Replace them in lib/content.ts before launch
          </p>
        )}
      </div>
      <Marquee className="py-4">
        {testimonials.map((t, i) => (
          <Card key={t.name} t={t} i={i} />
        ))}
      </Marquee>
      <Marquee reverse className="mt-4 py-4">
        {[...testimonials].reverse().map((t, i) => (
          <Card key={t.name} t={t} i={i + 2} />
        ))}
      </Marquee>
    </section>
  );
}
