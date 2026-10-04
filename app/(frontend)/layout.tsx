import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, Poppins } from "next/font/google";
import "./globals.css";
import { SmoothScroll } from "@/components/SmoothScroll";
import { Pixel } from "@/components/Pixel";
import { getSettings } from "@/lib/cms/queries";

const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const brand = settings.brandName || "Pandora Templates";
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
    title: { default: brand, template: `%s | ${brand}` },
    description: settings.tagline || undefined,
    openGraph: { siteName: brand, type: "website" },
  };
}

export const viewport: Viewport = {
  themeColor: "#FBF5EA",
};

export default async function FrontendLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await getSettings();
  return (
    // suppressHydrationWarning: browser extensions (Grammarly, ColorZilla, password managers…)
    // inject attributes into <html>/<body> before React loads. This only silences attribute
    // mismatches on these two elements, not on anything inside them.
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSerif.variable} ${poppins.variable} font-sans antialiased`} suppressHydrationWarning>
        <SmoothScroll />
        <Pixel id={settings.metaPixelId} />
        {children}
      </body>
    </html>
  );
}
