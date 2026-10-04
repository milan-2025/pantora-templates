import { createHmac, timingSafeEqual } from "crypto";

/**
 * Short-lived signed links for paid downloads.
 * /api/download/<orderId> checks the order is paid, then redirects to the file URL
 * with ?exp=…&sig=…; the product-files collection only serves files with a valid signature.
 */
const TTL_SECONDS = 10 * 60;

const secret = () => process.env.PAYLOAD_SECRET || "dev-secret-change-me";

const sign = (filename: string, exp: number) =>
  createHmac("sha256", secret()).update(`${filename}:${exp}`).digest("hex");

export function signDownload(filename: string) {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  return { exp: String(exp), sig: sign(filename, exp) };
}

export function verifyDownload(filename: string, exp: string | null, sig: string | null) {
  if (!exp || !sig) return false;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Date.now() / 1000) return false;
  const expected = Buffer.from(sign(filename, expNum));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
