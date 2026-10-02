import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { CheckoutForm } from "./CheckoutForm";
import { MiniMockup } from "./MiniMockup";
import { TrackEvent } from "@/components/TrackEvent";
import { Logo } from "@/components/Logo";
import { formatINR, product } from "@/lib/content";

export const metadata: Metadata = { title: `Checkout — ${product.name}`, robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="bg-glow min-h-screen px-4 pb-16 pt-6">
      <TrackEvent event="InitiateCheckout" />
      <header className="mx-auto mb-8 flex max-w-5xl items-center justify-between">
        <Logo />
        <Link href="/" className="flex items-center gap-1 text-sm font-medium text-plum hover:text-teal">
          <ArrowLeft className="size-4" /> Back
        </Link>
      </header>

      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_1.1fr]">
        {/* order summary */}
        <aside className="h-fit rounded-3xl bg-lavender p-6 shadow-soft md:p-8">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-teal">Your order</p>
          <MiniMockup />
          <div className="mt-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl">{product.name}</h1>
              <p className="text-sm text-charcoal/70">{product.formats.join(" + ")} · Instant download</p>
            </div>
            <div className="text-right">
              <div className="font-display text-3xl text-plum">{formatINR(product.price)}</div>
              {product.compareAtPrice && (
                <div className="text-sm text-charcoal/45 line-through">{formatINR(product.compareAtPrice)}</div>
              )}
            </div>
          </div>
          <ul className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
            {product.includes.map((i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 rounded-full bg-teal p-0.5 text-cream" strokeWidth={3.5} />
                {i}
              </li>
            ))}
          </ul>
        </aside>

        <CheckoutForm />
      </div>
    </div>
  );
}
