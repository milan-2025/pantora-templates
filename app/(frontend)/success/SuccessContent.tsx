"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import confetti from "canvas-confetti";
import { Download, FileSpreadsheet, Gift, Mail, MessageCircle } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { LogoMark } from "@/components/Logo";

type Props = {
  paid: boolean;
  orderId: string;
  firstName: string;
  email: string;
  productName: string;
  productSlug: string;
  hasFile: boolean;
  googleSheetsCopyUrl: string | null;
  whatsappHref: string | null;
  bonus: { title: string; hasFile: boolean; link: string | null } | null;
};

export function SuccessContent(p: Props) {
  useEffect(() => {
    if (!p.paid || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#3B1F4A", "#F2A93B", "#1F7A74", "#E0675A", "#FBE9C8"];
    confetti({ particleCount: 140, spread: 90, origin: { y: 0.6 }, colors });
    const t = setTimeout(() => {
      confetti({ particleCount: 70, angle: 60, spread: 70, origin: { x: 0 }, colors });
      confetti({ particleCount: 70, angle: 120, spread: 70, origin: { x: 1 }, colors });
    }, 500);
    return () => clearTimeout(t);
  }, [p.paid]);

  if (!p.paid) {
    return (
      <div className="w-full max-w-xl rounded-4xl bg-cream p-7 text-center shadow-lift md:p-10">
        <LogoMark className="mx-auto mb-5 size-16" />
        <h1 className="font-display text-4xl">We couldn&apos;t find a paid order</h1>
        <p className="mt-3 text-charcoal/75">
          If you&apos;ve just paid, check your email for your links, or message us and we&apos;ll sort it out right away.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {p.whatsappHref && (
            <a href={p.whatsappHref} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "teal" })}>
              <MessageCircle className="size-4" /> WhatsApp us
            </a>
          )}
          <Link href="/" className={buttonClasses({ variant: "outline" })}>
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, rotate: -3 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 140, damping: 14 }}
      className="w-full max-w-xl rounded-4xl bg-cream p-7 text-center shadow-lift md:p-10"
    >
      <LogoMark className="mx-auto mb-5 size-20" animated />
      <h1 className="font-display text-4xl md:text-5xl">{p.firstName ? `Yay, ${p.firstName}!` : "Payment successful!"}</h1>
      <p className="mt-3 text-lg text-charcoal/80">
        <span className="font-semibold text-plum">{p.productName}</span> is unboxed and ready to use.
      </p>

      <div className="mt-8 grid gap-4">
        {p.hasFile && (
          <a href={`/api/download/${encodeURIComponent(p.orderId)}`} className={buttonClasses({ variant: "teal", size: "lg", className: "w-full" })}>
            <Download className="size-5" /> Download your file
          </a>
        )}
        {p.googleSheetsCopyUrl && (
          <a
            href={p.googleSheetsCopyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses({ variant: "primary", size: "lg", className: "w-full" })}
          >
            <FileSpreadsheet className="size-5" /> Copy to Google Sheets
          </a>
        )}
      </div>

      {p.bonus && (
        <div className="mt-6 rounded-2xl bg-sand p-5 text-left">
          <p className="flex items-center gap-2 font-semibold text-plum">
            <Gift className="size-5 text-marigold-deep" /> Your free bonus: {p.bonus.title}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            {p.bonus.hasFile && (
              <a href={`/api/download/${encodeURIComponent(p.orderId)}?item=bonus`} className={buttonClasses({ variant: "plum", className: "w-full sm:w-auto" })}>
                <Download className="size-4" /> Download bonus
              </a>
            )}
            {p.bonus.link && (
              <a href={p.bonus.link} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "outline", className: "w-full sm:w-auto" })}>
                Open bonus
              </a>
            )}
          </div>
        </div>
      )}

      <div className="mt-7 flex items-start gap-3 rounded-2xl bg-lavender p-4 text-left text-sm text-charcoal">
        <Mail className="mt-0.5 size-5 shrink-0 text-coral" />
        <p>
          We&apos;ve also emailed these links to {p.email ? <b>{p.email}</b> : "you"}. Can&apos;t find it? Check your Promotions or
          Spam folder.
        </p>
      </div>

      <div className="mt-6 flex flex-col items-center justify-center gap-3 text-sm sm:flex-row">
        {p.whatsappHref && (
          <a href={p.whatsappHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-semibold text-teal">
            <MessageCircle className="size-4" /> Need help? WhatsApp us
          </a>
        )}
        <span className="hidden text-charcoal/30 sm:inline">·</span>
        <Link href="/" className="font-medium text-plum hover:text-teal">
          Back to home
        </Link>
      </div>
      <p className="mt-6 font-mono text-xs text-charcoal/50">Order ID: {p.orderId}</p>
    </motion.div>
  );
}
