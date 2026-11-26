import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";
import type { Payload } from "payload";

/**
 * Optional passwords for the apps that sign in with an emailed code (wedding planner, workout).
 * People can always sign in with a code; once they set a password they can use either.
 * Only a salted scrypt hash is stored, in the hidden "app-passwords" collection (one row per app + email).
 */

export type PasswordApp = "planner" | "workout" | "hostbook";
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 200;
const COLL = "app-passwords" as const;
const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number }) => Promise<Buffer>;
const PARAMS = { N: 16384, r: 8, p: 1 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>;

export class PasswordError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function checkNewPassword(raw: unknown) {
  const pw = typeof raw === "string" ? raw : "";
  if (pw.length < MIN_PASSWORD) throw new PasswordError(`Use at least ${MIN_PASSWORD} characters.`);
  if (pw.length > MAX_PASSWORD) throw new PasswordError("That password is too long.");
  if (/^\s|\s$/.test(pw)) throw new PasswordError("A password can't start or end with a space.");
  return pw;
}

/** "s1$<salt>$<hash>", both base64url. */
export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const h = await scrypt(pw, salt, 32, PARAMS);
  return `s1$${salt.toString("base64url")}$${h.toString("base64url")}`;
}

export async function passwordMatches(pw: string, stored: string | null | undefined) {
  const [v, s, h] = String(stored ?? "").split("$");
  if (v !== "s1" || !s || !h) return false;
  const want = Buffer.from(h, "base64url");
  const got = await scrypt(pw, Buffer.from(s, "base64url"), want.length, PARAMS);
  return got.length === want.length && timingSafeEqual(got, want);
}

async function rowOf(payload: Payload, app: PasswordApp, email: string) {
  const r = await payload.find({ collection: COLL, where: { and: [{ app: { equals: app } }, { email: { equals: email } }] }, limit: 1, depth: 0, overrideAccess: true });
  return (r.docs[0] as Doc | undefined) ?? null;
}

export async function hasPassword(payload: Payload, app: PasswordApp, email: string) {
  return Boolean((await rowOf(payload, app, email))?.hash);
}

/** Sets or replaces the password. The caller has already checked the person is signed in as `email`. */
export async function setPassword(payload: Payload, app: PasswordApp, email: string, raw: unknown) {
  const hash = await hashPassword(checkNewPassword(raw));
  const row = await rowOf(payload, app, email);
  if (row) await payload.update({ collection: COLL, id: row.id, data: { hash, failed: 0 } as never, overrideAccess: true });
  else await payload.create({ collection: COLL, data: { app, email, hash, failed: 0 } as never, overrideAccess: true });
  return { changed: Boolean(row?.hash) };
}

export async function removePassword(payload: Payload, app: PasswordApp, email: string) {
  await payload.delete({ collection: COLL, where: { and: [{ app: { equals: app } }, { email: { equals: email } }] }, overrideAccess: true }).catch(() => null);
}

const WRONG = "That email and password don't match. Check them, or sign in with a code instead.";
const LOCK_AFTER = 10, LOCK_MINUTES = 15;

/**
 * Checks email + password. Same message whether the email has no password or the password is wrong,
 * so the form doesn't reveal who has an account. After 10 wrong tries in a row the password is paused
 * for 15 minutes (a code still works, and signing in with a code doesn't reset this).
 */
export async function checkLogin(payload: Payload, app: PasswordApp, email: string, raw: unknown) {
  const pw = typeof raw === "string" ? raw.slice(0, MAX_PASSWORD + 1) : "";
  const row = await rowOf(payload, app, email);
  if (!row?.hash) {
    await hashPassword(pw || "x"); // similar timing for unknown emails
    throw new PasswordError(WRONG, 401);
  }
  if ((row.failed ?? 0) >= LOCK_AFTER && row.lockedUntil && new Date(row.lockedUntil).getTime() > Date.now()) {
    throw new PasswordError(`Too many wrong passwords. Sign in with a code, or try again in ${LOCK_MINUTES} minutes.`, 429);
  }
  if (!pw || !(await passwordMatches(pw, row.hash))) {
    const failed = (row.lockedUntil && new Date(row.lockedUntil).getTime() <= Date.now() ? 0 : row.failed ?? 0) + 1;
    await payload.update({
      collection: COLL, id: row.id, overrideAccess: true,
      data: { failed, lockedUntil: failed >= LOCK_AFTER ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null } as never,
    });
    throw new PasswordError(WRONG, 401);
  }
  if (row.failed) await payload.update({ collection: COLL, id: row.id, data: { failed: 0, lockedUntil: null } as never, overrideAccess: true });
  return true;
}
