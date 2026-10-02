import type { Metadata } from "next";
import { site, whatsappLink } from "@/lib/content";
import { Updated } from "../Updated";

export const metadata: Metadata = { title: `Refund Policy — ${site.brand}` };

export default function Refund() {
  return (
    <>
      <h1>Refund &amp; Cancellation Policy</h1>
      <Updated />
      <p>Because the product is a digital download delivered instantly, all sales are generally final once the files have been accessed.</p>
      <h2>We&apos;ll make it right</h2>
      <p>
        If the file doesn&apos;t open, is corrupted, or you were charged twice, contact us within 7 days on{" "}
        <a className="font-bold underline" href={whatsappLink()} target="_blank" rel="noopener noreferrer">WhatsApp</a>{" "}
        and we will fix the problem or issue a refund.
      </p>
      <h2>Refund timelines</h2>
      <p>Approved refunds are returned to the original payment method within 5–7 working days.</p>
    </>
  );
}
