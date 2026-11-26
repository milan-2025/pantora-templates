import type { Metadata } from "next";
import { HostBookApp } from "@/components/hostbook/App";

export const metadata: Metadata = {
  title: "HostBook · Pandora Templates",
  robots: { index: false, follow: false },
  manifest: "/hostbook.webmanifest",
  appleWebApp: { capable: true, title: "HostBook", statusBarStyle: "default" },
  icons: { apple: "/hostbook-icon.svg", icon: "/hostbook-icon.svg" },
};

export default function HostBookAppPage() {
  return <HostBookApp />;
}
