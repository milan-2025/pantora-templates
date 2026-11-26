import { NextResponse, type NextRequest } from "next/server";
import { getPayloadClient } from "@/lib/cms/queries";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import {
  HostBookError, addIdPhoto, attachFile, bootstrap, checkinSign, checkinSubmit, checkinView, checkout, completeTask, ctxFor, deleteRecord, emailOf, fileLink,
  idLinks, linkStaysHost, meView, ownAccount, passwordLogin, publicPlans, quote, refreshedToken, removeIdPhoto, runCron, saveRecord, setMyPassword,
  signFile, signIdUpload, startLogin, syncNow, updateAccount, verifyCheckout, verifyLogin,
} from "@/lib/hostbook/server";
import { dbs, hostFrom } from "@/lib/stays/server";

/**
 * Every API call of Pandora HostBook (/hostbook), in one file: /api/hostbook/<path>.
 * Signed-in calls send "Authorization: Bearer <token>" and, for people on more than one team, "x-hb-account: <id>".
 */

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path?: string[] }> };
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- request bodies are checked field by field in lib/hostbook/server
type Body = Record<string, any>;

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });

async function readBody(req: Request): Promise<Body> {
  if (req.method === "GET") return {};
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") throw new HostBookError("Invalid request");
  return b as Body;
}
function limit(req: Request, key: string, n: number, ms: number) {
  if (!rateLimit(`hostbook-${key}:${clientIp(req)}`, n, ms)) throw new HostBookError("Too many requests. Please wait a minute.", 429);
}

async function handle(req: NextRequest, ctx: Ctx) {
  const path = ((await ctx.params).path ?? []).join("/");
  const m = req.method;
  const url = new URL(req.url);
  const payload = await getPayloadClient();
  const b = await readBody(req);

  /* ----- open to everyone ----- */
  if (path === "auth/start" && m === "POST") {
    limit(req, "code", 8, 15 * 60_000);
    if (!rateLimit(`hostbook-code-email:${String(b.email).toLowerCase()}`, 4, 15 * 60_000)) throw new HostBookError("We just sent a code to this email. Please check your inbox (and spam).", 429);
    const r = await startLogin(payload, b.email);
    return { ok: true, email: r.email, ...(r.devCode ? { devCode: r.devCode } : {}) };
  }
  if (path === "auth/verify" && m === "POST") {
    limit(req, "verify", 20, 15 * 60_000);
    const r = await verifyLogin(payload, b.email, b.code);
    // A new sign-up gets its own account, unless they were invited as staff (then they land on that team).
    if (b.signup === true) await ownAccount(payload, r.email, true, { business: String(b.business ?? "").slice(0, 120), phone: String(b.phone ?? "").replace(/[^\d+ ]/g, "").slice(0, 20), source: String(b.source ?? "").slice(0, 80) });
    return r;
  }
  if (path === "auth/password" && m === "POST") {
    limit(req, "pw", 20, 15 * 60_000);
    if (!rateLimit(`hostbook-pw-email:${String(b.email).toLowerCase()}`, 10, 15 * 60_000)) throw new HostBookError("Too many tries. Sign in with a code, or wait a few minutes.", 429);
    return passwordLogin(payload, b.email, b.password);
  }
  if (path === "auth/stays" && m === "POST") {
    // Opened from the Pandora Stays host portal: the Stays sign-in cookie is enough.
    limit(req, "stays", 30, 15 * 60_000);
    const actor = await hostFrom(req, await dbs());
    if (!actor || actor.role !== "host") throw new HostBookError("Please sign in to the Stays host portal first", 401);
    return linkStaysHost(payload, actor.host);
  }
  if (path === "plans" && m === "GET") return publicPlans(payload);
  if (path.startsWith("checkin/")) {
    const code = path.split("/")[1];
    const sub = path.split("/")[2] ?? "";
    if (m === "GET" && !sub) { limit(req, "ci-view", 120, 15 * 60_000); return checkinView(payload, code); }
    if (m === "POST" && sub === "sign") { limit(req, "ci-sign", 40, 60 * 60_000); return checkinSign(payload, code); }
    if (m === "POST" && sub === "submit") { limit(req, "ci-submit", 15, 60 * 60_000); return checkinSubmit(payload, code, b); }
  }
  if (path === "cron") {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) throw new HostBookError("Not allowed", 401);
    return runCron(payload, { daily: url.searchParams.get("daily") === "1" });
  }

  /* ----- signed in ----- */
  const email = emailOf(req);
  if (!email) throw new HostBookError("Please sign in again", 401);
  const c = await ctxFor(payload, email, req.headers.get("x-hb-account"));

  switch (`${m} ${path}`) {
    case "GET me": {
      const out = await meView(payload, c);
      const token = refreshedToken(req, email);
      return { ...out, ...(token ? { token } : {}) };
    }
    case "GET items": return bootstrap(payload, c, Number(url.searchParams.get("since") ?? 0));
    case "POST items": limit(req, "save", 300, 60_000); return { item: await saveRecord(payload, c, b.kind, b.id, b.data ?? {}) };
    case "DELETE items": limit(req, "del", 120, 60_000); return deleteRecord(payload, c, b.id);
    case "POST tasks/done": limit(req, "done", 200, 60_000); return completeTask(payload, c, b.id, b);
    case "POST account": limit(req, "acct", 30, 60_000); return updateAccount(payload, c, b);
    case "POST password": limit(req, "setpw", 10, 15 * 60_000); return setMyPassword(payload, email, b.password, b.remove === true);
    case "POST sync": limit(req, "sync", 10, 15 * 60_000); return syncNow(payload, c);
    case "POST ids/sign": limit(req, "id-sign", 60, 60 * 60_000); return signIdUpload(payload, c, b.guestId);
    case "POST ids/add": return { item: await addIdPhoto(payload, c, b.guestId, b.publicId, b.side) };
    case "POST ids/remove": return { item: await removeIdPhoto(payload, c, b.guestId, b.publicId) };
    case "POST ids/links": limit(req, "id-view", 120, 15 * 60_000); return idLinks(payload, c, b.guestId);
    case "POST files/sign": limit(req, "file-sign", 60, 60 * 60_000); return signFile(payload, c, b.kind);
    case "POST files/add": return { item: await attachFile(payload, c, b.id, b.publicId, b.name) };
    case "POST files/link": limit(req, "file-view", 120, 15 * 60_000); return fileLink(payload, c, b.id, b.publicId);
    case "POST checkout": {
      limit(req, "order", 15, 60_000);
      if (b.quoteOnly) {
        const q = await quote(payload, c, b.plan, b.extra, b.coupon);
        return { total: q.total, amount: q.amount, discount: q.discount, label: q.label, kind: q.kind, expiresAt: q.expiresAt, name: q.plan.name };
      }
      return checkout(payload, c, b);
    }
    case "POST checkout/verify": limit(req, "verify-pay", 20, 60_000); return verifyCheckout(payload, c, b);
  }
  throw new HostBookError("Not found", 404);
}

const wrap = async (req: NextRequest, ctx: Ctx) => {
  try {
    const out = await handle(req, ctx);
    return out instanceof Response ? out : json(out);
  } catch (e) {
    if (e instanceof HostBookError) return json({ error: e.message, ...e.extra }, e.status);
    console.error("[hostbook-api]", e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
};

export const GET = wrap;
export const POST = wrap;
export const PUT = wrap;
export const DELETE = wrap;
