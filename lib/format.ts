import type { Media } from "@/payload-types";

export const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export const whatsappLink = (number: string | null | undefined, msg?: string | null) =>
  number ? `https://wa.me/${number.replace(/\D/g, "")}${msg ? `?text=${encodeURIComponent(msg)}` : ""}` : null;

/** An upload field is either an id (unpopulated) or the media doc. Returns the doc only when populated with a URL. */
export function mediaDoc(m: string | Media | null | undefined): (Media & { url: string }) | null {
  return m && typeof m === "object" && m.url ? (m as Media & { url: string }) : null;
}

export const isVideo = (m: Media) => Boolean(m.mimeType?.startsWith("video/"));
