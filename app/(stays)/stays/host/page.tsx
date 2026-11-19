import type { Metadata } from "next";
import { HostApp } from "@/components/stays/host/HostApp";

export const metadata: Metadata = { title: "Host portal", robots: { index: false, follow: false } };

export default function HostPortalPage() {
  return <div className="min-h-dvh bg-cream"><HostApp /></div>;
}
