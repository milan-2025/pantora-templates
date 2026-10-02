import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { site, whatsappLink } from "@/lib/content";

export function Footer() {
  return (
    <footer className="bg-plum px-4 pb-28 pt-14 text-cream md:pb-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xs">
          <Logo tone="cream" />
          <p className="mt-4 text-sm text-cream/70">Beautifully designed, ready-to-use templates for life&apos;s big projects.</p>
          <div className="mt-5 flex gap-3">
            <a href={site.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="grid size-10 place-items-center rounded-full bg-cream/10 transition-colors hover:bg-marigold hover:text-plum">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
              </svg>
            </a>
            <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="grid size-10 place-items-center rounded-full bg-cream/10 transition-colors hover:bg-teal">
              <MessageCircle className="size-5" />
            </a>
          </div>
        </div>
        <nav className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm text-cream/80 md:gap-x-14">
          <Link href="/terms" className="hover:text-marigold">Terms &amp; Conditions</Link>
          <Link href="/privacy" className="hover:text-marigold">Privacy Policy</Link>
          <Link href="/refund" className="hover:text-marigold">Refund Policy</Link>
          <Link href="/contact" className="hover:text-marigold">Contact Us</Link>
        </nav>
      </div>
      <div className="mx-auto mt-12 flex max-w-6xl flex-col justify-between gap-2 border-t border-cream/10 pt-6 text-xs text-cream/50 sm:flex-row">
        <span>© {new Date().getFullYear()} {site.brand}. All rights reserved.</span>
        <span>{site.domain}</span>
      </div>
    </footer>
  );
}
