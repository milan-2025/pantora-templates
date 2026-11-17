/** Browser helper for the stays APIs. Throws ApiError with the server's message. */
export class ApiError extends Error {
  constructor(public status: number, message: string, public data: Record<string, unknown> = {}) { super(message); }
}

export async function api<T = unknown>(base: "host" | "admin" | "public", a: string, body?: unknown, query = ""): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/stays/${base}?a=${a}${query}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "You seem to be offline. Check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error || `Something went wrong (${res.status})`, data as Record<string, unknown>);
  return data as T;
}

/** Upload one file straight to Cloudinary with a server-issued signature, reporting progress (0–1). */
export function uploadToCloud(sign: { url: string; fields: Record<string, string | number> }, file: File, onProgress: (p: number) => void): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(sign.fields)) fd.append(k, String(v));
    fd.append("file", file);
    const x = new XMLHttpRequest();
    x.open("POST", sign.url);
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    x.onload = () => {
      let j: Record<string, unknown> = {};
      try { j = JSON.parse(x.responseText); } catch { /* ignore */ }
      if (x.status >= 200 && x.status < 300) resolve(j);
      else reject(new Error(((j.error as { message?: string })?.message) || `Upload failed (${x.status})`));
    };
    x.onerror = () => reject(new Error("Upload failed: check your connection"));
    x.send(fd);
  });
}

export const fmtDate = (t: number | null | undefined) => (t ? new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
export const fmtDay = (t: number | null | undefined) => (t ? new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
