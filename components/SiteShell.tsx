import { getSettings } from "@/lib/cms/queries";
import { whatsappLink } from "@/lib/format";
import { Nav } from "@/components/sections/Nav";
import { Footer } from "@/components/sections/Footer";
import { FloatingActions } from "@/components/ui/FloatingActions";

/** Menu + footer + WhatsApp bubble around regular pages (homepage, builder pages, blog). */
export async function SiteShell({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const cta = settings.navCta?.label && settings.navCta?.url ? { label: settings.navCta.label, url: settings.navCta.url } : null;
  return (
    <>
      <Nav links={(settings.navLinks ?? []).map((l) => ({ label: l.label, url: l.url }))} cta={cta} />
      <main className="min-h-[60vh]">{children}</main>
      <Footer settings={settings} />
      <FloatingActions whatsappHref={whatsappLink(settings.whatsappNumber, settings.whatsappMessage)} />
    </>
  );
}
