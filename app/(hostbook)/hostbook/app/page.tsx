import type { Metadata } from "next";
import { HostBookApp } from "@/components/hostbook/App";
import { AppPixel } from "@/components/AppPixel";

export const metadata: Metadata = {
  title: "HostBook · Pandora Templates",
  robots: { index: false, follow: false },
  manifest: "/hostbook.webmanifest",
  appleWebApp: { capable: true, title: "HostBook", statusBarStyle: "default" },
  icons: { apple: "/hostbook-icon.svg", icon: "/hostbook-icon.svg" },
};

export default function HostBookAppPage() {
  return (
    <>
      <AppPixel product="hostbook" view={false} />
      <HostBookApp />
    </>
  );
}
