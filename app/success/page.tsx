import type { Metadata } from "next";
import { Suspense } from "react";
import { SuccessContent } from "./SuccessContent";
import { TrackEvent } from "@/components/TrackEvent";
import { product } from "@/lib/content";

export const metadata: Metadata = { title: `You're all set! — ${product.name}`, robots: { index: false } };

export default function SuccessPage() {
  return (
    <div className="bg-glow grid min-h-screen place-items-center px-4 py-16">
      <TrackEvent event="Purchase" />
      <Suspense>
        <SuccessContent />
      </Suspense>
    </div>
  );
}
