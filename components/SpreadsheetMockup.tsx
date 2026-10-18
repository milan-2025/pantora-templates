"use client";

import { AnimatePresence, motion } from "motion/react";
import { CountUp } from "@/components/ui/CountUp";
import { parseNumberCell, parseRows, pillTone, type PreviewSheet, type SheetPreview } from "@/lib/sheetPreview";

const row = {
  hidden: { opacity: 0, x: -16 },
  show: (i: number) => ({ opacity: 1, x: 0, transition: { delay: 0.08 * i, type: "spring" as const, stiffness: 200, damping: 20 } }),
};

const STAT_COLORS = ["bg-sand", "bg-mint", "bg-blush"];
const SLICE_COLORS = ["var(--plum)", "var(--marigold)", "var(--teal)", "var(--coral)", "var(--lavender)"];

/** A number that counts up (keeping ₹, %, units), or plain text. */
function Value({ text }: { text: string }) {
  const n = parseNumberCell(text);
  return n ? <CountUp value={n.value} format={n.format} /> : <>{text}</>;
}

function Pill({ text }: { text: string }) {
  const tone = pillTone(text);
  return (
    <motion.span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.className}`}
      animate={tone.pulse ? { scale: [1, 1.12, 1] } : undefined}
      transition={{ repeat: Infinity, duration: 1.4 }}
    >
      {text}
    </motion.span>
  );
}

function Stats({ stats }: { stats: NonNullable<PreviewSheet["stats"]> }) {
  return (
    <div className={`grid gap-2 ${stats.length === 1 ? "grid-cols-1" : stats.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
      {stats.map((s, i) => (
        <motion.div
          key={i}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: i * 0.1, type: "spring" }}
          className={`rounded-lg p-2 text-center text-plum ${STAT_COLORS[i % STAT_COLORS.length]}`}
        >
          <div className="font-display text-xl">
            <Value text={s.value} />
          </div>
          <div className="text-[10px] font-bold uppercase leading-tight">{s.label}</div>
        </motion.div>
      ))}
    </div>
  );
}

function Table({ columns, rows }: { columns: string[]; rows: string[][] }) {
  const width = Math.max(columns.length, ...rows.map((r) => r.length));
  const last = width - 1;
  return (
    <table className="w-full text-left text-[11px] sm:text-xs">
      {columns.length > 0 && (
        <thead>
          <tr className="border-b border-plum/25 text-[10px] uppercase tracking-wide text-plum">
            {columns.map((h, i) => (
              <th key={i} className="pb-1.5 pr-2 font-bold">{h}</th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((cells, i) => (
          <motion.tr key={i} custom={i} variants={row} initial="hidden" animate="show" className="border-b border-plum/8">
            {Array.from({ length: width }, (_, c) => {
              const text = cells[c] ?? "";
              const isNumber = Boolean(parseNumberCell(text));
              if (c === 0) return <td key={c} className="py-2 pr-2 font-medium text-plum">{text}</td>;
              if (c === last && width > 1 && text && !isNumber && text.length <= 16)
                return <td key={c} className="py-2"><Pill text={text} /></td>;
              return (
                <td key={c} className={`py-2 pr-2 ${text.length <= 14 ? "whitespace-nowrap" : ""}`}>
                  <Value text={text} />
                </td>
              );
            })}
          </motion.tr>
        ))}
      </tbody>
    </table>
  );
}

function Progress({ label, percent }: { label?: string | null; percent: number }) {
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs font-bold">
        <span>{label}</span>
        <span><CountUp value={pct} format={(n) => `${Math.round(n)}%`} /></span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-lavender">
        <motion.div
          className="h-full rounded-full bg-[linear-gradient(90deg,var(--teal),var(--marigold))]"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
        />
      </div>
    </div>
  );
}

function Donut({ values }: { values: number[] }) {
  const total = values.reduce((a, b) => a + Math.max(0, b), 0) || 1;
  const pcts = values.map((v) => (Math.max(0, v) / total) * 100);
  return (
    <svg viewBox="0 0 42 42" className="size-24 -rotate-90">
      {pcts.map((pct, i) => (
        <motion.circle
          key={i}
          cx="21" cy="21" r="15.9"
          fill="none"
          stroke={SLICE_COLORS[i % SLICE_COLORS.length]}
          strokeWidth="7"
          strokeDasharray={`${pct} ${100 - pct}`}
          strokeDashoffset={-pcts.slice(0, i).reduce((a, b) => a + b, 0)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 + i * 0.15 }}
        />
      ))}
    </svg>
  );
}

function Bars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-28 items-end justify-around gap-1">
      {values.map((v, i) => (
        <motion.div
          key={i}
          className="w-4 rounded-t bg-teal"
          initial={{ height: 0 }}
          animate={{ height: Math.max(4, (Math.max(0, v) / max) * 100) }}
          transition={{ delay: 0.2 + i * 0.08, type: "spring", stiffness: 120 }}
        />
      ))}
    </div>
  );
}

function Sheet({ sheet }: { sheet: PreviewSheet }) {
  const stats = (sheet.stats ?? []).filter((s) => s.label || s.value).slice(0, 3);
  const columns = (sheet.columns ?? []).slice(0, 5);
  const rows = parseRows(sheet.rows);
  const bars = (sheet.bars ?? []).filter((n) => typeof n === "number").slice(0, 8);
  const donut = (sheet.donut ?? []).filter((n) => typeof n === "number").slice(0, 5);
  const hasCharts = bars.length > 0 || donut.length > 0;
  return (
    <div className="space-y-3">
      {stats.length > 0 && <Stats stats={stats} />}
      {(rows.length > 0 || columns.length > 0) && <Table columns={columns} rows={rows} />}
      {typeof sheet.progressPercent === "number" && <Progress label={sheet.progressLabel} percent={sheet.progressPercent} />}
      {hasCharts && (
        <div className={`grid gap-3 ${bars.length && donut.length ? "grid-cols-2" : "grid-cols-1"}`}>
          {donut.length > 0 && (
            <div className="grid place-items-center rounded-lg border border-plum/10 bg-paper p-2">
              <Donut values={donut} />
              {sheet.chartLabel && <div className="text-[10px] font-bold uppercase">{sheet.chartLabel}</div>}
            </div>
          )}
          {bars.length > 0 && (
            <div className="grid rounded-lg border border-plum/10 bg-paper p-2">
              <Bars values={bars} />
              {sheet.chartLabel && !donut.length && <div className="text-center text-[10px] font-bold uppercase">{sheet.chartLabel}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- the window ---------- */

export function SpreadsheetMockup({
  preview,
  active,
  onTabChange,
  className = "",
}: {
  preview: SheetPreview;
  /** Index of the tab to show. */
  active: number;
  onTabChange?: (index: number) => void;
  className?: string;
}) {
  const index = Math.min(Math.max(0, active), preview.sheets.length - 1);
  const sheet = preview.sheets[index];
  return (
    <div className={`overflow-hidden rounded-2xl border border-plum/10 bg-paper shadow-lift ${className}`}>
      {/* title bar */}
      <div className="flex items-center gap-2 bg-teal px-3 py-2">
        <span className="size-2.5 rounded-full bg-coral" />
        <span className="size-2.5 rounded-full bg-marigold" />
        <span className="size-2.5 rounded-full bg-cream/80" />
        <span className="ml-2 truncate font-mono text-xs font-semibold text-cream">{preview.fileName}</span>
      </div>
      {/* formula bar */}
      <div className="flex items-center gap-2 border-b border-plum/10 bg-cream px-3 py-1 font-mono text-[10px] text-charcoal/60">
        <span className="font-bold text-plum">fx</span>
        <span className="truncate">{preview.formula}</span>
      </div>
      {/* sheet body */}
      <div className="bg-grid relative min-h-[300px] p-3 sm:p-4">
        <AnimatePresence mode="wait">
          {sheet && (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Sheet sheet={sheet} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* sheet tabs */}
      <div className="flex gap-1 overflow-x-auto border-t border-plum/10 bg-cream px-2 pt-1.5 [scrollbar-width:none]">
        {preview.sheets.map((t, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onTabChange?.(i)}
            className={`relative shrink-0 rounded-t-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              index === i ? "bg-paper text-teal shadow-[0_-2px_6px_-2px_rgb(59_31_74/0.15)]" : "text-charcoal/55 hover:bg-paper/60"
            }`}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
