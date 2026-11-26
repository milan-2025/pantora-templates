"use client";
import { useEffect, useState } from "react";
import { Check, Loader2, Lock, Sparkles } from "lucide-react";
import { FEATURES, FEATURE_LABEL, type FeatureKey } from "@/lib/hostbook/features";
import { api } from "../api";
import { useStore, type PlanV } from "../store";
import { Badge, Button, Card, Field, Input, PageHead, Sheet, cx, money } from "../ui";

let rzp: Promise<void> | null = null;
function loadRazorpay() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).Razorpay) return Promise.resolve();
  rzp ??= new Promise((ok, bad) => { const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js"; s.onload = () => ok(); s.onerror = () => { rzp = null; bad(new Error("Couldn't load the payment window. Check your internet.")); }; document.head.appendChild(s); });
  return rzp;
}

export function usePlans() {
  const [plans, setPlans] = useState<PlanV[] | null>(null);
  useEffect(() => { api<{ plans: PlanV[] }>("plans").then((r) => setPlans(r.plans)).catch(() => setPlans([])); }, []);
  return plans;
}

export function PlanCards({ plans, current, onPick, highlight }: { plans: PlanV[]; current?: string; onPick?: (p: PlanV) => void; highlight?: FeatureKey }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {plans.map((p) => {
        const isCur = p.id === current;
        const hasHi = highlight && p.features.includes(highlight);
        return (
          <div key={p.id} className={cx("flex flex-col rounded-2xl border bg-white p-4", p.badge ? "border-teal ring-1 ring-teal" : "border-line", highlight && !hasHi && "opacity-60")}>
            <div className="flex items-center justify-between"><b className="text-lg">{p.name}</b>{p.badge && <Badge tone="teal">{p.badge}</Badge>}</div>
            {p.tagline && <p className="text-xs text-muted">{p.tagline}</p>}
            <p className="mt-2 font-serif text-3xl">{p.isFree ? "Free" : money(p.price)}<span className="font-sans text-xs text-muted">{p.isFree ? "" : " / year"}</span></p>
            <ul className="mt-3 flex-1 space-y-1 text-sm">
              <li className="flex gap-1.5"><Check className="mt-0.5 size-4 shrink-0 text-teal" />{p.listings} listing{p.listings === 1 ? "" : "s"}, {p.staff} staff</li>
              <li className="flex gap-1.5"><Check className="mt-0.5 size-4 shrink-0 text-teal" />Bookings, calendar, guest register, income & expenses</li>
              <li className="flex gap-1.5"><Check className="mt-0.5 size-4 shrink-0 text-teal" />ID photos kept {p.idDays >= 365 ? `${Math.round(p.idDays / 365)} year${p.idDays >= 730 ? "s" : ""}` : p.idDays >= 60 ? `${Math.round(p.idDays / 30)} months` : `${p.idDays} days`}{p.hostChoosesIdDays ? " (or less, your choice)" : ""}</li>
              {FEATURES.filter((f) => p.features.includes(f.key)).map((f) => <li key={f.key} className={cx("flex gap-1.5", f.key === highlight && "font-semibold text-teal")}><Check className="mt-0.5 size-4 shrink-0 text-teal" />{f.label}</li>)}
              {p.highlights.map((h) => <li key={h} className="flex gap-1.5"><Check className="mt-0.5 size-4 shrink-0 text-teal" />{h}</li>)}
            </ul>
            {onPick && (isCur ? <Button tone="soft" className="mt-4" disabled>Your plan</Button> : !p.isFree ? <Button className="mt-4" onClick={() => onPick(p)}>Choose {p.name}</Button> : null)}
          </div>
        );
      })}
    </div>
  );
}

function Checkout({ plan, onClose }: { plan: PlanV; onClose: () => void }) {
  const s = useStore();
  const [extra, setExtra] = useState(plan.id === s.me.access.paidPlan?.id ? s.me.account.extraListings : 0);
  const [coupon, setCoupon] = useState(""), [applied, setApplied] = useState("");
  const [q, setQ] = useState<{ total: number; amount: number; discount: number; label: string; kind: string; expiresAt: string } | null>(null);
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear the last error before a new price check
    setErr("");
    api("checkout", { body: { plan: plan.id, extra, coupon: applied, quoteOnly: true } }).then(setQ).catch((e) => { setErr(e.message); if (applied) setApplied(""); });
  }, [plan.id, extra, applied]);
  const pay = async () => {
    setBusy(true); setErr("");
    try {
      const o = await api("checkout", { body: { plan: plan.id, extra, coupon: applied } });
      let res: Record<string, unknown> = {};
      if (o.provider === "razorpay") {
        await loadRazorpay();
        res = await new Promise((ok, bad) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const r = new (window as any).Razorpay({ ...o.clientData, order_id: o.orderId, name: "Pandora Templates", description: `HostBook ${plan.name} – 1 year`, prefill: { email: s.me.email, contact: s.me.account.phone }, theme: { color: "#1F5F5B" }, handler: ok, modal: { ondismiss: () => bad(new Error("Payment cancelled")) } });
          r.open();
        });
      }
      await api("checkout/verify", { body: res });
      await s.reloadMe();
      s.toast(`${plan.name} is active. Thank you! 🎉`);
      onClose();
      setTimeout(() => location.reload(), 600);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title={`HostBook ${plan.name}`} footer={<Button onClick={pay} disabled={busy || !q}>{busy ? <Loader2 className="size-4 animate-spin" /> : q ? `Pay ${money(q.total)}` : "…"}</Button>}>
      <div className="space-y-3 text-sm">
        <Field label={`Extra listings (${money(s.me.extraListingPrice)} each a year)`} hint={`${plan.listings} included. You'd have ${plan.listings + extra} in total.`}><Input type="number" min={0} max={200} value={extra} onChange={(e) => setExtra(Math.max(0, Number(e.target.value) || 0))} /></Field>
        <div className="flex gap-2"><Input placeholder="Coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} /><Button tone="soft" onClick={() => setApplied(coupon.trim())} disabled={!coupon.trim()}>Apply</Button></div>
        {q && <Card className="bg-sand">
          {q.kind === "upgrade" && <p className="mb-2 text-xs text-muted">Upgrading: you only pay the difference. Your plan end date stays the same.</p>}
          {q.kind === "renew" && <p className="mb-2 text-xs text-muted">Renewing: one more year is added on top of your current end date.</p>}
          <div className="flex justify-between"><span>Price</span><span>{money(q.amount)}</span></div>
          {q.discount > 0 && <div className="flex justify-between text-leaf"><span>{applied} ({q.label})</span><span>−{money(q.discount)}</span></div>}
          <div className="mt-1 flex justify-between border-t border-line pt-1 font-semibold"><span>Total (incl. GST)</span><span>{money(q.total)}</span></div>
          <p className="mt-2 text-xs text-muted">Runs until {new Date(q.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}. One-time payment, no auto-renewal.</p>
        </Card>}
        {err && <p className="rounded-xl bg-rust/10 px-3 py-2 text-rust">{err}</p>}
        <p className="text-xs text-muted">Secure checkout by Razorpay: UPI, cards, net banking.</p>
      </div>
    </Sheet>
  );
}

export function PlanScreen() {
  const s = useStore();
  const plans = usePlans();
  const [pick, setPick] = useState<PlanV | null>(null);
  const a = s.me.access;
  const [now] = useState(() => Date.now());
  return (
    <div>
      <PageHead title="Your plan" sub={<>You&apos;re on <b>{a.plan.name}</b>{a.viaStays && " (free as a Pandora Stays host)"}{a.expiresAt && ` until ${new Date(a.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`}. {a.listingLimit} listing{a.listingLimit === 1 ? "" : "s"}, {a.staffLimit} staff.</>} />
      {a.paidPlan && a.expiresAt && <Button className="mb-4" onClick={() => setPick(a.paidPlan)}><Sparkles className="size-4" /> Renew or add listings</Button>}
      {plans ? <PlanCards plans={plans} current={a.paidPlan && a.expiresAt && Date.parse(a.expiresAt) > now ? a.paidPlan.id : a.plan.id} onPick={setPick} /> : <Loader2 className="size-5 animate-spin text-teal" />}
      <p className="mt-4 text-xs text-muted">If a plan ends, nothing is deleted: paid features lock until you renew. Questions? {s.me.whatsapp ? <a className="underline" href={`https://wa.me/${s.me.whatsapp}`} target="_blank" rel="noreferrer">WhatsApp us</a> : "Email us"}.</p>
      {pick && <Checkout plan={pick} onClose={() => setPick(null)} />}
    </div>
  );
}

/** Opened when someone taps a locked feature or hits a plan limit. */
export function UpsellSheet() {
  const s = useStore();
  const plans = usePlans();
  const f = s.upsellFor;
  const [pick, setPick] = useState<PlanV | null>(null);
  if (!f && !pick) return null;
  const title = f === "listings" ? "Add more listings" : f === "staff" ? "Add more team members" : f ? FEATURE_LABEL[f as FeatureKey] : "";
  const feature = f && f !== "listings" && f !== "staff" ? (f as FeatureKey) : undefined;
  const options = (plans ?? []).filter((p) => !p.isFree && (feature ? p.features.includes(feature) : f === "listings" ? p.listings > s.me.access.listingLimit || p.id === s.me.access.paidPlan?.id : p.staff > s.me.access.staffLimit));
  return (
    <>
      {f && <Sheet wide open onClose={s.closeUpsell} title={title}>
        <p className="mb-4 flex items-center gap-2 text-sm text-muted"><Lock className="size-4" />{s.me.role !== "owner" ? "Ask the account owner to upgrade the plan." : f === "listings" ? `Your plan has ${s.me.access.listingLimit} listing${s.me.access.listingLimit === 1 ? "" : "s"}. Move up a plan, or buy extra listings on a paid plan.` : "These plans include it:"}</p>
        {plans ? <PlanCards plans={options.length ? options : plans.filter((p) => !p.isFree)} highlight={feature} onPick={s.me.role === "owner" ? (p) => { s.closeUpsell(); setPick(p); } : undefined} /> : <Loader2 className="size-5 animate-spin text-teal" />}
      </Sheet>}
      {pick && <Checkout plan={pick} onClose={() => setPick(null)} />}
    </>
  );
}
