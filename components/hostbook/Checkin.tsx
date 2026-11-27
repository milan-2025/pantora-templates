"use client";
/** Guest online check-in (/hostbook/c/<code>): guests fill in their details and upload IDs before arrival, and can fix them later. */
import { useEffect, useState } from "react";
import { AlertCircle, Camera, CheckCircle2, Loader2, MapPin, Pencil, Plus, ShieldCheck, Trash2, Wifi } from "lucide-react";
import { ID_TYPES } from "@/lib/hostbook/features";
import { ID_RULES, checkGuest, isIndian, type CheckinField } from "@/lib/hostbook/core";
import { uploadSigned } from "./api";
import { Button, Card, Field, Input, Select, Textarea, cx, fmtDay } from "./ui";

type Saved = {
  id: string; name: string; phone: string; email: string; address: string; city: string; nationality: string; gender: string; age: string | number; idType: string;
  idMasked: string; hasId: boolean; passportMasked: string; passportExpiry: string; visa: string; visaType: string; visaExpiry: string; arrivalInIndia: string; arrivedFrom: string; nextDestination: string; photos: string[];
};
type View = {
  host: { name: string; logoUrl: string };
  listing: { name: string; city: string; rules: string; checkIn: string; checkOut: string; address?: string; mapUrl?: string; wifiName?: string; wifiPass?: string; guidebook?: string } | null;
  stay: { start: string; end: string; adults: number; children: number };
  status: string; canEdit: boolean; changeRequest: { fields: string[]; note: string } | null; guests: Saved[];
  required: CheckinField[]; requiredForAll: boolean; idDays: number; foreignFields: boolean;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- form values are strings, plus the uploaded photos
type Person = Record<string, any>;

async function call<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`/api/hostbook/checkin/${path}`, { method: body ? "POST" : "GET", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || "Something went wrong"), { data: d });
  return d as T;
}
const blank = (): Person => ({ name: "", phone: "", email: "", address: "", city: "", nationality: "Indian", gender: "", age: "", idType: "Aadhaar", idNumber: "", photos: [], had: [] });
const fromSaved = (g: Saved): Person => ({
  id: g.id, name: g.name, phone: g.phone, email: g.email, address: g.address, city: g.city, nationality: g.nationality || "Indian", gender: g.gender, age: g.age || "",
  idType: g.idType || "Aadhaar", idNumber: "", idMasked: g.idMasked, hasId: g.hasId, passport: "", passportMasked: g.passportMasked, passportExpiry: g.passportExpiry, visa: g.visa,
  visaType: g.visaType, visaExpiry: g.visaExpiry, arrivalInIndia: g.arrivalInIndia, arrivedFrom: g.arrivedFrom, nextDestination: g.nextDestination, photos: [], had: g.photos,
});
const formFor = (v: View): Person[] => (v.guests.length ? v.guests.map(fromSaved) : Array.from({ length: Math.max(1, Math.min(6, v.stay.adults || 1)) }, blank));

export function CheckinPage({ code }: { code: string }) {
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState("");
  const [people, setPeople] = useState<Person[]>([blank()]);
  const [errors, setErrors] = useState<Record<string, string>[]>([]);
  const [agree, setAgree] = useState(false), [busy, setBusy] = useState(false), [msg, setMsg] = useState(""), [editing, setEditing] = useState(false);
  useEffect(() => {
    call<View>(code).then((x) => { setV(x); setPeople(formFor(x)); }).catch((e) => setErr(e.message));
  }, [code]);
  const set = (i: number, k: string, val: unknown) => {
    setPeople((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: val } : p)));
    setErrors((es) => es.map((e, j) => (j === i ? { ...e, [k === "idType" ? "idNumber" : k]: "" } : e)));
  };
  const upload = async (i: number, side: string, file: File) => {
    set(i, "_busy", side);
    try {
      const sig = await call<{ publicId: string; url: string; fields: Record<string, string> }>(`${code}/sign`, {});
      await uploadSigned(sig, file);
      setPeople((ps) => ps.map((p, j) => (j === i ? { ...p, _busy: "", photos: [...(p.photos as { side: string }[]).filter((x) => x.side !== side), { publicId: sig.publicId, side }] } : p)));
      setErrors((es) => es.map((e, j) => (j === i ? { ...e, [side === "back" ? "idBack" : "idFront"]: "" } : e)));
    } catch (e) { setMsg((e as Error).message); set(i, "_busy", ""); }
  };
  const submit = async () => {
    if (!v) return;
    setMsg("");
    // Same checks as the server, so mistakes show next to the field straight away.
    const found = people.map((p, i) => checkGuest(p, { required: v.required, all: v.requiredForAll, main: i === 0, photos: (p.photos as { side: string }[]).map((x) => x.side), hadPhotos: p.had, hadId: Boolean(p.hasId && !p.idNumber) }));
    setErrors(found);
    const first = found.findIndex((e) => Object.values(e).some(Boolean));
    if (first >= 0) { setMsg(`Please check ${first === 0 ? "the main guest" : `guest ${first + 1}`}: ${Object.values(found[first]).find(Boolean)}`); return; }
    if (!agree) return setMsg("Please tick that you agree to the house rules.");
    setBusy(true);
    try {
      const out = await call<View>(`${code}/submit`, { guests: people.map(({ _busy: _b, had: _h, idMasked: _m, hasId: _x, passportMasked: _pm, ...p }) => { void _b; void _h; void _m; void _x; void _pm; return p; }), agree });
      setV(out); setPeople(formFor(out)); setEditing(false); setAgree(false); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      const d = (e as { data?: { errors?: Record<string, string>[] } }).data;
      if (d?.errors) setErrors(d.errors);
      setMsg((e as Error).message);
    } finally { setBusy(false); }
  };

  if (err) return <Shell><Card className="text-center"><p className="font-semibold">Check-in link</p><p className="mt-1 text-sm text-muted">{err}</p></Card></Shell>;
  if (!v) return <Shell><div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-teal" /></div></Shell>;
  const l = v.listing;
  const sent = v.status === "submitted" || v.status === "approved";
  const showForm = !sent || editing;
  const ask = new Set(v.changeRequest?.fields ?? []);
  const req = (i: number, k: CheckinField) => (i === 0 || v.requiredForAll) && v.required.includes(k) && !(k === "phone" && i > 0);
  const label = (text: string, i: number, k?: CheckinField) => `${text}${k && req(i, k) ? " *" : ""}`;
  const flag = (k: string) => (ask.has(k) ? "ring-2 ring-rust/60 rounded-xl" : "");
  const hint = (i: number, k: string, extra?: string) => (errors[i]?.[k] ? <span className="text-rust">{errors[i][k]}</span> : extra);
  return (
    <Shell host={v.host}>
      <Card className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Your stay</p>
        <h1 className="font-serif text-2xl">{l?.name ?? "Your stay"}</h1>
        <p className="text-sm text-muted">{fmtDay(v.stay.start, true)} → {fmtDay(v.stay.end, true)}{l?.checkIn ? ` · check-in from ${l.checkIn}` : ""}{l?.checkOut ? ` · check-out by ${l.checkOut}` : ""}</p>
      </Card>

      {v.status === "changes" && v.changeRequest && (
        <Card className="mb-4 border-rust/30 bg-rust/5">
          <p className="flex items-center gap-1.5 font-semibold text-rust"><AlertCircle className="size-4" /> Your host asked you to update some details</p>
          {v.changeRequest.note && <p className="mt-1 whitespace-pre-line text-sm">{v.changeRequest.note}</p>}
          {ask.size > 0 && <p className="mt-1 text-xs text-muted">Marked in red below. Everything else you sent is already filled in.</p>}
        </Card>
      )}

      {sent && !editing && (
        <>
          <Card className="mb-4 border-leaf/30 bg-leaf/5 text-center">
            <CheckCircle2 className="mx-auto mb-2 size-8 text-leaf" />
            <p className="font-semibold">{v.status === "approved" ? "Your host has confirmed your details" : "Thank you! Your details are with your host."}</p>
            <p className="mt-1 text-sm text-muted">See you soon. Everything you need for arrival is below.</p>
            {v.canEdit && <Button tone="soft" size="sm" className="mt-3" onClick={() => setEditing(true)}><Pencil className="size-3.5" /> Change or add details</Button>}
          </Card>
          {l?.address && <Card className="mb-3"><p className="mb-1 flex items-center gap-1.5 font-semibold"><MapPin className="size-4 text-teal" /> Address</p><p className="whitespace-pre-line text-sm">{l.address}</p>{l.mapUrl && <a href={l.mapUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-teal">Open in Maps</a>}</Card>}
          {l?.wifiName && <Card className="mb-3"><p className="mb-1 flex items-center gap-1.5 font-semibold"><Wifi className="size-4 text-teal" /> Wi-Fi</p><p className="text-sm">{l.wifiName}{l.wifiPass && <> · password <b>{l.wifiPass}</b></>}</p></Card>}
          {l?.rules && <Card className="mb-3"><p className="mb-1 font-semibold">House rules</p><p className="whitespace-pre-line text-sm">{l.rules}</p></Card>}
          {l?.guidebook && <Card className="mb-3"><p className="mb-1 font-semibold">Guidebook</p><p className="whitespace-pre-line text-sm">{l.guidebook}</p></Card>}
        </>
      )}

      {showForm && (
        <>
          <p className="mb-3 text-sm text-muted">{v.guests.length ? "Check your details and fix or add anything missing." : "Please fill in details for each adult guest. Local rules require hosts to keep a guest register with ID."} Fields marked * are needed.</p>
          {people.map((p, i) => {
            const foreign = !isIndian(p.nationality);
            const rule = ID_RULES[p.idType] ?? ID_RULES.Other;
            const has = (side: string) => (p.photos as { side: string }[]).some((x) => x.side === side) || (p.had as string[]).includes(side);
            return (
              <Card key={p.id ?? `n${i}`} className="mb-3">
                <div className="mb-2 flex items-center justify-between"><b>{i === 0 ? "Main guest" : `Guest ${i + 1}`}</b>{i > 0 && <button onClick={() => { setPeople(people.filter((_, j) => j !== i)); setErrors(errors.filter((_, j) => j !== i)); }} className="text-rust" aria-label="Remove guest"><Trash2 className="size-4" /></button>}</div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Full name (as on ID) *" className={cx("col-span-2", flag("name"))} hint={hint(i, "name")}><Input value={p.name} onChange={(e) => set(i, "name", e.target.value)} autoComplete={i === 0 ? "name" : "off"} /></Field>
                  <Field label={label("Phone", i, "phone")} className={flag("phone")} hint={hint(i, "phone")}><Input inputMode="tel" value={p.phone} onChange={(e) => set(i, "phone", e.target.value)} placeholder="98765 43210" /></Field>
                  <Field label={label("Email", i, "email")} className={flag("email")} hint={hint(i, "email")}><Input type="email" value={p.email} onChange={(e) => set(i, "email", e.target.value)} /></Field>
                  <Field label={label("Home address", i, "address")} className={cx("col-span-2", flag("address"))} hint={hint(i, "address")}><Textarea rows={2} value={p.address} onChange={(e) => set(i, "address", e.target.value)} /></Field>
                  <Field label={label("City", i, "city")} className={flag("city")} hint={hint(i, "city")}><Input value={p.city} onChange={(e) => set(i, "city", e.target.value)} /></Field>
                  <Field label={label("Nationality", i, "nationality")} className={flag("nationality")} hint={hint(i, "nationality")}><Input value={p.nationality} onChange={(e) => set(i, "nationality", e.target.value)} /></Field>
                  <Field label={label("Gender", i, "gender")} className={flag("gender")} hint={hint(i, "gender")}><Select value={p.gender} onChange={(e) => set(i, "gender", e.target.value)} options={["", "Female", "Male", "Other"]} /></Field>
                  <Field label={label("Age", i, "age")} className={flag("age")} hint={hint(i, "age")}><Input type="number" inputMode="numeric" value={p.age} onChange={(e) => set(i, "age", e.target.value)} /></Field>
                  <Field label={label("ID type", i, "id")} className={flag("id")}><Select value={p.idType} onChange={(e) => set(i, "idType", e.target.value)} options={foreign ? ["Passport", ...ID_TYPES.filter((x) => x !== "Passport")] : ID_TYPES} /></Field>
                  <Field label={label("ID number", i, "id")} className={flag("id")} hint={hint(i, "idNumber", p.idMasked && !p.idNumber ? `Saved: ${p.idMasked}. Leave blank to keep it.` : rule.hint)}>
                    <Input value={p.idNumber} onChange={(e) => set(i, "idNumber", e.target.value)} placeholder={p.idMasked || rule.example} inputMode={p.idType === "Aadhaar" ? "numeric" : undefined} autoCapitalize="characters" />
                  </Field>
                  {foreign && v.foreignFields && <div className={cx("col-span-2 grid grid-cols-2 gap-3", flag("passport"), flag("visa"))}>
                    <Field label="Passport no." hint={hint(i, "passport", p.passportMasked && !p.passport ? `Saved: ${p.passportMasked}` : undefined)}><Input value={p.passport ?? ""} onChange={(e) => set(i, "passport", e.target.value)} placeholder={p.passportMasked} /></Field>
                    <Field label="Passport expiry"><Input type="date" value={p.passportExpiry ?? ""} onChange={(e) => set(i, "passportExpiry", e.target.value)} /></Field>
                    <Field label="Visa no."><Input value={p.visa ?? ""} onChange={(e) => set(i, "visa", e.target.value)} /></Field>
                    <Field label="Visa type"><Input value={p.visaType ?? ""} onChange={(e) => set(i, "visaType", e.target.value)} placeholder="e.g. e-Tourist" /></Field>
                    <Field label="Visa valid till"><Input type="date" value={p.visaExpiry ?? ""} onChange={(e) => set(i, "visaExpiry", e.target.value)} /></Field>
                    <Field label="Arrived in India on"><Input type="date" value={p.arrivalInIndia ?? ""} onChange={(e) => set(i, "arrivalInIndia", e.target.value)} /></Field>
                    <Field label="Arriving from"><Input value={p.arrivedFrom ?? ""} onChange={(e) => set(i, "arrivedFrom", e.target.value)} /></Field>
                    <Field label="Going next to"><Input value={p.nextDestination ?? ""} onChange={(e) => set(i, "nextDestination", e.target.value)} /></Field>
                  </div>}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["front", "back", ...(foreign ? ["visa"] : [])].map((side) => {
                    const k = side === "back" ? "idBack" : side === "front" ? "idFront" : "visa";
                    const ok = has(side);
                    const saved = ok && (p.had as string[]).includes(side) && !(p.photos as { side: string }[]).some((x) => x.side === side);
                    return (
                      <label key={side} className={cx("inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold", ok ? "bg-leaf/15 text-leaf" : errors[i]?.[k] ? "bg-rust/10 text-rust" : "bg-mist text-teal", ask.has(k) && "ring-2 ring-rust/60")}>
                        {p._busy === side ? <Loader2 className="size-3.5 animate-spin" /> : ok ? <CheckCircle2 className="size-3.5" /> : <Camera className="size-3.5" />} ID {side === "visa" ? "visa page" : side}{side !== "visa" && req(i, k as CheckinField) ? " *" : ""}{saved ? " (saved, tap to replace)" : ""}
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(i, side, f); e.target.value = ""; }} />
                      </label>
                    );
                  })}
                </div>
                {(errors[i]?.idFront || errors[i]?.idBack) && <p className="mt-1 text-xs text-rust">{errors[i].idFront || errors[i].idBack}</p>}
              </Card>
            );
          })}
          {people.length < 12 && <Button tone="soft" className={cx("mb-4", ask.has("addGuests") && "ring-2 ring-rust/60")} onClick={() => setPeople([...people, blank()])}><Plus className="size-4" /> Add another guest</Button>}
          {l?.rules && <Card className="mb-3"><p className="mb-1 font-semibold">House rules</p><p className="whitespace-pre-line text-sm">{l.rules}</p></Card>}
          <label className="mb-3 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> I agree to the house rules{l?.rules ? " above" : ""}, and the details I&apos;ve given are correct.</label>
          <p className="mb-4 flex items-start gap-2 text-xs text-muted"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal" />Your ID photos are shared only with your host, kept privately, and deleted automatically after {v.idDays} days.</p>
          {msg && <p className="mb-3 rounded-xl bg-rust/10 px-3 py-2 text-sm text-rust">{msg}</p>}
          <div className="flex gap-2">
            {editing && <Button tone="ghost" onClick={() => { setEditing(false); setPeople(formFor(v)); setErrors([]); setMsg(""); }}>Cancel</Button>}
            <Button className="flex-1" onClick={submit} disabled={busy || people.some((p) => p._busy)}>{busy ? <Loader2 className="size-4 animate-spin" /> : v.guests.length && v.status !== "pending" ? "Send updated details" : "Send my details"}</Button>
          </div>
        </>
      )}
    </Shell>
  );
}

function Shell({ host, children }: { host?: View["host"]; children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pb-16 pt-6">
      <div className="mb-5 flex items-center justify-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- host's own logo link */}
        {host?.logoUrl ? <img src={host.logoUrl} alt="" className="h-10 max-w-40 object-contain" /> : null}
        <span className="font-serif text-xl">{host?.name ?? "Guest check-in"}</span>
      </div>
      {children}
      <p className="mt-8 text-center text-[11px] text-muted">Powered by Pandora HostBook</p>
    </div>
  );
}
