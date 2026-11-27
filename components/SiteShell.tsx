import { getCatalogue, getSettings } from "@/lib/cms/queries";
import { whatsappLink } from "@/lib/format";
import { Nav } from "@/components/sections/Nav";
import { Footer } from "@/components/sections/Footer";
import { FloatingActions } from "@/components/ui/FloatingActions";

/** Menu + footer + WhatsApp bubble around regular pages (homepage, builder pages, blog). */
export async function SiteShell({ children }: { children: React.ReactNode }) {
  const [settings, catalogue] = await Promise.all([getSettings(), getCatalogue().catch(() => [])]);
  const menu = catalogue.map((g) => ({
    label: g.category.label,
    url: g.category.url,
    accent: g.category.accent,
    items: [...g.apps, ...g.templates].map((i) => ({ title: i.title, url: i.url, kind: i.kind })),
  }));
  const cta = settings.navCta?.label && settings.navCta?.url ? { label: settings.navCta.label, url: settings.navCta.url } : null;
  return (
    <>
      <Nav links={(settings.navLinks ?? []).map((l) => ({ label: l.label, url: l.url }))} cta={cta} menu={menu} />
      <main className="min-h-[60vh]">{children}</main>
      <Footer settings={settings} catalogue={catalogue} />
      <FloatingActions whatsappHref={whatsappLink(settings.whatsappNumber, settings.whatsappMessage)} />
    </>
  );
}
