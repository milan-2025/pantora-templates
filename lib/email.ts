import "server-only";
import { brevoSender, sendWithBrevo } from "@/lib/brevo";
import { downloadPath, type ExtraItem } from "@/lib/deliverables";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function send({ to, subject, html, replyTo }: { to: string; subject: string; html: string; replyTo?: string }) {
  return sendWithBrevo({
    to: [{ email: to }],
    subject,
    html,
    ...(replyTo ? { replyTo: { email: replyTo } } : {}),
  });
}

const btn = (href: string, label: string, bg: string, color = "#3B1F4A") =>
  `<a href="${href}" style="display:inline-block;margin:6px 0;padding:14px 22px;background:${bg};color:${color};border-radius:999px;font-weight:600;text-decoration:none">${label}</a>`;

const shell = (inner: string) => `<!doctype html><html><body style="margin:0;background:#FBF5EA;font-family:Poppins,Arial,Helvetica,sans-serif;color:#2A2A2A">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="background:#FFFDF8;border:1px solid #EBE2EF;border-radius:24px;padding:28px">${inner}</div>
    <p style="text-align:center;font-size:12px;color:#666">Pandora Templates · pandoratemplates.com</p>
  </div></body></html>`;

/** Sends the buyer their links. The download link goes through /api/download/<orderId>, which checks payment. */
export async function sendDeliveryEmail(order: {
  orderId: string;
  customerName: string;
  email: string;
  productName: string;
  hasFile: boolean;
  googleSheetsCopyUrl?: string | null;
  /** The product's "More files & links". */
  extras?: ExtraItem[];
  supportWhatsapp?: string | null;
  /** Quick-order bonus earned with this order, if any. */
  bonus?: { title: string; hasFile: boolean; link?: string | null } | null;
  /** Upsell products bought with this order. */
  addOns?: { id: string; name: string; hasFile: boolean; googleSheetsCopyUrl?: string | null; extras?: ExtraItem[] }[];
}) {
  const first = escapeHtml(order.customerName.split(" ")[0]);
  // Each extra file goes through the paid-order check like the main download; links open directly.
  const extraButtons = (extras: ExtraItem[] | undefined, addonId?: string) =>
    (extras ?? [])
      .flatMap((x) => [
        x.hasFile
          ? btn(`${siteUrl()}${downloadPath(order.orderId, { addonId, extraId: x.id })}`, `Download ${escapeHtml(x.label)}`, "#1F7A74", "#FBF5EA")
          : "",
        x.link ? btn(escapeHtml(x.link), x.hasFile ? `Open ${escapeHtml(x.label)}` : escapeHtml(x.label), "#F2A93B") : "",
      ])
      .filter(Boolean);
  const buttons = [
    order.hasFile ? btn(`${siteUrl()}/api/download/${encodeURIComponent(order.orderId)}`, "Download your file", "#1F7A74", "#FBF5EA") : "",
    order.googleSheetsCopyUrl ? btn(order.googleSheetsCopyUrl, "Copy to Google Sheets", "#F2A93B") : "",
    ...extraButtons(order.extras),
  ]
    .filter(Boolean)
    .join("<br/>");
  const bonus = order.bonus;
  const bonusHtml = bonus
    ? `<div style="margin:22px 0 0;padding:16px;border-radius:16px;background:#FBE9C8">
        <p style="margin:0 0 8px;font-weight:700;color:#3B1F4A">🎁 Your free bonus: ${escapeHtml(bonus.title)}</p>
        ${bonus.hasFile ? btn(`${siteUrl()}/api/download/${encodeURIComponent(order.orderId)}?item=bonus`, "Download your bonus", "#3B1F4A", "#FBF5EA") : ""}
        ${bonus.link ? `<br/>${btn(bonus.link, "Open your bonus", "#F2A93B")}` : ""}
      </div>`
    : "";
  const addOnsHtml = (order.addOns ?? [])
    .map(
      (a) => `<div style="margin:14px 0 0;padding:16px;border-radius:16px;background:#EBE2EF">
        <p style="margin:0 0 8px;font-weight:700;color:#3B1F4A">➕ ${escapeHtml(a.name)}</p>
        ${a.hasFile ? btn(`${siteUrl()}/api/download/${encodeURIComponent(order.orderId)}?item=addon-${encodeURIComponent(a.id)}`, `Download ${escapeHtml(a.name)}`, "#1F7A74", "#FBF5EA") : ""}
        ${a.googleSheetsCopyUrl ? `<br/>${btn(a.googleSheetsCopyUrl, "Copy to Google Sheets", "#F2A93B")}` : ""}
        ${extraButtons(a.extras, a.id).map((b) => `<br/>${b}`).join("")}
      </div>`,
    )
    .join("");

  const html = shell(`
      <p style="margin:0 0 6px;font-size:12px;letter-spacing:3px;color:#1F7A74;font-weight:700">OPEN THE BOX</p>
      <h1 style="margin:0 0 8px;font-size:30px;color:#3B1F4A;font-family:'DM Serif Display',Georgia,serif;font-weight:400">Everything&#39;s ready, ${first}.</h1>
      <p style="font-size:16px;line-height:1.5;margin:0 0 20px">Your <b>${escapeHtml(order.productName)}</b> is ready to use. Here are your links:</p>
      ${buttons}
      ${addOnsHtml}
      ${bonusHtml}
      <p style="font-size:14px;line-height:1.5;margin:24px 0 0">
        The download link is personal to your order. If it ever stops working, just reply to this email.
      </p>
      ${
        order.supportWhatsapp
          ? `<p style="font-size:14px;line-height:1.5">Need help? <a href="${order.supportWhatsapp}" style="color:#1F7A74;font-weight:700">WhatsApp us</a> anytime.</p>`
          : ""
      }
      <p style="font-size:12px;color:#666;margin-top:24px">Order ID: ${escapeHtml(order.orderId)}</p>`);

  return send({ to: order.email, subject: `Your download is ready: ${order.productName}`, html });
}

/** Notifies the site owner about a new contact-form message. */
export async function sendContactNotification(msg: { name: string; email: string; phone?: string; message: string; page?: string }) {
  // Defaults to the sending address (the shop's own inbox).
  const to = process.env.CONTACT_TO_EMAIL || brevoSender().email;
  const html = shell(`
      <h1 style="margin:0 0 12px;font-size:24px;color:#3B1F4A">New message from ${escapeHtml(msg.name)}</h1>
      <p style="margin:0 0 4px"><b>Email:</b> ${escapeHtml(msg.email)}</p>
      ${msg.phone ? `<p style="margin:0 0 4px"><b>Phone:</b> ${escapeHtml(msg.phone)}</p>` : ""}
      ${msg.page ? `<p style="margin:0 0 12px;color:#666"><b>Page:</b> ${escapeHtml(msg.page)}</p>` : ""}
      <p style="white-space:pre-wrap;line-height:1.6;background:#FBF5EA;padding:14px;border-radius:12px">${escapeHtml(msg.message)}</p>
      <p style="font-size:13px;color:#666">Also saved in the admin under Inbox → Contact messages.</p>`);
  return send({ to, subject: `New website message from ${msg.name}`, html, replyTo: msg.email });
}
