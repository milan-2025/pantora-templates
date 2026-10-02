import "server-only";
import { Resend } from "resend";
import { product, site } from "@/lib/content";
import type { Customer } from "@/lib/schema";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const absolute = (path: string) => (path.startsWith("http") ? path : new URL(path, site.url).toString());

function deliveryEmailHtml(customer: Customer, orderId: string) {
  const first = escapeHtml(customer.name.split(" ")[0]);
  const btn = (href: string, label: string, bg: string, color = "#3B1F4A") =>
    `<a href="${href}" style="display:inline-block;margin:6px 0;padding:14px 22px;background:${bg};color:${color};border-radius:999px;font-weight:600;text-decoration:none">${label}</a>`;

  return `<!doctype html><html><body style="margin:0;background:#FBF5EA;font-family:Poppins,Arial,Helvetica,sans-serif;color:#2A2A2A">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="background:#FFFDF8;border:1px solid #EBE2EF;border-radius:24px;padding:28px">
      <p style="margin:0 0 6px;font-size:12px;letter-spacing:3px;color:#1F7A74;font-weight:700">OPEN THE BOX</p>
      <h1 style="margin:0 0 8px;font-size:30px;color:#3B1F4A;font-family:'DM Serif Display',Georgia,serif;font-weight:400">Everything&#39;s ready, ${first}.</h1>
      <p style="font-size:16px;line-height:1.5;margin:0 0 20px">Your <b>${product.name}</b> is ready to use. Here are your links:</p>
      ${btn(absolute(product.excelDownload), "Download Excel file", "#1F7A74", "#FBF5EA")}<br/>
      ${btn(product.googleSheetsCopy, "Copy to Google Sheets", "#F2A93B")}
      <p style="font-size:14px;line-height:1.5;margin:24px 0 0">
        <b>Quick start:</b> make your copy, enter your total budget, and watch the totals update themselves.
      </p>
      <p style="font-size:14px;line-height:1.5">
        Need help? <a href="https://wa.me/${site.whatsappNumber}" style="color:#1F7A74;font-weight:700">WhatsApp us</a> anytime.
      </p>
      <p style="font-size:12px;color:#666;margin-top:24px">Order ID: ${orderId}</p>
    </div>
    <p style="text-align:center;font-size:12px;color:#666">${site.brand} · ${site.handle}</p>
  </div></body></html>`;
}

/** Emails the download links. Logs instead of sending when RESEND_API_KEY isn't set. */
export async function sendDeliveryEmail(customer: Customer, orderId: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? `${site.brand} <onboarding@resend.dev>`;
  const subject = "Your wedding planner sheet is here! 💍";

  if (!key) {
    console.log(`[email:dev] Would send "${subject}" to ${customer.email} (order ${orderId}). Set RESEND_API_KEY to send for real.`);
    return { sent: false };
  }

  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from,
    to: customer.email,
    subject,
    html: deliveryEmailHtml(customer, orderId),
  });
  if (error) {
    console.error("[email] send failed", error);
    return { sent: false };
  }
  return { sent: true };
}
