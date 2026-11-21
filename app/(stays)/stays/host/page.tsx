import type { Metadata } from "next";
import { HostApp } from "@/components/stays/host/HostApp";

export const metadata: Metadata = {
  title: "Host portal",
  robots: { index: false, follow: false },
  manifest: "/stays/host.webmanifest",
  appleWebApp: { capable: true, title: "Stays Host", statusBarStyle: "default" },
  icons: { apple: "/stays/icon-192.png" },
};

export default function HostPortalPage() {
  return <div className="min-h-dvh bg-cream"><HostApp /></div>;
}
