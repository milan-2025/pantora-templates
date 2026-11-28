"use client";

import type { ReactNode } from "react";

/** Small form pieces shared by the free calculators (/wedding-budget-calculator, /airbnb-profit-calculator). */

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-plum">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-charcoal/60">{hint}</span> : null}
    </label>
  );
}

export function Money({ value, onChange, step = 100, suffix }: { value: number; onChange: (n: number) => void; step?: number; suffix?: string }) {
  return (
    <span className="flex items-center rounded-xl border border-plum/15 bg-paper focus-within:border-plum/50">
      <span className="pl-3 text-charcoal/60">₹</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="w-full bg-transparent px-2 py-2.5 outline-none"
      />
      {suffix ? <span className="pr-3 text-xs whitespace-nowrap text-charcoal/60">{suffix}</span> : null}
    </span>
  );
}

export function Slider({
  value, onChange, min, max, step = 1, unit, accent,
}: { value: number; onChange: (n: number) => void; min: number; max: number; step?: number; unit?: string; accent: string }) {
  return (
    <span className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: accent }}
      />
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
        className="w-20 rounded-lg border border-plum/15 bg-paper px-2 py-1.5 text-right outline-none focus:border-plum/50"
        aria-label="Exact value"
      />
      {unit ? <span className="-ml-1 text-sm text-charcoal/60">{unit}</span> : null}
    </span>
  );
}

/** A row of choice buttons (radio-like, or several at once with `multi`). */
export function Choices<T extends string>({
  options, value, onChange, accent, tint, multi,
}: {
  options: { key: T; label: string; hint?: string }[];
  value: T | T[];
  onChange: (v: T) => void;
  accent: string;
  tint: string;
  multi?: boolean;
}) {
  const on = (k: T) => (Array.isArray(value) ? value.includes(k) : value === k);
  return (
    <div className="flex flex-wrap gap-2" role={multi ? "group" : "radiogroup"}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role={multi ? "checkbox" : "radio"}
          aria-checked={on(o.key)}
          title={o.hint}
          onClick={() => onChange(o.key)}
          className="rounded-full border px-3.5 py-2 text-sm font-medium transition-colors"
          style={on(o.key) ? { background: tint, borderColor: accent, color: accent } : { borderColor: "rgba(59,31,74,.15)", background: "var(--paper)" }}
        >
          {multi ? (on(o.key) ? "✓ " : "+ ") : ""}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Horizontal bars showing where the money goes. */
export function Bars({ rows, accent, format }: { rows: { key: string; label: string; amount: number; note?: string }[]; accent: string; format: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.amount));
  return (
    <ul className="grid gap-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-charcoal">{r.label}</span>
            <span className="font-semibold tabular-nums text-plum">{format(r.amount)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-plum/8">
            <div className="h-2 rounded-full" style={{ width: `${Math.max(1.5, (r.amount / max) * 100)}%`, background: accent }} />
          </div>
          {r.note ? <div className="mt-0.5 text-xs text-charcoal/55">{r.note}</div> : null}
        </li>
      ))}
    </ul>
  );
}
