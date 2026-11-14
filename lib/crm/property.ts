/** Property IDs, project photos, map links and lead-to-property matching: pure helpers (no database). */
import { safeHttpsUrl } from "./publicPage";

/** Short, human-friendly Property ID, unique within one company: PR-001, PR-002 ... PR-1000. */
export const formatCode = (n: number): string => `PR-${String(Math.max(1, Math.floor(n))).padStart(3, "0")}`;
export const isCode = (s: unknown): boolean => /^PR-\d{3,}$/.test(String(s ?? ""));

/** Numeric part, for natural sorting (PR-002 before PR-010). Unknown codes sort last. */
export const codeNumber = (s: unknown): number => (isCode(s) ? Number(String(s).slice(3)) : Number.MAX_SAFE_INTEGER);

export const MAX_IMAGES = 12;

/** Up to 12 unique https image links, in the order given. Anything else is dropped. */
export function cleanImages(v: unknown): string[] {
  const list = Array.isArray(v) ? v : String(v ?? "").split(/\s*\n\s*/);
  const out: string[] = [];
  for (const x of list) {
    const u = safeHttpsUrl(x);
    if (u && !out.includes(u)) out.push(u);
    if (out.length >= MAX_IMAGES) break;
  }
  return out;
}

/** Only real Google Maps links are kept (https, a Google Maps host or path). Returns "" otherwise. */
export function cleanMapUrl(v: unknown): string {
  const u = safeHttpsUrl(v);
  if (!u) return "";
  const { hostname, pathname } = new URL(u);
  const h = hostname.toLowerCase();
  const googleDomain = /^(www\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(h);
  const ok =
    (googleDomain && pathname.startsWith("/maps")) ||
    /^maps\.google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(h) ||
    h === "maps.app.goo.gl" ||
    (h === "goo.gl" && pathname.startsWith("/maps"));
  return ok ? u : "";
}

type P = { id: string; name: string };
const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

/**
 * Work out which project a lead is about. A valid project id wins; otherwise a typed project name is
 * matched (ignoring case) so leads created before Property IDs existed still link up.
 */
export function resolveProject(projects: P[], input: { projectId?: unknown; project?: unknown }): { projectId: string; project: string } {
  const byId = input.projectId ? projects.find((p) => p.id === String(input.projectId)) : undefined;
  if (byId) return { projectId: byId.id, project: byId.name };
  const name = String(input.project ?? "").trim().slice(0, 120);
  const byName = name ? projects.find((p) => norm(p.name) === norm(name)) : undefined;
  return byName ? { projectId: byName.id, project: byName.name } : { projectId: "", project: name };
}

/** Does this lead belong to this project? Uses the stored id, or the name for older leads without one. */
export const leadInProject = (lead: { projectId?: string; project?: string }, p: P): boolean =>
  lead.projectId ? lead.projectId === p.id : !!lead.project && norm(lead.project) === norm(p.name);
