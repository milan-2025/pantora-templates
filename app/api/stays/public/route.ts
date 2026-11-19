/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Stays public API (no sign-in). Only ever returns guest-safe data built by lib/stays/views.ts.
 *   GET  ?a=settings | search | suggest | map | property&code= | share&token=
 *   POST ?a=click   (an enquiry button was pressed; logged without any personal data)
 */
import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { ENQUIRY_TYPES } from "@/lib/stays/constants";
import { cleanDate, cleanGuests, CODE_RE } from "@/lib/stays/core";
import { str } from "@/lib/stays/property";
import { destinations, parseQuery, search, suggest } from "@/lib/stays/search";
import { adminCards, amenityDefs, browsingAdmin, dbs, getSettings, listedCards, publicSettings, rid, sameOrigin } from "@/lib/stays/server";
import { guestCanView, publicProperty, type StoredProperty } from "@/lib/stays/views";

export const dynamic = "force-dynamic";

const json = (v: unknown, status = 200, cache = false) =>
  NextResponse.json(v, { status, headers: cache ? { "cache-control": "public, max-age=30, stale-while-revalidate=120", vary: "Cookie" } : { "cache-control": "no-store" } });

const privateJson = (v: unknown) => NextResponse.json(v, { headers: { "cache-control": "private, no-store", vary: "Cookie" } });

export async function GET(req: NextRequest) {
  const a = req.nextUrl.searchParams.get("a") || "";
  const c = await dbs();
  if (a === "settings") {
    const [s, am] = await Promise.all([getSettings(c), amenityDefs(c)]);
    return json({ settings: publicSettings(s), amenities: am }, 200, true);
  }
  if (["search", "suggest", "destinations", "map"].includes(a)) {
    // Admin browsing view: every property with private extras, never cached anywhere.
    const admin = await browsingAdmin(req.headers);
    const cards = admin ? await adminCards(c) : await listedCards(c);
    const out = (v: unknown) => (admin ? privateJson(v) : json(v, 200, true));
    if (a === "search") return out(search(cards, parseQuery(req.nextUrl.searchParams)));
    if (a === "suggest") return out(suggest(cards, req.nextUrl.searchParams.get("q") || ""));
    if (a === "destinations") return out(destinations(cards));
    // Map: approximate positions only (also in the admin view; exact ones are on the property page).
    const q = parseQuery(req.nextUrl.searchParams);
    const r = search(cards, { ...q, page: 1, perPage: 100000 });
    return out(r.results.filter((x) => x.approx).map((x) => ({ code: x.code, slug: x.slug, title: x.title, approx: x.approx, place: x.place, price: x.price, cover: x.cover, maxGuests: x.maxGuests, bedrooms: x.bedrooms })));
  }
  if (a === "property") {
    const code = String(req.nextUrl.searchParams.get("code") || "").toUpperCase();
    if (!CODE_RE.test(code)) return json({ error: "Not found" }, 404);
    const p: StoredProperty | null = await c.properties.findOne({ code });
    if (!p || !guestCanView(p, false)) return json({ error: "Not found" }, 404);
    return json(publicProperty(p, p.showPrice !== false, await amenityDefs(c)));
  }
  return json({ error: "Unknown request" }, 400);
}

export async function POST(req: NextRequest) {
  const a = req.nextUrl.searchParams.get("a") || "";
  if (!sameOrigin(req)) return json({ error: "Forbidden" }, 403);
  if (a !== "click") return json({ error: "Unknown request" }, 400);
  if (!rateLimit(`stay-click:${clientIp(req)}`, 40, 3600_000)) return json({ ok: true, counted: false });
  if (await browsingAdmin(req.headers)) return json({ ok: true, counted: false }); // your own clicks aren't enquiries
  const b: any = await req.json().catch(() => ({}));
  const c = await dbs();
  const type = (ENQUIRY_TYPES as readonly string[]).includes(b.type) ? b.type : "simple";
  let p: StoredProperty | null = null;
  let shareId: string | null = null;
  const code = String(b.code || "").toUpperCase();
  if (CODE_RE.test(code)) p = await c.properties.findOne({ code });
  if (b.share) {
    const sh = await c.shares.findOne({ _id: String(b.share), revoked: { $ne: true } });
    if (sh && p && sh.propertyId === p._id) shareId = sh._id;
  }
  if (p && !guestCanView(p, !!shareId)) p = null;
  if (!p && type !== "general") return json({ ok: true, counted: false });
  const g = type === "dates" ? cleanGuests(b) : null;
  await c.enquiries.insertOne({
    _id: rid(), kind: "click", type, propertyId: p?._id || null, code: p?.code || null, title: p?.title || "",
    checkIn: type === "dates" ? cleanDate(b.checkIn) : "", checkOut: type === "dates" ? cleanDate(b.checkOut) : "",
    adults: g?.adults ?? null, children: g?.children ?? null, guests: g?.guests ?? null,
    source: str(b.source, 200), shareId, status: "new", notes: "", createdAt: Date.now(), updatedAt: Date.now(),
  });
  return json({ ok: true, counted: true });
}
