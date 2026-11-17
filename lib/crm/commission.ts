/** Channel partners and commissions: pure helpers (no database). */

export const COMMISSION_STATUSES = ["pending", "approved", "paid", "cancelled"] as const;
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];

/** Clean a percentage typed by a person. Returns null when empty/invalid so "not set" is distinguishable from 0. */
export function cleanPct(v: unknown): number | null {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace("%", "").trim());
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) / 100 : null;
}

/** A partner's own rate wins over the project's rate. Returns 0 when neither is set. */
export const effectiveRate = (partnerRate: unknown, projectRate: unknown): number =>
  cleanPct(partnerRate) ?? cleanPct(projectRate) ?? 0;

/** Commission in whole rupees. */
export const commissionAmount = (saleValue: unknown, pct: number): number => {
  const v = Number(saleValue);
  return Number.isFinite(v) && v > 0 && pct > 0 ? Math.round((v * pct) / 100) : 0;
};

/** A commission is created when a unit is booked for a lead that came through a partner, and a rate and price exist. */
export const shouldCreate = (partnerId: unknown, rate: number, saleValue: unknown): boolean =>
  !!partnerId && rate > 0 && Number(saleValue) > 0;

const NEXT: Record<CommissionStatus, CommissionStatus[]> = {
  pending: ["approved", "paid", "cancelled"],
  approved: ["pending", "paid", "cancelled"],
  paid: ["approved"], // reopen if marked paid by mistake; a paid commission can never be cancelled directly
  cancelled: ["pending"],
};
export const canChangeStatus = (from: string, to: string): boolean => !!NEXT[from as CommissionStatus]?.includes(to as CommissionStatus);

/** Totals by status (cancelled commissions are not counted as money owed or earned). */
export function summarize(list: { status: string; amount?: number }[]) {
  const s = { pending: 0, approved: 0, paid: 0, due: 0, count: list.filter((x) => x.status !== "cancelled").length };
  for (const c of list) {
    const a = Number(c.amount) || 0;
    if (c.status === "pending") s.pending += a;
    else if (c.status === "approved") s.approved += a;
    else if (c.status === "paid") s.paid += a;
  }
  s.due = s.pending + s.approved;
  return s;
}

/** Per-partner numbers for the Partners screen. */
export function partnerStats(
  partners: { id: string; name: string; email?: string; rate?: unknown }[],
  leads: { status?: string; partnerId?: string }[],
  commissions: { partnerId: string; status: string; amount?: number }[],
) {
  return partners.map((p) => {
    const mine = leads.filter((l) => l.partnerId === p.id);
    return {
      id: p.id, name: p.name, email: p.email || "", rate: cleanPct(p.rate),
      leads: mine.length,
      booked: mine.filter((l) => l.status === "Booked" || l.status === "Won").length,
      commission: summarize(commissions.filter((c) => c.partnerId === p.id)),
    };
  });
}

/** Fields a channel partner may set on their own leads (they never change stage, owner or attribution). */
export const PARTNER_LEAD_FIELDS = ["name", "phone", "email", "budget", "project", "projectId", "unitId", "bhk"] as const;
export function partnerLeadFields(body: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of PARTNER_LEAD_FIELDS) if (k in body) out[k] = String(body[k] ?? "").trim().slice(0, 120);
  return out;
}
