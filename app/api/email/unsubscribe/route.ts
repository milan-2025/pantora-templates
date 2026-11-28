import { getPayloadClient } from "@/lib/cms/queries";
import { checkUnsubscribeSig, optOut } from "@/lib/buyerOffers";

/**
 * Unsubscribe from offer emails. The link is signed, so it only works for the address it was sent to.
 * GET shows a button (link scanners in mail apps open links, and must not unsubscribe people by themselves);
 * the button POSTs and records the opt-out.
 */
const page = (body: string, status = 200) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Email preferences · Pandora Templates</title>
<style>body{font:16px/1.5 system-ui,sans-serif;background:#FBF5EA;color:#2A2A2A;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px;box-sizing:border-box}main{max-width:420px;background:#FFFDF8;border:1px solid #EBE2EF;border-radius:24px;padding:28px;text-align:center}h1{color:#3B1F4A;font-size:22px}button{background:#3B1F4A;color:#fff;border:0;border-radius:999px;padding:12px 24px;font-size:16px;font-weight:600;cursor:pointer}a{color:#3B1F4A}</style><main>${body}</main>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function read(req: Request, form?: URLSearchParams) {
  const url = new URL(req.url);
  const e = (form?.get("e") ?? url.searchParams.get("e") ?? "").trim().toLowerCase();
  const s = form?.get("s") ?? url.searchParams.get("s") ?? "";
  return { e, s, ok: !!e && checkUnsubscribeSig(e, s) };
}

export async function GET(req: Request) {
  const { e, s, ok } = read(req);
  if (!ok) return page("<h1>This link doesn't work</h1><p>Use the unsubscribe link from the latest email, or write to us from the <a href=\"/contact\">contact page</a>.</p>", 400);
  return page(`<h1>Stop offer emails?</h1><p>We'll stop sending offers to <b>${esc(e)}</b>. You'll still get emails about things you buy, like receipts and sign-in codes.</p>
<form method="post"><input type="hidden" name="e" value="${esc(e)}"><input type="hidden" name="s" value="${esc(s)}"><button>Unsubscribe</button></form>`);
}

export async function POST(req: Request) {
  const form = new URLSearchParams(await req.text());
  const { e, ok } = read(req, form);
  if (!ok) return page("<h1>This link doesn't work</h1>", 400);
  await optOut(await getPayloadClient(), e);
  return page(`<h1>You're unsubscribed</h1><p>${esc(e)} won't get offer emails from Pandora Templates any more.</p><p><a href="/">Back to pandoratemplates.com</a></p>`);
}
