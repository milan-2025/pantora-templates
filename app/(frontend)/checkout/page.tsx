import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { CheckoutForm } from "./CheckoutForm";
import { MiniMockup } from "./MiniMockup";
import { TrackEvent } from "@/components/TrackEvent";
import { Logo } from "@/components/Logo";
import { MediaSlot } from "@/components/ui/MediaSlot";
import { loadCheckoutProduct } from "@/lib/checkout";
import { getQuote } from "@/lib/pricing";
import { REF_COOKIE } from "@/lib/referral";
import { getPaymentProvider } from "@/lib/payments";
import { readVisitorStart } from "@/lib/offerWindow";

/** "live" only with live Razorpay keys; test keys and the mock gateway show a banner. */
function paymentMode(): "live" | "test" | "demo" {
  try {
    if (getPaymentProvider().name === "mock") return "demo";
  } catch {
    return "demo";
  }
  return process.env.RAZORPAY_KEY_ID?.startsWith("rzp_live_") ? "live" : "test";
}

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

type Args = { searchParams: Promise<{ product?: string }> };

export default async function CheckoutPage({ searchParams }: Args) {
  const { product: slug } = await searchParams;
  const loaded = await loadCheckoutProduct(slug || "wedding_planner");
  if (!loaded) notFound();
  const { payload, product } = loaded;

  // An affiliate's ?ref=CODE link is remembered in a cookie; apply it straight away.
  const refCode = (await cookies()).get(REF_COOKIE)?.value ?? "";
  const q = await getQuote(payload, product, refCode || null, { visitorStart: await readVisitorStart(String(product.id)) });
  const initialQuote = {
    regularPrice: q.offer.regularPrice,
    offerActive: q.offer.active,
    listPrice: q.listPrice,
    discount: q.discount,
    total: q.total,
    promoCode: q.promoCode,
    discountPercent: q.affiliate?.discountPercent ?? 0,
    codeError: q.codeError,
    bonusTitle: q.bonus?.active ? q.bonus.title : null,
  };

  return (
    <div className="bg-glow min-h-screen px-4 pb-16 pt-6">
      <TrackEvent event="InitiateCheckout" value={q.total} name={product.name} />
      <header className="mx-auto mb-8 flex max-w-5xl items-center justify-between">
        <Logo />
        <Link href={`/${product.slug}`} className="flex items-center gap-1 text-sm font-medium text-plum hover:text-teal">
          <ArrowLeft className="size-4" /> Back
        </Link>
      </header>

      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_1.1fr]">
        {/* order summary */}
        <aside className="h-fit min-w-0 rounded-3xl bg-lavender p-6 shadow-soft md:p-8">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-teal">Your order</p>
          <MediaSlot media={product.cardImage} className="aspect-[4/3] w-full rounded-2xl" fallback={<MiniMockup />} />
          <div className="mt-6">
            <h1 className="font-display text-2xl">{product.name}</h1>
            {!!product.formats?.length && (
              <p className="text-sm text-charcoal/70">{product.formats.join(" + ")} · Instant download</p>
            )}
          </div>
          {!!product.includes?.length && (
            <ul className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
              {product.includes.map((i, idx) => (
                <li key={i.id ?? idx} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 rounded-full bg-teal p-0.5 text-cream" strokeWidth={3.5} />
                  {i.text}
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="min-w-0">
          <CheckoutForm productSlug={product.slug} initialQuote={initialQuote} initialCode={refCode} paymentMode={paymentMode()} />
        </div>
      </div>
    </div>
  );
}
