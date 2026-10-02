"use client";

import { AnimatePresence, motion } from "motion/react";
import { CountUp } from "@/components/ui/CountUp";
import { showcaseTabs, type ShowcaseTabId } from "@/lib/content";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

const row = {
  hidden: { opacity: 0, x: -16 },
  show: (i: number) => ({ opacity: 1, x: 0, transition: { delay: 0.08 * i, type: "spring" as const, stiffness: 200, damping: 20 } }),
};

/* ---------- tab contents (sample data, purely illustrative) ---------- */

const budget = [
  { cat: "Venue", budget: 600000, spent: 450000 },
  { cat: "Catering", budget: 500000, spent: 380000 },
  { cat: "Decor", budget: 200000, spent: 90000 },
  { cat: "Photography", budget: 150000, spent: 150000 },
  { cat: "Outfits", budget: 250000, spent: 120000 },
];

function BudgetTab() {
  const total = budget.reduce((a, b) => a + b.budget, 0);
  const spent = budget.reduce((a, b) => a + b.spent, 0);
  return (
    <div>
      <Table head={["Category", "Budget", "Spent", "Left"]}>
        {budget.map((r, i) => (
          <motion.tr key={r.cat} custom={i} variants={row} initial="hidden" animate="show" className="border-b border-plum/8">
            <td className="py-2 pr-2 font-medium text-plum">{r.cat}</td>
            <td><CountUp value={r.budget} format={inr} /></td>
            <td><CountUp value={r.spent} format={inr} /></td>
            <td className={r.budget - r.spent === 0 ? "text-coral font-semibold" : "text-teal font-semibold"}>
              <CountUp value={r.budget - r.spent} format={inr} />
            </td>
          </motion.tr>
        ))}
      </Table>
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs font-bold">
          <span>Spent <CountUp value={spent} format={inr} /></span>
          <span>of {inr(total)}</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-lavender">
          <motion.div
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--teal),var(--marigold))]"
            initial={{ width: 0 }}
            animate={{ width: `${(spent / total) * 100}%` }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
          />
        </div>
      </div>
    </div>
  );
}

const guests = [
  { name: "Sharma family", side: "Bride", count: 6, rsvp: "Yes", meal: "Veg" },
  { name: "Bua ji 👑", side: "Groom", count: 2, rsvp: "Yes", meal: "Jain" },
  { name: "College gang", side: "Bride", count: 12, rsvp: "Maybe", meal: "Mixed" },
  { name: "Mehta uncle", side: "Groom", count: 4, rsvp: "Pending", meal: "Non-veg" },
  { name: "Office team", side: "Groom", count: 8, rsvp: "Yes", meal: "Mixed" },
];
const rsvpColor: Record<string, string> = { Yes: "bg-mint text-teal", Maybe: "bg-sand text-marigold-deep", Pending: "bg-blush text-coral" };

function GuestsTab() {
  return (
    <div>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        {[
          ["Invited", 412, "bg-lavender text-plum"],
          ["Confirmed", 286, "bg-mint text-teal"],
          ["Pending", 126, "bg-blush text-coral"],
        ].map(([l, v, c]) => (
          <div key={l as string} className={`rounded-lg p-1.5 ${c}`}>
            <div className="font-display text-lg"><CountUp value={v as number} /></div>
            <div className="text-[10px] font-bold uppercase">{l}</div>
          </div>
        ))}
      </div>
      <Table head={["Guest", "Side", "#", "RSVP"]}>
        {guests.map((g, i) => (
          <motion.tr key={g.name} custom={i} variants={row} initial="hidden" animate="show" className="border-b border-plum/8">
            <td className="py-2 pr-2 font-medium text-plum">{g.name}</td>
            <td>{g.side}</td>
            <td>{g.count}</td>
            <td><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${rsvpColor[g.rsvp]}`}>{g.rsvp}</span></td>
          </motion.tr>
        ))}
      </Table>
    </div>
  );
}

const vendors = [
  { name: "Lens & Love Studio", type: "📸 Photo", status: "Booked" },
  { name: "Spice Route Caterers", type: "🍛 Catering", status: "Booked" },
  { name: "Gendaphool Decor", type: "🌼 Decor", status: "Quote" },
  { name: "Beats by Kabir", type: "🎧 Music", status: "Booked" },
  { name: "Glam by Riya", type: "💄 Makeup", status: "Shortlist" },
];
const statusColor: Record<string, string> = { Booked: "bg-mint text-teal", Quote: "bg-sand text-marigold-deep", Shortlist: "bg-lavender text-plum" };

function VendorsTab() {
  return (
    <Table head={["Vendor", "Type", "Status"]}>
      {vendors.map((v, i) => (
        <motion.tr key={v.name} custom={i} variants={row} initial="hidden" animate="show" className="border-b border-plum/8">
          <td className="py-2.5 pr-2 font-medium text-plum">{v.name}</td>
          <td className="whitespace-nowrap">{v.type}</td>
          <td><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor[v.status]}`}>{v.status}</span></td>
        </motion.tr>
      ))}
    </Table>
  );
}

const payments = [
  { what: "Venue advance", amt: 200000, due: "Paid", tone: "bg-mint text-teal" },
  { what: "Caterer 2nd instalment", amt: 150000, due: "In 3 days", tone: "bg-blush text-coral" },
  { what: "Photographer balance", amt: 75000, due: "In 12 days", tone: "bg-sand text-marigold-deep" },
  { what: "Decor advance", amt: 45000, due: "Paid", tone: "bg-mint text-teal" },
  { what: "Mehendi artist", amt: 18000, due: "In 20 days", tone: "bg-lavender text-plum" },
];

function PaymentsTab() {
  return (
    <Table head={["Payment", "Amount", "Due"]}>
      {payments.map((p, i) => (
        <motion.tr key={p.what} custom={i} variants={row} initial="hidden" animate="show" className="border-b border-plum/8">
          <td className="py-2.5 pr-2 font-medium text-plum">{p.what}</td>
          <td><CountUp value={p.amt} format={inr} /></td>
          <td>
            <motion.span
              className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.tone}`}
              animate={p.due === "In 3 days" ? { scale: [1, 1.12, 1] } : undefined}
              transition={{ repeat: Infinity, duration: 1.4 }}
            >
              {p.due}
            </motion.span>
          </td>
        </motion.tr>
      ))}
    </Table>
  );
}

function DashboardTab() {
  const slices = [
    { pct: 35, color: "var(--plum)" },
    { pct: 25, color: "var(--marigold)" },
    { pct: 20, color: "var(--teal)" },
    { pct: 20, color: "var(--coral)" },
  ];
  let offset = 0;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2 grid grid-cols-3 gap-2">
        {[
          ["Days to go", 87, "bg-sand text-plum"],
          ["% budget used", 68, "bg-blush text-plum"],
          ["Vendors booked", 9, "bg-mint text-plum"],
        ].map(([l, v, c], i) => (
          <motion.div
            key={l as string}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.1, type: "spring" }}
            className={`rounded-lg p-2 text-center ${c}`}
          >
            <div className="font-display text-xl"><CountUp value={v as number} /></div>
            <div className="text-[10px] font-bold uppercase leading-tight">{l}</div>
          </motion.div>
        ))}
      </div>
      <div className="grid place-items-center rounded-lg border border-plum/10 bg-paper p-2">
        <svg viewBox="0 0 42 42" className="size-24 -rotate-90">
          {slices.map((s, i) => {
            const el = (
              <motion.circle
                key={i}
                cx="21" cy="21" r="15.9"
                fill="none"
                stroke={s.color}
                strokeWidth="7"
                strokeDasharray={`${s.pct} ${100 - s.pct}`}
                strokeDashoffset={-offset}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 + i * 0.15 }}
              />
            );
            offset += s.pct;
            return el;
          })}
        </svg>
        <div className="text-[10px] font-bold uppercase">Spend split</div>
      </div>
      <div className="flex items-end justify-around gap-1 rounded-lg border border-plum/10 bg-paper p-2">
        {[60, 85, 40, 95, 70].map((h, i) => (
          <motion.div
            key={i}
            className="w-4 rounded-t bg-teal"
            initial={{ height: 0 }}
            animate={{ height: h }}
            transition={{ delay: 0.2 + i * 0.08, type: "spring", stiffness: 120 }}
          />
        ))}
      </div>
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full text-left text-[11px] sm:text-xs">
      <thead>
        <tr className="border-b border-plum/25 text-[10px] uppercase tracking-wide text-plum">
          {head.map((h) => <th key={h} className="pb-1.5 pr-2 font-bold">{h}</th>)}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

const tabContent: Record<ShowcaseTabId, () => React.JSX.Element> = {
  budget: BudgetTab,
  guests: GuestsTab,
  vendors: VendorsTab,
  payments: PaymentsTab,
  dashboard: DashboardTab,
};

/* ---------- the window ---------- */

export function SpreadsheetMockup({
  active,
  onTabChange,
  className = "",
}: {
  active: ShowcaseTabId;
  onTabChange?: (id: ShowcaseTabId) => void;
  className?: string;
}) {
  const Content = tabContent[active];
  return (
    <div className={`overflow-hidden rounded-2xl border border-plum/10 bg-paper shadow-lift ${className}`}>
      {/* title bar */}
      <div className="flex items-center gap-2 bg-teal px-3 py-2">
        <span className="size-2.5 rounded-full bg-coral" />
        <span className="size-2.5 rounded-full bg-marigold" />
        <span className="size-2.5 rounded-full bg-cream/80" />
        <span className="ml-2 truncate font-mono text-xs font-semibold text-cream">our-wedding-planner.xlsx</span>
      </div>
      {/* formula bar */}
      <div className="flex items-center gap-2 border-b border-plum/10 bg-cream px-3 py-1 font-mono text-[10px] text-charcoal/60">
        <span className="font-bold text-plum">fx</span>
        <span className="truncate">=SUM(Budget[Spent])  · totals update automatically</span>
      </div>
      {/* sheet body */}
      <div className="bg-grid relative min-h-[300px] p-3 sm:p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <Content />
          </motion.div>
        </AnimatePresence>
      </div>
      {/* sheet tabs */}
      <div className="flex gap-1 overflow-x-auto border-t border-plum/10 bg-cream px-2 pt-1.5 [scrollbar-width:none]">
        {showcaseTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => onTabChange?.(t.id)}
            className={`relative shrink-0 rounded-t-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              active === t.id ? "bg-paper text-teal shadow-[0_-2px_6px_-2px_rgb(59_31_74/0.15)]" : "text-charcoal/55 hover:bg-paper/60"
            }`}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
