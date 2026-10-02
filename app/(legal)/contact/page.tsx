import type { Metadata } from "next";
import { site, whatsappLink } from "@/lib/content";
import { Updated } from "../Updated";

export const metadata: Metadata = { title: `Contact Us — ${site.brand}` };

export default function Contact() {
  return (
    <>
      <h1>Contact Us</h1>
      <Updated />
      <p>We usually reply within a few hours.</p>
      <ul>
        <li>
          WhatsApp:{" "}
          <a className="font-bold underline" href={whatsappLink()} target="_blank" rel="noopener noreferrer">+{site.whatsappNumber}</a>
        </li>
        <li>Email: <a className="font-bold underline" href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a></li>
        <li>
          Instagram:{" "}
          <a className="font-bold underline" href={site.instagram} target="_blank" rel="noopener noreferrer">{site.handle}</a>
        </li>
      </ul>
    </>
  );
}
