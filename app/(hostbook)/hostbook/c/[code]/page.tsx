import type { Metadata } from "next";
import { CheckinPage } from "@/components/hostbook/Checkin";

export const metadata: Metadata = { title: "Guest check-in", robots: { index: false, follow: false } };

export default async function GuestCheckin({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <CheckinPage code={code} />;
}
