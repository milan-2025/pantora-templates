import { Nav } from "@/components/sections/Nav";
import { Hero } from "@/components/sections/Hero";
import { PainPoints } from "@/components/sections/PainPoints";
import { Showcase } from "@/components/sections/Showcase";
import { Features } from "@/components/sections/Features";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Testimonials } from "@/components/sections/Testimonials";
import { Pricing } from "@/components/sections/Pricing";
import { FAQ } from "@/components/sections/FAQ";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { Footer } from "@/components/sections/Footer";
import { FloatingActions } from "@/components/ui/FloatingActions";
import { TrackEvent } from "@/components/TrackEvent";

export default function Home() {
  return (
    <>
      <TrackEvent event="ViewContent" />
      <Nav />
      <main>
        <Hero />
        <PainPoints />
        <Showcase />
        <Features />
        <HowItWorks />
        <Testimonials />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
      <FloatingActions />
    </>
  );
}
