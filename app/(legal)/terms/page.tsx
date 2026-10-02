import type { Metadata } from "next";
import { site } from "@/lib/content";
import { Updated } from "../Updated";

export const metadata: Metadata = { title: `Terms & Conditions — ${site.brand}` };

export default function Terms() {
  return (
    <>
      <h1>Terms &amp; Conditions</h1>
      <Updated />
      <p>By purchasing from {site.brand} you agree to these terms.</p>
      <h2>The product</h2>
      <p>You are buying a digital spreadsheet template delivered as a downloadable Excel file and a Google Sheets copy link. No physical product is shipped.</p>
      <h2>Licence</h2>
      <ul>
        <li>For your personal, non-commercial use (you may share it with your family and wedding planning helpers).</li>
        <li>You may not resell, redistribute, or publish the template or modified versions of it.</li>
      </ul>
      <h2>Payments</h2>
      <p>Prices are in Indian Rupees (INR). Payments are processed securely by our payment partner; we never see or store your card details.</p>
      <h2>Liability</h2>
      <p>The template is a planning aid. You are responsible for checking your own figures, dates and vendor agreements.</p>
      <h2>Contact</h2>
      <p>Questions about these terms? Reach us via the <a className="font-bold underline" href="/contact">Contact page</a>.</p>
    </>
  );
}
