"use client";

import { useMemo, useState } from "react";
import { SmartLink } from "@/components/ui/SmartLink";
import { Bars, Choices, Field, Money, Slider } from "@/components/tools/ToolUi";
import { DEFAULT_PROFIT, PLATFORMS, gstRate, inr, profit, scenarios, type ProfitInput } from "@/lib/tools/airbnbProfit";

const ACCENT = "#94491F";
const TINT = "#F7E4D8";

/** The calculator on /airbnb-profit-calculator. */
export function AirbnbProfitCalculator() {
  const [v, setV] = useState<ProfitInput>(DEFAULT_PROFIT);
  const set = <K extends keyof ProfitInput>(k: K) => (x: ProfitInput[K]) => setV((o) => ({ ...o, [k]: x }));
  const r = useMemo(() => profit(v), [v]);
  const what = useMemo(() => scenarios(v), [v]);
  const platformKey = PLATFORMS.find((p) => p.fee === v.platformFee)?.label ?? "custom";
  const good = r.net >= 0;

  return (
    <div className="grid gap-6 pb-16 lg:grid-cols-[1fr_1.05fr] lg:pb-0">
      {/* Phones: the result stays in view while the form is filled in. */}
      <a
        href="#profit-result"
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between px-5 py-3 text-cream shadow-lift lg:hidden"
        style={{ background: good ? "var(--plum)" : "#7A2620", paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <span className="text-sm text-cream/80">{good ? "Profit per month" : "Loss per month"}</span>
        <span className="font-display text-2xl">{inr(r.net)}</span>
      </a>
      <div className="grid content-start gap-6">
        <section className="card grid gap-5 rounded-3xl p-6 md:p-8">
          <h2 className="font-display text-2xl">Bookings</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Nightly rate" hint="What the guest pays per night, on average">
              <Money value={v.rate} onChange={set("rate")} />
            </Field>
            <Field label="Average stay" hint="Nights per booking">
              <Slider value={v.avgStay} onChange={set("avgStay")} min={1} max={14} accent={ACCENT} />
            </Field>
          </div>
          <Field label="Occupancy" hint={`${Math.round(r.nights)} of 30 nights booked a month`}>
            <Slider value={v.occupancy} onChange={set("occupancy")} min={0} max={100} unit="%" accent={ACCENT} />
          </Field>
          <Field label="Where bookings come from">
            <Choices
              options={[...PLATFORMS.map((p) => ({ key: p.label, label: `${p.label} · ${p.fee}%` })), ...(platformKey === "custom" ? [{ key: "custom", label: `Custom · ${v.platformFee}%` }] : [])]}
              value={platformKey}
              onChange={(k) => {
                const p = PLATFORMS.find((x) => x.label === k);
                if (p) set("platformFee")(p.fee);
              }}
              accent={ACCENT}
              tint={TINT}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Platform fee" hint="Taken from your payout">
              <Slider value={v.platformFee} onChange={set("platformFee")} min={0} max={30} unit="%" accent={ACCENT} />
            </Field>
            <Field label="Direct bookings" hint="WhatsApp, repeat guests, own website: no fee">
              <Slider value={v.directShare} onChange={set("directShare")} min={0} max={100} step={5} unit="%" accent={ACCENT} />
            </Field>
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={v.gstIncluded} onChange={(e) => set("gstIncluded")(e.target.checked)} className="mt-1" style={{ accentColor: ACCENT }} />
            <span>
              <b className="text-plum">My rate includes GST</b> (I&rsquo;m GST-registered and pay it myself). At {inr(v.rate)} a night the rate is{" "}
              <b>{gstRate(v.rate)}%</b>: nil up to ₹1,000, 5% up to ₹7,500, 18% above.
            </span>
          </label>
        </section>

        <section className="card grid gap-5 rounded-3xl p-6 md:p-8">
          <h2 className="font-display text-2xl">Costs</h2>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Cleaning" hint="Per booking">
              <Money value={v.cleaning} onChange={set("cleaning")} step={50} />
            </Field>
            <Field label="Laundry" hint="Per booking">
              <Money value={v.laundry} onChange={set("laundry")} step={50} />
            </Field>
            <Field label="Toiletries, tea, water" hint="Per night booked">
              <Money value={v.supplies} onChange={set("supplies")} step={10} />
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Rent or EMI" hint="Per month">
              <Money value={v.rent} onChange={set("rent")} step={500} />
            </Field>
            <Field label="Electricity, water, gas" hint="Per month">
              <Money value={v.electricity} onChange={set("electricity")} step={250} />
            </Field>
            <Field label="Wi-Fi & TV" hint="Per month">
              <Money value={v.internet} onChange={set("internet")} step={100} />
            </Field>
            <Field label="Caretaker / staff" hint="Per month">
              <Money value={v.staff} onChange={set("staff")} step={500} />
            </Field>
            <Field label="Society maintenance" hint="Per month">
              <Money value={v.society} onChange={set("society")} step={250} />
            </Field>
            <Field label="Other" hint="Software, insurance, ads">
              <Money value={v.other} onChange={set("other")} step={250} />
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Repairs fund" hint="Share of revenue kept for breakages and replacements">
              <Slider value={v.maintenance} onChange={set("maintenance")} min={0} max={15} unit="%" accent={ACCENT} />
            </Field>
            <Field label="Setup cost (one-time)" hint="Furniture, linen, appliances, deposit">
              <Money value={v.setup} onChange={set("setup")} step={10000} />
            </Field>
          </div>
        </section>
      </div>

      <div className="grid content-start gap-6 lg:sticky lg:top-24">
        <div id="profit-result" className="scroll-mt-24 rounded-3xl p-6 text-cream md:p-8" style={{ background: good ? "var(--plum)" : "#7A2620" }} aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cream/70">{good ? "Profit per month" : "Loss per month"}</p>
          <p className="mt-2 font-display text-5xl leading-tight">{inr(r.net)}</p>
          <p className="mt-2 text-cream/80">
            {inr(r.yearly)} a year · {r.margin < 0 ? "−" : ""}{Math.abs(Math.round(r.margin))}% margin · {inr(r.gross)} revenue
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-cream/10 p-3">
              <dt className="text-cream/70">Break-even occupancy</dt>
              <dd className="mt-0.5 text-xl font-semibold">{Number.isFinite(r.breakEven) ? (r.breakEven > 100 ? "Not reachable" : `${Math.ceil(r.breakEven)}%`) : "Not reachable"}</dd>
            </div>
            <div className="rounded-2xl bg-cream/10 p-3">
              <dt className="text-cream/70">Setup paid back in</dt>
              <dd className="mt-0.5 text-xl font-semibold">{r.paybackMonths == null ? "–" : r.paybackMonths > 120 ? "10+ years" : `${Math.ceil(r.paybackMonths)} months`}</dd>
            </div>
            <div className="rounded-2xl bg-cream/10 p-3">
              <dt className="text-cream/70">Bookings a month</dt>
              <dd className="mt-0.5 text-xl font-semibold">{r.bookings.toFixed(1)}</dd>
            </div>
            <div className="rounded-2xl bg-cream/10 p-3">
              <dt className="text-cream/70">You keep per night</dt>
              <dd className="mt-0.5 text-xl font-semibold">{inr(r.perNight)}</dd>
            </div>
          </dl>
          <SmartLink href="/hostbook?utm_source=profit-calculator" className="mt-5 inline-block rounded-full bg-marigold px-5 py-2.5 font-semibold text-plum">
            Track real profit per listing with HostBook, free
          </SmartLink>
        </div>
        <div className="card rounded-3xl p-6 md:p-8">
          <h2 className="mb-4 font-display text-2xl">Where the revenue goes</h2>
          <Bars rows={[...r.lines].sort((a, b) => b.amount - a.amount)} accent={ACCENT} format={inr} />
        </div>
        <div className="card rounded-3xl p-6 md:p-8">
          <h2 className="mb-3 font-display text-2xl">What if occupancy changes?</h2>
          <table className="w-full text-sm">
            <tbody>
              {what.map((s) => (
                <tr key={s.occupancy} className="border-b border-plum/10 last:border-0">
                  <td className="py-2">{s.occupancy}% booked</td>
                  <td className={`py-2 text-right font-semibold tabular-nums ${s.net < 0 ? "text-[#A23A2F]" : "text-plum"}`}>{inr(s.net)} / month</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-charcoal/55">
            Estimates only, before income tax. Check your platform&rsquo;s fee in its payout report, and ask your CA about GST and income tax on rental income.
          </p>
        </div>
      </div>
    </div>
  );
}
