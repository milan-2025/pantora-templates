"use client";
import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { istDay, type Rec } from "@/lib/hostbook/core";
import type { Kind } from "@/lib/hostbook/features";
import { useLookups, useStore } from "../store";
import { Badge, Button, Empty, Field, Input, Locked, PageHead, Select, Sheet, Tabs, Textarea, fmtDay, money } from "../ui";

export function Upkeep() {
  const s = useStore();
  const [tab, setTab] = useState<"stock" | "maint" | "meter">("stock");
  return (
    <div>
      <PageHead title="Stock & upkeep" />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "stock", label: "Stock" }, { value: "maint", label: "Maintenance" }, { value: "meter", label: "Meter readings" }]} />
      {tab === "stock" && (s.has("inventory") ? <Stock /> : <Locked feature="inventory" />)}
      {tab === "maint" && (s.has("maintenance") ? <Maint /> : <Locked feature="maintenance" />)}
      {tab === "meter" && (s.has("meters") ? <Meters /> : <Locked feature="meters" />)}
    </div>
  );
}

function useEditor(kind: Kind, blank: () => Record<string, unknown>) {
  const s = useStore();
  const [edit, setEdit] = useState<Rec | "new" | null>(null);
  const [f, setF] = useState<Record<string, any>>({}); // eslint-disable-line @typescript-eslint/no-explicit-any
  const open = (x: Rec | "new") => { setEdit(x); setF(x === "new" ? blank() : x); };
  const save = async () => { try { await s.save(kind, f, edit === "new" ? undefined : (edit as Rec).id); setEdit(null); s.toast("Saved"); } catch (e) { s.toast((e as Error).message, "bad"); } };
  const del = async () => { if (edit && edit !== "new" && confirm("Delete?")) { try { await s.remove(edit.id); setEdit(null); } catch (e) { s.toast((e as Error).message, "bad"); } } };
  return { edit, f, setF, open, save, del, close: () => setEdit(null) };
}

function ListingSelect({ value, onChange, all = "All / shared" }: { value: string; onChange: (v: string) => void; all?: string }) {
  const { listings } = useLookups();
  return <Select value={value ?? ""} onChange={(e) => onChange(e.target.value)} options={[{ value: "", label: all }, ...listings.map((l) => ({ value: l.id, label: l.name }))]} />;
}

function Stock() {
  const s = useStore();
  const { listingName } = useLookups();
  const e = useEditor("inventory", () => ({ name: "", qty: 0, min: 2, unit: "pcs", listingId: "" }));
  const list = s.of("inventory").sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const bump = async (x: Rec, d: number) => { try { await s.save("inventory", { qty: Math.max(0, (Number(x.qty) || 0) + d) }, x.id); } catch (err) { s.toast((err as Error).message, "bad"); } };
  return (
    <div>
      <div className="mb-3 flex justify-end"><Button onClick={() => e.open("new")}><Plus className="size-4" /> Item</Button></div>
      {list.length ? <div className="overflow-hidden rounded-2xl border border-line bg-white">{list.map((x) => {
        const low = Number(x.min) > 0 && Number(x.qty) <= Number(x.min);
        return (
          <div key={x.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0">
            <button onClick={() => e.open(x)} className="min-w-0 flex-1 text-left"><b>{x.name}</b> {low && <Badge tone="bad">Low</Badge>}<span className="block text-xs text-muted">{x.listingId ? listingName(x.listingId) : "Shared"} · alert at {x.min}</span></button>
            <button onClick={() => bump(x, -1)} className="grid size-8 place-items-center rounded-full bg-ink/5"><Minus className="size-4" /></button>
            <span className="w-14 text-center font-semibold">{x.qty} <span className="text-xs font-normal text-muted">{x.unit}</span></span>
            <button onClick={() => bump(x, 1)} className="grid size-8 place-items-center rounded-full bg-mist text-teal"><Plus className="size-4" /></button>
          </div>
        );
      })}</div> : <Empty title="No stock items yet" text="Bed sheets, towels, toilet rolls, soaps, tea & coffee… Get an alert in your morning email when one runs low." />}
      {e.edit && <Sheet open onClose={e.close} title="Stock item" footer={<>{e.edit !== "new" && <Button tone="danger" onClick={e.del}>Delete</Button>}<Button onClick={e.save}>Save</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Item" className="col-span-2"><Input value={e.f.name} onChange={(v) => e.setF({ ...e.f, name: v.target.value })} placeholder="e.g. Bath towels" /></Field>
          <Field label="In stock"><Input type="number" value={e.f.qty} onChange={(v) => e.setF({ ...e.f, qty: v.target.value })} /></Field>
          <Field label="Unit"><Input value={e.f.unit ?? ""} onChange={(v) => e.setF({ ...e.f, unit: v.target.value })} /></Field>
          <Field label="Alert when at or below"><Input type="number" value={e.f.min} onChange={(v) => e.setF({ ...e.f, min: v.target.value })} /></Field>
          <Field label="Listing"><ListingSelect value={e.f.listingId} onChange={(v) => e.setF({ ...e.f, listingId: v })} all="Shared" /></Field>
        </div>
      </Sheet>}
    </div>
  );
}

function Maint() {
  const s = useStore();
  const { listingName } = useLookups();
  const e = useEditor("maint", () => ({ date: istDay(), title: "", cost: "", vendor: "", status: "done", listingId: "" }));
  const list = s.of("maint").sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div>
      <div className="mb-3 flex items-center justify-between"><p className="text-sm text-muted">Repairs and servicing. Costs marked done count as expenses in your reports.</p><Button onClick={() => e.open("new")}><Plus className="size-4" /> Entry</Button></div>
      {list.length ? <div className="overflow-hidden rounded-2xl border border-line bg-white">{list.map((x) => (
        <button key={x.id} onClick={() => e.open(x)} className="flex w-full items-center justify-between border-b border-line px-4 py-3 text-left text-sm last:border-0">
          <span><b>{x.title}</b> {x.status === "planned" ? <Badge tone="warn">Planned</Badge> : x.status === "open" ? <Badge tone="bad">Open issue</Badge> : null}<span className="block text-xs text-muted">{fmtDay(x.date, true)} · {x.listingId ? listingName(x.listingId) : "All"}{x.vendor ? ` · ${x.vendor}` : ""}</span></span>
          {Number(x.cost) > 0 && <b>{money(x.cost)}</b>}
        </button>
      ))}</div> : <Empty title="Nothing logged yet" text="Plumber visits, geyser repairs, painting… with costs and vendor contacts." />}
      {e.edit && <Sheet open onClose={e.close} title="Maintenance" footer={<>{e.edit !== "new" && <Button tone="danger" onClick={e.del}>Delete</Button>}<Button onClick={e.save}>Save</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="What" className="col-span-2"><Input value={e.f.title} onChange={(v) => e.setF({ ...e.f, title: v.target.value })} placeholder="e.g. Geyser repair" /></Field>
          <Field label="Date"><Input type="date" value={e.f.date} onChange={(v) => e.setF({ ...e.f, date: v.target.value })} /></Field>
          <Field label="Status"><Select value={e.f.status} onChange={(v) => e.setF({ ...e.f, status: v.target.value })} options={[{ value: "done", label: "Done" }, { value: "open", label: "Open issue" }, { value: "planned", label: "Planned" }]} /></Field>
          <Field label="Cost (₹)"><Input type="number" value={e.f.cost} onChange={(v) => e.setF({ ...e.f, cost: v.target.value })} /></Field>
          <Field label="Vendor / phone"><Input value={e.f.vendor ?? ""} onChange={(v) => e.setF({ ...e.f, vendor: v.target.value })} /></Field>
          <Field label="Listing" className="col-span-2"><ListingSelect value={e.f.listingId} onChange={(v) => e.setF({ ...e.f, listingId: v })} /></Field>
          <Field label="Notes" className="col-span-2"><Textarea value={e.f.note ?? ""} onChange={(v) => e.setF({ ...e.f, note: v.target.value })} /></Field>
        </div>
      </Sheet>}
    </div>
  );
}

function Meters() {
  const s = useStore();
  const { listings, listingName } = useLookups();
  const [lid, setLid] = useState(listings[0]?.id ?? "");
  const e = useEditor("meter", () => ({ date: istDay(), reading: "", listingId: lid }));
  const list = s.of("meter").filter((x) => x.listingId === lid).sort((a, b) => a.date.localeCompare(b.date));
  const stays = s.of("booking").filter((b) => b.listingId === lid && b.status !== "cancelled" && b.status !== "blocked");
  const rows = list.map((x, i) => {
    const prev = list[i - 1];
    const used = prev ? Number(x.reading) - Number(prev.reading) : null;
    const during = prev ? stays.find((b) => b.start >= prev.date && b.end <= x.date) : null;
    return { x, used, during };
  }).reverse();
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select className="w-auto" value={lid} onChange={(v) => setLid(v.target.value)} options={listings.map((l) => ({ value: l.id, label: l.name }))} />
        <p className="flex-1 text-xs text-muted">Note the reading at check-in and check-out to see units used per stay.</p>
        <Button onClick={() => e.open("new")} disabled={!lid}><Plus className="size-4" /> Reading</Button>
      </div>
      {rows.length ? <div className="overflow-hidden rounded-2xl border border-line bg-white">{rows.map(({ x, used, during }) => (
        <button key={x.id} onClick={() => e.open(x)} className="flex w-full items-center justify-between border-b border-line px-4 py-3 text-left text-sm last:border-0">
          <span><b>{x.reading}</b> <span className="text-muted">units · {fmtDay(x.date, true)}</span>{x.note && <span className="block text-xs text-muted">{x.note}</span>}</span>
          {used !== null && <span className="text-right text-xs"><b className="text-sm">{used} used</b>{during && <span className="block text-muted">stay of {during.guestName || s.byId.get(during.guestId)?.name || "guest"}</span>}</span>}
        </button>
      ))}</div> : <Empty title={`No readings for ${listingName(lid)} yet`} />}
      {e.edit && <Sheet open onClose={e.close} title="Meter reading" footer={<>{e.edit !== "new" && <Button tone="danger" onClick={e.del}>Delete</Button>}<Button onClick={e.save}>Save</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Reading (units)"><Input type="number" autoFocus value={e.f.reading} onChange={(v) => e.setF({ ...e.f, reading: v.target.value })} /></Field>
          <Field label="Date"><Input type="date" value={e.f.date} onChange={(v) => e.setF({ ...e.f, date: v.target.value })} /></Field>
          <Field label="Note" className="col-span-2"><Input value={e.f.note ?? ""} onChange={(v) => e.setF({ ...e.f, note: v.target.value })} placeholder="e.g. at check-out" /></Field>
        </div>
      </Sheet>}
    </div>
  );
}
