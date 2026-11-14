/** YouTube videos and private unit documents: pure helpers (no database, no network). */

export const MAX_VIDEOS = 10;
const ID = /^[A-Za-z0-9_-]{11}$/;

/** The 11-character video id from any common YouTube link, or "" if it is not a YouTube video link. */
export function youTubeId(v: unknown): string {
  let u: URL;
  try { u = new URL(String(v ?? "").trim()); } catch { return ""; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return "";
  const h = u.hostname.toLowerCase().replace(/^(www|m)\./, "");
  let id = "";
  if (h === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (h === "youtube.com" || h === "youtube-nocookie.com") {
    const parts = u.pathname.split("/").filter(Boolean);
    if (u.pathname === "/watch") id = u.searchParams.get("v") || "";
    else if (["shorts", "embed", "live", "v"].includes(parts[0])) id = parts[1] || "";
  }
  return ID.test(id) ? id : "";
}

/** Up to 10 unique videos, stored as plain https://www.youtube.com/watch?v=ID links. Anything else is dropped. */
export function cleanVideos(v: unknown): string[] {
  const list = Array.isArray(v) ? v : String(v ?? "").split(/[\s,]+/);
  const out: string[] = [];
  for (const x of list) {
    const id = youTubeId(x);
    const link = id ? `https://www.youtube.com/watch?v=${id}` : "";
    if (link && !out.includes(link)) out.push(link);
    if (out.length >= MAX_VIDEOS) break;
  }
  return out;
}

/** Privacy-friendly embed address (no cookies until the visitor presses play). */
export const embedUrl = (id: string) => (ID.test(id) ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : "");

// ---------- private documents ----------

export const MAX_DOCS = 20;
export const DOC_EXT = ["pdf", "doc", "docx", "xls", "xlsx", "csv", "txt", "jpg", "jpeg", "png", "webp", "heic", "ppt", "pptx", "dwg", "zip"] as const;

/** A safe display name for a document; returns "" if the type is not allowed. */
export function cleanDocName(v: unknown): string {
  const raw = String(v ?? "").replace(/[\\/\u0000-\u001f<>:"|?*]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  const ext = raw.includes(".") ? raw.split(".").pop()!.toLowerCase() : "";
  return ext && (DOC_EXT as readonly string[]).includes(ext) && raw.length > ext.length + 1 ? raw : "";
}

/** Folder a company's documents for one unit live in. Used to sign uploads and to check what is saved. */
export const docFolder = (ws: string, unitId: string) => `crm/${ws}/units/${unitId}/docs`;

/** The uploaded file must be inside this unit's private folder (no `..`, no other company or unit). */
export const docInFolder = (publicId: unknown, ws: string, unitId: string): boolean => {
  const p = String(publicId ?? "");
  return p.startsWith(docFolder(ws, unitId) + "/") && !p.includes("..") && p.length < 400 && !/[\s?#]/.test(p.slice(docFolder(ws, unitId).length + 1));
};
