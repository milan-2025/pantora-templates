import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminApp } from "@/components/stays/admin/AdminApp";
import { adminFrom } from "@/lib/stays/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stays dashboard",
  robots: { index: false, follow: false },
  manifest: "/stays/admin.webmanifest",
  appleWebApp: { capable: true, title: "Stays", statusBarStyle: "default" },
  icons: { apple: "/stays/icon-192.png" },
};

/**
 * Admin dashboard. Uses the site's existing admin login (/admin). The page itself is only a shell: every piece of
 * data is loaded through /api/stays/admin, which checks the login on each request.
 */
export default async function StaysAdminPage() {
  const h = await headers();
  const admin = await adminFrom(new Request("http://local/stays/admin", { headers: h }));
  if (!admin) redirect("/admin/login?redirect=%2Fstays%2Fadmin");
  return <AdminApp />;
}
