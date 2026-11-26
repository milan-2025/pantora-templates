"use client";
/** Small fetch wrapper for /api/hostbook. The sign-in token and chosen team live in localStorage on this device. */

export class ApiError extends Error {
  constructor(message: string, public status: number, public extra: Record<string, unknown> = {}) { super(message); }
}

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* private mode */ } },
};
export const session = {
  token: () => ls.get("hb_token"),
  account: () => ls.get("hb_acct"),
  setToken: (t: string | null) => ls.set("hb_token", t),
  setAccount: (a: string | null) => ls.set("hb_acct", a),
  cache: (acct: string) => { try { return JSON.parse(ls.get(`hb_cache:${acct}`) || "null"); } catch { return null; } },
  saveCache: (acct: string, v: unknown) => { try { ls.set(`hb_cache:${acct}`, JSON.stringify(v)); } catch { /* full: skip */ } },
  clear: () => { try { Object.keys(localStorage).filter((k) => k.startsWith("hb_")).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ } },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const t = session.token(), a = session.account();
  if (t) headers.authorization = `Bearer ${t}`;
  if (a) headers["x-hb-account"] = a;
  let res: Response;
  try {
    res = await fetch(`/api/hostbook/${path}`, { method: opts.method ?? (opts.body ? "POST" : "GET"), headers, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: "no-store" });
  } catch {
    throw new ApiError("You're offline. Changes need an internet connection.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && path !== "auth/verify" && path !== "auth/password") window.dispatchEvent(new Event("hb-signed-out"));
    throw new ApiError(data.error || "Something went wrong", res.status, data);
  }
  return data as T;
}

/** Shrinks a photo in the browser (JPEG, longest side `max` px) before uploading, to save data and Cloudinary credits. */
export async function shrink(file: File, max = 1600): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/heic") return file;
  const img = await createImageBitmap(file).catch(() => null);
  if (!img) return file;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((ok) => canvas.toBlob((b) => ok(b ?? file), "image/jpeg", 0.82));
}

/** Uploads straight to Cloudinary with fields the server signed. */
export async function uploadSigned(sig: { url: string; fields: Record<string, string | number> }, file: File) {
  const blob = await shrink(file);
  const fd = new FormData();
  for (const [k, v] of Object.entries(sig.fields)) fd.append(k, String(v));
  fd.append("file", blob, file.name.replace(/\.\w+$/, "") + ".jpg");
  const res = await fetch(sig.url, { method: "POST", body: fd });
  if (!res.ok) throw new ApiError("Upload failed. Please try again.", res.status);
  return res.json();
}
