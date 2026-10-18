import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Quick-order bonus window: when a visitor first lands on a product page, the server records the
 * time in a signed cookie. Orders placed within the configured minutes include the bonus;
 * reloading or editing the cookie can't extend the window.
 */

const COOKIE_DAYS = 30;
const cookieName = (productId: string) => `pt_offer_${productId}`;
const secret = () => process.env.PAYLOAD_SECRET || "dev-secret-change-me";
const sign = (productId: string, startMs: number) =>
  createHmac("sha256", secret()).update(`offer:${productId}:${startMs}`).digest("hex").slice(0, 32);

function parse(productId: string, value: string | undefined): number | null {
  if (!value) return null;
  const [startStr, sig] = value.split(".");
  const start = Number(startStr);
  if (!Number.isFinite(start) || !sig || start > Date.now() + 60_000) return null;
  const expected = Buffer.from(sign(productId, start));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? start : null;
}

/** When this visitor's bonus window started, or null for a first-time visitor. */
export async function readVisitorStart(productId: string) {
  const jar = await cookies();
  return parse(productId, jar.get(cookieName(productId))?.value);
}

/** Starts this visitor's bonus window if it hasn't started yet. Only callable from route handlers. */
export async function ensureVisitorStart(productId: string) {
  const existing = await readVisitorStart(productId);
  if (existing) return existing;
  const start = Date.now();
  const jar = await cookies();
  jar.set(cookieName(productId), `${start}.${sign(productId, start)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_DAYS * 86_400,
  });
  return start;
}
