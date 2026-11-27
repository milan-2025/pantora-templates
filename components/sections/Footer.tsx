import Link from "next/link";
import { SmartLink } from "@/components/ui/SmartLink";
import { MessageCircle } from "lucide-react";
import { Logo } from "@/components/Logo";
import type { SiteSetting } from "@/payload-types";
import { whatsappLink } from "@/lib/format";
import { getCatalogue, type CatalogueGroup } from "@/lib/cms/queries";

/**
 * Site footer. One column per category (its apps and templates, built automatically from the link map and the
 * published products), so every product page is one click from every page. "Help" is the admin's footer links.
 */
export async function Footer({ settings, catalogue }: { settings: SiteSetting; catalogue?: CatalogueGroup[] }) {
  const wa = whatsappLink(settings.whatsappNumber, settings.whatsappMessage);
  const helpLinks = settings.footerLinks ?? [];
  const brand = settings.brandName || "Pandora Templates";
  const groups = (catalogue ?? (await getCatalogue().catch(() => []))).filter((g) => g.apps.length || g.templates.length);

  return (
    <footer className="bg-plum px-4 pb-28 pt-14 text-cream md:pb-14">
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_repeat(5,minmax(0,1fr))]">
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
        {groups.map(({ category: c, apps, templates }) => (
          <nav key={c.key} aria-label={c.label} className="text-sm">
            <SmartLink href={c.url} className="mb-3 block text-xs font-semibold uppercase tracking-[0.18em] text-marigold hover:text-cream">
              {c.label}
            </SmartLink>
            <ul className="grid gap-y-2 text-cream/80">
              {[...apps, ...templates].map((l) => (
                <li key={l.url}>
                  <SmartLink href={l.url} title={l.text || undefined} className="hover:text-marigold">
                    {l.title}
                  </SmartLink>
                </li>
              ))}
            </ul>
          </nav>
        ))}
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
