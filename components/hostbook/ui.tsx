"use client";
/** Shared building blocks for HostBook screens. */
import { useEffect } from "react";
import { Lock, X } from "lucide-react";
import { FEATURE_LABEL, type FeatureKey } from "@/lib/hostbook/features";
import { inr } from "@/lib/hostbook/core";
import { useStore } from "./store";

export const money = inr;
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmtDay = (d?: string, year = false) => {
  if (!d) return "—";
  const [y, m, dd] = d.split("-").map(Number);
  return `${dd} ${MONTHS[m - 1]}${year ? ` ${y}` : ""}`;
};
export const fmtMonth = (m: string) => { const [y, mm] = m.split("-").map(Number); return `${MONTHS[mm - 1]} ${String(y).slice(2)}`; };

export function Button({ tone = "primary", size = "md", className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "primary" | "ghost" | "soft" | "danger"; size?: "sm" | "md" }) {
  return (
    <button
      {...p}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition disabled:opacity-50 active:scale-[.98]",
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm",
        tone === "primary" && "bg-teal text-white hover:bg-teal-deep",
        tone === "soft" && "bg-mist text-teal hover:bg-mist/70",
        tone === "ghost" && "text-ink/70 hover:bg-ink/5",
        tone === "danger" && "bg-rust/10 text-rust hover:bg-rust/15",
        className,
      )}
    />
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-xs font-semibold text-ink/70">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}
const inputBase = "rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/15";
/** Full width unless the caller sets a width. */
const inputCls = (extra?: string) => cx(inputBase, !/(^|\s)w-/.test(extra ?? "") && "w-full", extra);
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={inputCls(p.className)} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={inputCls(p.className)} />;
export function Select({ options, ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: (string | { value: string; label: string })[] }) {
  return (
    <select {...p} className={cx(inputCls(p.className), "appearance-none bg-[right_.75rem_center] bg-no-repeat pr-8")} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%236c7679' stroke-width='2'%3E%3Cpath d='M2 4l4 4 4-4'/%3E%3C/svg%3E\")" }}>
      {options.map((o) => (typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  );
}

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={cx("rounded-2xl border border-line bg-white p-4", className)} />;
}
export function Badge({ tone = "plain", children }: { tone?: "plain" | "ok" | "warn" | "bad" | "teal"; children: React.ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
      tone === "plain" && "bg-ink/5 text-ink/70", tone === "ok" && "bg-leaf/12 text-leaf", tone === "warn" && "bg-sun/20 text-[#8a5a10]", tone === "bad" && "bg-rust/12 text-rust", tone === "teal" && "bg-mist text-teal")}>
      {children}
    </span>
  );
}
export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "ok" | "bad" }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={cx("mt-1 font-serif text-2xl leading-none", tone === "ok" && "text-leaf", tone === "bad" && "text-rust")}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-muted">{sub}</div>}
    </div>
  );
}
export function Empty({ icon, title, text, action }: { icon?: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white/60 px-6 py-10 text-center">
      {icon && <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-mist text-teal">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHead({ title, sub, action }: { title: string; sub?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h1 className="font-serif text-3xl leading-tight">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/** Bottom sheet on phones, centred dialog on larger screens. */
export function Sheet({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 md:items-center md:p-6" onClick={onClose}>
      <div className={cx("flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-sand shadow-2xl md:rounded-3xl", wide ? "md:max-w-3xl" : "md:max-w-lg")} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-serif text-xl">{title}</h2>
          <button onClick={onClose} className="rounded-full p-2 text-ink/60 hover:bg-ink/5" aria-label="Close"><X className="size-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}

/** Shown in place of a locked feature. */
export function Locked({ feature, compact }: { feature: FeatureKey; compact?: boolean }) {
  const { upsell } = useStore();
  if (compact) return <button onClick={() => upsell(feature)} className="inline-flex items-center gap-1 rounded-full bg-sun/20 px-2 py-0.5 text-[11px] font-semibold text-[#8a5a10]"><Lock className="size-3" /> Upgrade</button>;
  return (
    <div className="rounded-2xl border border-sun/40 bg-sun/10 p-5 text-center">
      <Lock className="mx-auto mb-2 size-6 text-[#8a5a10]" />
      <p className="font-semibold">{FEATURE_LABEL[feature]}</p>
      <p className="mt-1 text-sm text-muted">This isn&apos;t on your current plan.</p>
      <Button className="mt-3" onClick={() => upsell(feature)}>See plans</Button>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; badge?: React.ReactNode }[] }) {
  return (
    <div className="no-scrollbar -mx-1 mb-4 flex gap-1 overflow-x-auto px-1">
      {tabs.map((t) => (
        <button key={t.value} onClick={() => onChange(t.value)} className={cx("shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition", value === t.value ? "bg-ink text-white" : "bg-white text-ink/70 border border-line hover:bg-ink/5")}>
          {t.label}{t.badge}
        </button>
      ))}
    </div>
  );
}

/** Simple bar chart (SVG) for income vs expenses by month. */
export function Bars({ data }: { data: { label: string; a: number; b: number }[] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.a, d.b]));
  const w = 100 / Math.max(1, data.length);
  return (
    <div>
      <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="h-40 w-full">
        {data.map((d, i) => (
          <g key={i}>
            <rect x={i * w + w * 0.12} y={50 - (d.a / max) * 46} width={w * 0.36} height={(d.a / max) * 46} rx="0.6" className="fill-teal"><title>{`${d.label} income ${inr(d.a)}`}</title></rect>
            <rect x={i * w + w * 0.52} y={50 - (d.b / max) * 46} width={w * 0.36} height={(d.b / max) * 46} rx="0.6" className="fill-rust/70"><title>{`${d.label} expenses ${inr(d.b)}`}</title></rect>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex text-[10px] text-muted">{data.map((d, i) => <div key={i} className="flex-1 text-center">{d.label}</div>)}</div>
      <div className="mt-2 flex gap-4 text-[11px] text-muted"><span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-teal" /> Income</span><span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-rust/70" /> Expenses</span></div>
    </div>
  );
}
export function HBar({ rows }: { rows: { name: string; amount: number; sub?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.amount));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.name}>
          <div className="flex justify-between text-xs"><span className="font-medium">{r.name}{r.sub && <span className="text-muted"> · {r.sub}</span>}</span><span>{inr(r.amount)}</span></div>
          <div className="mt-1 h-2 rounded-full bg-ink/5"><div className="h-2 rounded-full bg-teal" style={{ width: `${(r.amount / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export function download(name: string, text: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob(["﻿" + text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Opens a clean printable page (Save as PDF from the print dialog). */
export function printPage(title: string, body: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
    body{font-family:Arial,Helvetica,sans-serif;color:#1f2a2e;margin:28px;font-size:12px} h1{font-size:20px;margin:0 0 4px} h2{font-size:14px;margin:18px 0 6px}
    .muted{color:#6c7679} table{border-collapse:collapse;width:100%;margin-top:10px} th,td{border:1px solid #cfd6d4;padding:6px 7px;text-align:left;vertical-align:top} th{background:#eef3f1;font-size:11px}
    .r{text-align:right} .tot td{font-weight:bold;background:#f6f8f7} @media print{button{display:none}}
  </style></head><body><button onclick="print()" style="float:right;padding:8px 14px;border-radius:20px;border:0;background:#1F5F5B;color:#fff;font-weight:bold">Print / Save as PDF</button>${body}</body></html>`);
  w.document.close();
}
export const escHtml = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
