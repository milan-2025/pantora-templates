"use client";
/**
 * WhatsApp enquiry buttons. Every message goes to the site's configured number (never the host's) and always
 * includes the property ID. Nothing is sent automatically: the guest presses a button, WhatsApp opens with the
 * message typed in, and the guest presses send. A click is logged (no personal data) so the admin can see interest.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, MapPin, MessageCircle, X } from "lucide-react";
import { cleanGuests, enquiryMessage, waLink } from "@/lib/stays/core";
import type { TemplateKey } from "@/lib/stays/constants";

type Props = {
  code: string; title: string; place: string;
  whatsappNumber: string; templates: Partial<Record<TemplateKey, string>>;
  shareId?: string | null; layout?: "panel" | "bar";
  priceSlot?: React.ReactNode;
};

function logClick(body: Record<string, unknown>) {
  try {
    const data = JSON.stringify({ ...body, source: location.pathname });
    const url = "/api/stays/public?a=click";
    if (!(navigator.sendBeacon && navigator.sendBeacon(url, new Blob([data], { type: "application/json" })))) {
      fetch(url, { method: "POST", body: data, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
    }
  } catch { /* logging must never block the enquiry */ }
}

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export function EnquiryButtons(p: Props) {
  const [open, setOpen] = useState(false);
  const vars = { title: p.title, id: p.code, location: p.place };
  const simple = useMemo(() => waLink(p.whatsappNumber, enquiryMessage("simple", vars, p.templates)), [p.whatsappNumber, p.templates, p.title, p.code]); // eslint-disable-line react-hooks/exhaustive-deps
  const loc = useMemo(() => waLink(p.whatsappNumber, enquiryMessage("location", vars, p.templates)), [p.whatsappNumber, p.templates, p.title, p.code]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!simple) return <p className="text-sm text-muted">Enquiries are not set up yet.</p>;

  const buttons = (
    <>
      <button type="button" onClick={() => setOpen(true)} className="s-btn s-btn-wa w-full">
        <CalendarDays className="size-4" aria-hidden /> Check Availability
      </button>
      <a href={simple} target="_blank" rel="noopener noreferrer" onClick={() => logClick({ code: p.code, type: "simple", share: p.shareId })} className="s-btn s-btn-ghost w-full">
        <MessageCircle className="size-4" aria-hidden /> Enquire on WhatsApp
      </a>
      <a href={loc} target="_blank" rel="noopener noreferrer" onClick={() => logClick({ code: p.code, type: "location", share: p.shareId })} className="s-btn s-btn-ghost w-full">
        <MapPin className="size-4" aria-hidden /> Ask for Exact Location
      </a>
    </>
  );

  return (
    <>
      {p.layout === "bar" ? (
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">{p.priceSlot}</div>
          <button type="button" onClick={() => setOpen(true)} className="s-btn s-btn-wa"><CalendarDays className="size-4" aria-hidden /> Check Availability</button>
        </div>
      ) : (
        <div className="grid gap-2.5">{buttons}</div>
      )}
      {open && <DatesDialog {...p} onClose={() => setOpen(false)} />}
    </>
  );
}

function DatesDialog(p: Props & { onClose: () => void }) {
  const [checkIn, setIn] = useState("");
  const [checkOut, setOut] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [err, setErr] = useState("");
  const dlg = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    // No close() on cleanup: closing fires onClose, which would unmount the dialog during React's dev double-run.
    if (dlg.current && !dlg.current.open) dlg.current.showModal();
  }, []);

  function go(e: React.FormEvent) {
    e.preventDefault();
    if (!checkIn || !checkOut) return setErr("Please choose both dates");
    if (checkOut <= checkIn) return setErr("Check-out must be after check-in");
    const g = cleanGuests({ adults, children });
    const msg = enquiryMessage("dates", { title: p.title, id: p.code, location: p.place, checkin: checkIn, checkout: checkOut, ...g }, p.templates);
    logClick({ code: p.code, type: "dates", share: p.shareId, checkIn, checkOut, adults: g.adults, children: g.children });
    window.open(waLink(p.whatsappNumber, msg), "_blank", "noopener,noreferrer");
    p.onClose();
  }

  const counter = (label: string, hint: string, v: number, set: (n: number) => void, min: number) => (
    <div className="flex items-center justify-between gap-3 py-2">
      <div><p className="text-sm font-medium text-plum">{label}</p><p className="text-xs text-muted">{hint}</p></div>
      <div className="flex items-center gap-3">
        <button type="button" className="grid size-9 place-items-center rounded-full border border-line text-plum disabled:opacity-30" onClick={() => set(Math.max(min, v - 1))} disabled={v <= min} aria-label={`Fewer ${label.toLowerCase()}`}>−</button>
        <span className="w-6 text-center tabular-nums" aria-live="polite">{v}</span>
        <button type="button" className="grid size-9 place-items-center rounded-full border border-line text-plum" onClick={() => set(Math.min(30, v + 1))} aria-label={`More ${label.toLowerCase()}`}>+</button>
      </div>
    </div>
  );

  return (
    <dialog ref={dlg} onClose={p.onClose} onCancel={p.onClose} className="m-auto w-[min(92vw,26rem)] rounded-3xl bg-paper p-0 text-charcoal shadow-lift backdrop:bg-plum/40">
      <form onSubmit={go} className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">Check availability</h2>
            <p className="mt-1 text-sm text-muted">{p.title} · {p.code}</p>
          </div>
          <button type="button" onClick={p.onClose} className="rounded-full p-1.5 text-muted hover:bg-plum/5" aria-label="Close"><X className="size-5" /></button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <label className="block"><span className="s-label">Check-in</span><input type="date" required min={today()} value={checkIn} onChange={(e) => { setIn(e.target.value); setErr(""); }} className="s-input" /></label>
          <label className="block"><span className="s-label">Check-out</span><input type="date" required min={checkIn || today()} value={checkOut} onChange={(e) => { setOut(e.target.value); setErr(""); }} className="s-input" /></label>
        </div>
        <div className="mt-3 divide-y divide-line">
          {counter("Adults", "13 years and above", adults, setAdults, 1)}
          {counter("Children", "Below 13 years", children, setChildren, 0)}
        </div>
        <p className="mt-2 text-sm text-plum">Total guests: <strong>{adults + children}</strong></p>
        {err && <p className="mt-3 rounded-xl bg-blush px-3 py-2 text-sm text-coral" role="alert">{err}</p>}
        <button type="submit" className="s-btn s-btn-wa mt-5 w-full"><MessageCircle className="size-4" aria-hidden /> Continue on WhatsApp</button>
        <p className="mt-2 text-center text-xs text-muted">WhatsApp opens with your message ready. Nothing is sent until you press send.</p>
      </form>
    </dialog>
  );
}

/** The two secondary enquiries as small links (phone bottom bar). */
export function EnquiryQuickLinks(p: Props) {
  const vars = { title: p.title, id: p.code, location: p.place };
  const simple = waLink(p.whatsappNumber, enquiryMessage("simple", vars, p.templates));
  const loc = waLink(p.whatsappNumber, enquiryMessage("location", vars, p.templates));
  if (!simple) return null;
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <a href={simple} target="_blank" rel="noopener noreferrer" onClick={() => logClick({ code: p.code, type: "simple", share: p.shareId })} className="s-btn s-btn-ghost s-btn-sm"><MessageCircle className="size-4" aria-hidden /> Enquire</a>
      <a href={loc} target="_blank" rel="noopener noreferrer" onClick={() => logClick({ code: p.code, type: "location", share: p.shareId })} className="s-btn s-btn-ghost s-btn-sm"><MapPin className="size-4" aria-hidden /> Exact location</a>
    </div>
  );
}
