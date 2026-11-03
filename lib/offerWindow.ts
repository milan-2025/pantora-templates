import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { bonusTiming } from "@/lib/pricing";
import type { Product } from "@/payload-types";

/**
 * Quick-order bonus window: when a visitor first lands on a product page, the server records the
 * time in a signed cookie. Orders placed within the configured minutes include the bonus;
 * reloading or editing the cookie can't extend the window. If the product's timer is set to
 * restart (e.g. 1 day after it runs out), the visitor gets a fresh window once that time has passed.
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

/** When this visitor's bonus window started, or null for a first-time visitor (or one due a fresh window). */
export async function readVisitorStart(product: Product) {
  const id = String(product.id);
  const jar = await cookies();
  const start = parse(id, jar.get(cookieName(id))?.value);
  if (!start) return null;
  const { windowMs, restartMs } = bonusTiming(product);
  // The window ran out and the restart time has passed: treat them like a new visitor.
  if (restartMs && Date.now() >= start + windowMs + restartMs) return null;
  return start;
}

/** Starts this visitor's bonus window if it hasn't started yet (or is due to restart). Only callable from route handlers. */
export async function ensureVisitorStart(product: Product) {
  const existing = await readVisitorStart(product);
  if (existing) return existing;
  const id = String(product.id);
  const start = Date.now();
  const { windowMs, restartMs } = bonusTiming(product);
  // Keep the cookie at least until the next restart, so a long restart period is still honoured.
  const maxAgeMs = Math.max(COOKIE_DAYS * 86_400_000, windowMs + (restartMs ?? 0) + 86_400_000);
  const jar = await cookies();
  jar.set(cookieName(id), `${start}.${sign(id, start)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.round(maxAgeMs / 1000),
  });
  return start;
}
