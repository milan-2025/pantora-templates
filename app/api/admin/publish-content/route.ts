import { getPayloadClient } from "@/lib/cms/queries";
import { planContent } from "@/lib/content/publish";
import { CONTENT_RELEASE_ID, markContentPublished } from "@/lib/content/autoPublish";

/**
 * Admin-only page to publish the content pack (lib/content/) by hand and see exactly what happened.
 * Open https://<site>/api/admin/publish-content while logged in to /admin:
 *   GET  shows what would change (nothing is saved),
 *   POST (the button) applies it and lists every step that worked or failed.
 * Safe to run again: posts that already exist are skipped and the homepage is only rewritten if it differs.
 */
export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const page = (body: string) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Publish content pack</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:760px;margin:30px auto;padding:0 18px;color:#2a2a2a}h1{color:#3B1F4A}li{margin:4px 0}.ok{color:#1F7A74}.bad{color:#C62828}.note{color:#8a6d1f}
button{background:#F2A93B;color:#3B1F4A;border:0;border-radius:999px;padding:12px 26px;font-weight:700;font-size:16px;cursor:pointer}a{color:#3B1F4A}</style>
<h1>Content pack: ${esc(CONTENT_RELEASE_ID)}</h1>${body}<p><a href="/admin">← Back to admin</a></p>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
const list = (items: string[], cls = "") => (items.length ? `<ul>${items.map((i) => `<li class="${cls}">${esc(i)}</li>`).join("")}</ul>` : "<p>None.</p>");

async function admin(req: Request) {
  const payload = await getPayloadClient();
  const { user } = await payload.auth({ headers: req.headers });
  return { payload, user };
}

export async function GET(req: Request) {
  const { payload, user } = await admin(req);
  if (!user) return new Response("Please log in to /admin first, then open this page again.", { status: 401 });
  const plan = await planContent(payload);
  return page(
    `<h2>What will change</h2>${plan.changes.length ? list(plan.changes) : "<p class='ok'>Nothing to do: everything is already published.</p>"}` +
      (plan.notes.length ? `<h2>Notes</h2>${list(plan.notes, "note")}` : "") +
      (plan.changes.length ? `<form method="post"><button>Publish now</button></form>` : ""),
  );
}

export async function POST(req: Request) {
  const { payload, user } = await admin(req);
  if (!user) return new Response("Please log in to /admin first.", { status: 401 });
  const plan = await planContent(payload);
  const res = await plan.apply();
  if (!res.failed.length) await markContentPublished(payload, { changes: plan.changes, notes: plan.notes });
  return page(
    `<h2 class="ok">Done (${res.done.length})</h2>${list(res.done, "ok")}` +
      (res.failed.length ? `<h2 class="bad">Failed (${res.failed.length})</h2>${list(res.failed.map((f) => `${f.step}: ${f.error}`), "bad")}<p>Send this list to your developer, or press Publish again after fixing it.</p><form method="post"><button>Try again</button></form>` : "") +
      (plan.notes.length ? `<h2>Notes</h2>${list(plan.notes, "note")}` : "") +
      `<p>Pages refresh within 5 minutes. <a href="/blog">Open the blog</a> · <a href="/">Open the homepage</a></p>`,
  );
}
