"use client";

import { useMemo, useState } from "react";
import { SmartLink } from "@/components/ui/SmartLink";
import { Bars, Choices, Field, Slider } from "@/components/tools/ToolUi";
import { CITY_TIERS, DEFAULT_INPUT, FUNCTIONS, STYLES, estimateBudget, lakh, type BudgetInput, type FunctionKey } from "@/lib/tools/weddingBudget";

const ACCENT = "#A23A2F";
const TINT = "#F8E1DD";

/** The calculator on /wedding-budget-calculator. */
export function WeddingBudgetCalculator() {
  const [v, setV] = useState<BudgetInput>(DEFAULT_INPUT);
  const set = <K extends keyof BudgetInput>(k: K, x: BudgetInput[K]) => setV((o) => ({ ...o, [k]: x }));
  const toggle = (f: FunctionKey) => setV((o) => ({ ...o, functions: o.functions.includes(f) ? o.functions.filter((x) => x !== f) : [...o.functions, f] }));
  const r = useMemo(() => estimateBudget(v), [v]);
  const rows = [...r.lines].sort((a, b) => b.amount - a.amount);

  const share = () => {
    const text = `Our wedding budget estimate: ${lakh(r.low)} – ${lakh(r.high)} for ${r.guests} guests (${lakh(r.perGuest)} per guest).\nWork out yours free: https://pandoratemplates.com/wedding-budget-calculator`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr]">
      <div className="card grid content-start gap-6 rounded-3xl p-6 md:p-8">
        <Field label="Where is the wedding?">
          <Choices options={CITY_TIERS} value={v.city} onChange={(x) => set("city", x)} accent={ACCENT} tint={TINT} />
          <span className="mt-1 block text-xs text-charcoal/60">{CITY_TIERS.find((c) => c.key === v.city)?.hint}</span>
        </Field>
        <Field label="Style">
          <Choices options={STYLES} value={v.style} onChange={(x) => set("style", x)} accent={ACCENT} tint={TINT} />
          <span className="mt-1 block text-xs text-charcoal/60">{STYLES.find((s) => s.key === v.style)?.hint}</span>
        </Field>
        <Field label="Guests at the wedding" hint="Fewer usually come to Haldi and Mehendi; the calculator allows for that.">
          <Slider value={v.guests} onChange={(x) => set("guests", x)} min={50} max={1500} step={10} accent={ACCENT} />
        </Field>
        <Field label="Functions">
          <Choices options={FUNCTIONS} value={v.functions} onChange={toggle} accent={ACCENT} tint={TINT} multi />
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Guests from out of town" hint="Who need a room">
            <Slider value={v.outstation} onChange={(x) => set("outstation", x)} min={0} max={100} step={5} unit="%" accent={ACCENT} />
          </Field>
          <Field label="Nights they stay">
            <Slider value={v.nights} onChange={(x) => set("nights", x)} min={0} max={5} accent={ACCENT} />
          </Field>
        </div>
      </div>

      <div className="grid content-start gap-6">
        <div className="rounded-3xl p-6 text-cream md:p-8" style={{ background: "var(--plum)" }} aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cream/70">Estimated total</p>
          <p className="mt-2 font-display text-4xl leading-tight md:text-[2.6rem]">
            {lakh(r.low)} – {lakh(r.high)}
          </p>
          <p className="mt-2 text-cream/80">
            About {lakh(r.total)} · {lakh(r.perGuest)} per guest · {r.plates.toLocaleString("en-IN")} plates
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <SmartLink href="/planner/signup?utm_source=budget-calculator" className="rounded-full bg-marigold px-5 py-2.5 font-semibold text-plum">
              Track this budget in the planner, free
            </SmartLink>
            <button type="button" onClick={share} className="rounded-full px-5 py-2.5 font-semibold ring-1 ring-cream/40 hover:bg-cream/10">
              Share on WhatsApp
            </button>
          </div>
        </div>
        <div className="card rounded-3xl p-6 md:p-8">
          <h2 className="mb-4 font-display text-2xl">Where the money goes</h2>
          <Bars rows={rows} accent={ACCENT} format={lakh} />
          <p className="mt-5 text-xs text-charcoal/55">
            Rough estimates from typical 2025–26 prices. Real quotes depend on your dates, vendors and how much you bargain, so use this to set a starting budget,
            then put the real numbers in a planner.
          </p>
        </div>
      </div>
    </div>
  );
}
