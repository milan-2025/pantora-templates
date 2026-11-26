"use client";
import { useState } from "react";
import { Archive, Building2, CalendarSync, Plus, Trash2, Undo2 } from "lucide-react";
import { BOOKING_SOURCES } from "@/lib/hostbook/features";
import { type Rec } from "@/lib/hostbook/core";
import { useStore } from "../store";
import { Badge, Button, Card, Empty, Field, Input, Locked, PageHead, Select, Sheet, Textarea } from "../ui";

const DEFAULT_CHECKLIST = ["Change bed sheets & towels", "Clean bathroom", "Sweep & mop floors", "Empty bins", "Restock toiletries", "Check for damage or lost items"];

export function Listings({ query = "" }: { query?: string }) {
  const s = useStore();
  const all = s.of("listing");
  const active = all.filter((l) => !l.archived), archived = all.filter((l) => l.archived);
  const [edit, setEdit] = useState<Rec | "new" | null>(new URLSearchParams(query).get("add") ? "new" : null);
  const limit = s.me.access.listingLimit;
  const full = active.length >= limit;
  const tryAdd = () => (full ? s.upsell("listings") : setEdit("new"));
  const restore = async (l: Rec) => { try { await s.save("listing", { archived: false }, l.id); } catch (e) { s.toast((e as Error).message, "bad"); } };
  return (
    <div>
      <PageHead title="Listings" sub={`${active.length} of ${limit} on your ${s.me.access.plan.name} plan`} action={s.can("owner") && <Button onClick={tryAdd}><Plus className="size-4" /> Listing</Button>} />
      {active.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {active.map((l) => (
            <Card key={l.id} className="cursor-pointer hover:border-teal/40" onClick={() => s.can("owner") && setEdit(l)}>
              <div className="flex items-start justify-between gap-2">
                <div><b className="text-lg">{l.name}</b><p className="text-sm text-muted">{[l.city, l.checkIn && `In ${l.checkIn}`, l.checkOut && `Out ${l.checkOut}`].filter(Boolean).join(" · ")}</p></div>
                {Array.isArray(l.ical) && l.ical.length > 0 && <Badge tone="teal"><CalendarSync className="size-3" />{l.ical.length} synced</Badge>}
              </div>
              <p className="mt-2 text-xs text-muted">{s.of("booking").filter((b) => b.listingId === l.id && b.status !== "cancelled").length} bookings · {s.of("task").filter((t) => t.listingId === l.id && t.active !== false).length} tasks</p>
            </Card>
          ))}
        </div>
      ) : <Empty icon={<Building2 />} title="No listings yet" text="Add each flat, room or villa you host." action={s.can("owner") && <Button onClick={tryAdd}>Add listing</Button>} />}
      {archived.length > 0 && <div className="mt-6"><h3 className="mb-2 text-sm font-semibold text-muted">Archived</h3>{archived.map((l) => <div key={l.id} className="mb-2 flex items-center justify-between rounded-xl border border-line bg-white px-4 py-2 text-sm"><span>{l.name}</span>{s.can("owner") && <Button size="sm" tone="ghost" onClick={() => restore(l)}><Undo2 className="size-3.5" /> Restore</Button>}</div>)}</div>}
      {edit && <ListingEditor listing={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function ListingEditor({ listing, onClose }: { listing: Rec | null; onClose: () => void }) {
  const s = useStore();
  const [f, setF] = useState<Record<string, any>>(() => listing ? { ...listing, checklist: (listing.checklist ?? []).join("\n") } : { name: "", checkIn: "2:00 PM", checkOut: "11:00 AM", ical: [], checklist: DEFAULT_CHECKLIST.join("\n") }); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const feeds = (f.ical ?? []) as { source: string; url: string }[];
  const save = async () => {
    setBusy(true);
    try {
      await s.save("listing", { ...f, checklist: String(f.checklist ?? "").split("\n").map((x) => x.trim()).filter(Boolean), ical: feeds.filter((x) => x.url.trim()) }, listing?.id);
      s.toast(listing ? "Listing saved" : "Listing added"); onClose();
    } catch (e) { s.toast((e as Error).message, "bad"); } finally { setBusy(false); }
  };
  const archive = async () => { if (!listing || !confirm(`Archive ${listing.name}? It stays in your reports but frees a listing slot.`)) return; try { await s.save("listing", { archived: true }, listing.id); onClose(); } catch (e) { s.toast((e as Error).message, "bad"); } };
  return (
    <Sheet wide open onClose={onClose} title={listing ? listing.name : "New listing"} footer={<>{listing && <Button tone="danger" onClick={archive}><Archive className="size-4" /> Archive</Button>}<Button tone="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></>}>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Name" className="md:col-span-2"><Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. 2BHK Sector 20, Panchkula" /></Field>
        <Field label="Address (shown to guests after they check in)" className="md:col-span-2"><Textarea rows={2} value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
        <Field label="City"><Input value={f.city ?? ""} onChange={(e) => set("city", e.target.value)} /></Field>
        <Field label="Google Maps link"><Input value={f.mapUrl ?? ""} onChange={(e) => set("mapUrl", e.target.value)} /></Field>
        <Field label="Check-in time"><Input value={f.checkIn ?? ""} onChange={(e) => set("checkIn", e.target.value)} /></Field>
        <Field label="Check-out time"><Input value={f.checkOut ?? ""} onChange={(e) => set("checkOut", e.target.value)} /></Field>
        <Field label="Wi-Fi name"><Input value={f.wifiName ?? ""} onChange={(e) => set("wifiName", e.target.value)} /></Field>
        <Field label="Wi-Fi password"><Input value={f.wifiPass ?? ""} onChange={(e) => set("wifiPass", e.target.value)} /></Field>
        <Field label="Default cleaning fee (₹)"><Input type="number" value={f.cleaningFee ?? ""} onChange={(e) => set("cleaningFee", e.target.value)} /></Field>
        <Field label="House rules (guests agree to these at check-in)" className="md:col-span-2"><Textarea rows={4} value={f.rules ?? ""} onChange={(e) => set("rules", e.target.value)} placeholder={"No smoking indoors\nNo parties\nQuiet hours 10 PM – 7 AM"} /></Field>
      </div>

      <h3 className="mb-2 mt-5 font-semibold">Calendar sync</h3>
      {s.has("ical") ? <>
        <p className="mb-2 text-xs text-muted">Airbnb: Listing → Availability → Connect calendars → Export calendar, copy the link. Booking.com: Calendar → Sync calendars → Export. Bookings come in every few hours (or tap Sync).</p>
        {feeds.map((x, i) => (
          <div key={i} className="mb-2 flex gap-2">
            <Select className="w-36" value={x.source} onChange={(e) => set("ical", feeds.map((y, j) => (j === i ? { ...y, source: e.target.value } : y)))} options={BOOKING_SOURCES} />
            <Input value={x.url} placeholder="https://www.airbnb.co.in/calendar/ical/…" onChange={(e) => set("ical", feeds.map((y, j) => (j === i ? { ...y, url: e.target.value } : y)))} />
            <button onClick={() => set("ical", feeds.filter((_, j) => j !== i))} className="rounded-full p-2 text-rust hover:bg-rust/10" aria-label="Remove"><Trash2 className="size-4" /></button>
          </div>
        ))}
        {feeds.length < 5 && <Button size="sm" tone="soft" onClick={() => set("ical", [...feeds, { source: "Airbnb", url: "" }])}><Plus className="size-3.5" /> Calendar link</Button>}
      </> : <Locked feature="ical" />}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 font-semibold">Cleaning checklist</h3>
          {s.has("cleaning") ? <Field label="One item per line" hint="Created on each checkout day."><Textarea rows={6} value={f.checklist ?? ""} onChange={(e) => set("checklist", e.target.value)} /></Field> : <Locked feature="cleaning" />}
        </div>
        <div>
          <h3 className="mb-2 font-semibold">Guidebook</h3>
          {s.has("guidebook") ? <Field label="Shown to guests after check-in" hint="Directions, parking, how things work, nearby food, emergency numbers."><Textarea rows={6} value={f.guidebook ?? ""} onChange={(e) => set("guidebook", e.target.value)} /></Field> : <Locked feature="guidebook" />}
        </div>
      </div>

      {(s.has("owners") || s.has("gst")) && <div className="mt-5 grid gap-3 md:grid-cols-2">
        {s.has("owners") && <>
          <Field label="Owner (if you manage it for someone)"><Select value={f.ownerId ?? ""} onChange={(e) => set("ownerId", e.target.value)} options={[{ value: "", label: "I own it" }, ...s.of("owner").map((o) => ({ value: o.id, label: o.name }))]} /></Field>
          <Field label="Commission % for this listing" hint="Empty = owner's default"><Input type="number" value={f.commission ?? ""} onChange={(e) => set("commission", e.target.value)} /></Field>
        </>}
        {s.has("gst") && <>
          <Field label="GSTIN"><Input value={f.gstin ?? ""} onChange={(e) => set("gstin", e.target.value.toUpperCase())} /></Field>
          <Field label="GST rate %"><Input type="number" value={f.gstRate ?? ""} onChange={(e) => set("gstRate", e.target.value)} /></Field>
        </>}
      </div>}
    </Sheet>
  );
}
