"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Loader2, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";

type Status = "idle" | "sending" | "sent" | "error";

const input =
  "w-full rounded-xl border border-plum/15 bg-cream px-4 py-3 text-base outline-none transition-all focus:border-teal focus:ring-4 focus:ring-teal/15";

/** Contact form. Messages land in the admin (Inbox → Contact messages) and are emailed to the owner. */
export function ContactSection({
  heading,
  text,
  whatsappHref,
  email,
}: {
  heading?: string | null;
  text?: string | null;
  whatsappHref?: string | null;
  email?: string | null;
}) {
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, page: pathname }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Couldn't send your message");
      setStatus("sent");
      form.reset();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Couldn't send your message");
    }
  }

  return (
    <section id="contact" className="scroll-mt-16 bg-cream px-4 py-20 md:py-28">
      <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[1fr_1.2fr] md:gap-14">
        <Reveal className="min-w-0">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-teal">Contact</p>
          <h2 className="font-display text-4xl md:text-5xl">{heading || "Get in touch"}</h2>
          {text && <p className="mt-4 text-lg leading-relaxed text-charcoal/75">{text}</p>}
          <div className="mt-8 space-y-3">
            {whatsappHref && (
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 font-medium text-plum hover:text-teal">
                <span className="grid size-10 place-items-center rounded-full bg-mint text-teal">
                  <MessageCircle className="size-5" />
                </span>
                Chat on WhatsApp
              </a>
            )}
            {email && (
              <a href={`mailto:${email}`} className="flex items-center gap-3 font-medium text-plum hover:text-teal">
                <span className="grid size-10 place-items-center rounded-full bg-blush text-coral">
                  <Mail className="size-5" />
                </span>
                {email}
              </a>
            )}
          </div>
        </Reveal>

        <Reveal delay={0.1} className="min-w-0">
          <div className="card relative rounded-3xl p-6 md:p-8">
            <AnimatePresence mode="wait">
              {status === "sent" ? (
                <motion.div
                  key="sent"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-10 text-center"
                >
                  <CheckCircle2 className="mx-auto mb-4 size-14 text-teal" />
                  <h3 className="font-display text-3xl">Message sent</h3>
                  <p className="mt-2 text-charcoal/70">Thank you! We usually reply within a few hours.</p>
                  <button onClick={() => setStatus("idle")} className="mt-6 text-sm font-medium text-teal underline underline-offset-4">
                    Send another message
                  </button>
                </motion.div>
              ) : (
                <motion.form key="form" onSubmit={onSubmit} className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-semibold text-plum">Name</span>
                      <input name="name" required minLength={2} autoComplete="name" className={input} />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-semibold text-plum">Email</span>
                      <input name="email" type="email" required autoComplete="email" className={input} />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-plum">
                      Phone <span className="font-normal text-charcoal/50">(optional)</span>
                    </span>
                    <input name="phone" type="tel" autoComplete="tel" className={input} />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-plum">Message</span>
                    <textarea name="message" required minLength={5} rows={4} className={`${input} resize-y`} />
                  </label>
                  {/* honeypot: hidden from people, bots fill it in */}
                  <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
                  {status === "error" && <p className="rounded-xl bg-blush p-3 text-sm text-plum">{error}</p>}
                  <Button type="submit" size="lg" className="w-full" disabled={status === "sending"}>
                    {status === "sending" && <Loader2 className="size-5 animate-spin" />}
                    Send message
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
