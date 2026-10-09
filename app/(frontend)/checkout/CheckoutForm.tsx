"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Check, Loader2, Lock, ShieldCheck, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LogoMark } from "@/components/Logo";
import { customerSchema, type Customer } from "@/lib/schema";
import { formatINR } from "@/lib/format";
import { openRazorpay } from "@/lib/razorpayCheckout";

export type QuoteView = {
  regularPrice: number;
  offerActive: boolean;
  listPrice: number;
  discount: number;
  total: number;
  promoCode: string | null;
  discountPercent: number;
  codeError: string | null;
};

type Errors = Partial<Record<keyof Customer, string>>;

const fields: {
  name: keyof Customer;
  label: string;
  type: string;
  placeholder: string;
  autoComplete: string;
  hint?: string;
  optional?: boolean;
}[] = [
  { name: "name", label: "Your name", type: "text", placeholder: "Priya Sharma", autoComplete: "name" },
  { name: "email", label: "Email", type: "email", placeholder: "priya@gmail.com", autoComplete: "email", hint: "We'll send your download links here" },
  { name: "phone", label: "WhatsApp number", type: "tel", placeholder: "98765 43210", autoComplete: "tel", hint: "Only for order support" },
  { name: "city", label: "City", type: "text", placeholder: "Pune", autoComplete: "address-level2", optional: true },
];

const processingSteps = ["Securing your payment…", "Confirming with the bank…", "Preparing your files…"];

const inputClass = (error?: string) =>
  `w-full rounded-xl border bg-cream px-4 py-3 text-base outline-none transition-all focus:border-teal focus:ring-4 focus:ring-teal/15 ${
    error ? "border-coral" : "border-plum/15"
  }`;

export function CheckoutForm({
  productSlug,
  initialQuote,
  initialCode,
  paymentMode,
}: {
  productSlug: string;
  initialQuote: QuoteView;
  /** Referral code remembered from an affiliate link (already applied to initialQuote if valid). */
  initialCode: string;
  /** Shown as a banner so nobody mistakes a test checkout for a real one. */
  paymentMode: "live" | "test" | "demo";
}) {
  const router = useRouter();
  const [values, setValues] = useState<Customer>({ name: "", email: "", phone: "", city: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(-1); // -1 = modal closed

  const [quote, setQuote] = useState<QuoteView>(initialQuote);
  const [codeInput, setCodeInput] = useState(initialCode);
  const [codeOpen, setCodeOpen] = useState(Boolean(initialCode));
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState(initialQuote.codeError ?? "");

  async function applyCode(code: string) {
    setCodeBusy(true);
    setCodeError("");
    try {
      const res = await fetch("/api/checkout/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: productSlug, promoCode: code || undefined }),
      });
      const q = (await res.json()) as QuoteView & { error?: string };
      if (!res.ok) throw new Error(q.error || "Couldn't check that code");
      if (q.codeError) {
        setCodeError(q.codeError);
      } else {
        setQuote(q);
        if (!code) setCodeInput("");
      }
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : "Couldn't check that code");
    } finally {
      setCodeBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const parsed = customerSchema.safeParse(values);
    if (!parsed.success) {
      const errs: Errors = {};
      for (const issue of parsed.error.issues) errs[issue.path[0] as keyof Customer] ??= issue.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    setBusy(true);

    try {
      const res = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: productSlug, customer: parsed.data, promoCode: quote.promoCode ?? undefined }),
      });
      const order = await res.json();
      if (!res.ok) throw new Error(order.error);

      // Take the payment: Razorpay's secure popup, or a short demo animation in mock mode.
      let gatewayPayload: Record<string, unknown> = {};
      if (order.provider === "razorpay") {
        gatewayPayload = await openRazorpay(order.orderId, order.clientData);
        setStep(1); // "Confirming with the bank…"
      } else {
        for (let i = 0; i < processingSteps.length; i++) {
          setStep(i);
          await new Promise((r) => setTimeout(r, 900));
        }
        gatewayPayload = { mock: true };
      }

      const vres = await fetch("/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.orderId, payload: gatewayPayload }),
      });
      const verified = await vres.json();
      if (!vres.ok) throw new Error(verified.error);

      setStep(processingSteps.length); // all done ✓
      await new Promise((r) => setTimeout(r, 600));
      router.push(`/success?order=${encodeURIComponent(order.orderId)}`);
    } catch (err) {
      setStep(-1);
      setBusy(false);
      setFormError(err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="card h-fit rounded-3xl p-6 md:p-8">
        <h2 className="mb-1 font-display text-3xl">Almost there</h2>
        <p className="mb-6 text-charcoal/70">Add your details and your files will be ready in under a minute.</p>

        <div className="grid gap-5 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.name} className={f.name === "name" || f.name === "email" ? "sm:col-span-2" : ""}>
              <label htmlFor={f.name} className="mb-1.5 block text-sm font-semibold text-plum">
                {f.label} {f.optional && <span className="font-normal text-charcoal/50">(optional)</span>}
              </label>
              <input
                id={f.name}
                name={f.name}
                type={f.type}
                autoComplete={f.autoComplete}
                placeholder={f.placeholder}
                value={values[f.name] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                aria-invalid={!!errors[f.name]}
                className={inputClass(errors[f.name])}
              />
              <AnimatePresence>
                {errors[f.name] ? (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-1 text-sm font-medium text-coral">
                    {errors[f.name]}
                  </motion.p>
                ) : f.hint ? (
                  <p className="mt-1 text-xs text-charcoal/60">{f.hint}</p>
                ) : null}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {/* promo code */}
        <div className="mt-6">
          {quote.promoCode ? (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-mint px-4 py-3 text-sm">
              <span className="flex items-center gap-2 font-medium text-teal">
                <Tag className="size-4" /> {quote.promoCode} applied: {quote.discountPercent}% off
              </span>
              <button type="button" onClick={() => applyCode("")} className="text-charcoal/60 hover:text-plum" aria-label="Remove code">
                <X className="size-4" />
              </button>
            </div>
          ) : codeOpen ? (
            <div>
              <div className="flex gap-2">
                <input
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (codeInput.trim()) applyCode(codeInput.trim());
                    }
                  }}
                  placeholder="Promo code"
                  aria-label="Promo code"
                  className={inputClass(codeError)}
                />
                <Button type="button" variant="plum" disabled={codeBusy || !codeInput.trim()} onClick={() => applyCode(codeInput.trim())}>
                  {codeBusy ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
                </Button>
              </div>
              {codeError && <p className="mt-1 text-sm font-medium text-coral">{codeError}</p>}
            </div>
          ) : (
            <button type="button" onClick={() => setCodeOpen(true)} className="text-sm font-medium text-teal underline underline-offset-4">
              Have a promo code?
            </button>
          )}
        </div>

        {/* totals */}
        <div className="mt-6 space-y-2 rounded-2xl bg-cream p-4 text-sm">
          {quote.offerActive && (
            <div className="flex justify-between text-charcoal/60">
              <span>Regular price</span>
              <s>{formatINR(quote.regularPrice)}</s>
            </div>
          )}
          <div className="flex justify-between">
            <span>{quote.offerActive ? "Offer price" : "Price"}</span>
            <span>{formatINR(quote.listPrice)}</span>
          </div>
          {quote.discount > 0 && (
            <div className="flex justify-between text-teal">
              <span>Promo code ({quote.promoCode})</span>
              <span>−{formatINR(quote.discount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-plum/10 pt-2 text-base font-semibold text-plum">
            <span>Total</span>
            <span>{formatINR(quote.total)}</span>
          </div>
        </div>

        {formError && <p className="mt-5 rounded-xl bg-blush p-3 text-sm font-medium text-plum">{formError}</p>}

        <Button type="submit" size="lg" className="mt-6 w-full" disabled={busy}>
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-5" />}
          Pay {formatINR(quote.total)}
        </Button>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-charcoal/65">
          <span className="flex items-center gap-1">
            <ShieldCheck className="size-4 text-teal" /> 100% secure
          </span>
          <span>UPI · Cards · Netbanking · Wallets</span>
        </div>
        <p className="mt-4 text-center text-xs leading-relaxed text-charcoal/55">
          If you add your city, your first name and city may appear in our &ldquo;recent purchases&rdquo; notice. We never show
          your surname, email or phone.
        </p>
        {paymentMode !== "live" && (
          <p className="mt-4 rounded bg-sand p-2 text-center font-mono text-[11px]">
            {paymentMode === "test"
              ? "TEST MODE: use Razorpay test cards or UPI (success@razorpay). No real money is charged."
              : "DEMO MODE: no payment gateway connected. No real money is charged."}
          </p>
        )}
      </form>

      {/* processing modal */}
      <AnimatePresence>
        {step >= 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-plum/60 p-4 backdrop-blur-sm"
            role="dialog"
            aria-live="polite"
          >
            <motion.div initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-sm rounded-3xl bg-cream p-7 shadow-lift">
              <motion.div
                className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-lavender"
                animate={{ rotate: step < processingSteps.length ? [0, 90, 180, 270, 360] : 0 }}
                transition={{ duration: 2, repeat: step < processingSteps.length ? Infinity : 0, ease: "easeInOut" }}
              >
                <LogoMark className="size-10" />
              </motion.div>
              <ul className="space-y-3">
                {processingSteps.map((s, i) => (
                  <li key={s} className={`flex items-center gap-3 font-medium text-plum transition-opacity ${i <= step ? "opacity-100" : "opacity-30"}`}>
                    <span className={`grid size-6 place-items-center rounded-full ${i < step ? "bg-teal text-cream" : "bg-lavender text-plum"}`}>
                      {i < step ? <Check className="size-3.5" strokeWidth={4} /> : i === step ? <Loader2 className="size-3.5 animate-spin" /> : null}
                    </span>
                    {s}
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
