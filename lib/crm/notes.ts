/** Pinned note on a lead (works in normal and real estate mode): cleaned to a small, safe shape. */
export type Pinned = { x: string; by: string; t: number; eby?: string; et?: number };

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** Returns null (no pinned note) for empty text or anything that is not an object. */
export function cleanPinned(v: unknown, now = Date.now()): Pinned | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const x = String(o.x ?? "").trim().slice(0, 2000);
  if (!x) return null;
  const p: Pinned = { x, by: String(o.by ?? "").trim().slice(0, 80), t: num(o.t) || now };
  if (o.eby) { p.eby = String(o.eby).trim().slice(0, 80); p.et = num(o.et) || now; }
  return p;
}
