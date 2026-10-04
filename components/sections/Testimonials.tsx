import { Star } from "lucide-react";
import { Marquee } from "@/components/ui/Marquee";

const accents = ["border-t-coral", "border-t-teal", "border-t-marigold", "border-t-plum"];

type Item = { id?: string | null; name: string; city?: string | null; text: string };

function Card({ t, i }: { t: Item; i: number }) {
  return (
    <figure className={`card w-75 shrink-0 rounded-3xl border-t-4 p-6 md:w-90 ${accents[i % accents.length]}`}>
      <div className="mb-3 flex gap-0.5">
        {Array.from({ length: 5 }).map((_, k) => (
          <Star key={k} className="size-4 fill-marigold text-marigold" />
        ))}
      </div>
      <blockquote className="mb-4 font-display text-xl leading-snug text-plum">&ldquo;{t.text}&rdquo;</blockquote>
      <figcaption className="text-sm font-semibold text-plum">
        {t.name} {t.city && <span className="font-normal text-charcoal/60">· {t.city}</span>}
      </figcaption>
    </figure>
  );
}

/** Two rows of scrolling reviews. Used by product pages and the Testimonials page block. */
export function Testimonials({ eyebrow, heading, items }: { eyebrow?: string | null; heading?: string | null; items: Item[] }) {
  if (!items.length) return null;
  return (
    <section className="overflow-hidden bg-cream py-20 md:py-28">
      {(eyebrow || heading) && (
        <div className="mb-12 px-4 text-center">
          {eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-coral">{eyebrow}</p>}
          {heading && <h2 className="font-display text-4xl md:text-6xl">{heading}</h2>}
        </div>
      )}
      <Marquee className="py-4">
        {items.map((t, i) => (
          <Card key={(t.id ?? t.name) + i} t={t} i={i} />
        ))}
      </Marquee>
      {items.length > 2 && (
        <Marquee reverse className="mt-4 py-4">
          {[...items].reverse().map((t, i) => (
            <Card key={(t.id ?? t.name) + "r" + i} t={t} i={i + 2} />
          ))}
        </Marquee>
      )}
    </section>
  );
}
