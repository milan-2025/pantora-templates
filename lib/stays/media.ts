/**
 * Stays: property photos and videos stored in Cloudinary. Pure helpers (no network).
 *
 * Files go straight from the browser to Cloudinary with an upload signature the server issues for one folder
 * (stays/<property id>), so big videos never pass through the website. The server then checks Cloudinary's
 * signature on the upload result before saving it, so only files really uploaded into that folder are accepted.
 * Cloudinary keeps the originals permanently and makes thumbnails, WebP/AVIF and video posters on the fly.
 */
import { MAX_IMAGE_MB, MAX_VIDEO_MB } from "./constants";

export type MediaType = "image" | "video";
export type MediaItem = {
  id: string;
  type: MediaType;
  publicId: string;
  url: string; // https://res.cloudinary.com/<cloud>/<type>/upload/v123/stays/<pid>/<file>.<ext>
  width: number | null;
  height: number | null;
  bytes: number | null;
  duration: number | null;
  caption: string;
  /** Uploaded by a host to a live listing: hidden from guests until the admin approves it. */
  pending: boolean;
  /** The host asked for it to be removed from a live listing. */
  removalRequested: boolean;
  by: "admin" | "host";
  at: number;
  /** Which room (from the property's room list) this photo/video shows. */
  roomId?: string | null;
};

export const IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp", "heic", "heif", "avif"];
export const VIDEO_FORMATS = ["mp4", "mov", "webm", "m4v", "3gp"];
export const folderFor = (propertyId: string) => `stays/${propertyId}`;

/** The upload must be in this property's folder, with no tricks in the name. */
export function inFolder(publicId: unknown, propertyId: string) {
  const p = String(publicId ?? "");
  const f = folderFor(propertyId) + "/";
  return p.startsWith(f) && p.length < 300 && /^[A-Za-z0-9_\-/.]+$/.test(p) && !p.includes("..") && !p.slice(f.length).includes("/");
}

/** A Cloudinary delivery URL for this cloud and resource type, matching the public id. */
export function validDeliveryUrl(url: unknown, cloud: string, type: MediaType, publicId: string) {
  const s = String(url ?? "");
  const base = `https://res.cloudinary.com/${cloud}/${type}/upload/`;
  if (!s.startsWith(base) || s.length > 600) return false;
  const rest = s.slice(base.length).replace(/^v\d+\//, "");
  return rest.replace(/\.[a-z0-9]{2,5}$/i, "") === publicId;
}

export const maxBytes = (type: MediaType) => (type === "video" ? MAX_VIDEO_MB : MAX_IMAGE_MB) * 1024 * 1024;

/** Insert a Cloudinary transformation after /upload/. Non-Cloudinary URLs are returned unchanged. */
export function cld(url: string, transform: string) {
  const i = url.indexOf("/upload/");
  return i < 0 || !url.startsWith("https://res.cloudinary.com/") ? url : `${url.slice(0, i + 8)}${transform}/${url.slice(i + 8)}`;
}
/** Image at a width, auto format (WebP/AVIF) and quality. */
export const imgUrl = (url: string, w: number, h?: number) => cld(url, `f_auto,q_auto,c_${h ? "fill" : "limit"},w_${w}${h ? `,h_${h}` : ""}`);
/** Still frame from a video (1 s in), as a JPEG-family image. */
export const posterUrl = (url: string, w = 800) => cld(url, `so_1,f_auto,q_auto,c_limit,w_${w}`).replace(/\.[a-z0-9]{2,5}$/i, ".jpg");
/** Video re-encoded for the web at a sensible size. */
export const videoUrl = (url: string) => cld(url, "q_auto,vc_auto,c_limit,w_1280");
export const srcSet = (url: string, widths = [480, 800, 1200, 1600]) => widths.map((w) => `${imgUrl(url, w)} ${w}w`).join(", ");

/** Cover = the chosen cover if it is still there and visible, else the first visible photo. */
export function coverOf(media: MediaItem[], coverId: string | null | undefined, includePending = false) {
  const vis = media.filter((m) => m.type === "image" && (includePending || !m.pending));
  return vis.find((m) => m.id === coverId) || vis[0] || null;
}

/** New order of media from a list of ids. Unknown ids are ignored; anything not listed keeps its place at the end. */
export function reorder(media: MediaItem[], ids: unknown): MediaItem[] {
  const want = (Array.isArray(ids) ? ids : []).map(String);
  const byId = new Map(media.map((m) => [m.id, m]));
  const first = want.filter((id, i) => byId.has(id) && want.indexOf(id) === i).map((id) => byId.get(id)!);
  return [...first, ...media.filter((m) => !first.includes(m))];
}
