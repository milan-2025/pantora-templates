/**
 * Past buyer offers: people who bought the Wedding Planner Sheet get one email about the Online Wedding Planner,
 * and Workout Challenge Tracker buyers one about Pandora Workout, each with a coupon code from the admin
 * (Settings → Past buyer offers). Sent once per person and campaign, in daily batches (the invite reminders cron),
 * never to someone who unsubscribed or already uses the app, and only while the code is valid.
 *
 * Unsubscribe links are signed (HMAC with PAYLOAD_SECRET), so nobody can unsubscribe someone else.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Payload } from "payload";
import { sendWithBrevo } from "@/lib/brevo";
import { findAffiliate } from "@/lib/pricing";

export type CampaignKey = "planner" | "workout";
type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const CAMPAIGNS: Record<CampaignKey, { product: string; label: string; appUrl: string; codeKind: string }> = {
  planner: { product: "wedding_planner_sheet", label: "Wedding Planner Sheet buyers → Online Wedding Planner", appUrl: "/planner", codeKind: "planner" },
  workout: { product: "workout_challange", label: "Workout Challenge Tracker buyers → Pandora Workout", appUrl: "/workout", codeKind: "workout" },
};

const site = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const secret = () => `${process.env.PAYLOAD_SECRET || "dev-secret-change-me"}:unsubscribe`;
const norm = (e: unknown) => String(e ?? "").trim().toLowerCase();
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const unsubscribeSig = (email: string) => createHmac("sha256", secret()).update(norm(email)).digest("base64url").slice(0, 22);
export function checkUnsubscribeSig(email: string, sig: string) {
  const a = Buffer.from(unsubscribeSig(email)), b = Buffer.from(String(sig));
  return a.length === b.length && timingSafeEqual(a, b);
}
export const unsubscribeUrl = (email: string) => `${site()}/api/email/unsubscribe?e=${encodeURIComponent(norm(email))}&s=${unsubscribeSig(email)}`;

async function db(payload: Payload) {
  const d = (payload.db as unknown as { connection: { db: { collection: (n: string) => Doc } } }).connection.db;
  return { sent: d.collection("buyer_offer_sent"), optouts: d.collection("email_optouts") };
}

export async function optOut(payload: Payload, email: string) {
  const { optouts } = await db(payload);
  await optouts.updateOne({ _id: norm(email) }, { $setOnInsert: { at: new Date() } }, { upsert: true });
}

export type OfferSettings = { on: boolean; dailyLimit: number; plannerOn: boolean; plannerCode: string; plannerOffer: string; workoutOn: boolean; workoutCode: string; workoutOffer: string };

export async function getOfferSettings(payload: Payload): Promise<OfferSettings> {
  const g = ((await payload.findGlobal({ slug: "buyer-offers" as never, depth: 0, overrideAccess: true }).catch(() => ({}))) ?? {}) as Doc;
  return {
    on: g.on === true, dailyLimit: Math.max(1, Math.min(280, Number(g.dailyLimit) || 100)),
    plannerOn: g.plannerOn === true, plannerCode: String(g.plannerCode ?? "").trim().toUpperCase(), plannerOffer: String(g.plannerOffer ?? "").trim(),
    workoutOn: g.workoutOn === true, workoutCode: String(g.workoutCode ?? "").trim().toUpperCase(), workoutOffer: String(g.workoutOffer ?? "").trim(),
  };
}

/** Whether a campaign can send: switched on, with a code that exists, is active and covers the app. */
export async function campaignStatus(payload: Payload, s: OfferSettings, key: CampaignKey): Promise<{ ready: boolean; why: string }> {
  const on = key === "planner" ? s.plannerOn : s.workoutOn;
  const code = key === "planner" ? s.plannerCode : s.workoutCode;
  const offer = key === "planner" ? s.plannerOffer : s.workoutOffer;
  if (!on) return { ready: false, why: "Campaign is switched off" };
  if (!code) return { ready: false, why: "No coupon code set" };
  if (!offer) return { ready: false, why: "Write what the code gives (shown in the email)" };
  const a = (await findAffiliate(payload, code)) as Doc | null;
  if (!a) return { ready: false, why: `Code ${code} doesn't exist, is switched off or has ended (Shop → Affiliates)` };
  const covers = a.appliesTo !== "listed" || (Array.isArray(a.productDeals) && a.productDeals.some((d: Doc) => d.kind === CAMPAIGNS[key].codeKind));
  if (!covers) return { ready: false, why: `Code ${code} doesn't have a deal for the ${key === "planner" ? "planner plans" : "workout plans"}` };
  return { ready: true, why: "" };
}

/** Everyone who bought the campaign's sheet and should get the email now (oldest buyers first is not needed: any order). */
export async function recipients(payload: Payload, key: CampaignKey, limit = 10_000): Promise<{ email: string; name: string }[]> {
  const product = (await payload.find({ collection: "products", where: { slug: { equals: CAMPAIGNS[key].product } }, limit: 1, depth: 0, overrideAccess: true })).docs[0];
  if (!product) return [];
  const orders = await payload.find({ collection: "orders", where: { and: [{ product: { equals: product.id } }, { paymentStatus: { equals: "paid" } }] }, limit: 20_000, depth: 0, overrideAccess: true, select: { email: true, customerName: true } as never });
  const seen = new Map<string, string>();
  for (const o of orders.docs as Doc[]) {
    const e = norm(o.email);
    if (e && !seen.has(e)) seen.set(e, String(o.customerName ?? "").split(" ")[0]);
  }
  if (!seen.size) return [];
  const emails = [...seen.keys()];
  const { sent, optouts } = await db(payload);
  const [done, out] = await Promise.all([
    sent.find({ _id: { $in: emails.map((e) => `${key}:${e}`) } }).toArray() as Promise<Doc[]>,
    optouts.find({ _id: { $in: emails } }).toArray() as Promise<Doc[]>,
  ]);
  const skip = new Set<string>([...done.map((d) => String(d._id).slice(key.length + 1)), ...out.map((d) => String(d._id))]);
  // People who already use the app don't need the offer.
  const users = key === "planner"
    ? ((await payload.find({ collection: "planners", where: { ownerEmail: { in: emails } }, limit: 20_000, depth: 0, overrideAccess: true })).docs as Doc[]).map((d) => norm(d.ownerEmail))
    : ((await payload.find({ collection: "workout-profiles" as never, where: { email: { in: emails } } as never, limit: 20_000, depth: 0, overrideAccess: true })).docs as Doc[]).map((d) => norm(d.email));
  for (const u of users) skip.add(u);
  return emails.filter((e) => !skip.has(e)).slice(0, limit).map((email) => ({ email, name: seen.get(email) ?? "" }));
}

const shell = (body: string, email: string) =>
  `<!doctype html><html><body style="margin:0;background:#FBF5EA;font-family:Arial,Helvetica,sans-serif;color:#2A2A2A"><div style="max-width:540px;margin:0 auto;padding:32px 20px"><div style="background:#FFFDF8;border:1px solid #EBE2EF;border-radius:24px;padding:28px;line-height:1.55">${body}</div><p style="text-align:center;font-size:12px;color:#888;line-height:1.6">You're getting this because you bought from Pandora Templates.<br><a href="${esc(unsubscribeUrl(email))}" style="color:#888">Unsubscribe from offers</a> · pandoratemplates.com</p></div></body></html>`;
const btn = (href: string, text: string) => `<a href="${esc(href)}" style="display:inline-block;padding:13px 24px;background:#3B1F4A;color:#fff;border-radius:999px;text-decoration:none;font-weight:bold">${esc(text)}</a>`;
const codeBox = (code: string, offer: string) => `<div style="margin:18px 0;padding:14px 16px;border:2px dashed #F2A93B;border-radius:16px;background:#FFF8EC"><div style="font-size:13px;color:#7a5a1a">Your code</div><div style="font-size:24px;font-weight:bold;letter-spacing:2px;color:#3B1F4A">${esc(code)}</div><div style="font-size:14px">${esc(offer)}</div></div>`;

/** The email for one person (also used by the admin preview). */
export function offerEmail(key: CampaignKey, to: { email: string; name: string }, code: string, offer: string) {
  const hi = to.name ? `Hi ${esc(to.name)},` : "Hi,";
  if (key === "planner") {
    const link = `${site()}/planner?v=family&code=${encodeURIComponent(code)}&utm_source=email&utm_medium=buyer-offer&utm_campaign=sheet-to-planner`;
    return {
      subject: "Your wedding sheet, now online for the whole family",
      html: shell(`<p>${hi}</p>
<p>Thank you for using the Pandora Wedding Planner Sheet. Many families tell us the hardest part isn't the sheet itself: it's keeping everyone's copy up to date.</p>
<p>The <b>Online Wedding Planner</b> fixes that. Mummy, Papa and your siblings work on <b>one live plan</b> from their own phones, with:</p>
<ul style="padding-left:18px"><li>Guest list and RSVPs per function, with a digital invite</li><li>Budget, vendors and payment reminders before each one is due</li><li>Rooms, cabs, shagun and a day-of run sheet</li></ul>
<p>You can bring your filled-in sheet straight in when you start.</p>
${codeBox(code, offer)}
<p>${btn(link, "Try it free for 14 days")}</p>
<p style="font-size:13px;color:#666">No card needed for the trial. The code is filled in for you when you choose a plan.</p>`, to.email),
      text: `${hi} The Online Wedding Planner puts your whole family on one live plan. Your code ${code}: ${offer}. Try it free for 14 days: ${link}\nUnsubscribe: ${unsubscribeUrl(to.email)}`,
    };
  }
  const link = `${site()}/workout?v=streak&code=${encodeURIComponent(code)}&utm_source=email&utm_medium=buyer-offer&utm_campaign=tracker-to-app`;
  return {
    subject: "Your workout tracker, now with a coach in your pocket",
    html: shell(`<p>${hi}</p>
<p>Thank you for using the Pandora Workout Challenge Tracker. If you liked ticking off your days, you'll love <b>Pandora Workout</b>:</p>
<ul style="padding-left:18px"><li>Today's workout ready every morning, with a follow-along player</li><li>Streaks, gifts at milestones and a buddy who notices when you skip</li><li>Friends and family on the same challenge, included in yearly plans</li></ul>
<p>You can import your Excel tracker in a tap, so your days and measurements come with you.</p>
${codeBox(code, offer)}
<p>${btn(link, "Start your free challenge")}</p>
<p style="font-size:13px;color:#666">Your first challenge is free. The code is filled in for you when you upgrade.</p>`, to.email),
    text: `${hi} Pandora Workout gives you today's workout, streaks and friends. Your code ${code}: ${offer}. Start free: ${link}\nUnsubscribe: ${unsubscribeUrl(to.email)}`,
  };
}

/** Sends today's batch across both campaigns, up to the daily limit. Returns what happened, per campaign. */
export async function sendBuyerOffers(payload: Payload, opts: { max?: number } = {}) {
  const s = await getOfferSettings(payload);
  if (!s.on) return { skipped: "Sending is off" } as const;
  let left = Math.min(opts.max ?? s.dailyLimit, s.dailyLimit);
  const { sent } = await db(payload);
  const out: Record<string, { sent: number; failed: number; note?: string }> = {};
  for (const key of Object.keys(CAMPAIGNS) as CampaignKey[]) {
    const st = await campaignStatus(payload, s, key);
    if (!st.ready) { out[key] = { sent: 0, failed: 0, note: st.why }; continue; }
    const code = key === "planner" ? s.plannerCode : s.workoutCode, offer = key === "planner" ? s.plannerOffer : s.workoutOffer;
    let ok = 0, bad = 0;
    for (const r of await recipients(payload, key, left)) {
      if (left <= 0) break;
      // Claim first, so two runs at once can never email the same person twice.
      try { await sent.insertOne({ _id: `${key}:${r.email}`, at: new Date(), code }); } catch { continue; }
      const m = offerEmail(key, r, code, offer);
      const res = await sendWithBrevo({ to: [{ email: r.email, name: r.name || undefined }], subject: m.subject, html: m.html, text: m.text }).catch(() => ({ sent: false }));
      if (res.sent) { ok++; left--; } else { bad++; await sent.deleteOne({ _id: `${key}:${r.email}` }); if (bad >= 3) break; }
    }
    out[key] = { sent: ok, failed: bad };
  }
  return out;
}
