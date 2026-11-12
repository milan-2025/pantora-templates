/**
 * Real estate mode: pure helpers (no database, no framework) so they can be unit-tested.
 * The API in app/api/crm/route.ts uses these and always scopes queries by workspace (`ws`).
 */

export type Mode = "general" | "realestate";
export const modeOf = (ws: { mode?: unknown } | null | undefined): Mode => (ws?.mode === "realestate" ? "realestate" : "general");

export const UNIT_STATUSES = ["available", "soft_hold", "hard_hold", "booked", "sold"] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

export const PROJECT_TYPES = ["residential", "commercial", "plot", "rental"] as const;

/** Extra lead stages shown only in real estate mode (inserted before Won). */
export const RE_STAGES: Record<string, string> = {
  New: "#2563eb",
  Contacted: "#7c3aed",
  Qualified: "#0d9488",
  "Site visit scheduled": "#ea580c",
  "Site visit done": "#c2410c",
  Proposal: "#b45309",
  Negotiation: "#a21caf",
  Booked: "#0891b2",
  Won: "#16a34a",
  Lost: "#6b7280",
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const str = (v: unknown, max = 80) => String(v ?? "").trim().slice(0, max);

export type UnitInput = {
  no: string; tower: string; floor: number | null; bhk: string; area: number | null; price: number | null;
};

/** Validate and clean one unit row. Returns an error message for unusable rows. */
export function cleanUnit(raw: Record<string, unknown>): { ok: true; unit: UnitInput } | { ok: false; error: string } {
  const no = str(raw.no ?? raw.unit ?? raw.unitNumber ?? raw["unit no"], 30);
  if (!no) return { ok: false, error: "Unit number is required" };
  return {
    ok: true,
    unit: {
      no,
      tower: str(raw.tower, 30),
      floor: num(raw.floor),
      bhk: str(raw.bhk, 20),
      area: num(raw.area ?? raw.areaSqFt ?? raw["area sqft"]),
      price: num(raw.price ?? raw.basePrice),
    },
  };
}

/** "101-110" style ranges for quickly creating many units. */
export function expandRange(from: number, to: number, prefix = ""): string[] {
  if (!Number.isInteger(from) || !Number.isInteger(to) || to < from || to - from > 999) return [];
  return Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${from + i}`);
}

/**
 * Which status changes are allowed. Booked/sold units can only be released by an admin
 * (never silently overwritten by a hold), which prevents double-booking.
 */
export function canTransition(from: UnitStatus, to: UnitStatus, isAdmin: boolean): boolean {
  if (from === to) return false;
  if (!isAdmin) return from === "available" && to === "soft_hold"; // agents may only place a soft hold
  if (from === "sold" && to !== "available") return false; // sold can only be reopened, not re-booked
  return true;
}

/** An agent may release a soft hold only if they placed it. */
export const canRelease = (unit: { status: string; heldBy?: string }, user: { name: string; admin: boolean }): boolean =>
  unit.status === "soft_hold" || unit.status === "hard_hold" ? user.admin || (unit.status === "soft_hold" && unit.heldBy === user.name) : false;

export const HOLD_HOURS_DEFAULT = 48;
export const holdHours = (v: unknown, fallback = HOLD_HOURS_DEFAULT) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n <= 24 * 30 ? n : fallback;
};

/** Mongo filter + update that release every expired soft hold in one workspace (atomic, idempotent). */
export const expiredHoldFilter = (ws: string, now: number) => ({ ws, status: "soft_hold", heldUntil: { $lte: now } });
export const releaseUpdate = () => ({
  $set: { status: "available" as UnitStatus },
  $unset: { heldUntil: "", heldBy: "", leadId: "", leadName: "" },
});

/** Filter for placing a hold. Matching only `available` units makes two agents racing for one unit safe: only one wins. */
export const holdFilter = (ws: string, id: string) => ({ _id: id, ws, status: "available" });

/** Plan limits for the inventory (units across all projects). */
export const UNIT_LIMITS: Record<string, number> = { trial: 200, starter: 500, growth: 5000, internal: 1e9 };

/** Quick stats for a project's unit list. */
export function unitStats(units: { status: string; price?: number | null }[]) {
  const s = { total: units.length, available: 0, soft_hold: 0, hard_hold: 0, booked: 0, sold: 0, soldValue: 0 };
  for (const u of units) {
    if (u.status in s) (s as Record<string, number>)[u.status]++;
    if ((u.status === "booked" || u.status === "sold") && u.price) s.soldValue += u.price;
  }
  return s;
}
