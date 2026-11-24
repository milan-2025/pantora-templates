import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/cms/queries";
import { getPaymentProvider } from "@/lib/payments";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { PhotosError, PHOTO_ORDER_IDS } from "@/lib/photos/routeHelpers";
import { getPhotoPlans } from "@/lib/photos/plans";
import { StorageNotConfigured, localGet, localPut } from "@/lib/photos/s3";
import {
  authorize, checkPin, createGallery, dailyCron, findGallery, finishUploads, itemAction, manageView, markPhotosPaid, passOk, publicView, quote, saveSettings,
  startAccess, startUploads, verifyAccess,
} from "@/lib/photos/server";

/**
 * Every API call of wedding photo galleries, in one file: /api/photos/<path>.
 * The couple's calls send their private key in the "x-edit-token" header; guests of a PIN-protected gallery send
 * "x-gallery-pass" (from /pin).
 */

type Ctx = { params: Promise<{ path?: string[] }> };
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- request bodies are checked field by field in lib/photos
type Body = Record<string, any>;

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });

function limit(req: Request, key: string, n: number, ms: number) {
  if (!rateLimit(`photos-${key}:${clientIp(req)}`, n, ms)) throw new PhotosError("Too many requests. Please wait a minute.", 429);
}

async function handle(req: Request, ctx: Ctx): Promise<Response> {
  const parts = (await ctx.params).path ?? [];
  const path = parts.join("/");
  const m = req.method;
  const url = new URL(req.url);

  // Local development storage (no bucket configured): uploads and downloads go through here.
  if (parts[0] === "local") {
    const key = parts.slice(1).join("/");
    if (m === "PUT") {
      const r = await localPut(key, url, await req.arrayBuffer());
      return new Response(null, { status: r.status, headers: { "access-control-allow-origin": "*" } });
    }
    const buf = await localGet(key);
    if (!buf) return new Response("Not found", { status: 404 });
    const type = key.endsWith(".jpg") ? "image/jpeg" : key.endsWith(".webm") ? "video/webm" : key.endsWith(".mov") ? "video/quicktime" : "video/mp4";
    return new Response(new Uint8Array(buf), { headers: { "content-type": type, "cache-control": "public, max-age=31536000, immutable" } });
  }

  const payload = await getPayloadClient();
  let b: Body = {};
  if (m === "POST") {
    const parsed = await req.json().catch(() => null);
    if (!parsed || typeof parsed !== "object") throw new PhotosError("Invalid request");
    b = parsed as Body;
  }

  /* ----- open to everyone ----- */
  if (path === "plans" && m === "GET") {
    const cfg = await getPhotoPlans(payload);
    return json(cfg);
  }
  if (path === "create" && m === "POST") {
    limit(req, "create", 6, 60 * 60_000);
    return json(await createGallery(payload, b));
  }
  if (path === "auth/start" && m === "POST") {
    limit(req, "code", 8, 15 * 60_000);
    if (!rateLimit(`photos-code-email:${String(b.email).toLowerCase()}`, 4, 15 * 60_000)) throw new PhotosError("We just sent a code. Please check your inbox (and spam).", 429);
    return json(await startAccess(payload, b.email));
  }
  if (path === "auth/verify" && m === "POST") {
    limit(req, "verify", 20, 15 * 60_000);
    return json(await verifyAccess(payload, b.email, b.code));
  }
  if (path === "cron" && (m === "GET" || m === "POST")) {
    const want = process.env.CRON_SECRET;
    if (!want || req.headers.get("authorization") !== `Bearer ${want}`) throw new PhotosError("Not allowed", 401);
    return json(await dailyCron(payload));
  }

  /* ----- guests: /public/<slug>[/…] ----- */
  if (parts[0] === "public" && parts[1]) {
    const g = await findGallery(payload, parts[1]);
    if (!g || g.state === "purged") throw new PhotosError("This gallery doesn't exist", 404);
    const sub = parts.slice(2).join("/");
    if (sub === "" && m === "GET") {
      limit(req, "view", 240, 60_000);
      return json(await publicView(payload, g, { pass: req.headers.get("x-gallery-pass"), album: url.searchParams.get("album"), page: Number(url.searchParams.get("page")) || 1 }));
    }
    if (sub === "pin" && m === "POST") {
      limit(req, "pin", 10, 15 * 60_000);
      return json(checkPin(g, b.pin));
    }
    if (sub === "upload" && m === "POST") {
      limit(req, "guest-upload", 10, 10 * 60_000);
      if (!passOk(g, req.headers.get("x-gallery-pass"))) throw new PhotosError("Type the gallery PIN first", 401);
      const name = String(b.name ?? "").trim().slice(0, 60);
      if (name.length < 2) throw new PhotosError("Please add your name so the couple knows who sent these");
      return json(await startUploads(payload, g, b.files, { name }));
    }
    if (sub === "done" && m === "POST") {
      limit(req, "guest-done", 30, 10 * 60_000);
      return json(await finishUploads(payload, g, b.ids, String(b.ticket ?? "")));
    }
  }

  /* ----- the couple: /manage/<slug>[/…] ----- */
  if (parts[0] === "manage" && parts[1]) {
    limit(req, "manage", 300, 60_000);
    const g = await authorize(req, payload, parts[1]);
    const sub = parts.slice(2).join("/");
    if (sub === "" && m === "GET") return json(await manageView(payload, g));
    if (sub === "settings" && m === "POST") return json(await saveSettings(payload, g, b));
    if (sub === "upload" && m === "POST") return json(await startUploads(payload, g, b.files));
    if (sub === "done" && m === "POST") return json(await finishUploads(payload, g, b.ids));
    if (sub === "items" && m === "POST") return json(await itemAction(payload, g, b));
    if (sub === "quote" && m === "POST") {
      if (!PHOTO_ORDER_IDS.includes(b.plan)) throw new PhotosError("Unknown plan");
      return json(await quote(payload, g, b.plan, typeof b.coupon === "string" && b.coupon.trim() ? b.coupon.trim().toUpperCase().slice(0, 30) : undefined));
    }
    if (sub === "checkout" && m === "POST") {
      limit(req, "order", 10, 60_000);
      if (!PHOTO_ORDER_IDS.includes(b.plan)) throw new PhotosError("Unknown plan");
      const coupon = typeof b.coupon === "string" && b.coupon.trim() ? b.coupon.trim().toUpperCase().slice(0, 30) : undefined;
      const q = await quote(payload, g, b.plan, coupon);
      const email = String(b.email ?? g.contactEmail ?? "").trim().toLowerCase();
      const order = await getPaymentProvider().createOrder({
        amount: q.total,
        currency: "INR",
        customer: { name: g.names, email, phone: String(b.phone ?? g.phone ?? ""), city: "" },
        description: b.plan === "renew" ? "Wedding photo gallery – 1 more year" : `Wedding photo gallery – ${q.name} plan`,
      });
      await payload.update({ collection: "photo-galleries", id: g.id, data: { orderId: order.orderId, orderPlan: b.plan, amount: q.total, promoCode: coupon ?? "" } as never, overrideAccess: true, depth: 0 });
      return json({ orderId: order.orderId, provider: order.provider, clientData: order.clientData ?? null, total: q.total });
    }
    if (sub === "verify" && m === "POST") {
      limit(req, "verify-pay", 20, 60_000);
      if (!g.orderId) throw new PhotosError("No payment to check", 400);
      const r = await getPaymentProvider().verify({ orderId: g.orderId, payload: b });
      if (!r.ok) throw new PhotosError("Payment could not be verified", 400);
      await markPhotosPaid(payload, g.orderId, r.paymentId);
      return json({ ok: true });
    }
  }

  throw new PhotosError("Not found", 404);
}

async function run(req: Request, ctx: Ctx) {
  try {
    return await handle(req, ctx);
  } catch (e) {
    if (e instanceof PhotosError) return json({ error: e.message }, e.status);
    if (e instanceof StorageNotConfigured) return json({ error: e.message }, 503);
    console.error("[photos-api]", e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}

export const GET = run;
export const POST = run;
export const PUT = run;
export const dynamic = "force-dynamic";
