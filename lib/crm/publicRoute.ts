/** Shared plumbing for the public pages (/property, /unit, /catalogue). */

export const html = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": status === 200 ? "public, max-age=0, s-maxage=60, stale-while-revalidate=300" : "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
    },
  });

export const notFound = (why = "The project may have been unpublished.") =>
  html(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Not available</title><body style="font:16px system-ui;text-align:center;padding:64px 16px;color:#444"><h1 style="font-size:20px">This page is not available</h1><p>${why}</p></body>`, 404);

export const validPub = (s: string) => /^[a-f0-9]{10,40}$/.test(s);

/** A company's public pages are live only in real estate mode, while active and paid up (or on trial). */
export function wsLive(w: any): boolean {
  if (!w || w.status === "suspended" || w.mode !== "realestate") return false;
  const end = w.plan === "trial" ? w.trialEnds : w.validUntil;
  return !(w.plan !== "internal" && end && end < Date.now());
}

/** Link previews (WhatsApp, Facebook) and search crawlers are not counted as views. */
export const isBot = (req: Request) => /bot|crawl|spider|preview|facebookexternalhit|whatsapp/i.test(req.headers.get("user-agent") || "");

export const refOf = (req: Request) => new URL(req.url).searchParams.get("ref") || "";
