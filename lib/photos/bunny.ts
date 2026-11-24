/**
 * Optional: Bunny Stream for smoother video playback (adaptive quality, like YouTube).
 *
 * OFF until both of these are set, so it costs nothing unless you turn it on:
 *   BUNNY_STREAM_LIBRARY_ID   the Video Library id (Bunny → Stream → your library → API)
 *   BUNNY_STREAM_API_KEY      that library's API key
 *
 * While it is off, videos play straight from photo storage (R2), which costs nothing extra.
 * When it is on, each new Premium/Royal video is also handed to Bunny (Bunny fetches it from storage itself),
 * and guests get Bunny's player once Bunny has finished encoding it. Bunny bills only for what it stores and
 * streams (a $1 monthly minimum once the account is active).
 */

const API = "https://video.bunnycdn.com";
const lib = () => process.env.BUNNY_STREAM_LIBRARY_ID ?? "";
const key = () => process.env.BUNNY_STREAM_API_KEY ?? "";
export const bunnyEnabled = () => Boolean(lib() && key());

async function call(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}/library/${lib()}${path}`, {
    ...init,
    headers: { AccessKey: key(), accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}), ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Bunny Stream ${init.method ?? "GET"} ${path} failed (${res.status}): ${(await res.text().catch(() => "")).slice(0, 200)}`);
  return res.json().catch(() => ({}));
}

/** Asks Bunny to download the video from our storage. The title is our item id, so we can find it again. */
export async function bunnyFetch(sourceUrl: string, itemId: string) {
  await call("/videos/fetch", { method: "POST", body: JSON.stringify({ url: sourceUrl, title: `pt-${itemId}` }) });
}

/** Bunny's id for one of our videos (the fetch call doesn't return it), or null if Bunny hasn't created it yet. */
export async function bunnyFind(itemId: string): Promise<string | null> {
  const r = (await call(`/videos?search=${encodeURIComponent(`pt-${itemId}`)}&itemsPerPage=5`)) as { items?: { guid: string; title: string }[] };
  return r.items?.find((v) => v.title === `pt-${itemId}`)?.guid ?? null;
}

/** 4 = finished encoding (ready to play), 5 or 6 = failed. Anything else: still working. */
export async function bunnyStatus(guid: string): Promise<"ready" | "failed" | "working"> {
  const v = (await call(`/videos/${guid}`)) as { status?: number };
  if (v.status === 4) return "ready";
  if (v.status === 5 || v.status === 6) return "failed";
  return "working";
}

export async function bunnyDelete(guid: string) {
  await call(`/videos/${guid}`, { method: "DELETE" }).catch((e) => console.error("[bunny] delete", e));
}

/** The player page guests see in an <iframe>. */
export const bunnyEmbedUrl = (guid: string) => `https://iframe.mediadelivery.net/embed/${lib()}/${guid}?autoplay=false&preload=true&responsive=true`;
