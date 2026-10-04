import type { AdminViewServerProps } from "payload";
import { DefaultTemplate } from "@payloadcms/next/templates";
import { Gutter } from "@payloadcms/ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import { markCommissionPaid } from "./earningsActions";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

const cell: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid var(--theme-elevation-100)", textAlign: "left" };

/**
 * Admin page: sales, revenue and commission per affiliate, with an optional date range,
 * and a button to mark owed commission as paid.
 */
export async function AffiliateEarnings({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req } = initPageResult;
  if (!req.user) redirect("/admin/login?redirect=/admin/affiliate-earnings");

  const sp = (searchParams ?? {}) as Record<string, string | undefined>;
  const from = sp.from || "";
  const to = sp.to || "";

  const where: Record<string, unknown> = { paymentStatus: { equals: "paid" }, affiliate: { exists: true } };
  if (from || to) {
    where.paidAt = {
      ...(from ? { greater_than_equal: new Date(from).toISOString() } : {}),
      ...(to ? { less_than_equal: new Date(`${to}T23:59:59`).toISOString() } : {}),
    };
  }

  const [orders, affiliates] = await Promise.all([
    req.payload.find({ collection: "orders", where: where as never, limit: 10000, depth: 0, pagination: false, req }),
    req.payload.find({ collection: "affiliates", limit: 1000, depth: 0, pagination: false, req }),
  ]);

  type Row = { sales: number; revenue: number; commission: number; owed: number };
  const totals = new Map<string, Row>();
  for (const o of orders.docs) {
    const id = String(o.affiliate);
    const row = totals.get(id) ?? { sales: 0, revenue: 0, commission: 0, owed: 0 };
    row.sales += 1;
    row.revenue += o.amount ?? 0;
    row.commission += o.commissionAmount ?? 0;
    if (o.commissionStatus === "pending") row.owed += o.commissionAmount ?? 0;
    totals.set(id, row);
  }
  const rows = affiliates.docs
    .map((a) => ({ a, t: totals.get(String(a.id)) ?? { sales: 0, revenue: 0, commission: 0, owed: 0 } }))
    .sort((x, y) => y.t.owed - x.t.owed || y.t.sales - x.t.sales);
  const grand = rows.reduce((s, r) => ({ sales: s.sales + r.t.sales, revenue: s.revenue + r.t.revenue, owed: s.owed + r.t.owed }), {
    sales: 0,
    revenue: 0,
    owed: 0,
  });

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={req.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={req.user || undefined}
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter>
        <h1 style={{ marginTop: 24 }}>Affiliate earnings</h1>
        <p style={{ color: "var(--theme-elevation-600)", maxWidth: 640 }}>
          Paid orders that used an affiliate&apos;s code or referral link. Pay each affiliate the &ldquo;Owed&rdquo; amount,
          then click &ldquo;Mark as paid&rdquo;.
        </p>

        <form method="get" style={{ display: "flex", gap: 12, alignItems: "end", margin: "20px 0", flexWrap: "wrap" }}>
          <label>
            From
            <br />
            <input type="date" name="from" defaultValue={from} />
          </label>
          <label>
            To
            <br />
            <input type="date" name="to" defaultValue={to} />
          </label>
          <button type="submit" className="btn btn--style-secondary btn--size-small" style={{ margin: 0 }}>
            Filter
          </button>
          {(from || to) && <Link href="/admin/affiliate-earnings">Clear</Link>}
        </form>

        <div style={{ display: "flex", gap: 24, margin: "8px 0 24px", flexWrap: "wrap" }}>
          <Stat label="Affiliate sales" value={String(grand.sales)} />
          <Stat label="Affiliate revenue" value={inr(grand.revenue)} />
          <Stat label="Commission owed" value={inr(grand.owed)} />
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Affiliate", "Code", "Sales", "Revenue", "Commission earned", "Owed", ""].map((h) => (
                  <th key={h} style={{ ...cell, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td style={cell} colSpan={7}>No affiliates yet. Add one under Shop → Affiliates.</td>
                </tr>
              )}
              {rows.map(({ a, t }) => (
                <tr key={a.id}>
                  <td style={cell}>
                    <Link href={`/admin/collections/affiliates/${a.id}`}>{a.name}</Link>
                    {!a.active && <span style={{ marginLeft: 6, opacity: 0.6 }}>(inactive)</span>}
                  </td>
                  <td style={cell}><code>{a.code}</code></td>
                  <td style={cell}>{t.sales}</td>
                  <td style={cell}>{inr(t.revenue)}</td>
                  <td style={cell}>{inr(t.commission)}</td>
                  <td style={{ ...cell, fontWeight: 700 }}>{inr(t.owed)}</td>
                  <td style={cell}>
                    {t.owed > 0 && (
                      <form action={markCommissionPaid}>
                        <input type="hidden" name="affiliateId" value={String(a.id)} />
                        <button type="submit" className="btn btn--style-primary btn--size-small" style={{ margin: 0 }}>
                          Mark as paid
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ marginTop: 16, fontSize: 13, color: "var(--theme-elevation-500)" }}>
          &ldquo;Mark as paid&rdquo; clears everything currently owed to that affiliate, regardless of the date filter.
          Individual orders can also be changed under Shop → Orders.
        </p>
      </Gutter>
    </DefaultTemplate>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "14px 18px", border: "1px solid var(--theme-elevation-150)", borderRadius: 8, minWidth: 160 }}>
      <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "var(--theme-elevation-500)" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}
