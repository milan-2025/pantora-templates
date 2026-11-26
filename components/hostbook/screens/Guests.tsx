"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Camera, Eye, Loader2, MessageCircle, Pencil, Plus, Search, Star, Trash2, Users } from "lucide-react";
import { ID_TYPES } from "@/lib/hostbook/features";
import { waLink, type Rec } from "@/lib/hostbook/core";
import { api, uploadSigned } from "../api";
import { useStore } from "../store";
import { Badge, Button, Card, Empty, Field, Input, Locked, PageHead, Select, Sheet, Tabs, Textarea, fmtDay } from "../ui";
import { BookingRow } from "./Bookings";
import { go } from "../App";

const isForeign = (g: Rec) => Boolean(g.nationality) && !/^(india|indian|in)$/i.test(String(g.nationality).trim());
export const flagBadge = (g: Rec) => (g.flag === "blocked" ? <Badge tone="bad">Do not host</Badge> : g.flag === "flagged" ? <Badge tone="warn">Flagged</Badge> : g.flag === "vip" ? <Badge tone="ok">VIP</Badge> : null);

export function Guests({ query = "" }: { query?: string }) {
  const s = useStore();
  const [q, setQ] = useState(""), [tab, setTab] = useState<"all" | "repeat" | "flagged" | "noid">("all");
  const addFor = new URLSearchParams(query).get("add");
  const [edit, setEdit] = useState<Rec | "new" | null>(addFor ? "new" : null);
  const stays = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of s.of("booking")) if (b.status !== "cancelled") for (const g of new Set([b.guestId, ...(b.guestIds ?? [])].filter(Boolean))) m.set(g, (m.get(g) ?? 0) + 1);
    return m;
  }, [s]);
  const list = s.of("guest").filter((g) => {
    const text = `${g.name} ${g.phone} ${g.phone2} ${g.email} ${g.city} ${g.idMasked}`.toLowerCase();
    if (q && !text.includes(q.toLowerCase())) return false;
    if (tab === "repeat") return (stays.get(g.id) ?? 0) > 1;
    if (tab === "flagged") return g.flag === "flagged" || g.flag === "blocked";
    if (tab === "noid") return !g.idPhotos?.length && !g.idMasked;
    return true;
  }).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  const onSaved = async (g: Rec) => {
    if (addFor) {
      const b = s.byId.get(addFor);
      if (b) await s.save("booking", { guestIds: [...new Set([...(b.guestIds ?? (b.guestId ? [b.guestId] : [])), g.id])], ...(b.guestId ? {} : { guestId: g.id, guestName: g.name }) }, b.id).catch(() => null);
      go(`booking/${addFor}`);
    } else go(`guest/${g.id}`);
  };
  return (
    <div>
      <PageHead title="Guests" sub={`${s.of("guest").length} in your guest register`} action={<Button onClick={() => setEdit("new")}><Plus className="size-4" /> Guest</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "all", label: "All" }, { value: "repeat", label: "Returning" }, ...(s.has("guestFlags") ? [{ value: "flagged" as const, label: "Flagged" }] : []), { value: "noid", label: "No ID yet" }]} />
      <div className="relative mb-3"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><Input className="pl-9" placeholder="Search name, phone, email, ID" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {list.length ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          {list.map((g) => (
            <a key={g.id} href={`#guest/${g.id}`} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0 hover:bg-ink/[.02]">
              <div className="grid size-10 shrink-0 place-items-center rounded-full bg-mist font-semibold text-teal">{String(g.name || "?").slice(0, 1).toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5"><b className="truncate">{g.name}</b>{flagBadge(g)}{isForeign(g) && <Badge>{g.nationality}</Badge>}{(stays.get(g.id) ?? 0) > 1 && <Badge tone="teal">{stays.get(g.id)} stays</Badge>}</div>
                <div className="truncate text-xs text-muted">{[g.phone, g.city, g.idType && `${g.idType} ${g.idMasked ?? ""}`].filter(Boolean).join(" · ")}</div>
              </div>
              {g.rating ? <span className="flex items-center gap-0.5 text-xs text-sun"><Star className="size-3.5 fill-current" />{g.rating}</span> : null}
            </a>
          ))}
        </div>
      ) : <Empty icon={<Users />} title={q ? "No guests match" : "No guests yet"} text="Guests are added when you create a booking, or when guests fill in your online check-in link." />}
      {edit && <GuestEditor guest={edit === "new" ? null : edit} onClose={() => { setEdit(null); if (addFor) go(`booking/${addFor}`); }} onSaved={onSaved} />}
    </div>
  );
}

export function GuestEditor({ guest, onClose, onSaved }: { guest: Rec | null; onClose: () => void; onSaved?: (g: Rec) => void }) {
  const s = useStore();
  const [f, setF] = useState<Record<string, any>>(() => ({ idType: "Aadhaar", nationality: "Indian", ...(guest ?? {}), idNumber: guest?.idNumber ?? "" })); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const foreign = isForeign(f as Rec);
  const save = async () => {
    setBusy(true);
    try {
      const data = { ...f };
      if (guest && !s.can("ids")) delete data.idNumber;
      if (guest && s.can("ids") && !data.idNumber && guest.idMasked) delete data.idNumber;
      const g = await s.save("guest", data, guest?.id);
      s.toast("Guest saved"); onClose(); onSaved?.(g);
    } catch (e) { s.toast((e as Error).message, "bad"); } finally { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title={guest ? "Edit guest" : "New guest"} footer={<><Button tone="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Full name (as on ID)" className="col-span-2"><Input value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Phone"><Input value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} inputMode="tel" /></Field>
        <Field label="Other phone"><Input value={f.phone2 ?? ""} onChange={(e) => set("phone2", e.target.value)} inputMode="tel" /></Field>
        <Field label="Email" className="col-span-2"><Input type="email" value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Home address" className="col-span-2"><Textarea rows={2} value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
        <Field label="City"><Input value={f.city ?? ""} onChange={(e) => set("city", e.target.value)} /></Field>
        <Field label="Nationality"><Input value={f.nationality ?? ""} onChange={(e) => set("nationality", e.target.value)} /></Field>
        <Field label="Gender"><Select value={f.gender ?? ""} onChange={(e) => set("gender", e.target.value)} options={["", "Female", "Male", "Other"]} /></Field>
        <Field label="Age"><Input type="number" value={f.age ?? ""} onChange={(e) => set("age", e.target.value)} /></Field>
        <Field label="ID type"><Select value={f.idType ?? ""} onChange={(e) => set("idType", e.target.value)} options={ID_TYPES} /></Field>
        {s.can("ids") ? <Field label="ID number" hint={guest?.idMasked && !f.idNumber ? `Saved: ${guest.idMasked}. Type to replace.` : undefined}><Input value={f.idNumber ?? ""} onChange={(e) => set("idNumber", e.target.value)} /></Field> : <Field label="ID number"><Input disabled value={guest?.idMasked ?? ""} /></Field>}
        {foreign && s.has("formC") && <>
          <p className="col-span-2 mt-2 text-xs font-semibold text-ink/70">For Form C (foreign guests)</p>
          <Field label="Passport no."><Input value={f.passport ?? ""} onChange={(e) => set("passport", e.target.value)} /></Field>
          <Field label="Passport expiry"><Input type="date" value={f.passportExpiry ?? ""} onChange={(e) => set("passportExpiry", e.target.value)} /></Field>
          <Field label="Visa no."><Input value={f.visa ?? ""} onChange={(e) => set("visa", e.target.value)} /></Field>
          <Field label="Visa type"><Input value={f.visaType ?? ""} onChange={(e) => set("visaType", e.target.value)} placeholder="e.g. e-Tourist" /></Field>
          <Field label="Visa expiry"><Input type="date" value={f.visaExpiry ?? ""} onChange={(e) => set("visaExpiry", e.target.value)} /></Field>
          <Field label="Arrived in India on"><Input type="date" value={f.arrivalInIndia ?? ""} onChange={(e) => set("arrivalInIndia", e.target.value)} /></Field>
          <Field label="Arrived from (city/country)"><Input value={f.arrivedFrom ?? ""} onChange={(e) => set("arrivedFrom", e.target.value)} /></Field>
          <Field label="Going next to"><Input value={f.nextDestination ?? ""} onChange={(e) => set("nextDestination", e.target.value)} /></Field>
        </>}
        {s.has("guestFlags") && <>
          <Field label="Flag"><Select value={f.flag ?? ""} onChange={(e) => set("flag", e.target.value)} options={[{ value: "", label: "None" }, { value: "vip", label: "VIP / great guest" }, { value: "flagged", label: "Flagged: be careful" }, { value: "blocked", label: "Do not host" }]} /></Field>
          <Field label="Your rating"><Select value={String(f.rating ?? "")} onChange={(e) => set("rating", e.target.value)} options={[{ value: "", label: "—" }, ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: "★".repeat(n) }))]} /></Field>
        </>}
        <Field label="Private notes" className="col-span-2"><Textarea value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></Field>
      </div>
    </Sheet>
  );
}

function IdPhotos({ g }: { g: Rec }) {
  const s = useStore();
  const [links, setLinks] = useState<{ side: string; url: string; publicId: string; deleteAt: number }[] | null>(null);
  const [busy, setBusy] = useState("");
  const photos = (g.idPhotos ?? []) as { side: string; deleteAt: number; publicId: string }[];
  // eslint-disable-next-line react-hooks/set-state-in-effect -- hide old links when the photos change
  useEffect(() => { setLinks(null); }, [g.idPhotos]);
  const view = async () => { setBusy("view"); try { setLinks((await api("ids/links", { body: { guestId: g.id } })).photos); } catch (e) { s.toast((e as Error).message, "bad"); } finally { setBusy(""); } };
  const upload = async (file: File, side: string) => {
    setBusy(side);
    try {
      const sig = await api("ids/sign", { body: { guestId: g.id } });
      await uploadSigned(sig, file);
      const r = await api("ids/add", { body: { guestId: g.id, publicId: sig.publicId, side } });
      s.put(r.item); s.toast("ID photo saved");
    } catch (e) { s.toast((e as Error).message, "bad"); } finally { setBusy(""); }
  };
  const remove = async (publicId: string) => {
    if (!confirm("Delete this ID photo now?")) return;
    try { const r = await api("ids/remove", { body: { guestId: g.id, publicId } }); s.put(r.item); setLinks(null); } catch (e) { s.toast((e as Error).message, "bad"); }
  };
  const [now] = useState(() => Date.now());
  const days = (t: number) => Math.max(0, Math.ceil((t - now) / 864e5));
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">ID photos</h2>{photos.length > 0 && s.can("ids") && !links && <Button size="sm" tone="soft" onClick={view} disabled={busy === "view"}>{busy === "view" ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />} View</Button>}</div>
      {links ? (
        <div className="grid grid-cols-2 gap-2">
          {links.map((p) => (
            <div key={p.publicId} className="overflow-hidden rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived private link, not for the image optimiser */}
              <img src={p.url} alt={`ID ${p.side}`} className="aspect-[4/3] w-full bg-sand object-contain" />
              <div className="flex items-center justify-between px-2 py-1 text-[11px]"><span className="capitalize">{p.side} · deletes in {days(p.deleteAt)}d</span><button onClick={() => remove(p.publicId)} className="text-rust">Delete</button></div>
            </div>
          ))}
          <p className="col-span-2 text-[11px] text-muted">These links stop working in a few minutes.</p>
        </div>
      ) : photos.length ? (
        <ul className="text-sm">{photos.map((p, i) => <li key={i} className="flex justify-between py-0.5"><span className="capitalize">{p.side}</span><span className="text-xs text-muted">auto-deletes in {days(p.deleteAt)} days</span></li>)}</ul>
      ) : (
        <p className="text-sm text-muted">{g.idsDeletedAt ? `Photos were deleted on ${new Date(g.idsDeletedAt).toLocaleDateString("en-IN")} as planned. The written details stay.` : "No ID photos yet."}</p>
      )}
      {s.can("guests") && <div className="mt-3 flex flex-wrap gap-2">
        {["front", "back", ...(isForeign(g) ? ["visa"] : [])].map((side) => (
          <label key={side} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-mist px-3 py-1.5 text-xs font-semibold capitalize text-teal">
            {busy === side ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />} {side}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, side); e.target.value = ""; }} />
          </label>
        ))}
      </div>}
      <p className="mt-2 text-[11px] text-muted">Kept privately for {s.me.access.idDays} days, then deleted automatically.</p>
    </Card>
  );
}

export function GuestDetail({ id }: { id: string }) {
  const s = useStore();
  const g = s.byId.get(id);
  const [edit, setEdit] = useState(false);
  if (!g) return <Empty title="Guest not found" action={<Button onClick={() => go("guests")}>All guests</Button>} />;
  const stays = s.of("booking").filter((b) => b.guestId === g.id || b.guestIds?.includes(g.id)).sort((a, b) => b.start.localeCompare(a.start));
  const del = async () => { if (!confirm(`Delete ${g.name} and their ID photos? Their bookings stay.`)) return; try { await s.remove(g.id); go("guests"); } catch (e) { s.toast((e as Error).message, "bad"); } };
  return (
    <div>
      <button onClick={() => history.length > 1 ? history.back() : go("guests")} className="mb-3 flex items-center gap-1 text-sm text-muted"><ArrowLeft className="size-4" /> Back</button>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">{g.name}</h1>
          <div className="mt-1 flex flex-wrap gap-1.5">{flagBadge(g)}{g.rating ? <Badge tone="warn">{"★".repeat(g.rating)}</Badge> : null}<Badge>{stays.length} stay{stays.length === 1 ? "" : "s"}</Badge></div>
        </div>
        <div className="flex gap-2">
          {g.phone && <a href={waLink(g.phone, `Hi ${String(g.name).split(" ")[0]}!`)} target="_blank" rel="noreferrer"><Button tone="soft"><MessageCircle className="size-4" /> Chat</Button></a>}
          <Button tone="soft" onClick={() => setEdit(true)}><Pencil className="size-4" /> Edit</Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-semibold">Details</h2>
          <dl className="grid grid-cols-[110px_1fr] gap-y-1 text-sm">
            {[["Phone", [g.phone, g.phone2].filter(Boolean).join(", ")], ["Email", g.email], ["Address", g.address], ["City", g.city], ["Nationality", g.nationality], ["Gender / age", [g.gender, g.age].filter(Boolean).join(", ")], ["ID", g.idType ? `${g.idType} ${s.can("ids") ? g.idNumber || g.idMasked : g.idMasked}` : ""],
              ...(isForeign(g) ? [["Passport", g.passport], ["Visa", [g.visaType, g.visa, g.visaExpiry && `till ${fmtDay(g.visaExpiry, true)}`].filter(Boolean).join(" · ")]] : [])]
              .filter(([, v]) => v).map(([k, v]) => <Fragment key={String(k)}><dt className="text-muted">{k}</dt><dd className="whitespace-pre-line">{v}</dd></Fragment>)}
          </dl>
          {g.notes && <p className="mt-3 whitespace-pre-line rounded-xl bg-sand p-3 text-sm">{g.notes}</p>}
          {!s.has("guestFlags") && <div className="mt-3 text-xs text-muted">Flags & ratings <Locked feature="guestFlags" compact /></div>}
        </Card>
        <IdPhotos g={g} />
        <div className="md:col-span-2">
          <h2 className="mb-2 font-semibold">Stays</h2>
          {stays.length ? <div className="overflow-hidden rounded-2xl border border-line bg-white">{stays.map((b) => <BookingRow key={b.id} b={b} />)}</div> : <p className="text-sm text-muted">No stays linked.</p>}
        </div>
      </div>
      {s.can("owner") && <Button tone="danger" size="sm" className="mt-6" onClick={del}><Trash2 className="size-3.5" /> Delete guest</Button>}
      {edit && <GuestEditor guest={g} onClose={() => setEdit(false)} />}
    </div>
  );
}
