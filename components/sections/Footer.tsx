import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Logo } from "@/components/Logo";
import type { SiteSetting } from "@/payload-types";
import { whatsappLink } from "@/lib/format";

export function Footer({ settings }: { settings: SiteSetting }) {
  const wa = whatsappLink(settings.whatsappNumber, settings.whatsappMessage);
  const links = settings.footerLinks ?? [];
  const brand = settings.brandName || "Pandora Templates";

  return (
    <footer className="bg-plum px-4 pb-28 pt-14 text-cream md:pb-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xs">
          <Logo tone="cream" />
          {settings.tagline && <p className="mt-4 text-sm text-cream/70">{settings.tagline}</p>}
          <div className="mt-5 flex gap-3">
            {settings.instagramUrl && (
              <a
                href={settings.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="grid size-10 place-items-center rounded-full bg-cream/10 transition-colors hover:bg-marigold hover:text-plum"
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
                </svg>
              </a>
            )}
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="grid size-10 place-items-center rounded-full bg-cream/10 transition-colors hover:bg-teal"
              >
                <MessageCircle className="size-5" />
              </a>
            )}
          </div>
        </div>
        {!!links.length && (
          <nav className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm text-cream/80 md:gap-x-14">
            {links.map((l) => (
              <Link key={l.url + l.label} href={l.url} className="hover:text-marigold">
                {l.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
      <div className="mx-auto mt-12 flex max-w-6xl flex-col justify-between gap-2 border-t border-cream/10 pt-6 text-xs text-cream/50 sm:flex-row">
        <span>
          © {new Date().getFullYear()} {brand}. All rights reserved.
        </span>
        <span>pandoratemplates.com</span>
      </div>
    </footer>
  );
}
