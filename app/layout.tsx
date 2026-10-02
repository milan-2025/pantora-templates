import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, Poppins } from "next/font/google";
import "./globals.css";
import { SmoothScroll } from "@/components/SmoothScroll";
import { Pixel } from "@/components/Pixel";
import { product, site } from "@/lib/content";

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

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: `${product.name} | ${site.brand}`,
  description: `${product.tagline} One connected sheet for budget, guests, vendors & payments. Excel + Google Sheets.`,
  openGraph: {
    title: `${product.name} | ${site.brand}`,
    description: site.promise,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#FBF5EA",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: browser extensions (Grammarly, ColorZilla, password managers…)
    // inject attributes into <html>/<body> before React loads. This only silences attribute
    // mismatches on these two elements, not on anything inside them.
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSerif.variable} ${poppins.variable} font-sans antialiased`} suppressHydrationWarning>
        <SmoothScroll />
        <Pixel />
        {children}
      </body>
    </html>
  );
}
