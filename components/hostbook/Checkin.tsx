"use client";
/** Guest online check-in (/hostbook/c/<code>): guests fill in their details and upload IDs before arrival. */
import { useEffect, useState } from "react";
import { Camera, CheckCircle2, Loader2, MapPin, Plus, ShieldCheck, Trash2, Wifi } from "lucide-react";
import { ID_TYPES } from "@/lib/hostbook/features";
import { uploadSigned } from "./api";
import { Button, Card, Field, Input, Select, Textarea, fmtDay } from "./ui";

type View = {
  host: { name: string; logoUrl: string };
  listing: { name: string; city: string; rules: string; checkIn: string; checkOut: string; address?: string; mapUrl?: string; wifiName?: string; wifiPass?: string; guidebook?: string } | null;
  stay: { start: string; end: string; adults: number; children: number };
  status: string; idDays: number; foreignFields: boolean;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- form values are strings, plus the uploaded photos
type Person = Record<string, any>;

async function call<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`/api/hostbook/checkin/${path}`, { method: body ? "POST" : "GET", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Something went wrong");
  return d as T;
}
const blank = (): Person => ({ name: "", phone: "", email: "", address: "", city: "", nationality: "Indian", gender: "", age: "", idType: "Aadhaar", idNumber: "" });
const isForeign = (p: Person) => Boolean(p.nationality) && !/^(india|indian|in)$/i.test(p.nationality.trim());

export function CheckinPage({ code }: { code: string }) {
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState("");
  const [people, setPeople] = useState<Person[]>([blank()]);
  const [agree, setAgree] = useState(false), [busy, setBusy] = useState(false), [msg, setMsg] = useState("");
  useEffect(() => {
    call<View>(code).then((x) => { setV(x); setPeople(Array.from({ length: Math.max(1, Math.min(6, x.stay.adults || 1)) }, blank)); }).catch((e) => setErr(e.message));
  }, [code]);
  const set = (i: number, k: string, val: unknown) => setPeople((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: val } : p)));
  const upload = async (i: number, side: string, file: File) => {
    set(i, "_busy", side);
    try {
      const sig = await call<{ publicId: string; url: string; fields: Record<string, string> }>(`${code}/sign`, {});
      await uploadSigned(sig, file);
      setPeople((ps) => ps.map((p, j) => (j === i ? { ...p, _busy: "", photos: [...((p.photos ?? []) as { side: string }[]).filter((x) => x.side !== side), { publicId: sig.publicId, side }] } : p)));
    } catch (e) { setMsg((e as Error).message); set(i, "_busy", ""); }
  };
  const submit = async () => {
    setMsg("");
    if (!people[0].name || !people[0].phone) return setMsg("Please add the main guest's name and phone number.");
    if (!agree) return setMsg("Please tick that you agree to the house rules.");
    setBusy(true);
    try { setV(await call<View>(`${code}/submit`, { guests: people.map(({ _busy: _b, ...p }) => { void _b; return p; }), agree })); window.scrollTo({ top: 0, behavior: "smooth" }); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };

  if (err) return <Shell><Card className="text-center"><p className="font-semibold">Check-in link</p><p className="mt-1 text-sm text-muted">{err}</p></Card></Shell>;
  if (!v) return <Shell><div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-teal" /></div></Shell>;
  const l = v.listing;
  const done = v.status === "submitted" || v.status === "approved";
  return (
    <Shell host={v.host}>
      <Card className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Your stay</p>
        <h1 className="font-serif text-2xl">{l?.name ?? "Your stay"}</h1>
        <p className="text-sm text-muted">{fmtDay(v.stay.start, true)} → {fmtDay(v.stay.end, true)}{l?.checkIn ? ` · check-in from ${l.checkIn}` : ""}{l?.checkOut ? ` · check-out by ${l.checkOut}` : ""}</p>
      </Card>

      {done ? (
        <>
          <Card className="mb-4 border-leaf/30 bg-leaf/5 text-center"><CheckCircle2 className="mx-auto mb-2 size-8 text-leaf" /><p className="font-semibold">{v.status === "approved" ? "Your host has confirmed your details" : "Thank you! Your details are with your host."}</p><p className="mt-1 text-sm text-muted">See you soon. Everything you need for arrival is below.</p></Card>
          {l?.address && <Card className="mb-3"><p className="mb-1 flex items-center gap-1.5 font-semibold"><MapPin className="size-4 text-teal" /> Address</p><p className="whitespace-pre-line text-sm">{l.address}</p>{l.mapUrl && <a href={l.mapUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-teal">Open in Maps</a>}</Card>}
          {l?.wifiName && <Card className="mb-3"><p className="mb-1 flex items-center gap-1.5 font-semibold"><Wifi className="size-4 text-teal" /> Wi-Fi</p><p className="text-sm">{l.wifiName}{l.wifiPass && <> · password <b>{l.wifiPass}</b></>}</p></Card>}
          {l?.rules && <Card className="mb-3"><p className="mb-1 font-semibold">House rules</p><p className="whitespace-pre-line text-sm">{l.rules}</p></Card>}
          {l?.guidebook && <Card className="mb-3"><p className="mb-1 font-semibold">Guidebook</p><p className="whitespace-pre-line text-sm">{l.guidebook}</p></Card>}
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">Please fill in details for each adult guest. Local rules require hosts to keep a guest register with ID.</p>
          {people.map((p, i) => (
            <Card key={i} className="mb-3">
              <div className="mb-2 flex items-center justify-between"><b>{i === 0 ? "Main guest" : `Guest ${i + 1}`}</b>{i > 0 && <button onClick={() => setPeople(people.filter((_, j) => j !== i))} className="text-rust"><Trash2 className="size-4" /></button>}</div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Full name (as on ID)" className="col-span-2"><Input value={p.name} onChange={(e) => set(i, "name", e.target.value)} autoComplete={i === 0 ? "name" : "off"} /></Field>
                <Field label={i === 0 ? "Phone" : "Phone (optional)"}><Input inputMode="tel" value={p.phone} onChange={(e) => set(i, "phone", e.target.value)} /></Field>
                <Field label="Email"><Input type="email" value={p.email} onChange={(e) => set(i, "email", e.target.value)} /></Field>
                <Field label="Home address" className="col-span-2"><Textarea rows={2} value={p.address} onChange={(e) => set(i, "address", e.target.value)} /></Field>
                <Field label="City"><Input value={p.city} onChange={(e) => set(i, "city", e.target.value)} /></Field>
                <Field label="Nationality"><Input value={p.nationality} onChange={(e) => set(i, "nationality", e.target.value)} /></Field>
                <Field label="Gender"><Select value={p.gender} onChange={(e) => set(i, "gender", e.target.value)} options={["", "Female", "Male", "Other"]} /></Field>
                <Field label="Age"><Input type="number" value={p.age} onChange={(e) => set(i, "age", e.target.value)} /></Field>
                <Field label="ID type"><Select value={p.idType} onChange={(e) => set(i, "idType", e.target.value)} options={isForeign(p) ? ["Passport", ...ID_TYPES.filter((x) => x !== "Passport")] : ID_TYPES} /></Field>
                <Field label="ID number"><Input value={p.idNumber} onChange={(e) => set(i, "idNumber", e.target.value)} /></Field>
                {isForeign(p) && v.foreignFields && <>
                  <Field label="Passport no."><Input value={p.passport ?? ""} onChange={(e) => set(i, "passport", e.target.value)} /></Field>
                  <Field label="Passport expiry"><Input type="date" value={p.passportExpiry ?? ""} onChange={(e) => set(i, "passportExpiry", e.target.value)} /></Field>
                  <Field label="Visa no."><Input value={p.visa ?? ""} onChange={(e) => set(i, "visa", e.target.value)} /></Field>
                  <Field label="Visa type"><Input value={p.visaType ?? ""} onChange={(e) => set(i, "visaType", e.target.value)} /></Field>
                  <Field label="Visa valid till"><Input type="date" value={p.visaExpiry ?? ""} onChange={(e) => set(i, "visaExpiry", e.target.value)} /></Field>
                  <Field label="Arrived in India on"><Input type="date" value={p.arrivalInIndia ?? ""} onChange={(e) => set(i, "arrivalInIndia", e.target.value)} /></Field>
                  <Field label="Arriving from"><Input value={p.arrivedFrom ?? ""} onChange={(e) => set(i, "arrivedFrom", e.target.value)} /></Field>
                  <Field label="Going next to"><Input value={p.nextDestination ?? ""} onChange={(e) => set(i, "nextDestination", e.target.value)} /></Field>
                </>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {["front", "back", ...(isForeign(p) ? ["visa"] : [])].map((side) => {
                  const has = (p.photos as { side: string }[] | undefined)?.some((x) => x.side === side);
                  return (
                    <label key={side} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold capitalize ${has ? "bg-leaf/15 text-leaf" : "bg-mist text-teal"}`}>
                      {p._busy === side ? <Loader2 className="size-3.5 animate-spin" /> : has ? <CheckCircle2 className="size-3.5" /> : <Camera className="size-3.5" />} ID {side}
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(i, side, f); e.target.value = ""; }} />
                    </label>
                  );
                })}
              </div>
            </Card>
          ))}
          {people.length < 12 && <Button tone="soft" className="mb-4" onClick={() => setPeople([...people, blank()])}><Plus className="size-4" /> Add another guest</Button>}
          {l?.rules && <Card className="mb-3"><p className="mb-1 font-semibold">House rules</p><p className="whitespace-pre-line text-sm">{l.rules}</p></Card>}
          <label className="mb-3 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> I agree to the house rules{l?.rules ? " above" : ""}, and the details I&apos;ve given are correct.</label>
          <p className="mb-4 flex items-start gap-2 text-xs text-muted"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal" />Your ID photos are shared only with your host, kept privately, and deleted automatically after {v.idDays} days.</p>
          {msg && <p className="mb-3 rounded-xl bg-rust/10 px-3 py-2 text-sm text-rust">{msg}</p>}
          <Button className="w-full" onClick={submit} disabled={busy || people.some((p) => p._busy)}>{busy ? <Loader2 className="size-4 animate-spin" /> : "Send my details"}</Button>
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
