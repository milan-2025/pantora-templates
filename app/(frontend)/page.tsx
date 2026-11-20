import type { Metadata } from "next";
import Link from "next/link";
import { getPageBySlug, getSettings } from "@/lib/cms/queries";
import { seoMetadata } from "@/lib/cms/seo";
import { RenderBlocks } from "@/components/blocks/RenderBlocks";
import { SiteShell } from "@/components/SiteShell";
import { JsonLd } from "@/components/JsonLd";
import { pageDescription } from "@/lib/cms/pageText";
import { organizationJsonLd, websiteJsonLd } from "@/lib/structuredData";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageBySlug("home");
  const settings = await getSettings();
  return {
    ...seoMetadata(page?.seo, {
      title: settings.brandName || "Pandora Templates",
      description: settings.tagline || pageDescription(page?.layout),
      path: "/",
    }),
    title: { absolute: page?.seo?.title || settings.brandName || "Pandora Templates" },
  };
}

/** The homepage is the Page with slug "home", built from blocks in the admin. */
export default async function HomePage() {
  const [page, settings] = await Promise.all([getPageBySlug("home"), getSettings()]);
  const brand = settings.brandName || "Pandora Templates";
  const structuredData = (
    <>
      <JsonLd
        data={organizationJsonLd({
          name: brand,
          description: settings.tagline,
          email: settings.supportEmail,
          sameAs: [settings.instagramUrl],
        })}
      />
      <JsonLd data={websiteJsonLd(brand)} />
    </>
  );

  if (page?.hideHeaderFooter)
    return (
      <>
        {structuredData}
        <RenderBlocks blocks={page.layout} settings={settings} title={page.title} />
      </>
    );

  return (
    <SiteShell>
      {structuredData}
      {page ? (
        <RenderBlocks blocks={page.layout} settings={settings} title={page.title} />
      ) : (
        <section className="bg-glow grid min-h-[70vh] place-items-center px-4 pt-24 text-center">
          <div>
            <h1 className="font-display text-5xl">Welcome to {settings.brandName || "Pandora Templates"}</h1>
            <p className="mt-4 text-charcoal/70">
              Create a page with the slug <code>home</code> in the{" "}
              <Link href="/admin/collections/pages" className="text-teal underline">
                admin
              </Link>{" "}
              to build this homepage.
            </p>
          </div>
        </section>
      )}
    </SiteShell>
  );
}
