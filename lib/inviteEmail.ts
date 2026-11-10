import "server-only";
import type { Payload } from "payload";
import { sendWithBrevo } from "@/lib/brevo";
import { getPlanConfig } from "@/lib/invites";
import { findAffiliate } from "@/lib/pricing";
import type { Invite } from "@/payload-types";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Link that opens the couple's draft (and pre-fills a promo code at checkout). */
export const draftLink = (invite: Pick<Invite, "slug" | "editToken">, promo?: string) =>
  `${siteUrl()}/shaadi?edit=${invite.slug}.${invite.editToken}${promo ? `&code=${encodeURIComponent(promo)}` : ""}`;

/**
 * Emails a couple about their draft invite.
 * kind "saved": "your draft is saved" (sent when they give their email).
 * kind "reminder": a nudge to finish, with an optional promo code and your own message.
 * The promo is the one typed for this send, else the default from Invite plans & prices.
 */
export async function emailCouple(payload: Payload, invite: Invite, opts: { kind: "saved" | "reminder"; promo?: string }) {
  if (!invite.contactEmail || !invite.editToken) return { sent: false };
  const cfg = await getPlanConfig(payload);
  const promoCode = opts.kind === "reminder" ? (opts.promo?.trim().toUpperCase() || cfg.reminders.promoCode) : "";
  const affiliate = promoCode ? await findAffiliate(payload, promoCode) : null;
  const pct = affiliate?.discountPercent ?? 0;
  const link = draftLink(invite, affiliate ? promoCode : undefined);
  const names = invite.names ? esc(invite.names) : "your wedding";
  const saved = opts.kind === "saved";

  const promoBox = affiliate && pct > 0
    ? `<div style="margin:18px 0;padding:14px 16px;border:1px dashed #C9972B;border-radius:14px;background:#FFF8E6;text-align:center">
         <div style="font-size:13px;color:#7A5A12">A little something to help you finish</div>
         <div style="font-size:22px;font-weight:700;margin:4px 0">${pct}% off with code ${esc(promoCode)}</div>
         <div style="font-size:12px;color:#7A5A12">It is applied automatically when you use the button below.</div></div>`
    : "";
  const note = !saved && cfg.reminders.message ? `<p style="white-space:pre-line">${esc(cfg.reminders.message)}</p>` : "";

  const html = `<!doctype html><html><body style="margin:0;background:#FBF5EA;font-family:Arial,Helvetica,sans-serif;color:#2A2A2A"><div style="max-width:520px;margin:0 auto;padding:32px 20px"><div style="background:#FFFDF8;border:1px solid #EBE2EF;border-radius:24px;padding:28px">
    <h2 style="margin:0 0 8px">${saved ? "Your invite draft is saved" : "Your invite is almost ready"}</h2>
    <p>${saved ? `We saved the invite for ${names}. Use the button to come back and keep editing any time.` : `The invite for ${names} is waiting for you. Everything you designed is saved exactly as you left it.`}</p>
    ${note}${promoBox}
    <p><a href="${link}" style="display:inline-block;padding:12px 22px;background:#3B1F4A;color:#fff;border-radius:999px;text-decoration:none;font-weight:600">${saved ? "Continue my invite" : "Finish my invite"}</a></p>
    <p style="font-size:12px;color:#666">Keep this email safe: anyone with the link can edit your draft.</p></div></div></body></html>`;

  return sendWithBrevo({ to: [{ email: invite.contactEmail }], subject: saved ? "Your wedding invite draft is saved" : "Your wedding invite is almost ready ✨", html });
}
