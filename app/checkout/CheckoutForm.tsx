"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Check, Loader2, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LogoMark } from "@/components/Logo";
import { customerSchema, type Customer } from "@/lib/schema";
import { formatINR, product } from "@/lib/content";

type Errors = Partial<Record<keyof Customer, string>>;

const fields: { name: keyof Customer; label: string; type: string; placeholder: string; autoComplete: string; hint?: string }[] = [
  { name: "name", label: "Your name", type: "text", placeholder: "Priya Sharma", autoComplete: "name" },
  { name: "email", label: "Email", type: "email", placeholder: "priya@gmail.com", autoComplete: "email", hint: "We'll send your download links here" },
  { name: "phone", label: "WhatsApp number", type: "tel", placeholder: "98765 43210", autoComplete: "tel", hint: "Only for order support" },
];

const processingSteps = ["Securing your payment…", "Confirming with the bank…", "Preparing your sheet…"];

export function CheckoutForm() {
  const router = useRouter();
  const [values, setValues] = useState<Customer>({ name: "", email: "", phone: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(-1); // -1 = modal closed

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
        body: JSON.stringify({ customer: parsed.data }),
      });
      const order = await res.json();
      if (!res.ok) throw new Error(order.error);

      // GATEWAY CHECKOUT GOES HERE
      // For a real gateway: open its checkout widget with `order.clientData`, and in its
      // success handler call verify() with the payload it returns. The mock provider
      // just plays a short "processing" animation instead.
      let payload: Record<string, unknown> = {};
      if (order.provider === "mock") {
        for (let i = 0; i < processingSteps.length; i++) {
          setStep(i);
          await new Promise((r) => setTimeout(r, 900));
        }
        payload = { mock: true };
      }

      const vres = await fetch("/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.orderId, customer: parsed.data, payload }),
      });
      const verified = await vres.json();
      if (!vres.ok) throw new Error(verified.error);

      setStep(processingSteps.length); // all done ✓
      try {
        sessionStorage.setItem("sd_order", JSON.stringify({ orderId: order.orderId, name: parsed.data.name, email: parsed.data.email }));
      } catch {}
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
        <p className="mb-6 text-charcoal/70">Add your details and your planner will be ready in under a minute.</p>

        <div className="space-y-5">
          {fields.map((f) => (
            <div key={f.name}>
              <label htmlFor={f.name} className="mb-1.5 block text-sm font-semibold text-plum">{f.label}</label>
              <input
                id={f.name}
                name={f.name}
                type={f.type}
                autoComplete={f.autoComplete}
                placeholder={f.placeholder}
                value={values[f.name]}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                aria-invalid={!!errors[f.name]}
                className={`w-full rounded-xl border bg-cream px-4 py-3 text-base outline-none transition-all focus:border-teal focus:ring-4 focus:ring-teal/15 ${
                  errors[f.name] ? "border-coral" : "border-plum/15"
                }`}
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

        {formError && <p className="mt-5 rounded-xl bg-blush p-3 text-sm font-medium text-plum">{formError}</p>}

        <Button type="submit" size="lg" className="mt-7 w-full" disabled={busy}>
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-5" />}
          Pay {formatINR(product.price)}
        </Button>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-charcoal/65">
          <span className="flex items-center gap-1"><ShieldCheck className="size-4 text-teal" /> 100% secure</span>
          <span>UPI · Cards · Netbanking · Wallets</span>
        </div>
        {process.env.NODE_ENV === "development" && (
          <p className="mt-4 rounded bg-sand p-2 text-center font-mono text-[11px]">
            DEV: mock payment mode. No real money is charged
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
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-sm rounded-3xl bg-cream p-7 shadow-lift"
            >
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
