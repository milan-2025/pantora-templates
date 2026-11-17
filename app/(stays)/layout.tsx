import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, Poppins } from "next/font/google";
import "./stays.css";

const dmSerif = DM_Serif_Display({ variable: "--font-dm-serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
};

export const viewport: Viewport = { themeColor: "#FBF5EA", width: "device-width", initialScale: 1 };

/** Root layout for the stays section (/stays, /stay/…): its own shell so the main site is untouched. */
export default function StaysLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <body className={`${dmSerif.variable} ${poppins.variable} font-sans antialiased min-h-dvh`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
