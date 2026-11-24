import { createHash, createHmac } from "crypto";

/**
 * Object storage for wedding photos and videos, through the S3 API. Works with Cloudflare R2 (recommended: free
 * downloads), Backblaze B2, Hetzner, Wasabi or AWS S3: only the environment variables change.
 *
 *   PHOTOS_S3_ENDPOINT   e.g. https://<account-id>.r2.cloudflarestorage.com (R2) or https://s3.us-west-004.backblazeb2.com (B2)
 *   PHOTOS_S3_REGION     "auto" for R2; the bucket's region elsewhere (e.g. us-west-004)
 *   PHOTOS_S3_BUCKET     the bucket name
 *   PHOTOS_S3_KEY_ID     access key id
 *   PHOTOS_S3_SECRET     secret access key
 *   PHOTOS_PUBLIC_URL    public address of the bucket, e.g. https://photos.pandoratemplates.com (no trailing slash)
 *
 * Browsers upload straight to the bucket with short-lived signed links (the files never pass through our server),
 * and guests load photos straight from the public address. File names contain a random part, so nobody can guess them.
 *
 * Without these variables (local development only) files are kept in ./.photos-local and served by our own API.
 */

export type S3Config = { endpoint: string; region: string; bucket: string; keyId: string; secret: string; publicUrl: string };

export function s3Config(): S3Config | null {
  const e = process.env;
  if (!e.PHOTOS_S3_ENDPOINT || !e.PHOTOS_S3_BUCKET || !e.PHOTOS_S3_KEY_ID || !e.PHOTOS_S3_SECRET) return null;
  return {
    endpoint: e.PHOTOS_S3_ENDPOINT.replace(/\/+$/, ""),
    region: e.PHOTOS_S3_REGION || "auto",
    bucket: e.PHOTOS_S3_BUCKET,
    keyId: e.PHOTOS_S3_KEY_ID,
    secret: e.PHOTOS_S3_SECRET,
    publicUrl: (e.PHOTOS_PUBLIC_URL || "").replace(/\/+$/, ""),
  };
}

/** Local folder storage is only for development: refused on the live site. */
export const localStorageAllowed = () => process.env.NODE_ENV !== "production" || process.env.PHOTOS_ALLOW_LOCAL === "true";

const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
const hmac = (k: string | Buffer, s: string) => createHmac("sha256", k).update(s).digest();
/** RFC 3986 encoding, as AWS signatures need it. */
const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
const encPath = (p: string) => p.split("/").map(enc).join("/");
export const amzDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/**
 * AWS Signature Version 4 for a link with the signature in the query string ("presigned URL").
 * `headers` are signed too (lower-case names): the uploader must send exactly these, so e.g. a signed
 * content-length stops anyone uploading a bigger file than we allowed.
 */
export function presign(opts: {
  method: string;
  host: string;
  path: string; // already the object path, e.g. /bucket/key
  region: string;
  keyId: string;
  secret: string;
  expires: number; // seconds
  headers?: Record<string, string>;
  now?: Date;
  protocol?: string;
}) {
  const now = opts.now ?? new Date();
  const datetime = amzDate(now);
  const date = datetime.slice(0, 8);
  const scope = `${date}/${opts.region}/s3/aws4_request`;
  const headers: Record<string, string> = { host: opts.host, ...(opts.headers ?? {}) };
  const names = Object.keys(headers).map((h) => h.toLowerCase()).sort();
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim()]));
  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${opts.keyId}/${scope}`,
    "X-Amz-Date": datetime,
    "X-Amz-Expires": String(opts.expires),
    "X-Amz-SignedHeaders": names.join(";"),
  };
  const qs = Object.keys(query).sort().map((k) => `${enc(k)}=${enc(query[k])}`).join("&");
  const canonical = [opts.method, encPath(opts.path), qs, names.map((n) => `${n}:${lower[n]}\n`).join(""), names.join(";"), "UNSIGNED-PAYLOAD"].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", datetime, scope, sha256(canonical)].join("\n");
  const kDate = hmac("AWS4" + opts.secret, date);
  const kSigning = hmac(hmac(hmac(kDate, opts.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", kSigning).update(toSign).digest("hex");
  return `${opts.protocol ?? "https"}://${opts.host}${encPath(opts.path)}?${qs}&X-Amz-Signature=${signature}`;
}

function objectUrl(cfg: S3Config, method: string, key: string, expires: number, headers?: Record<string, string>) {
  const u = new URL(cfg.endpoint);
  // Path-style addresses (endpoint/bucket/key) work on R2, B2, Hetzner, Wasabi and S3.
  const base = u.pathname.replace(/\/+$/, "");
  return presign({ method, host: u.host, path: `${base}/${cfg.bucket}/${key}`, region: cfg.region, keyId: cfg.keyId, secret: cfg.secret, expires, headers, protocol: u.protocol.replace(":", "") });
}

/* ---------------- what the rest of the app uses ---------------- */

const LOCAL_DIR = () => process.env.PHOTOS_LOCAL_DIR || ".photos-local";
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const localSig = (key: string, exp: number) => createHmac("sha256", `${process.env.PAYLOAD_SECRET || "dev-secret-change-me"}:photos-local`).update(`${key}:${exp}`).digest("hex").slice(0, 32);

export class StorageNotConfigured extends Error {
  constructor() {
    super("Photo storage isn't set up yet. Add the PHOTOS_S3_… settings (see docs/photos/README.md).");
  }
}

/** A link the browser can PUT one file to, valid for an hour. */
export function uploadUrl(key: string, size: number, contentType: string): string {
  const cfg = s3Config();
  if (cfg) return objectUrl(cfg, "PUT", key, 3600, { "content-length": String(size), "content-type": contentType });
  if (!localStorageAllowed()) throw new StorageNotConfigured();
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${siteUrl()}/api/photos/local/${key}?exp=${exp}&size=${size}&sig=${localSig(key, exp)}`;
}

/** Where guests load a file from. */
export function publicUrl(key: string): string {
  const cfg = s3Config();
  if (cfg) return `${cfg.publicUrl}/${key}`;
  return `/api/photos/local/${key}`;
}

/** A temporary link to read a private object (used to hand a video to Bunny Stream). */
export function readUrl(key: string, seconds = 6 * 3600) {
  const cfg = s3Config();
  if (cfg) return objectUrl(cfg, "GET", key, seconds);
  return siteUrl() + publicUrl(key);
}

/** Size of an uploaded file in bytes, or null if it isn't there. */
export async function objectSize(key: string): Promise<number | null> {
  const cfg = s3Config();
  if (!cfg) {
    const { stat } = await import("fs/promises");
    const path = await import("path");
    return stat(path.join(LOCAL_DIR(), key)).then((s) => s.size).catch(() => null);
  }
  const res = await fetch(objectUrl(cfg, "HEAD", key, 300), { method: "HEAD" });
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`Storage HEAD failed (${res.status})`);
  return Number(res.headers.get("content-length") ?? 0);
}

/** Deletes files. Missing files are fine. Runs a few at a time. */
export async function deleteObjects(keys: string[]) {
  const list = keys.filter(Boolean);
  const cfg = s3Config();
  if (!cfg) {
    const { rm } = await import("fs/promises");
    const path = await import("path");
    await Promise.all(list.map((k) => rm(path.join(LOCAL_DIR(), k), { force: true })));
    return;
  }
  for (let i = 0; i < list.length; i += 8) {
    await Promise.all(
      list.slice(i, i + 8).map(async (k) => {
        const res = await fetch(objectUrl(cfg, "DELETE", k, 300), { method: "DELETE" });
        if (!res.ok && res.status !== 404) console.error(`[photos] delete ${k} failed (${res.status})`);
      }),
    );
  }
}

/* ---------------- local development storage ---------------- */

/** Only keys we make: g/<gallery>/<random>/<file>. Stops "../" tricks. */
export const safeKey = (k: string) => /^g\/[a-z0-9]{1,40}\/[a-z0-9]{8,40}\/[a-z]{1,2}\.(jpg|mp4|mov|webm|m4v)$/.test(k);

export async function localPut(key: string, url: URL, body: ArrayBuffer) {
  if (!localStorageAllowed() || s3Config()) return { status: 404 };
  const exp = Number(url.searchParams.get("exp"));
  if (!safeKey(key) || !(exp > Date.now() / 1000) || url.searchParams.get("sig") !== localSig(key, exp)) return { status: 403 };
  if (body.byteLength !== Number(url.searchParams.get("size"))) return { status: 400 };
  const { mkdir, writeFile } = await import("fs/promises");
  const path = await import("path");
  const file = path.join(LOCAL_DIR(), key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(body));
  return { status: 200 };
}

export async function localGet(key: string) {
  if (!localStorageAllowed() || s3Config() || !safeKey(key)) return null;
  const { readFile } = await import("fs/promises");
  const path = await import("path");
  return readFile(path.join(LOCAL_DIR(), key)).catch(() => null);
}
