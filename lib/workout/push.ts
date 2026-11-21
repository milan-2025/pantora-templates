import "server-only";
import { createPrivateKey, generateKeyPairSync, sign } from "crypto";

/**
 * Web push without a library: a VAPID-signed, empty push. The app's offline worker wakes up, asks the server
 * what's new (/api/workout/inbox) and shows the notification. Empty pushes need no payload encryption.
 */

export type PushSub = { endpoint: string; at?: string };
export type VapidKeys = { publicKey: string; privateJwk: string };

const b64u = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function makeVapidKeys(): VapidKeys {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = privateKey.export({ format: "jwk" }) as { x: string; y: string; d: string };
  const pub = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]);
  return { publicKey: b64u(pub), privateJwk: JSON.stringify({ kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, d: jwk.d }) };
}

export function vapidJwt(keys: VapidKeys, endpoint: string, now = Date.now()) {
  const aud = new URL(endpoint).origin;
  const head = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const body = b64u(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: "mailto:support@pandoratemplates.com" }));
  const key = createPrivateKey({ key: JSON.parse(keys.privateJwk), format: "jwk" });
  const sig = sign("sha256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" });
  return `${head}.${body}.${b64u(sig)}`;
}

const ALLOWED_HOSTS = /(^|\.)(googleapis\.com|push\.apple\.com|mozilla\.com|mozaws\.net|windows\.com|notify\.windows\.com)$/;
export const validSub = (s: unknown): s is PushSub => {
  if (!s || typeof s !== "object" || typeof (s as PushSub).endpoint !== "string") return false;
  try {
    const u = new URL((s as PushSub).endpoint);
    return u.protocol === "https:" && ALLOWED_HOSTS.test(u.hostname) && u.href.length < 800;
  } catch {
    return false;
  }
};

/** Sends an empty push. Returns false when the subscription is gone (unsubscribed or expired) and should be dropped. */
export async function sendPush(keys: VapidKeys, sub: PushSub): Promise<boolean> {
  try {
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: { TTL: "43200", Urgency: "normal", Authorization: `vapid t=${vapidJwt(keys, sub.endpoint)}, k=${keys.publicKey}`, "Content-Length": "0" },
    });
    if (res.status === 404 || res.status === 410) return false;
    if (!res.ok) console.error("[workout-push]", res.status, await res.text().catch(() => ""));
    return true;
  } catch (e) {
    console.error("[workout-push]", e);
    return true;
  }
}
