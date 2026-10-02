import type { Metadata } from "next";
import { site } from "@/lib/content";
import { Updated } from "../Updated";

export const metadata: Metadata = { title: `Privacy Policy — ${site.brand}` };

export default function Privacy() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <Updated />
      <h2>What we collect</h2>
      <p>When you buy, we collect your name, email address and phone number. Payment details are handled entirely by our payment partner.</p>
      <h2>How we use it</h2>
      <ul>
        <li>To deliver your purchase and send your download links.</li>
        <li>To provide support if you contact us.</li>
        <li>To measure our ads (via the Meta Pixel) so we can reach more couples like you.</li>
      </ul>
      <h2>Sharing</h2>
      <p>We never sell your data. We only share it with services that help us run the store (payment gateway, email delivery, analytics).</p>
      <h2>Your choices</h2>
      <p>You can ask us to delete your data at any time by contacting us.</p>
    </>
  );
}
