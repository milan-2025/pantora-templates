"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { datesFree, enquiryText, nightsBetween, waLink } from "@/lib/hostbook/site";

const DAY = 864e5;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const todayIST = () => iso(Date.now() + 5.5 * 3600_000);
const addDays = (d: string, n: number) => iso(Date.parse(d + "T00:00:00Z") + n * DAY);

/** Two-month calendar (taken nights crossed out), dates, guests and name, then WhatsApp with the message ready. */
export function BookBox(p: { slug: string; listingId: string; listing: string; site: string; whatsapp: string; busy: string[]; price: number; maxGuests: number; url: string }) {
  const today = todayIST();
  const busy = useMemo(() => new Set(p.busy), [p.busy]);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [guests, setGuests] = useState(2);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");

  const pick = (d: string) => {
    setMsg("");
    if (d < today || busy.has(d) && (!start || end || d <= start)) return;
    if (!start || end || d <= start) { setStart(d); setEnd(""); return; }
    if (!datesFree(p.busy, start, d)) { setMsg("Some nights in between are already booked. Pick other dates."); return; }
    setEnd(d);
  };
  const nights = nightsBetween(start, end);
  const send = () => {
    const text = enquiryText({ site: p.site, listing: p.listing, start: nights ? start : undefined, end: nights ? end : undefined, guests, name: name.trim(), url: p.url });
    // Tell the host in HostBook too; WhatsApp opens either way.
    try {
      fetch("/api/hostbook/site/enquiry", { method: "POST", headers: { "content-type": "application/json" }, keepalive: true, body: JSON.stringify({ slug: p.slug, listingId: p.listingId, start, end, guests, name: name.trim() }) }).catch(() => {});
    } catch { /* the WhatsApp message is what matters */ }
    window.location.href = waLink(p.whatsapp, text);
  };

  const months = [month, (() => { const [y, m] = month.split("-").map(Number); return iso(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1)).slice(0, 7); })()];
  const shift = (n: number) => { const [y, m] = month.split("-").map(Number); const t = Date.UTC(y, m - 1 + n, 1); if (iso(t).slice(0, 7) >= today.slice(0, 7)) setMonth(iso(t).slice(0, 7)); };

  return (
    <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
      <p className="flex items-baseline justify-between">
        {p.price ? (
          <span><b className="text-2xl">₹{p.price.toLocaleString("en-IN")}</b> <span className="text-sm text-muted">/ night</span></span>
        ) : (
          <span className="font-semibold">Check dates</span>
        )}
        <span className="text-xs text-muted">Crossed-out nights are booked</span>
      </p>

      <div className="mt-4 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="grid size-9 place-items-center rounded-full hover:bg-mist disabled:opacity-30" disabled={month <= today.slice(0, 7)}>
          <ChevronLeft className="size-5" />
        </button>
        <button type="button" onClick={() => shift(1)} aria-label="Next month" className="grid size-9 place-items-center rounded-full hover:bg-mist">
          <ChevronRight className="size-5" />
        </button>
      </div>
      <div className="mt-1 grid gap-5 sm:grid-cols-2">
        {months.map((mo) => {
          const [y, m] = mo.split("-").map(Number);
          const first = Date.UTC(y, m - 1, 1);
          const lead = (new Date(first).getUTCDay() + 6) % 7; // Monday first
          const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
          return (
            <div key={mo}>
              <p className="mb-2 text-center text-sm font-semibold">{new Date(first).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}</p>
              <div className="grid grid-cols-7 text-center text-[11px] text-muted">{["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i}>{d}</span>)}</div>
              <div className="mt-1 grid grid-cols-7 gap-0.5">
                {Array.from({ length: lead }, (_, i) => <span key={"x" + i} />)}
                {Array.from({ length: days }, (_, i) => {
                  const d = iso(first + i * DAY);
                  const past = d < today, taken = busy.has(d), inRange = start && end && d > start && d < end, edge = d === start || d === end;
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={past}
                      onClick={() => pick(d)}
                      aria-label={`${d}${taken ? ", booked" : ""}`}
                      className={`aspect-square rounded-lg text-sm ${edge ? "bg-teal font-semibold text-sand" : inRange ? "bg-mist" : ""} ${past ? "text-muted/40" : taken ? "bg-ink/5 text-muted line-through" : "hover:bg-mist"}`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <label className="grid gap-1">
          <span className="text-muted">Check-in</span>
          <input type="date" min={today} value={start} onChange={(e) => { setStart(e.target.value); if (end && end <= e.target.value) setEnd(""); }} className="rounded-xl border border-line px-3 py-2" />
        </label>
        <label className="grid gap-1">
          <span className="text-muted">Check-out</span>
          <input type="date" min={start ? addDays(start, 1) : today} value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-xl border border-line px-3 py-2" />
        </label>
        <label className="grid gap-1">
          <span className="text-muted">Guests</span>
          <input type="number" min={1} max={p.maxGuests || 30} value={guests} onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))} className="rounded-xl border border-line px-3 py-2" />
        </label>
        <label className="grid gap-1">
          <span className="text-muted">Your name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="rounded-xl border border-line px-3 py-2" />
        </label>
      </div>
      {start && end && !datesFree(p.busy, start, end) ? <p className="mt-3 text-sm text-rust">Some of these nights are already booked. You can still ask the host.</p> : null}
      {msg ? <p className="mt-3 text-sm text-rust">{msg}</p> : null}
      {nights && p.price ? <p className="mt-3 text-sm text-muted">{nights} night{nights === 1 ? "" : "s"} × ₹{p.price.toLocaleString("en-IN")} = <b className="text-ink">₹{(nights * p.price).toLocaleString("en-IN")}</b> (the host confirms the final price)</p> : null}
      <button type="button" onClick={send} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-teal px-5 py-3 font-semibold text-sand hover:bg-teal-deep">
        <MessageCircle className="size-5" /> Send enquiry on WhatsApp
      </button>
      <p className="mt-2 text-center text-xs text-muted">You book directly with the host. No booking fee.</p>
    </div>
  );
}
