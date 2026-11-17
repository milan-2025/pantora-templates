/** Helpers for the Stays API tests: real route handlers, in-memory database, fake admin sign-in. */
import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { makeFakeDb } from "./fakeMongo";

process.env.PAYLOAD_SECRET = "test-secret";
process.env.CLOUDINARY_URL = "cloudinary://key123:cloudsecret456@democloud";

export const fake = makeFakeDb();
export const ADMIN_COOKIE = "payload-token=admin-ok";
/** Stand-in for getPayloadClient(): the database, plus Payload's auth() that recognises one admin cookie. */
export const mockPayload = async () => ({
  db: { connection: { db: fake } },
  auth: async ({ headers }: { headers: Headers }) => ({
    user: (headers.get("cookie") || "").includes("payload-token=admin-ok") ? { id: "admin1", email: "owner@site.in", name: "Owner", collection: "users" } : null,
  }),
});

type Route = { GET: (r: NextRequest) => Promise<Response>; POST: (r: NextRequest) => Promise<Response> };
const routes: Record<string, Route> = {};
export async function loadRoutes() {
  routes.public = (await import("../app/api/stays/public/route")) as unknown as Route;
  routes.host = (await import("../app/api/stays/host/route")) as unknown as Route;
  routes.admin = (await import("../app/api/stays/admin/route")) as unknown as Route;
}

let ip = 1;
export async function call(api: "public" | "host" | "admin", a: string, opts: { body?: unknown; cookie?: string; query?: string; method?: string; origin?: string } = {}) {
  const method = opts.method ?? (opts.body !== undefined ? "POST" : "GET");
  const req = new NextRequest(`http://localhost/api/stays/${api}?a=${a}${opts.query || ""}`, {
    method,
    body: method === "POST" ? JSON.stringify(opts.body ?? {}) : undefined,
    headers: { host: "localhost", "x-forwarded-for": `10.9.${Math.floor(ip / 250)}.${ip++ % 250}`, ...(opts.cookie ? { cookie: opts.cookie } : {}), ...(opts.origin ? { origin: opts.origin } : {}) },
  });
  const res = await (method === "POST" ? routes[api].POST(req) : routes[api].GET(req));
  const raw = await res.text();
  let json: any = {};
  try { json = JSON.parse(raw); } catch { /* not json */ }
  return { status: res.status, json, raw, setCookie: res.headers.get("set-cookie") || "" };
}

export const admin = {
  get: (a: string, query = "") => call("admin", a, { cookie: ADMIN_COOKIE, query }),
  post: (a: string, body: unknown) => call("admin", a, { cookie: ADMIN_COOKIE, body }),
};
export type HostSess = { cookie: string; id: string };
export const asHost = (h: HostSess) => ({
  get: (a: string, query = "") => call("host", a, { cookie: h.cookie, query }),
  post: (a: string, body: unknown) => call("host", a, { cookie: h.cookie, body }),
});
export async function registerHost(name: string, email: string): Promise<HostSess> {
  const r = await call("host", "register", { body: { name, email, phone: "9876500000", password: "password123" } });
  if (r.status !== 200) throw new Error("register failed: " + r.raw);
  return { cookie: r.setCookie.split(";")[0], id: r.json.host.id };
}

/** What Cloudinary would return after a signed upload into the property's folder. */
export function fakeUpload(propertyId: string, name: string, type: "image" | "video" = "image", extra: Record<string, unknown> = {}) {
  const public_id = `stays/${propertyId}/${name}`;
  const version = "1700000000";
  const signature = crypto.createHash("sha1").update(`public_id=${public_id}&version=${version}cloudsecret456`).digest("hex");
  return {
    public_id, version, signature, resource_type: type, width: 1600, height: 1200, bytes: 400_000,
    secure_url: `https://res.cloudinary.com/democloud/${type}/upload/v${version}/${public_id}.${type === "video" ? "mp4" : "jpg"}`, ...extra,
  };
}

/** A complete property as the admin form would send it. */
export const fullListing = (over: Record<string, unknown> = {}) => ({
  title: "Sea Breeze 2BHK", shortDescription: "Bright flat with a balcony", description: "Two bedrooms, fast Wi-Fi.",
  propertyType: "2BHK", category: "Family stay",
  location: { address: "Flat 1202, Tower B, Palm Society, 14 Hidden Lane", society: "Palm Society", street: "14 Hidden Lane", locality: "Sector 70", city: "Mohali", state: "Punjab", pin: "160071", lat: 30.70123, lng: 76.71456, mapsUrl: "" },
  rooms: { bedrooms: 2, bathrooms: 2, beds: 3, maxGuests: 5 },
  amenities: ["wifi", "ac", "pool"], features: ["Mountain view"],
  policies: { checkIn: "13:00", checkOut: "11:00", rules: "No loud music after 10 pm" },
  pricing: { landing: { weekday: 2000, weekend: 2500 }, listing: { weekday: 2500, weekend: 3000 } },
  airbnbUrl: "https://www.airbnb.co.in/rooms/123456789", adminNotes: "Owner prefers calls after 6pm", ownerName: "Mr Secret Owner",
  visibility: "public", showPrice: true,
  ...over,
});

/** Strings that must never appear in anything a guest can receive. */
export const SECRETS = ["Flat 1202", "Hidden Lane", "160071", "30.70123", "76.71456", "airbnb.co.in", "Owner prefers", "Mr Secret Owner", "9876500000"];
