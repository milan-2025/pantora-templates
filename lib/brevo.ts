import type { EmailAdapter, SendEmailOptions } from "payload";

/**
 * Sends email through Brevo's transactional API (https://developers.brevo.com/reference/sendtransacemail).
 * The sender address must be verified in Brevo → Senders, Domains & Dedicated IPs.
 */

export const brevoSender = () => ({
  email: process.env.EMAIL_FROM_ADDRESS || "pandoratemplate@gmail.com",
  name: process.env.EMAIL_FROM_NAME || "Pandora Templates",
});

type Contact = { email: string; name?: string };

export async function sendWithBrevo(message: {
  to: Contact[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: Contact;
  sender?: Contact;
}): Promise<{ sent: boolean; messageId?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.log(`[email:dev] Would send "${message.subject}" to ${message.to.map((t) => t.email).join(", ")}. Set BREVO_API_KEY to send for real.`);
    return { sent: false };
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: message.sender ?? brevoSender(),
      to: message.to,
      subject: message.subject,
      ...(message.html ? { htmlContent: message.html } : {}),
      ...(message.text ? { textContent: message.text } : {}),
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
    }),
  });

  if (!res.ok) {
    // Never log the API key; Brevo's error body only says what was wrong.
    console.error(`[email] Brevo send failed (${res.status}):`, await res.text().catch(() => ""));
    return { sent: false };
  }
  const data = (await res.json().catch(() => ({}))) as { messageId?: string };
  return { sent: true, messageId: data.messageId };
}

/* ---------- Payload admin emails (e.g. "forgot password") ---------- */

type Addr = string | { name?: string; address: string };

function toContacts(value: SendEmailOptions["to"]): Contact[] {
  const list = (Array.isArray(value) ? value : value ? [value] : []) as Addr[];
  return list.flatMap((a) => {
    if (typeof a === "object") return [{ email: a.address, ...(a.name ? { name: a.name } : {}) }];
    // "Name <email>" or a comma-separated list of plain addresses
    return a.split(",").map((part) => {
      const m = part.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
      return m ? { email: m[2].trim(), ...(m[1].trim() ? { name: m[1].trim() } : {}) } : { email: part.trim() };
    });
  });
}

export const brevoAdapter: EmailAdapter = () => {
  const sender = brevoSender();
  return {
    name: "brevo",
    defaultFromAddress: sender.email,
    defaultFromName: sender.name,
    sendEmail: async (message) => {
      const replyTo = toContacts(message.replyTo as SendEmailOptions["to"])[0];
      const result = await sendWithBrevo({
        to: toContacts(message.to),
        subject: String(message.subject ?? ""),
        html: typeof message.html === "string" ? message.html : undefined,
        text: typeof message.text === "string" ? message.text : undefined,
        ...(replyTo ? { replyTo } : {}),
      });
      if (!result.sent && process.env.BREVO_API_KEY) throw new Error("Brevo could not send the email");
      return result;
    },
  };
};
