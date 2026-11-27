"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, BedDouble, Check, Copy, MessageCircle, Pencil, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { BOOKING_SOURCES } from "@/lib/hostbook/features";
import { addDays, bookingIncome, fillTemplate, istDay, nights, overlaps, waLink, type Rec } from "@/lib/hostbook/core";
import { api } from "../api";
import { useLookups, useStore } from "../store";
import { Badge, Button, Card, Empty, Field, Input, Locked, PageHead, Select, Sheet, Tabs, Textarea, fmtDay, money } from "../ui";
import { go } from "../App";

export const statusBadge = (b: Rec) => {
  if (b.status === "cancelled") return <Badge tone="bad">Cancelled</Badge>;
  if (b.status === "blocked") return <Badge>Blocked</Badge>;
  const t = istDay();
  if (b.start <= t && b.end > t) return <Badge tone="ok">Staying now</Badge>;
  if (b.end <= t) return <Badge>Past</Badge>;
  return <Badge tone="teal">Upcoming</Badge>;
};
export const checkinBadge = (b: Rec) =>
  b.checkinStatus === "approved" ? <Badge tone="ok"><Check className="size-3" />Details OK</Badge>
    : b.checkinStatus === "submitted" ? <Badge tone="warn">Details to review</Badge>
    : b.checkinStatus === "changes" ? <Badge tone="bad">Waiting for guest</Badge> : null;

/** What a host can ask a guest to fix; the guest's form opens again with these marked. */
export const FIX_OPTIONS = [
  { key: "name", label: "Name" }, { key: "phone", label: "Phone" }, { key: "email", label: "Email" }, { key: "address", label: "Home address" },
  { key: "city", label: "City" }, { key: "nationality", label: "Nationality" }, { key: "gender", label: "Gender" }, { key: "age", label: "Age" },
  { key: "id", label: "ID type & number" }, { key: "idFront", label: "ID photo (front)" }, { key: "idBack", label: "ID photo (back)" },
  { key: "passport", label: "Passport details" }, { key: "visa", label: "Visa details" }, { key: "addGuests", label: "Add the other guests" },
];

function AskFix({ b, onClose }: { b: Rec; onClose: () => void }) {
  const s = useStore();
  const [fields, setFields] = useState<string[]>([]), [note, setNote] = useState(""), [busy, setBusy] = useState(false);
  const g = b.guestId ? s.byId.get(b.guestId) : null;
  const phone = String(g?.phone || b.phone || "");
  const ask = async () => {
    setBusy(true);
    try {
      const r = await api("checkin/request", { body: { bookingId: b.id, fields, note } });
      s.put(r.item);
      const what = fields.map((k) => FIX_OPTIONS.find((o) => o.key === k)?.label.toLowerCase()).filter(Boolean).join(", ");
      const text = `Hi ${String(g?.name || b.guestName || "").split(" ")[0] || "there"}, please update your check-in details${what ? ` (${what})` : ""}${note ? `: ${note}` : "."} ${checkinUrl(r.item)}`;
      if (phone) window.open(waLink(phone, text), "_blank");
      else { navigator.clipboard?.writeText(text); s.toast("Message copied. Send it to the guest"); }
      onClose();
    } catch (e) { s.toast((e as Error).message, "bad"); } finally { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title="Ask the guest to fix details" footer={<><Button tone="ghost" onClick={onClose}>Cancel</Button><Button onClick={ask} disabled={busy || (!fields.length && !note.trim())}>{phone ? "Send on WhatsApp" : "Copy message"}</Button></>}>
      <p className="mb-3 text-sm text-muted">Their check-in link opens again with what they sent already filled in, and the items below marked.</p>
      <div className="grid grid-cols-2 gap-x-4">{FIX_OPTIONS.map((o) => <label key={o.key} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={fields.includes(o.key)} onChange={() => setFields((f) => (f.includes(o.key) ? f.filter((x) => x !== o.key) : [...f, o.key]))} />{o.label}</label>)}</div>
      <Field label="Note for the guest (optional)" className="mt-3"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. The Aadhaar photo is blurry, please upload it again" /></Field>
    </Sheet>
  );
}

export function checkinUrl(b: Rec) { return b.checkinCode ? `${location.origin}/hostbook/c/${b.checkinCode}` : ""; }

export function templateVars(b: Rec, s: ReturnType<typeof useStore>) {
  const l = s.byId.get(b.listingId);
  const g = b.guestId ? s.byId.get(b.guestId) : null;
  return {
    guest: String(g?.name || b.guestName || "there").split(" ")[0], listing: l?.name ?? "", checkin: fmtDay(b.start), checkout: fmtDay(b.end),
    checkinTime: l?.checkIn || "2 PM", checkoutTime: l?.checkOut || "11 AM", address: l?.address ?? "", wifi: l?.wifiName ?? "", wifiPass: l?.wifiPass ?? "",
    checkinLink: checkinUrl(b), host: s.me.account.business || "", nights: nights(b),
  };
}

export function BookingRow({ b }: { b: Rec }) {
  const { listingName, guestName } = useLookups();
  const { can } = useStore();
  return (
    <a href={`#booking/${b.id}`} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0 hover:bg-ink/[.02]">
      <div className="grid w-12 shrink-0 place-items-center rounded-xl bg-mist py-1.5 text-center leading-tight text-teal">
        <span className="text-[10px] font-semibold uppercase">{fmtDay(b.start).split(" ")[1]}</span><span className="font-serif text-xl">{b.start.slice(8)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5"><span className="truncate font-semibold">{guestName(b)}</span>{statusBadge(b)}{checkinBadge(b)}</div>
        <div className="truncate text-xs text-muted">{listingName(b.listingId)} · {fmtDay(b.start)} → {fmtDay(b.end)} · {nights(b)} night{nights(b) === 1 ? "" : "s"}{b.source ? ` · ${b.source}` : ""}</div>
      </div>
      {can("money") && b.status !== "blocked" && <div className="text-right text-sm font-semibold">{money(bookingIncome(b))}</div>}
    </a>
  );
}

export function Bookings() {
  const s = useStore();
  const { listings } = useLookups();
  const [tab, setTab] = useState<"upcoming" | "now" | "past" | "all">("upcoming");
  const [q, setQ] = useState(""), [lid, setLid] = useState("");
  const [edit, setEdit] = useState<Rec | null | "new">(null);
  const t = istDay();
  const list = useMemo(() => {
    const byName = (b: Rec) => `${b.guestName ?? ""} ${s.byId.get(b.guestId)?.name ?? ""} ${b.phone ?? ""} ${b.notes ?? ""}`.toLowerCase();
    return s.of("booking").filter((b) => (!lid || b.listingId === lid) && (!q || byName(b).includes(q.toLowerCase())))
      .filter((b) => tab === "all" || (tab === "upcoming" ? b.start > t && b.status !== "cancelled" : tab === "now" ? b.start <= t && b.end > t && b.status !== "cancelled" : b.end <= t))
      .sort((a, b) => (tab === "past" ? b.start.localeCompare(a.start) : a.start.localeCompare(b.start)));
  }, [s, tab, q, lid, t]);
  return (
    <div>
      <PageHead title="Bookings" sub={`${s.of("booking").filter((b) => b.start > t && b.status === "confirmed").length} upcoming`} action={<Button onClick={() => setEdit("new")} disabled={!listings.length}><Plus className="size-4" /> Booking</Button>} />
      {!listings.length && <Empty icon={<BedDouble />} title="Add a listing first" text="Bookings belong to a listing (a flat, room or villa)." action={<Button onClick={() => go("listings")}>Add listing</Button>} />}
      {listings.length > 0 && <>
        <Tabs value={tab} onChange={setTab} tabs={[{ value: "upcoming", label: "Upcoming" }, { value: "now", label: "Staying now" }, { value: "past", label: "Past" }, { value: "all", label: "All" }]} />
        <div className="mb-3 flex gap-2">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><Input className="pl-9" placeholder="Search guest, phone, note" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {listings.length > 1 && <Select className="w-40" value={lid} onChange={(e) => setLid(e.target.value)} options={[{ value: "", label: "All listings" }, ...listings.map((l) => ({ value: l.id, label: l.name }))]} />}
        </div>
        {list.length ? <div className="overflow-hidden rounded-2xl border border-line bg-white">{list.map((b) => <BookingRow key={b.id} b={b} />)}</div> : <Empty title="No bookings here" />}
      </>}
      {edit && <BookingEditor booking={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={(b) => go(`booking/${b.id}`)} />}
    </div>
  );
}

export function BookingEditor({ booking, onClose, onSaved, defaults }: { booking: Rec | null; onClose: () => void; onSaved?: (b: Rec) => void; defaults?: Partial<Rec> }) {
  const s = useStore();
  const { listings } = useLookups();
  const [f, setF] = useState<Record<string, any>>(() => booking ?? { listingId: listings[0]?.id ?? "", start: istDay(), end: addDays(istDay(), 1), source: "Airbnb", status: "confirmed", adults: 2, children: 0, ...defaults }); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const clash = useMemo(() => s.of("booking").find((b) => b.id !== f.id && b.listingId === f.listingId && b.status !== "cancelled" && f.start && f.end && overlaps(b as never, f as never)), [s, f]);
  const guests = s.of("guest").sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const listing = s.byId.get(f.listingId);
  const save = async () => {
    setBusy(true);
    try {
      const data = { ...f };
      // A typed name with no guest record yet becomes a guest record, so their stays and details build up.
      if (!data.guestId && data.guestName && data.status !== "blocked" && s.can("guests")) {
        const g = await s.save("guest", { name: data.guestName, phone: data.phone ?? "" });
        data.guestId = g.id;
      }
      const b = await s.save("booking", data, booking?.id);
      s.toast(booking ? "Booking saved" : "Booking added");
      onClose(); onSaved?.(b);
    } catch (e) { s.toast((e as Error).message, "bad"); } finally { setBusy(false); }
  };
  const blocked = f.status === "blocked";
  return (
    <Sheet open onClose={onClose} title={booking ? "Edit booking" : "New booking"} footer={<><Button tone="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Listing" className="col-span-2"><Select value={f.listingId} onChange={(e) => set("listingId", e.target.value)} options={listings.map((l) => ({ value: l.id, label: l.name }))} /></Field>
          <Field label="Check-in"><Input type="date" value={f.start} onChange={(e) => { set("start", e.target.value); if (f.end <= e.target.value) set("end", addDays(e.target.value, 1)); }} /></Field>
          <Field label="Check-out"><Input type="date" value={f.end} min={f.start} onChange={(e) => set("end", e.target.value)} /></Field>
        </div>
        {clash && <p className="flex items-start gap-2 rounded-xl bg-sun/20 px-3 py-2 text-xs text-[#8a5a10]"><AlertTriangle className="mt-0.5 size-4 shrink-0" />Clashes with {clash.guestName || s.byId.get(clash.guestId)?.name || "another booking"} ({fmtDay(clash.start)} → {fmtDay(clash.end)}).</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type"><Select value={f.status} onChange={(e) => set("status", e.target.value)} options={[{ value: "confirmed", label: "Booking" }, { value: "blocked", label: "Blocked dates" }, { value: "cancelled", label: "Cancelled" }]} /></Field>
          <Field label="Booked on"><Select value={f.source} onChange={(e) => set("source", e.target.value)} options={BOOKING_SOURCES} /></Field>
        </div>
        {!blocked && <>
          {s.can("guests") && <Field label="Guest">
            <Select value={f.guestId ?? ""} onChange={(e) => { set("guestId", e.target.value); const g = s.byId.get(e.target.value); if (g) { set("guestName", g.name); set("phone", g.phone); } }} options={[{ value: "", label: "New guest (type below)" }, ...guests.map((g) => ({ value: g.id, label: `${g.name}${g.phone ? ` · ${g.phone}` : ""}${g.flag === "blocked" ? " ⛔" : ""}` }))]} />
          </Field>}
          {s.byId.get(f.guestId)?.flag === "blocked" && <p className="rounded-xl bg-rust/10 px-3 py-2 text-xs text-rust">⛔ This guest is on your do-not-host list.</p>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Guest name"><Input value={f.guestName ?? ""} onChange={(e) => set("guestName", e.target.value)} disabled={Boolean(f.guestId)} /></Field>
            <Field label="Phone"><Input value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} inputMode="tel" /></Field>
            <Field label="Adults"><Input type="number" min={1} value={f.adults ?? 1} onChange={(e) => set("adults", e.target.value)} /></Field>
            <Field label="Children"><Input type="number" min={0} value={f.children ?? 0} onChange={(e) => set("children", e.target.value)} /></Field>
          </div>
          {s.can("money") && <div className="rounded-2xl border border-line bg-white p-3">
            <p className="mb-2 text-xs font-semibold text-ink/70">Money</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Guest paid (₹)"><Input type="number" inputMode="decimal" value={f.gross ?? ""} onChange={(e) => set("gross", e.target.value)} /></Field>
              <Field label="Platform fee (₹)"><Input type="number" inputMode="decimal" value={f.platformFee ?? ""} onChange={(e) => set("platformFee", e.target.value)} /></Field>
              <Field label="Cleaning fee (₹)"><Input type="number" inputMode="decimal" value={f.cleaningFee ?? listing?.cleaningFee ?? ""} onChange={(e) => set("cleaningFee", e.target.value)} /></Field>
              <Field label="GST / taxes (₹)"><Input type="number" inputMode="decimal" value={f.taxes ?? ""} onChange={(e) => set("taxes", e.target.value)} /></Field>
              <Field label="You receive (payout ₹)" className="col-span-2" hint={!f.payout && f.gross ? `Leave empty to use ${money((Number(f.gross) || 0) - (Number(f.platformFee) || 0))} (paid − fee)` : undefined}><Input type="number" inputMode="decimal" value={f.payout ?? ""} onChange={(e) => set("payout", e.target.value)} /></Field>
            </div>
            {s.has("deposits") ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Security deposit (₹)"><Input type="number" value={f.deposit ?? ""} onChange={(e) => set("deposit", e.target.value)} /></Field>
                <Field label="Deposit status"><Select value={f.depositStatus ?? ""} onChange={(e) => set("depositStatus", e.target.value)} options={[{ value: "", label: "—" }, { value: "held", label: "Holding" }, { value: "returned", label: "Returned" }, { value: "deducted", label: "Part kept" }, { value: "kept", label: "Fully kept" }]} /></Field>
                {(f.depositStatus === "deducted") && <Field label="Returned (₹)" className="col-span-2"><Input type="number" value={f.depositBack ?? ""} onChange={(e) => set("depositBack", e.target.value)} /></Field>}
              </div>
            ) : <div className="mt-2 text-xs text-muted">Security deposits <Locked feature="deposits" compact /></div>}
          </div>}
        </>}
        <Field label="Notes"><Textarea value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></Field>
      </div>
    </Sheet>
  );
}

export function SendWhatsApp({ b, onClose }: { b: Rec; onClose: () => void }) {
  const s = useStore();
  const g = b.guestId ? s.byId.get(b.guestId) : null;
  const phone = String(g?.phone || b.phone || "");
  const templates = s.has("whatsapp") ? [...s.of("template"), ...s.defaultTemplates.map((t, i) => ({ ...t, id: `d${i}`, kind: "template" as const }))] : [];
  const vars = templateVars(b, s);
  return (
    <Sheet open onClose={onClose} title="Send on WhatsApp">
      {!phone && <p className="mb-3 rounded-xl bg-sun/20 px-3 py-2 text-xs">Add the guest&apos;s phone number first.</p>}
      {b.checkinCode && <a target="_blank" rel="noreferrer" href={waLink(phone, `Hi ${vars.guest}! Please fill in your guest details before arrival: ${vars.checkinLink}`)} className="mb-2 block rounded-2xl border border-line bg-white p-3 text-sm"><b>Check-in link</b><p className="mt-1 text-xs text-muted">Ask the guest to fill in details and upload IDs.</p></a>}
      {templates.map((t) => (
        <a key={t.id} target="_blank" rel="noreferrer" href={waLink(phone, fillTemplate(t.body, vars))} className="mb-2 block rounded-2xl border border-line bg-white p-3 text-sm">
          <b>{t.name}</b><p className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-muted">{fillTemplate(t.body, vars)}</p>
        </a>
      ))}
      {!s.has("whatsapp") && <Locked feature="whatsapp" />}
    </Sheet>
  );
}

export function BookingDetail({ id }: { id: string }) {
  const s = useStore();
  const { listingName, guestName } = useLookups();
  const b = s.byId.get(id);
  const [edit, setEdit] = useState(false), [wa, setWa] = useState(false), [damage, setDamage] = useState(false), [fix, setFix] = useState(false);
  if (!b) return <Empty title="Booking not found" action={<Button onClick={() => go("bookings")}>All bookings</Button>} />;
  const people = (b.guestIds?.length ? b.guestIds : b.guestId ? [b.guestId] : []).map((g: string) => s.byId.get(g)).filter(Boolean) as Rec[];
  const link = checkinUrl(b);
  const damages = s.of("damage").filter((d) => d.bookingId === b.id);
  const clean = s.of("clean").find((c) => c.bookingId === b.id);
  const del = async () => { if (!confirm("Delete this booking?")) return; try { await s.remove(b.id); go("bookings"); } catch (e) { s.toast((e as Error).message, "bad"); } };
  const approve = async () => { try { await s.save("booking", { checkinStatus: "approved" }, b.id); s.toast("Guest details approved"); } catch (e) { s.toast((e as Error).message, "bad"); } };
  return (
    <div>
      <button onClick={() => history.length > 1 ? history.back() : go("bookings")} className="mb-3 flex items-center gap-1 text-sm text-muted"><ArrowLeft className="size-4" /> Back</button>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">{guestName(b)}</h1>
          <p className="text-sm text-muted">{listingName(b.listingId)} · {fmtDay(b.start, true)} → {fmtDay(b.end, true)} · {nights(b)} night{nights(b) === 1 ? "" : "s"}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{statusBadge(b)}{checkinBadge(b)}{b.source && <Badge>{b.source}</Badge>}{b.icalUid && <Badge>Synced</Badge>}</div>
        </div>
        <div className="flex gap-2">
          {b.status !== "blocked" && <Button tone="soft" onClick={() => setWa(true)}><MessageCircle className="size-4" /> WhatsApp</Button>}
          <Button tone="soft" onClick={() => setEdit(true)}><Pencil className="size-4" /> Edit</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {b.status !== "blocked" && <Card>
          <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Guests</h2><span className="text-xs text-muted">{b.adults || 1} adult{(b.adults || 1) > 1 ? "s" : ""}{b.children ? `, ${b.children} child` : ""}</span></div>
          {people.length ? people.map((g) => (
            <a key={g.id} href={`#guest/${g.id}`} className="mb-1 flex items-center justify-between rounded-xl bg-sand px-3 py-2 text-sm">
              <span><b>{g.name}</b><span className="text-muted"> {g.phone}</span></span>
              <span className="flex gap-1">{g.flag === "blocked" && <Badge tone="bad">Do not host</Badge>}{g.idPhotos?.length ? <Badge tone="ok">ID</Badge> : <Badge tone="warn">No ID</Badge>}</span>
            </a>
          )) : <p className="text-sm text-muted">No guest details yet.</p>}
          {s.has("checkin") && link ? (
            <div className="mt-3 rounded-xl border border-dashed border-line p-3">
              <p className="text-xs font-semibold">Online check-in link</p>
              <p className="mt-0.5 break-all text-xs text-muted">{link}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" tone="soft" onClick={() => { navigator.clipboard?.writeText(link); s.toast("Link copied"); }}><Copy className="size-3.5" /> Copy</Button>
                <Button size="sm" tone="soft" onClick={() => setWa(true)}><MessageCircle className="size-3.5" /> Send</Button>
                {b.checkinStatus === "submitted" && <Button size="sm" onClick={approve}><Check className="size-3.5" /> Approve details</Button>}
                {s.can("guests") && <Button size="sm" tone="soft" onClick={() => setFix(true)}><Pencil className="size-3.5" /> Ask guest to fix</Button>}
              </div>
              {b.checkinStatus === "changes" && b.changeRequest && <p className="mt-2 rounded-lg bg-rust/10 px-2 py-1.5 text-xs text-rust">Asked to fix: {[...(b.changeRequest.fields ?? []).map((k: string) => FIX_OPTIONS.find((o) => o.key === k)?.label), b.changeRequest.note].filter(Boolean).join(" · ")}</p>}
              {b.checkinStatus === "approved" && <p className="mt-2 text-[11px] text-muted">Approved, so the guest can no longer change their details. &ldquo;Ask guest to fix&rdquo; opens the form again.</p>}
            </div>
          ) : !s.has("checkin") ? <div className="mt-3"><Locked feature="checkin" compact /> <span className="text-xs text-muted">Online check-in</span></div> : null}
          {s.can("guests") && <Button size="sm" tone="ghost" className="mt-2" onClick={() => go(`guests?add=${b.id}`)}><UserPlus className="size-3.5" /> Add guest by hand</Button>}
        </Card>}

        {s.can("money") && b.status !== "blocked" && <Card>
          <h2 className="mb-2 font-semibold">Money</h2>
          <dl className="space-y-1 text-sm">
            {[["Guest paid", b.gross], ["Platform fee", b.platformFee], ["Cleaning fee", b.cleaningFee], ["GST / taxes", b.taxes]].filter(([, v]) => Number(v)).map(([k, v]) => <div key={k} className="flex justify-between"><dt className="text-muted">{k}</dt><dd>{money(v)}</dd></div>)}
            <div className="flex justify-between border-t border-line pt-1 font-semibold"><dt>You receive</dt><dd>{money(bookingIncome(b))}</dd></div>
            {nights(b) > 0 && <div className="flex justify-between text-xs text-muted"><dt>Per night</dt><dd>{money(bookingIncome(b) / nights(b))}</dd></div>}
            {s.has("deposits") && Number(b.deposit) > 0 && <div className="flex justify-between pt-2"><dt className="text-muted">Deposit</dt><dd>{money(b.deposit)} · {({ held: "holding", returned: "returned", deducted: `returned ${money(b.depositBack)}`, kept: "kept" } as Record<string, string>)[b.depositStatus] ?? "—"}</dd></div>}
          </dl>
        </Card>}

        {s.has("deposits") && b.status !== "blocked" && <Card>
          <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Damage log</h2><Button size="sm" tone="soft" onClick={() => setDamage(true)}><Plus className="size-3.5" /> Add</Button></div>
          {damages.length ? damages.map((d) => <div key={d.id} className="mb-1 rounded-xl bg-sand px-3 py-2 text-sm"><div className="flex justify-between"><b>{fmtDay(d.date)}</b><span>{money(d.cost)}{Number(d.recovered) ? ` · got back ${money(d.recovered)}` : ""}</span></div><p className="text-muted">{d.note}</p></div>) : <p className="text-sm text-muted">Nothing recorded.</p>}
        </Card>}

        {clean && <Card><h2 className="mb-1 font-semibold">Cleaning after checkout</h2><p className="text-sm text-muted">{clean.items?.filter((i: { done: boolean }) => i.done).length ?? 0} of {clean.items?.length ?? 0} done{clean.doneAt ? " · finished" : ""}</p><Button size="sm" tone="soft" className="mt-2" onClick={() => go("tasks")}>Open checklist</Button></Card>}

        {b.notes && <Card className="md:col-span-2"><h2 className="mb-1 font-semibold">Notes</h2><p className="whitespace-pre-line text-sm">{b.notes}</p></Card>}
      </div>
      <Button tone="danger" size="sm" className="mt-6" onClick={del}><Trash2 className="size-3.5" /> Delete booking</Button>
      {edit && <BookingEditor booking={b} onClose={() => setEdit(false)} />}
      {wa && <SendWhatsApp b={b} onClose={() => setWa(false)} />}
      {damage && <DamageEditor b={b} onClose={() => setDamage(false)} />}
      {fix && <AskFix b={b} onClose={() => setFix(false)} />}
    </div>
  );
}

function DamageEditor({ b, onClose }: { b: Rec; onClose: () => void }) {
  const s = useStore();
  const [f, setF] = useState({ date: istDay(), note: "", cost: "", recovered: "" });
  const save = async () => {
    try { await s.save("damage", { ...f, bookingId: b.id, guestId: b.guestId ?? "", listingId: b.listingId }); s.toast("Saved"); onClose(); } catch (e) { s.toast((e as Error).message, "bad"); }
  };
  return (
    <Sheet open onClose={onClose} title="Damage or loss" footer={<Button onClick={save}>Save</Button>}>
      <div className="space-y-3">
        <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="What happened"><Textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Broken glass, stained bedsheet" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost (₹)"><Input type="number" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} /></Field>
          <Field label="Recovered (₹)"><Input type="number" value={f.recovered} onChange={(e) => setF({ ...f, recovered: e.target.value })} /></Field>
        </div>
      </div>
    </Sheet>
  );
}
