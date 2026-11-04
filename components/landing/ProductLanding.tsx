import { getPayloadClient } from "@/lib/cms/queries";
import { getOfferState } from "@/lib/pricing";
import { getLiveData } from "@/lib/live";
import { whatsappLink } from "@/lib/format";
import type { Product, SiteSetting } from "@/payload-types";
import { Nav } from "@/components/sections/Nav";
import { Hero } from "@/components/sections/Hero";
import { PainPoints } from "@/components/sections/PainPoints";
import { Showcase } from "@/components/sections/Showcase";
import { FeatureHighlights } from "@/components/sections/FeatureHighlights";
import { Features } from "@/components/sections/Features";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Testimonials } from "@/components/sections/Testimonials";
import { Pricing } from "@/components/sections/Pricing";
import { FAQ } from "@/components/sections/FAQ";
import { ContactSection } from "@/components/sections/ContactSection";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { Footer } from "@/components/sections/Footer";
import { FloatingActions } from "@/components/ui/FloatingActions";
import { TrackEvent } from "@/components/TrackEvent";
import { LiveDataProvider } from "./LiveData";
import { RecentPurchases } from "./OfferWidgets";
import { RefCapture } from "./RefCapture";
import { referralMaxAgeMs } from "@/lib/referral";
import { checkoutHref } from "./types";

/** The animated sales page for one product, e.g. /wedding_planner. All content comes from the admin. */
export async function ProductLanding({ product, settings }: { product: Product; settings: SiteSetting }) {
  const payload = await getPayloadClient();
  const [offer, live] = await Promise.all([getOfferState(payload, product), getLiveData(payload, product)]);
  const props = { product, offer, settings };
  const wa = whatsappLink(settings.whatsappNumber, settings.whatsappMessage);

  const links = [
    { label: "What's inside", url: "#inside" },
    { label: "Pricing", url: "#pricing" },
    ...(product.faq?.items?.length ? [{ label: "FAQ", url: "#faq" }] : []),
  ];

  return (
    <LiveDataProvider slug={product.slug} initial={live}>
      <RefCapture maxAgeSeconds={Math.round(referralMaxAgeMs(settings) / 1000)} />
      <TrackEvent event="ViewContent" value={offer.price} name={product.name} />
      <Nav links={links} cta={{ label: "Buy now", url: checkoutHref(product) }} />
      <main>
        <Hero {...props} />
        <PainPoints {...props} />
        <Showcase {...props} />
        <FeatureHighlights {...props} />
        <Features {...props} />
        <HowItWorks {...props} />
        <Testimonials
          eyebrow={product.testimonials?.eyebrow}
          heading={product.testimonials?.heading}
          items={product.testimonials?.items ?? []}
        />
        <Pricing {...props} />
        <FAQ eyebrow={product.faq?.eyebrow} heading={product.faq?.heading} items={product.faq?.items ?? []} whatsappHref={wa} />
        {product.contact?.show && (
          <ContactSection heading={product.contact.heading} text={product.contact.text} whatsappHref={wa} email={settings.supportEmail} />
        )}
        <FinalCTA {...props} />
      </main>
      <Footer settings={settings} />
      <FloatingActions whatsappHref={wa} buy={{ href: checkoutHref(product), price: live.price, label: "Get it now" }} />
      <RecentPurchases enabled={Boolean(product.showRecentPurchases)} productName={product.name} />
    </LiveDataProvider>
  );
}
