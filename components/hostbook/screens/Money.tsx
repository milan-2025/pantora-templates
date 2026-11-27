"use client";
import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Camera, Download, FileText, Loader2, Paperclip, Plus, Printer, Repeat, Search } from "lucide-react";
import { EXPENSE_CATEGORIES, PAY_METHODS } from "@/lib/hostbook/features";
import { addDays, addMonths, bookingIncome, buildReport, buildStatement, istDay, nights, ownerStatement, toCsv, type Rec } from "@/lib/hostbook/core";
import { api, uploadSigned } from "../api";
import { useLookups, useStore } from "../store";
import { go } from "../App";
import { Badge, Bars, Button, Card, Empty, Field, HBar, Input, Locked, PageHead, Select, Sheet, Stat, Tabs, Textarea, download, escHtml, fmtDay, fmtMonth, money, printPage } from "../ui";

type Period = "month" | "last" | "fy" | "year" | "custom";
function range(p: Period, custom: { from: string; to: string }) {
  const t = istDay(), m = t.slice(0, 7) + "-01";
  if (p === "month") return { from: m, to: addDays(addMonths(m, 1), -1) };
  if (p === "last") { const lm = addMonths(m, -1); return { from: lm, to: addDays(m, -1) }; }
  if (p === "year") return { from: `${t.slice(0, 4)}-01-01`, to: `${t.slice(0, 4)}-12-31` };
  if (p === "fy") { const y = Number(t.slice(5, 7)) >= 4 ? Number(t.slice(0, 4)) : Number(t.slice(0, 4)) - 1; return { from: `${y}-04-01`, to: `${y + 1}-03-31` }; }
  return custom;
}

export function MoneyScreen() {
  const s = useStore();
  const full = s.can("money");
  const [tab, setTab] = useState<"overview" | "statement" | "expenses" | "income" | "repeating" | "owners" | "gst">(full ? "overview" : "expenses");
  return (
    <div>
      <PageHead title="Money" sub={full ? "Income, expenses and profit for each listing" : "Expenses you've added"} />
      {full && <Tabs value={tab} onChange={setTab} tabs={[{ value: "overview", label: "Overview" }, { value: "statement", label: "Statement" }, { value: "expenses", label: "Expenses" }, { value: "income", label: "Other income" }, { value: "repeating", label: "Repeating" }, { value: "owners", label: "Owner statements" }, { value: "gst", label: "GST" }]} />}
      {tab === "overview" && <Overview />}
      {tab === "statement" && <Statement />}
      {tab === "expenses" && <Expenses />}
      {tab === "income" && <OtherIncome />}
      {tab === "repeating" && (s.has("recurring") ? <Repeating /> : <Locked feature="recurring" />)}
      {tab === "owners" && (s.has("owners") ? <Owners /> : <Locked feature="owners" />)}
      {tab === "gst" && (s.has("gst") ? <Gst /> : <Locked feature="gst" />)}
    </div>
  );
}

function PeriodPicker({ p, setP, custom, setCustom, lid, setLid }: { p: Period; setP: (p: Period) => void; custom: { from: string; to: string }; setCustom: (c: { from: string; to: string }) => void; lid: string; setLid: (s: string) => void }) {
  const { listings } = useLookups();
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <Select className="w-auto" value={p} onChange={(e) => setP(e.target.value as Period)} options={[{ value: "month", label: "This month" }, { value: "last", label: "Last month" }, { value: "fy", label: "This financial year (Apr–Mar)" }, { value: "year", label: "This calendar year" }, { value: "custom", label: "Custom dates" }]} />
      {p === "custom" && <><Input type="date" className="w-auto" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /><Input type="date" className="w-auto" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></>}
      {listings.length > 1 && <Select className="w-auto" value={lid} onChange={(e) => setLid(e.target.value)} options={[{ value: "", label: "All listings" }, ...listings.map((l) => ({ value: l.id, label: l.name }))]} />}
    </div>
  );
}

function Overview() {
  const s = useStore();
  const { listingName } = useLookups();
  const [p, setP] = useState<Period>("month");
  const [custom, setCustom] = useState({ from: addDays(istDay(), -30), to: istDay() });
  const [lid, setLid] = useState("");
  const { from, to } = range(p, custom);
  const r = useMemo(() => buildReport(s.items, from, to, lid), [s.items, from, to, lid]);
  const exportCsv = () => {
    if (!s.has("export")) return s.upsell("export");
    const rows: (string | number)[][] = [["Type", "Date", "Listing", "Category / source", "Guest / note", "Nights", "Amount (₹)"]];
    for (const b of s.of("booking").filter((b) => b.status !== "cancelled" && b.status !== "blocked" && b.start >= from && b.start <= to && (!lid || b.listingId === lid)).sort((a, b) => a.start.localeCompare(b.start)))
      rows.push(["Booking", b.start, listingName(b.listingId), b.source ?? "", b.guestName || s.byId.get(b.guestId)?.name || "", nights(b), bookingIncome(b)]);
    for (const x of s.of("income").filter((x) => x.date >= from && x.date <= to && (!lid || x.listingId === lid))) rows.push(["Other income", x.date, x.listingId ? listingName(x.listingId) : "All", x.source ?? "", x.note ?? "", "", x.amount]);
    for (const x of s.of("expense").filter((x) => x.date >= from && x.date <= to && (!lid || x.listingId === lid || !x.listingId))) rows.push(["Expense", x.date, x.listingId ? listingName(x.listingId) : "All", x.category ?? "", [x.vendor, x.note].filter(Boolean).join(" · "), "", -Number(x.amount || 0)]);
    rows.push([], ["Total income", "", "", "", "", r.nights, r.income], ["Total expenses", "", "", "", "", "", -r.expenses], ["Profit", "", "", "", "", "", r.profit]);
    download(`hostbook-${from}-to-${to}.csv`, toCsv(rows));
  };
  const printPl = () => {
    printPage("Profit & loss", `<h1>Profit &amp; loss</h1><p class="muted">${escHtml(s.me.account.business)} · ${lid ? escHtml(listingName(lid)) : "All listings"} · ${fmtDay(from, true)} to ${fmtDay(to, true)}</p>
      <table><tr><th>Item</th><th class="r">₹</th></tr><tr><td>Booking income (payouts)</td><td class="r">${money(r.bookingIncome)}</td></tr><tr><td>Other income</td><td class="r">${money(r.otherIncome)}</td></tr>
      ${r.byCategory.map((c) => `<tr><td>Expense: ${escHtml(c.name)}</td><td class="r">−${money(c.amount)}</td></tr>`).join("")}<tr class="tot"><td>Profit</td><td class="r">${money(r.profit)}</td></tr></table>
      <h2>Occupancy</h2><table><tr><td>Nights booked</td><td class="r">${r.nights} of ${r.available}</td></tr><tr><td>Occupancy</td><td class="r">${r.occupancy}%</td></tr><tr><td>Average nightly rate</td><td class="r">${money(r.adr)}</td></tr><tr><td>Earnings per available night</td><td class="r">${money(r.revpar)}</td></tr></table>`);
  };
  if (!s.has("reports")) {
    return (
      <div>
        <PeriodPicker {...{ p, setP, custom, setCustom, lid, setLid }} />
        <div className="mb-4 grid grid-cols-3 gap-3"><Stat label="Income" value={money(r.income)} /><Stat label="Expenses" value={money(r.expenses)} /><Stat label="Profit" value={money(r.profit)} tone={r.profit >= 0 ? "ok" : "bad"} /></div>
        <Locked feature="reports" />
      </div>
    );
  }
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <PeriodPicker {...{ p, setP, custom, setCustom, lid, setLid }} />
        <div className="mb-4 flex gap-2"><Button tone="soft" size="sm" onClick={printPl}><Printer className="size-3.5" /> PDF</Button><Button tone="soft" size="sm" onClick={exportCsv}><Download className="size-3.5" /> Excel</Button></div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Income" value={money(r.income)} sub={r.otherIncome ? `${money(r.otherIncome)} other` : `${r.bookings} bookings`} />
        <Stat label="Expenses" value={money(r.expenses)} />
        <Stat label="Profit" value={money(r.profit)} tone={r.profit >= 0 ? "ok" : "bad"} sub={r.income ? `${Math.round((r.profit / r.income) * 100)}% margin` : undefined} />
        <Stat label="Occupancy" value={`${r.occupancy}%`} sub={`${r.nights} of ${r.available} nights`} />
        <Stat label="Avg nightly rate" value={money(r.adr)} />
        <Stat label="Per available night" value={money(r.revpar)} />
        <Stat label="Platform fees" value={money(r.platformFees)} />
        <Stat label="Bookings" value={r.bookings} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {r.byMonth.length > 1 && <Card className="md:col-span-2"><h3 className="mb-2 font-semibold">By month</h3><Bars data={r.byMonth.map((m) => ({ label: fmtMonth(m.month), a: m.income, b: m.expenses }))} /></Card>}
        <Card><h3 className="mb-3 font-semibold">Where the money goes</h3>{r.byCategory.length ? <HBar rows={r.byCategory} /> : <p className="text-sm text-muted">No expenses in this period.</p>}</Card>
        <Card><h3 className="mb-3 font-semibold">Where bookings come from</h3>{r.bySource.length ? <HBar rows={r.bySource.map((x) => ({ ...x, sub: `${x.count} booking${x.count === 1 ? "" : "s"}` }))} /> : <p className="text-sm text-muted">No bookings in this period.</p>}</Card>
        {!lid && r.byListing.length > 1 && <Card className="md:col-span-2 overflow-x-auto"><h3 className="mb-2 font-semibold">By listing</h3>
          <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted"><th className="py-1">Listing</th><th className="text-right">Income</th><th className="text-right">Expenses</th><th className="text-right">Profit</th><th className="text-right">Occupancy</th></tr></thead>
            <tbody>{r.byListing.sort((a, b) => b.profit - a.profit).map((x) => <tr key={x.id} className="border-t border-line"><td className="py-1.5">{x.name}</td><td className="text-right">{money(x.income)}</td><td className="text-right">{money(x.expenses)}</td><td className={`text-right font-semibold ${x.profit < 0 ? "text-rust" : ""}`}>{money(x.profit)}</td><td className="text-right">{x.occupancy}%</td></tr>)}</tbody></table>
          <p className="mt-2 text-[11px] text-muted">Expenses not tied to a listing are split evenly.</p></Card>}
      </div>
    </div>
  );
}

export function ExpenseEditor({ expense, onClose }: { expense: Rec | null; onClose: () => void }) {
  const s = useStore();
  const { listings } = useLookups();
  const [f, setF] = useState<Record<string, any>>(() => expense ?? { date: istDay(), listingId: listings.length === 1 ? listings[0].id : "", category: "Cleaning", amount: "", method: "UPI" }); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!(Number(f.amount) > 0)) return s.toast("Enter the amount", "bad");
    setBusy(true);
    try {
      const r = await s.save("expense", f, expense?.id);
      if (file) {
        const sig = await api("files/sign", { body: { kind: "expense" } });
        await uploadSigned(sig, file);
        s.put((await api("files/add", { body: { id: r.id, publicId: sig.publicId, name: file.name } })).item);
      }
      s.toast("Expense saved"); onClose();
    } catch (e) { s.toast((e as Error).message, "bad"); } finally { setBusy(false); }
  };
  const del = async () => { if (!expense || !confirm("Delete this expense?")) return; try { await s.remove(expense.id); onClose(); } catch (e) { s.toast((e as Error).message, "bad"); } };
  return (
    <Sheet open onClose={onClose} title={expense ? "Edit expense" : "Add expense"} footer={<>{expense && <Button tone="danger" onClick={del}>Delete</Button>}<Button tone="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (₹)"><Input autoFocus type="number" inputMode="decimal" value={f.amount} onChange={(e) => set("amount", e.target.value)} /></Field>
        <Field label="Date"><Input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label="Category"><Select value={f.category} onChange={(e) => set("category", e.target.value)} options={EXPENSE_CATEGORIES} /></Field>
        <Field label="Listing"><Select value={f.listingId} onChange={(e) => set("listingId", e.target.value)} options={[{ value: "", label: "All listings (shared)" }, ...listings.map((l) => ({ value: l.id, label: l.name }))]} /></Field>
        <Field label="Paid by"><Select value={f.method} onChange={(e) => set("method", e.target.value)} options={PAY_METHODS} /></Field>
        <Field label="Paid to (vendor)"><Input value={f.vendor ?? ""} onChange={(e) => set("vendor", e.target.value)} /></Field>
        <Field label="Note" className="col-span-2"><Textarea rows={2} value={f.note ?? ""} onChange={(e) => set("note", e.target.value)} /></Field>
      </div>
      <div className="mt-3">
        {s.has("receipts") ? (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-mist px-3 py-2 text-sm font-semibold text-teal">
            <Camera className="size-4" /> {file ? file.name : expense?.files?.length ? "Add another receipt" : "Add receipt photo"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        ) : <span className="text-xs text-muted">Receipt photos <Locked feature="receipts" compact /></span>}
        {expense?.files?.length ? <ReceiptLinks r={expense} /> : null}
      </div>
    </Sheet>
  );
}

function ReceiptLinks({ r }: { r: Rec }) {
  const s = useStore();
  const [busy, setBusy] = useState("");
  const open = async (publicId: string) => {
    setBusy(publicId);
    const w = window.open("", "_blank");
    try { const x = await api("files/link", { body: { id: r.id, publicId } }); if (w) w.location.href = x.url; } catch (e) { w?.close(); s.toast((e as Error).message, "bad"); } finally { setBusy(""); }
  };
  return <div className="mt-2 flex flex-wrap gap-2">{(r.files as { publicId: string; name: string }[]).map((f, i) => <button key={f.publicId} onClick={() => open(f.publicId)} className="flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-xs">{busy === f.publicId ? <Loader2 className="size-3 animate-spin" /> : <Paperclip className="size-3" />} Receipt {i + 1}</button>)}</div>;
}

function Expenses() {
  const s = useStore();
  const { listingName, listings } = useLookups();
  const [edit, setEdit] = useState<Rec | "new" | null>(null);
  const [month, setMonth] = useState(istDay().slice(0, 7)), [cat, setCat] = useState(""), [lid, setLid] = useState("");
  const list = s.of("expense").filter((x) => x.date?.startsWith(month) && (!cat || x.category === cat) && (!lid || x.listingId === lid)).sort((a, b) => b.date.localeCompare(a.date));
  const total = list.reduce((t, x) => t + (Number(x.amount) || 0), 0);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Input type="month" className="w-auto" value={month} onChange={(e) => setMonth(e.target.value)} />
        <Select className="w-auto" value={cat} onChange={(e) => setCat(e.target.value)} options={[{ value: "", label: "All categories" }, ...EXPENSE_CATEGORIES]} />
        {listings.length > 1 && <Select className="w-auto" value={lid} onChange={(e) => setLid(e.target.value)} options={[{ value: "", label: "All listings" }, ...listings.map((l) => ({ value: l.id, label: l.name }))]} />}
        <Button className="ml-auto" onClick={() => setEdit("new")}><Plus className="size-4" /> Expense</Button>
      </div>
      {list.length ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          {list.map((x) => (
            <button key={x.id} onClick={() => setEdit(x)} className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-0 hover:bg-ink/[.02]">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5"><b>{x.category}</b>{x.recurringId && <Repeat className="size-3 text-muted" />}{x.files?.length ? <Paperclip className="size-3 text-muted" /> : null}</div>
                <div className="truncate text-xs text-muted">{fmtDay(x.date)} · {x.listingId ? listingName(x.listingId) : "All listings"}{x.vendor ? ` · ${x.vendor}` : ""}{x.note ? ` · ${x.note}` : ""}</div>
              </div>
              <b>{money(x.amount)}</b>
            </button>
          ))}
          <div className="flex justify-between bg-sand px-4 py-2.5 text-sm font-semibold"><span>Total</span><span>{money(total)}</span></div>
        </div>
      ) : <Empty title="No expenses this month" text="Track cleaning, laundry, bills, repairs and supplies to see your real profit." action={<Button onClick={() => setEdit("new")}>Add expense</Button>} />}
      {edit && <ExpenseEditor expense={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function OtherIncome() {
  const s = useStore();
  const { listingName, listings } = useLookups();
  const [edit, setEdit] = useState<Rec | "new" | null>(null);
  const list = s.of("income").sort((a, b) => b.date.localeCompare(a.date));
  const [f, setF] = useState<Record<string, any>>({}); // eslint-disable-line @typescript-eslint/no-explicit-any
  const open = (x: Rec | "new") => { setEdit(x); setF(x === "new" ? { date: istDay(), listingId: "", amount: "", source: "" } : x); };
  const save = async () => { try { await s.save("income", f, edit === "new" ? undefined : (edit as Rec).id); setEdit(null); } catch (e) { s.toast((e as Error).message, "bad"); } };
  const del = async () => { if (edit && edit !== "new" && confirm("Delete?")) { await s.remove(edit.id); setEdit(null); } };
  return (
    <div>
      <div className="mb-3 flex items-center justify-between"><p className="text-sm text-muted">Income that isn&apos;t a booking: extra-bed charges, late checkout, breakfast, damages recovered…</p><Button onClick={() => open("new")}><Plus className="size-4" /> Income</Button></div>
      {list.length ? <div className="overflow-hidden rounded-2xl border border-line bg-white">{list.map((x) => <button key={x.id} onClick={() => open(x)} className="flex w-full justify-between border-b border-line px-4 py-3 text-left text-sm last:border-0"><span><b>{x.source || "Income"}</b><span className="block text-xs text-muted">{fmtDay(x.date, true)} · {x.listingId ? listingName(x.listingId) : "All"}{x.note ? ` · ${x.note}` : ""}</span></span><b className="text-leaf">{money(x.amount)}</b></button>)}</div> : <Empty title="No other income yet" />}
      {edit && <Sheet open onClose={() => setEdit(null)} title="Other income" footer={<>{edit !== "new" && <Button tone="danger" onClick={del}>Delete</Button>}<Button onClick={save}>Save</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)"><Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="What for"><Input value={f.source ?? ""} onChange={(e) => setF({ ...f, source: e.target.value })} placeholder="e.g. Extra bed" /></Field>
          <Field label="Listing"><Select value={f.listingId} onChange={(e) => setF({ ...f, listingId: e.target.value })} options={[{ value: "", label: "All" }, ...listings.map((l) => ({ value: l.id, label: l.name }))]} /></Field>
          <Field label="Note" className="col-span-2"><Input value={f.note ?? ""} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        </div>
      </Sheet>}
    </div>
  );
}

function Repeating() {
  const s = useStore();
  const { listingName, listings } = useLookups();
  const [edit, setEdit] = useState<Rec | "new" | null>(null);
  const [f, setF] = useState<Record<string, any>>({}); // eslint-disable-line @typescript-eslint/no-explicit-any
  const open = (x: Rec | "new") => { setEdit(x); setF(x === "new" ? { category: "Rent / EMI", amount: "", day: 1, listingId: "", active: true } : x); };
  const save = async () => { try { await s.save("recurring", f, edit === "new" ? undefined : (edit as Rec).id); setEdit(null); s.toast("Saved"); } catch (e) { s.toast((e as Error).message, "bad"); } };
  const del = async () => { if (edit && edit !== "new" && confirm("Stop and delete this repeating expense? Expenses already added stay.")) { await s.remove(edit.id); setEdit(null); } };
  const list = s.of("recurring");
  return (
    <div>
      <div className="mb-3 flex items-center justify-between"><p className="text-sm text-muted">Added to expenses automatically each month on the day you pick.</p><Button onClick={() => open("new")}><Plus className="size-4" /> Repeating</Button></div>
      {list.length ? <div className="overflow-hidden rounded-2xl border border-line bg-white">{list.map((x) => <button key={x.id} onClick={() => open(x)} className="flex w-full items-center justify-between border-b border-line px-4 py-3 text-left text-sm last:border-0"><span><b>{x.category}</b> {x.active === false && <Badge>Paused</Badge>}<span className="block text-xs text-muted">On day {x.day} each month · {x.listingId ? listingName(x.listingId) : "All listings"}{x.note ? ` · ${x.note}` : ""}</span></span><b>{money(x.amount)}</b></button>)}</div> : <Empty icon={<Repeat />} title="No repeating expenses" text="Rent, EMI, internet, salaries, society maintenance…" />}
      {edit && <Sheet open onClose={() => setEdit(null)} title="Repeating expense" footer={<>{edit !== "new" && <Button tone="danger" onClick={del}>Delete</Button>}<Button onClick={save}>Save</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)"><Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="Day of month (1–28)"><Input type="number" min={1} max={28} value={f.day} onChange={(e) => setF({ ...f, day: e.target.value })} /></Field>
          <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={EXPENSE_CATEGORIES} /></Field>
          <Field label="Listing"><Select value={f.listingId} onChange={(e) => setF({ ...f, listingId: e.target.value })} options={[{ value: "", label: "All listings" }, ...listings.map((l) => ({ value: l.id, label: l.name }))]} /></Field>
          <Field label="Note" className="col-span-2"><Input value={f.note ?? ""} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Flat rent to Mr Sharma" /></Field>
          <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active !== false} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Active</label>
        </div>
      </Sheet>}
    </div>
  );
}

function Owners() {
  const s = useStore();
  const { listings } = useLookups();
  const owners = s.of("owner");
  const [edit, setEdit] = useState<Rec | "new" | null>(null);
  const [f, setF] = useState<Record<string, any>>({}); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [month, setMonth] = useState(addMonths(istDay().slice(0, 7) + "-01", -1).slice(0, 7));
  const open = (x: Rec | "new") => { setEdit(x); setF(x === "new" ? { name: "", commission: 20 } : x); };
  const save = async () => { try { await s.save("owner", f, edit === "new" ? undefined : (edit as Rec).id); setEdit(null); } catch (e) { s.toast((e as Error).message, "bad"); } };
  const statement = (o: Rec) => {
    const mine = listings.filter((l) => l.ownerId === o.id);
    if (!mine.length) return s.toast("Link a listing to this owner first (Listings → edit → Owner)", "bad");
    const parts = mine.map((l) => {
      const st = ownerStatement(s.items, l.id, month, Number(l.commission ?? o.commission) || 0);
      return { l, st, pct: Number(l.commission ?? o.commission) || 0 };
    });
    const due = parts.reduce((t, p) => t + p.st.due, 0);
    printPage(`Owner statement ${month}`, `<h1>Owner statement · ${fmtMonth(month)}</h1><p class="muted">From ${escHtml(s.me.account.business || s.me.email)} to ${escHtml(o.name)}${o.phone ? ` · ${escHtml(o.phone)}` : ""}</p>` +
      parts.map(({ l, st, pct }) => `<h2>${escHtml(l.name)}</h2><table><tr><th>Guest</th><th>Dates</th><th>Nights</th><th class="r">Payout</th></tr>${st.bookings.map((b) => `<tr><td>${escHtml(b.guestName || s.byId.get(b.guestId)?.name || "Guest")}</td><td>${fmtDay(b.start)} → ${fmtDay(b.end)}</td><td>${nights(b)}</td><td class="r">${money(bookingIncome(b))}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">No stays</td></tr>`}</table>
      <table><tr><td>Income this month (nights in month)</td><td class="r">${money(st.income)}</td></tr><tr><td>Management commission (${pct}%)</td><td class="r">−${money(st.commission)}</td></tr>${st.expenseRows.map((x) => `<tr><td>Expense: ${escHtml(x.category)} ${x.note ? "· " + escHtml(x.note) : ""} (${fmtDay(x.date)})</td><td class="r">−${money(x.amount)}</td></tr>`).join("")}<tr class="tot"><td>Due to owner</td><td class="r">${money(st.due)}</td></tr></table>`).join("") +
      (parts.length > 1 ? `<h2>Total due to owner: ${money(due)}</h2>` : ""));
  };
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2"><p className="flex-1 text-sm text-muted">For managing flats owned by others: a monthly statement with your commission and what the owner is owed.</p><Input type="month" className="w-auto" value={month} onChange={(e) => setMonth(e.target.value)} /><Button onClick={() => open("new")}><Plus className="size-4" /> Owner</Button></div>
      {owners.length ? <div className="grid gap-3 md:grid-cols-2">{owners.map((o) => {
        const mine = listings.filter((l) => l.ownerId === o.id);
        return <Card key={o.id}><div className="flex justify-between"><div><b>{o.name}</b><p className="text-xs text-muted">{o.commission}% commission · {mine.map((l) => l.name).join(", ") || "no listings linked"}</p></div><Button size="sm" tone="ghost" onClick={() => open(o)}>Edit</Button></div><Button size="sm" tone="soft" className="mt-3" onClick={() => statement(o)}><FileText className="size-3.5" /> {fmtMonth(month)} statement</Button></Card>;
      })}</div> : <Empty title="No owners yet" text="Add an owner, then pick them on the listing under Listings → edit." />}
      {edit && <Sheet open onClose={() => setEdit(null)} title="Owner" footer={<Button onClick={save}>Save</Button>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" className="col-span-2"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Phone"><Input value={f.phone ?? ""} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Your commission %"><Input type="number" value={f.commission} onChange={(e) => setF({ ...f, commission: e.target.value })} /></Field>
          <Field label="Email" className="col-span-2"><Input value={f.email ?? ""} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Notes" className="col-span-2"><Textarea value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Bank / UPI for payouts" /></Field>
        </div>
      </Sheet>}
    </div>
  );
}

function Gst() {
  const s = useStore();
  const { listings, listingName } = useLookups();
  const [p, setP] = useState<Period>("fy");
  const [custom, setCustom] = useState({ from: addDays(istDay(), -90), to: istDay() });
  const [lid, setLid] = useState("");
  const { from, to } = range(p, custom);
  const rows = useMemo(() => {
    const m = new Map<string, { gross: number; taxes: number; n: number }>();
    for (const b of s.of("booking")) {
      if (b.status === "cancelled" || b.status === "blocked" || b.start < from || b.start > to || (lid && b.listingId !== lid)) continue;
      const k = b.start.slice(0, 7);
      const x = m.get(k) ?? { gross: 0, taxes: 0, n: 0 };
      x.gross += Number(b.gross) || bookingIncome(b); x.taxes += Number(b.taxes) || 0; x.n++;
      m.set(k, x);
    }
    return [...m].sort();
  }, [s, from, to, lid]);
  const tot = rows.reduce((t, [, x]) => ({ gross: t.gross + x.gross, taxes: t.taxes + x.taxes, n: t.n + x.n }), { gross: 0, taxes: 0, n: 0 });
  const ex = () => download(`gst-${from}-${to}.csv`, toCsv([["Month", "Bookings", "Booking value (₹)", "GST / taxes collected (₹)"], ...rows.map(([k, x]) => [k, x.n, Math.round(x.gross), Math.round(x.taxes)]), ["Total", tot.n, Math.round(tot.gross), Math.round(tot.taxes)]]));
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between"><PeriodPicker {...{ p, setP, custom, setCustom, lid, setLid }} /><Button size="sm" tone="soft" onClick={ex}><Download className="size-3.5" /> Excel</Button></div>
      <p className="mb-3 text-xs text-muted">From the &ldquo;GST / taxes&rdquo; you enter on each booking, by check-in month. {listings.filter((l) => l.gstin).map((l) => `${l.name}: GSTIN ${l.gstin}`).join(" · ")}</p>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <table className="w-full text-sm"><thead className="bg-sand text-left text-xs text-muted"><tr><th className="px-4 py-2">Month</th><th className="text-right">Bookings</th><th className="text-right">Value</th><th className="px-4 text-right">GST</th></tr></thead>
          <tbody>{rows.map(([k, x]) => <tr key={k} className="border-t border-line"><td className="px-4 py-2">{fmtMonth(k)}</td><td className="text-right">{x.n}</td><td className="text-right">{money(x.gross)}</td><td className="px-4 text-right">{money(x.taxes)}</td></tr>)}
            <tr className="border-t border-line font-semibold"><td className="px-4 py-2">Total{lid ? ` · ${listingName(lid)}` : ""}</td><td className="text-right">{tot.n}</td><td className="text-right">{money(tot.gross)}</td><td className="px-4 text-right">{money(tot.taxes)}</td></tr></tbody></table>
      </div>
      <p className="mt-3 text-[11px] text-muted">A summary to share with your CA. It isn&apos;t a GST return.</p>
    </div>
  );
}

/** Every rupee in and out, oldest first, with a running balance, like a bank statement. */
function Statement() {
  const s = useStore();
  const { listingName } = useLookups();
  const [p, setP] = useState<Period>("month");
  const [custom, setCustom] = useState({ from: addDays(istDay(), -30), to: istDay() });
  const [lid, setLid] = useState("");
  const [dir, setDir] = useState<"all" | "in" | "out">("all");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Rec | null>(null);
  const { from, to } = range(p, custom);
  const st = buildStatement(s.items, from, to, { listingId: lid, names: listingName });
  const rows = st.rows.filter((r) => (dir === "all" || (dir === "in" ? r.moneyIn > 0 : r.moneyOut > 0)) && (!q || `${r.title} ${r.sub} ${listingName(r.listingId)}`.toLowerCase().includes(q.toLowerCase())));
  const filtered = dir !== "all" || Boolean(q);
  const open = (r: (typeof rows)[number]) => {
    if (r.kind === "booking") go(`booking/${r.id}`);
    else if (r.kind === "expense") setEdit(s.byId.get(r.id) ?? null);
    else if (r.kind === "maint") go("upkeep");
  };
  const where = lid ? listingName(lid) : "All listings";
  const exportCsv = () => {
    if (!s.has("export")) return s.upsell("export");
    download(`statement-${from}-to-${to}.csv`, toCsv([
      ["Date", "Details", "Notes", "Listing", "Money in (₹)", "Money out (₹)", "Balance (₹)"],
      [from, "Opening balance", "", where, "", "", st.opening],
      ...rows.map((r) => [r.date, r.title, r.sub, r.listingId ? listingName(r.listingId) : "All", r.moneyIn || "", r.moneyOut || "", r.balance]),
      [to, "Closing balance", "", where, st.moneyIn, st.moneyOut, st.closing],
    ]));
  };
  const print = () => printPage("Account statement", `<h1>Account statement</h1><p class="muted">${escHtml(s.me.account.business || s.me.email)} · ${escHtml(where)} · ${fmtDay(from, true)} to ${fmtDay(to, true)}</p>
    <table><tr><th>Date</th><th>Details</th><th>Listing</th><th class="r">Money in</th><th class="r">Money out</th><th class="r">Balance</th></tr>
    <tr class="tot"><td>${fmtDay(from, true)}</td><td>Opening balance</td><td></td><td></td><td></td><td class="r">${money(st.opening)}</td></tr>
    ${rows.map((r) => `<tr><td>${fmtDay(r.date, true)}</td><td>${escHtml(r.title)}${r.sub ? `<br><span class="muted">${escHtml(r.sub)}</span>` : ""}</td><td>${escHtml(r.listingId ? listingName(r.listingId) : "All")}</td><td class="r">${r.moneyIn ? money(r.moneyIn) : ""}</td><td class="r">${r.moneyOut ? money(r.moneyOut) : ""}</td><td class="r">${money(r.balance)}</td></tr>`).join("")}
    <tr class="tot"><td>${fmtDay(to, true)}</td><td>Closing balance</td><td></td><td class="r">${money(st.moneyIn)}</td><td class="r">${money(st.moneyOut)}</td><td class="r">${money(st.closing)}</td></tr></table>`);
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <PeriodPicker {...{ p, setP, custom, setCustom, lid, setLid }} />
        <div className="mb-4 flex gap-2"><Button tone="soft" size="sm" onClick={print}><Printer className="size-3.5" /> PDF</Button><Button tone="soft" size="sm" onClick={exportCsv}><Download className="size-3.5" /> Excel</Button></div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Opening balance" value={money(st.opening)} sub={fmtDay(from, true)} />
        <Stat label="Money in" value={money(st.moneyIn)} tone="ok" sub={`${st.rows.filter((r) => r.moneyIn).length} entries`} />
        <Stat label="Money out" value={money(st.moneyOut)} tone="bad" sub={`${st.rows.filter((r) => r.moneyOut).length} entries`} />
        <Stat label="Closing balance" value={money(st.closing)} tone={st.closing >= 0 ? "ok" : "bad"} sub={fmtDay(to, true)} />
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Tabs value={dir} onChange={setDir} tabs={[{ value: "all", label: "All" }, { value: "in", label: "Money in" }, { value: "out", label: "Money out" }]} />
        <div className="relative min-w-48 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><Input className="pl-9" placeholder="Search guest, category, vendor, note" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="flex items-center justify-between bg-sand px-4 py-2 text-xs font-semibold text-muted"><span>{fmtDay(from, true)} · Opening balance</span><span>{money(st.opening)}</span></div>
        {rows.length ? rows.map((r) => (
          <button key={`${r.kind}-${r.id}`} onClick={() => open(r)} className="flex w-full items-center gap-3 border-t border-line px-4 py-3 text-left hover:bg-ink/[.02]">
            <span className={`grid size-8 shrink-0 place-items-center rounded-full ${r.moneyIn ? "bg-leaf/12 text-leaf" : "bg-rust/10 text-rust"}`}>{r.moneyIn ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{r.title}</span>
              <span className="block truncate text-xs text-muted">{fmtDay(r.date, true)}{r.listingId ? ` · ${listingName(r.listingId)}` : " · All listings"}{r.sub && r.sub !== listingName(r.listingId) ? ` · ${r.sub}` : ""}</span>
            </span>
            <span className="text-right">
              <span className={`block text-sm font-semibold ${r.moneyIn ? "text-leaf" : "text-rust"}`}>{r.moneyIn ? `+${money(r.moneyIn)}` : `−${money(r.moneyOut)}`}</span>
              {!filtered && <span className="block text-[11px] text-muted">Bal {money(r.balance)}</span>}
            </span>
          </button>
        )) : <p className="border-t border-line px-4 py-8 text-center text-sm text-muted">Nothing in or out in these dates.</p>}
        <div className="flex items-center justify-between border-t border-line bg-sand px-4 py-2.5 text-sm font-semibold"><span>{fmtDay(to, true)} · Closing balance</span><span className={st.closing < 0 ? "text-rust" : ""}>{money(st.closing)}</span></div>
      </div>
      <p className="mt-2 text-[11px] text-muted">Bookings count on their check-in date, at what you receive (payout). Paid repairs from the maintenance log are included.{lid ? " Shared expenses (not tied to a listing) only show under All listings." : ""}{filtered ? " Balances are hidden while filtered." : ""}</p>
      {edit && <ExpenseEditor expense={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
