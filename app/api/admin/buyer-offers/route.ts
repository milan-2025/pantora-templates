import { getPayloadClient } from "@/lib/cms/queries";
import { sendWithBrevo } from "@/lib/brevo";
import { CAMPAIGNS, campaignStatus, getOfferSettings, offerEmail, recipients, sendBuyerOffers, type CampaignKey } from "@/lib/buyerOffers";

/**
 * Admin-only page for the past buyer offers (Settings → Past buyer offers):
 *   GET   how many people each campaign would email, whether it's ready, and a preview of the email,
 *   POST  action=test  sends both emails to the signed-in admin's own address,
 *         action=send  sends today's batch now (the daily job does the same).
 */
export const dynamic = "force-dynamic";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const page = (body: string) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Past buyer offers</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:820px;margin:30px auto;padding:0 18px;color:#2a2a2a}h1{color:#3B1F4A}.c{border:1px solid #e5dcea;border-radius:16px;padding:16px;margin:14px 0}.ok{color:#1F7A74}.bad{color:#C62828}
button{background:#F2A93B;color:#3B1F4A;border:0;border-radius:999px;padding:10px 20px;font-weight:700;cursor:pointer;margin-right:8px}iframe{width:100%;height:640px;border:1px solid #eee;border-radius:12px}a{color:#3B1F4A}</style>
<h1>Past buyer offers</h1>${body}<p><a href="/admin/globals/buyer-offers">Edit settings</a> · <a href="/admin">Back to admin</a></p>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );

async function admin(req: Request) {
  const payload = await getPayloadClient();
  const { user } = await payload.auth({ headers: req.headers });
  return { payload, user: user as { email?: string } | null };
}

export async function GET(req: Request) {
  const { payload, user } = await admin(req);
  if (!user) return new Response("Please log in to /admin first, then open this page again.", { status: 401 });
  const s = await getOfferSettings(payload);
  const parts: string[] = [`<p>Sending is <b class="${s.on ? "ok" : "bad"}">${s.on ? "on" : "off"}</b> · up to <b>${s.dailyLimit}</b> emails a day. The daily job (invite reminders cron) sends the next batch.</p>`];
  for (const key of Object.keys(CAMPAIGNS) as CampaignKey[]) {
    const st = await campaignStatus(payload, s, key);
    const list = await recipients(payload, key);
    const code = key === "planner" ? s.plannerCode : s.workoutCode, offer = key === "planner" ? s.plannerOffer : s.workoutOffer;
    const m = offerEmail(key, { email: user.email ?? "you@example.com", name: "Riya" }, code || "YOURCODE", offer || "(what the code gives)");
    parts.push(`<div class="c"><h2>${esc(CAMPAIGNS[key].label)}</h2><p>${st.ready ? `<b class="ok">Ready</b>` : `<b class="bad">Not sending:</b> ${esc(st.why)}`}</p>
<p><b>${list.length}</b> buyer${list.length === 1 ? "" : "s"} still to email (not unsubscribed, not emailed yet, not already using the app).</p>
<p>Subject: <b>${esc(m.subject)}</b></p><iframe srcdoc="${esc(m.html)}"></iframe></div>`);
  }
  parts.push(`<form method="post"><input type="hidden" name="action" value="test"><button>Send both emails to ${esc(user.email ?? "me")} as a test</button></form>
<form method="post" style="margin-top:10px" onsubmit="return confirm('Send today\\'s batch to real customers now?')"><input type="hidden" name="action" value="send"><button>Send today's batch now</button></form>`);
  return page(parts.join(""));
}

export async function POST(req: Request) {
  const { payload, user } = await admin(req);
  if (!user) return new Response("Please log in to /admin first.", { status: 401 });
  const action = new URLSearchParams(await req.text()).get("action");
  if (action === "test") {
    const s = await getOfferSettings(payload);
    const results: string[] = [];
    for (const key of Object.keys(CAMPAIGNS) as CampaignKey[]) {
      const m = offerEmail(key, { email: String(user.email), name: "" }, (key === "planner" ? s.plannerCode : s.workoutCode) || "YOURCODE", (key === "planner" ? s.plannerOffer : s.workoutOffer) || "(what the code gives)");
      const r = await sendWithBrevo({ to: [{ email: String(user.email) }], subject: `[Test] ${m.subject}`, html: m.html, text: m.text }).catch(() => ({ sent: false }));
      results.push(`${esc(CAMPAIGNS[key].label)}: ${r.sent ? "<b class=ok>sent</b>" : "<b class=bad>not sent (is BREVO_API_KEY set?)</b>"}`);
    }
    return page(`<p>${results.join("<br>")}</p><p><a href="/api/admin/buyer-offers">Back</a></p>`);
  }
  if (action === "send") {
    const r = await sendBuyerOffers(payload);
    return page(`<pre>${esc(JSON.stringify(r, null, 2))}</pre><p><a href="/api/admin/buyer-offers">Back</a></p>`);
  }
  return page("<p>Unknown action.</p>");
}
