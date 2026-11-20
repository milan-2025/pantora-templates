import Link from "next/link";
import { SmartLink } from "@/components/ui/SmartLink";
import { MessageCircle } from "lucide-react";
import { Logo } from "@/components/Logo";
import type { SiteSetting } from "@/payload-types";
import { whatsappLink } from "@/lib/format";
import { getProductLinks } from "@/lib/cms/queries";
import { LANDING_PAGES } from "@/lib/siteLinks";

/**
 * Site footer. The "Products" column is built automatically (every published product + the planner, invite maker,
 * stays and CRM), so every product page is always one click from every page. "Help" is the admin's footer links.
 */
export async function Footer({ settings }: { settings: SiteSetting }) {
  const wa = whatsappLink(settings.whatsappNumber, settings.whatsappMessage);
  const helpLinks = settings.footerLinks ?? [];
  const brand = settings.brandName || "Pandora Templates";
  const products = await getProductLinks().catch(() => []);
  const productLinks = [
    ...LANDING_PAGES.map((p) => ({ label: p.label, url: p.url, title: p.description })),
    ...products.map((p) => ({ label: p.name, url: `/${p.slug}`, title: p.tagline ?? undefined })),
  ];

  return (
    <footer className="bg-plum px-4 pb-28 pt-14 text-cream md:pb-14">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
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
        <nav aria-label="Products" className="text-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-marigold">Products</p>
          <ul className="grid gap-x-8 gap-y-2 text-cream/80 sm:grid-cols-2 md:grid-cols-1">
            {productLinks.map((l) => (
              <li key={l.url}>
                <SmartLink href={l.url} title={l.title} className="hover:text-marigold">
                  {l.label}
                </SmartLink>
              </li>
            ))}
          </ul>
        </nav>
        {!!helpLinks.length && (
          <nav aria-label="Help" className="text-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-marigold">Help</p>
            <ul className="grid gap-y-2 text-cream/80">
              {helpLinks.map((l) => (
                <li key={l.url + l.label}>
                  <SmartLink href={l.url} className="hover:text-marigold">
                    {l.label}
                  </SmartLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
      <div className="mx-auto mt-12 flex max-w-6xl flex-col justify-between gap-2 border-t border-cream/10 pt-6 text-xs text-cream/50 sm:flex-row">
        <span>
          © {new Date().getFullYear()} {brand}. All rights reserved.
        </span>
        <Link href="/" className="hover:text-marigold">
          pandoratemplates.com
        </Link>
      </div>
    </footer>
  );
}
