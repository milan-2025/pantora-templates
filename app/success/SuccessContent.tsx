"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import confetti from "canvas-confetti";
import { Download, FileSpreadsheet, Mail, MessageCircle } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { LogoMark } from "@/components/Logo";
import { product, whatsappLink } from "@/lib/content";

type Order = { orderId: string; name: string; email: string };

export function SuccessContent() {
  const params = useSearchParams();
  const orderId = params.get("order") ?? "";
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("sd_order") ?? "null") as Order | null;
      if (saved?.orderId === orderId) setOrder(saved);
    } catch {}

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#3B1F4A", "#F2A93B", "#1F7A74", "#E0675A", "#FBE9C8"];
    confetti({ particleCount: 140, spread: 90, origin: { y: 0.6 }, colors });
    const t = setTimeout(() => {
      confetti({ particleCount: 70, angle: 60, spread: 70, origin: { x: 0 }, colors });
      confetti({ particleCount: 70, angle: 120, spread: 70, origin: { x: 1 }, colors });
    }, 500);
    return () => clearTimeout(t);
  }, [orderId]);

  const first = order?.name.split(" ")[0];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, rotate: -3 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 140, damping: 14 }}
      className="w-full max-w-xl rounded-4xl bg-cream p-7 text-center shadow-lift md:p-10"
    >
      <LogoMark className="mx-auto mb-5 size-20" animated />
      <h1 className="font-display text-4xl md:text-5xl">
        {first ? `Yay, ${first}!` : "Payment successful!"}
      </h1>
      <p className="mt-3 text-lg text-charcoal/80">
        Your <span className="font-semibold text-plum">{product.name}</span> is unboxed and ready to use.
      </p>

      <div className="mt-8 grid gap-4">
        <a href={product.excelDownload} download className={buttonClasses({ variant: "teal", size: "lg", className: "w-full" })}>
          <Download className="size-5" /> Download Excel file
        </a>
        <a href={product.googleSheetsCopy} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "primary", size: "lg", className: "w-full" })}>
          <FileSpreadsheet className="size-5" /> Copy to Google Sheets
        </a>
      </div>

      <div className="mt-7 flex items-start gap-3 rounded-2xl bg-lavender p-4 text-left text-sm text-charcoal">
        <Mail className="mt-0.5 size-5 shrink-0 text-coral" />
        <p>
          We&apos;ve also emailed these links to {order?.email ? <b>{order.email}</b> : "you"}. Can&apos;t find it? Check
          your Promotions or Spam folder.
        </p>
      </div>

      <div className="mt-6 flex flex-col items-center justify-center gap-3 text-sm sm:flex-row">
        <a href={whatsappLink(`Hi! I just bought the Wedding Planner (order ${orderId}) and need a little help.`)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-semibold text-teal">
          <MessageCircle className="size-4" /> Need help? WhatsApp us
        </a>
        <span className="hidden text-charcoal/30 sm:inline">·</span>
        <Link href="/" className="font-medium text-plum hover:text-teal">Back to home</Link>
      </div>
      {orderId && <p className="mt-6 font-mono text-xs text-charcoal/50">Order ID: {orderId}</p>}
    </motion.div>
  );
}
