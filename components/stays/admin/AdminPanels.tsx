"use client";
/** Admin screens: hosts, enquiries, pricing overview, settings, saved-offline listings, activity log. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { CloudOff, Copy, Loader2, MessageCircle, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { AMENITY_CATEGORIES, ENQUIRY_STATUSES, type Settings } from "@/lib/stays/constants";
import { inr, margins, waLink } from "@/lib/stays/core";
import { api, fmtDate, fmtDay } from "../client/api";
import { Field, Section } from "../client/PropertyForm";
import { useAdmin, Empty, type HostRow } from "./AdminApp";
import { HistoryList, Img, StatusChip } from "./AdminProperties";
import { ContactButtons } from "../ui";
import { clearDevice, clearSynced, discardEdit, listListings, listQueue, queueEdit, removeOffline, saveOffline, storageUsage, syncQueue, getMeta, type OfflineListing, type QueuedEdit } from "./offline";
import type { Status } from "@/lib/stays/constants";

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-plum/40 p-4" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-paper shadow-lift" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-center justify-between border-b border-line p-4"><h2 className="font-display text-2xl">{title}</h2><button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-plum/5" aria-label="Close"><X className="size-5" /></button></div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

// ---------------- hosts ----------------

export function HostsScreen() {
  const { hosts, reloadBoot, toast } = useAdmin();
  const [edit, setEdit] = useState<Partial<HostRow> | null>(null);
  const [q, setQ] = useState("");
  const [invite, setInvite] = useState<{ name: string; link: string; phone: string } | null>(null);
  const list = hosts.filter((h) => !q || [h.name, h.email, h.phone, h.hostCode].join(" ").toLowerCase().includes(q.toLowerCase()));
  async function makeInvite(h: HostRow) {
    try {
      const r = await api<{ link: string }>("admin", "host_invite", { id: h.id });
      setInvite({ name: h.name, link: r.link, phone: h.whatsapp || h.phone });
      await reloadBoot();
    } catch (e) { toast((e as Error).message, false); }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-3xl">Hosts</h1><p className="text-sm text-muted">{hosts.length} host{hosts.length === 1 ? "" : "s"}. Hosts can also sign up themselves at /stays/host.</p></div>
        <button type="button" onClick={() => setEdit({ status: "active" })} className="s-btn s-btn-primary s-btn-sm"><Plus className="size-4" /> Add host</button>
      </div>
      <input className="s-input max-w-sm" placeholder="Search name, phone, email, host ID" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length === 0 ? <div className="s-card rounded-2xl"><Empty>No hosts yet. Add one, then send them an invite link.</Empty></div> : (
        <div className="s-card overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="border-b border-line bg-cream/60 text-left text-xs text-muted"><tr><th className="p-3 font-medium">Host</th><th className="p-3 font-medium">Contact</th><th className="p-3 text-center font-medium">Properties</th><th className="p-3 text-center font-medium">Approved</th><th className="p-3 text-center font-medium">Pending</th><th className="p-3 font-medium">Status</th><th className="p-3 font-medium">Registered</th><th className="p-3" /></tr></thead>
            <tbody className="divide-y divide-line">
              {list.map((h) => (
                <tr key={h.id} className="hover:bg-cream/60">
                  <td className="p-3"><p className="font-medium text-plum">{h.name}</p><p className="text-xs text-muted">{h.hostCode}{h.ownerName ? ` · owner ${h.ownerName}` : ""}</p>{h.notes && <p className="mt-0.5 line-clamp-1 max-w-56 text-xs text-muted" title={h.notes}>📝 {h.notes}</p>}</td>
                  <td className="p-3 text-xs"><p>{h.phone || "—"}{h.whatsapp && h.whatsapp !== h.phone ? ` · WA ${h.whatsapp}` : ""}</p><p className="text-muted">{h.email || "no email"}</p>{(h.whatsapp || h.phone) && <div className="mt-1"><ContactButtons phone={h.whatsapp || h.phone} size="xs" greet={`Hi ${h.name},`} /></div>}</td>
                  <td className="p-3 text-center"><a href={`#properties?host=${h.id}`} className="text-plum underline">{h.total}</a></td>
                  <td className="p-3 text-center">{h.approved}</td>
                  <td className="p-3 text-center">{h.pending ? <span className="font-semibold text-marigold-deep">{h.pending}</span> : 0}</td>
                  <td className="p-3 text-xs"><span className={`s-chip ${h.status === "active" ? "!bg-mint !text-teal" : "!bg-blush !text-coral"}`}>{h.status}</span><p className="mt-1 text-muted">{h.hasLogin ? `Last login ${fmtDay(h.lastLoginAt)}` : h.invited ? "Invite sent" : "No login yet"}</p></td>
                  <td className="p-3 text-xs text-muted">{fmtDay(h.createdAt)}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => makeInvite(h)} className="s-btn s-btn-ghost s-btn-sm" title={h.hasLogin ? "Send a link to reset their password" : "Send an invite link"}>{h.hasLogin ? "Reset link" : "Invite"}</button>
                      <button type="button" onClick={() => setEdit(h)} className="rounded-lg p-2 text-muted hover:bg-plum/5" aria-label={`Edit ${h.name}`}><Pencil className="size-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && <HostForm h={edit} onClose={() => setEdit(null)} onSaved={async () => { setEdit(null); await reloadBoot(); toast("Host saved"); }} />}
      {invite && (
        <Modal title={`Link for ${invite.name}`} onClose={() => setInvite(null)}>
          <p className="text-sm text-muted">Send this link to the host. It lets them set a password and manage their properties. It works once and expires in 14 days.</p>
          <p className="mt-3 break-all rounded-xl bg-white p-3 text-sm ring-1 ring-line">{invite.link}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="s-btn s-btn-ghost s-btn-sm" onClick={() => navigator.clipboard.writeText(invite.link).then(() => toast("Copied"))}><Copy className="size-4" /> Copy</button>
            {invite.phone && <a className="s-btn s-btn-wa s-btn-sm" target="_blank" rel="noopener noreferrer" href={waLink(invite.phone, `Hi ${invite.name}, here is your link to list and manage your property with us:\n${invite.link}`)}><MessageCircle className="size-4" /> Send on WhatsApp</a>}
          </div>
        </Modal>
      )}
    </div>
  );
}

function HostForm({ h, onClose, onSaved }: { h: Partial<HostRow>; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: h.name || "", ownerName: h.ownerName || "", email: h.email || "", phone: h.phone || "", whatsapp: h.whatsapp || "", payout: h.payout || "", notes: h.notes || "", status: h.status || "active" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api("admin", "host_save", { id: h.id, ...f }); onSaved(); } catch (er) { setErr((er as Error).message); } finally { setBusy(false); }
  }
  return (
    <Modal title={h.id ? `Edit ${h.name}` : "Add host"} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Host name *"><input className="s-input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Owner name (if different)"><input className="s-input" value={f.ownerName} onChange={(e) => setF({ ...f, ownerName: e.target.value })} /></Field>
          <Field label="Phone"><input className="s-input" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="WhatsApp"><input className="s-input" type="tel" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} /></Field>
          <Field label="Email" className="sm:col-span-2" hint="Needed for the host to sign in."><input className="s-input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        </div>
        <Field label="Payout details"><textarea className="s-input" rows={2} value={f.payout} onChange={(e) => setF({ ...f, payout: e.target.value })} placeholder="UPI / bank account" /></Field>
        <Field label="Private notes"><textarea className="s-input" rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        <Field label="Status" hint="Paused or left hosts can't sign in. Their properties and photos stay.">
          <select className="s-input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="active">Active</option><option value="suspended">Paused</option><option value="left">Left the platform</option></select>
        </Field>
        {err && <p className="rounded-xl bg-blush px-3 py-2 text-sm text-coral">{err}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="s-btn s-btn-ghost">Cancel</button><button className="s-btn s-btn-primary" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />}Save</button></div>
      </form>
    </Modal>
  );
}

// ---------------- enquiries ----------------

type Enq = { _id: string; kind: "click" | "manual"; type: string; propertyId: string | null; code: string | null; title: string; checkIn: string; checkOut: string; adults: number | null; children: number | null; guests: number | null; guestName?: string; guestPhone?: string; channel?: string; source: string; shareId: string | null; status: string; notes: string; createdAt: number };
const TYPE_LABEL: Record<string, string> = { simple: "Simple enquiry", dates: "Dates & guests", location: "Exact location", general: "General" };

export function EnquiriesScreen() {
  const { toast } = useAdmin();
  const [list, setList] = useState<Enq[] | null>(null);
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Partial<Enq> | null>(null);
  const load = useCallback(() => api<Enq[]>("admin", "enquiries").then(setList).catch((e) => toast(e.message, false)), [toast]);
  useEffect(() => { load(); }, [load]);
  const shown = (list || []).filter((e) => (!kind || e.kind === kind) && (!status || e.status === status) && (!q || [e.code, e.title, e.guestName, e.guestPhone, e.notes].join(" ").toLowerCase().includes(q.toLowerCase())));
  const clicks = (list || []).filter((e) => e.kind === "click").length;
  async function upd(id: string, patch: Record<string, unknown>) {
    try { await api("admin", "enquiry_update", { id, ...patch }); load(); } catch (e) { toast((e as Error).message, false); }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-3xl">Enquiries</h1><p className="text-sm text-muted">{clicks} WhatsApp button click{clicks === 1 ? "" : "s"} · {(list?.length || 0) - clicks} recorded enquir{(list?.length || 0) - clicks === 1 ? "y" : "ies"}</p></div>
        <button type="button" onClick={() => setEdit({ status: "new", type: "general" })} className="s-btn s-btn-primary s-btn-sm"><Plus className="size-4" /> Record an enquiry</button>
      </div>
      <p className="rounded-2xl bg-lavender p-3 text-sm text-plum"><strong>About button clicks:</strong> WhatsApp doesn&apos;t tell this website who messaged you or what they wrote. A &quot;button click&quot; only means someone pressed an enquiry button and WhatsApp opened (they may not have sent the message). Use <em>Record an enquiry</em> for real conversations, with the guest&apos;s name and number.</p>
      <div className="flex flex-wrap gap-2">
        <input className="s-input !w-auto" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="s-input !w-auto" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Clicks and recorded</option><option value="click">Button clicks only</option><option value="manual">Recorded only</option></select>
        <select className="s-input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any status</option>{ENQUIRY_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      {!list ? <div className="s-skeleton h-60" /> : shown.length === 0 ? <div className="s-card rounded-2xl"><Empty>No enquiries yet.</Empty></div> : (
        <div className="s-card overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[60rem] text-sm">
            <thead className="border-b border-line bg-cream/60 text-left text-xs text-muted"><tr><th className="p-3 font-medium">When</th><th className="p-3 font-medium">Kind</th><th className="p-3 font-medium">Property</th><th className="p-3 font-medium">Dates / guests</th><th className="p-3 font-medium">Guest</th><th className="p-3 font-medium">Source</th><th className="p-3 font-medium">Status</th><th className="p-3 font-medium">Notes</th><th className="p-3" /></tr></thead>
            <tbody className="divide-y divide-line">
              {shown.map((e) => (
                <tr key={e._id} className="align-top hover:bg-cream/60">
                  <td className="whitespace-nowrap p-3 text-xs text-muted">{fmtDate(e.createdAt)}</td>
                  <td className="p-3 text-xs"><span className={`s-chip ${e.kind === "click" ? "" : "!bg-mint !text-teal"}`}>{e.kind === "click" ? "Button click" : "Recorded"}</span><p className="mt-1 text-muted">{TYPE_LABEL[e.type] || e.type}</p></td>
                  <td className="p-3 text-xs">{e.propertyId ? <a href={`#p/${e.propertyId}`} className="text-plum underline">{e.code}</a> : "—"}<p className="max-w-40 truncate text-muted">{e.title}</p></td>
                  <td className="p-3 text-xs">{e.checkIn ? `${e.checkIn} → ${e.checkOut || "?"}` : "—"}{e.guests ? <p className="text-muted">{e.adults ?? "?"} adults, {e.children ?? 0} children ({e.guests})</p> : null}</td>
                  <td className="p-3 text-xs">{e.guestName || "—"}{e.guestPhone && <p><a className="text-teal underline" href={waLink(e.guestPhone, "")?.replace(/\?text=$/, "")} target="_blank" rel="noopener noreferrer">{e.guestPhone}</a></p>}</td>
                  <td className="max-w-40 truncate p-3 text-xs text-muted" title={e.source}>{e.shareId ? "Share link" : e.channel || e.source || "—"}</td>
                  <td className="p-3"><select className="s-input !min-h-0 !w-auto !py-1 text-xs" value={e.status} onChange={(ev) => upd(e._id, { status: ev.target.value })} aria-label="Status">{ENQUIRY_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></td>
                  <td className="p-3"><textarea defaultValue={e.notes} rows={1} className="s-input !min-h-0 min-w-40 !py-1 text-xs" onBlur={(ev) => { if (ev.target.value !== e.notes) upd(e._id, { notes: ev.target.value }); }} aria-label="Notes" /></td>
                  <td className="p-3 text-right">
                    <div className="flex gap-1">
                      {e.kind === "manual" && <button type="button" onClick={() => setEdit(e)} className="rounded-lg p-1.5 text-muted hover:bg-plum/5" aria-label="Edit"><Pencil className="size-4" /></button>}
                      <button type="button" onClick={async () => { if (confirm("Delete this enquiry?")) { await api("admin", "enquiry_delete", { id: e._id }); load(); } }} className="rounded-lg p-1.5 text-muted hover:bg-blush hover:text-coral" aria-label="Delete"><Trash2 className="size-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && <EnquiryForm e={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); toast("Enquiry saved"); }} />}
    </div>
  );
}

function EnquiryForm({ e, onClose, onSaved }: { e: Partial<Enq>; onClose: () => void; onSaved: () => void }) {
  const [props, setProps] = useState<{ id: string; code: string; title: string }[]>([]);
  const [f, setF] = useState({ propertyId: e.propertyId || "", guestName: e.guestName || "", guestPhone: e.guestPhone || "", channel: e.channel || "WhatsApp", checkIn: e.checkIn || "", checkOut: e.checkOut || "", adults: e.adults ?? "", children: e.children ?? "", type: e.type || "general", status: e.status || "new", notes: e.notes || "" });
  const [err, setErr] = useState("");
  useEffect(() => { api<{ id: string; code: string; title: string }[]>("admin", "properties").then(setProps).catch(() => {}); }, []);
  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    try { await api("admin", "enquiry_save", { id: e._id, ...f }); onSaved(); } catch (er) { setErr((er as Error).message); }
  }
  return (
    <Modal title={e._id ? "Edit enquiry" : "Record an enquiry"} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Property"><select className="s-input" value={f.propertyId} onChange={(x) => setF({ ...f, propertyId: x.target.value })}><option value="">General (no specific property)</option>{props.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.title}</option>)}</select></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Guest name"><input className="s-input" value={f.guestName} onChange={(x) => setF({ ...f, guestName: x.target.value })} /></Field>
          <Field label="Guest phone"><input className="s-input" type="tel" value={f.guestPhone} onChange={(x) => setF({ ...f, guestPhone: x.target.value })} /></Field>
          <Field label="Check-in"><input className="s-input" type="date" value={f.checkIn} onChange={(x) => setF({ ...f, checkIn: x.target.value })} /></Field>
          <Field label="Check-out"><input className="s-input" type="date" value={f.checkOut} onChange={(x) => setF({ ...f, checkOut: x.target.value })} /></Field>
          <Field label="Adults"><input className="s-input" type="number" min={0} value={f.adults} onChange={(x) => setF({ ...f, adults: x.target.value })} /></Field>
          <Field label="Children"><input className="s-input" type="number" min={0} value={f.children} onChange={(x) => setF({ ...f, children: x.target.value })} /></Field>
          <Field label="Came through"><select className="s-input" value={f.channel} onChange={(x) => setF({ ...f, channel: x.target.value })}>{["WhatsApp", "Phone call", "Instagram", "Referral", "Walk-in", "Other"].map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Status"><select className="s-input" value={f.status} onChange={(x) => setF({ ...f, status: x.target.value })}>{ENQUIRY_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        </div>
        <Field label="Notes"><textarea className="s-input" rows={3} value={f.notes} onChange={(x) => setF({ ...f, notes: x.target.value })} /></Field>
        {err && <p className="rounded-xl bg-blush px-3 py-2 text-sm text-coral">{err}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="s-btn s-btn-ghost">Cancel</button><button className="s-btn s-btn-primary">Save</button></div>
      </form>
    </Modal>
  );
}

// ---------------- pricing ----------------

type PRow = { id: string; code: string; title: string; status: Status; ownership: string; host: { name: string } | null; city: string; pricing: { landing: { weekday: number | null; weekend: number | null }; listing: { weekday: number | null; weekend: number | null } }; margins: ReturnType<typeof margins> };

export function PricingScreen() {
  const { toast } = useAdmin();
  const [rows, setRows] = useState<PRow[] | null>(null);
  const [only, setOnly] = useState<"" | "missing" | "negative" | "published">("");
  const [sort, setSort] = useState("margin");
  useEffect(() => { api<PRow[]>("admin", "pricing").then(setRows).catch((e) => toast(e.message, false)); }, [toast]);
  const list = useMemo(() => {
    const r = (rows || []).filter((x) => (only === "missing" ? x.margins.missing : only === "negative" ? x.margins.negative : only === "published" ? x.status === "published" : true));
    const by: Record<string, (a: PRow, b: PRow) => number> = {
      margin: (a, b) => (b.margins.perWeek ?? -1e9) - (a.margins.perWeek ?? -1e9),
      pct: (a, b) => (b.margins.weekdayPct ?? -1e9) - (a.margins.weekdayPct ?? -1e9),
      listing: (a, b) => (b.pricing.listing.weekday ?? 0) - (a.pricing.listing.weekday ?? 0),
      code: (a, b) => a.code.localeCompare(b.code),
    };
    return [...r].sort(by[sort]);
  }, [rows, only, sort]);
  const complete = list.filter((x) => !x.margins.missing);
  const avg = (k: "weekday" | "weekend") => (complete.length ? Math.round(complete.reduce((s, x) => s + (x.margins[k] || 0), 0) / complete.length) : null);
  const week = complete.reduce((s, x) => s + (x.margins.perWeek || 0), 0);
  return (
    <div className="space-y-4">
      <div><h1 className="font-display text-3xl">Pricing and margins</h1><p className="text-sm text-muted">Admin only. Margin = listing price (guest) − landing price (host payout).</p></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Average weekday margin", inr(avg("weekday")) || "—"], ["Average weekend margin", inr(avg("weekend")) || "—"], ["Potential margin / week", inr(week) || "—", "if every listed property is booked 5 weekday + 2 weekend nights"], ["Missing prices", String((rows || []).filter((x) => x.margins.missing).length)]].map(([l, v, h]) => (
          <div key={l} className="s-card rounded-2xl p-4" title={h}><p className="text-xs text-muted">{l}</p><p className="mt-1 font-display text-2xl text-plum">{v}</p></div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <select className="s-input !w-auto" value={only} onChange={(e) => setOnly(e.target.value as typeof only)}><option value="">All properties</option><option value="published">Published only</option><option value="missing">Missing prices</option><option value="negative">Losing money</option></select>
        <select className="s-input !w-auto" value={sort} onChange={(e) => setSort(e.target.value)}><option value="margin">Highest weekly margin</option><option value="pct">Highest margin %</option><option value="listing">Highest guest price</option><option value="code">Property ID</option></select>
      </div>
      {!rows ? <div className="s-skeleton h-60" /> : (
        <div className="s-card overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[56rem] text-sm tabular-nums">
            <thead className="border-b border-line bg-cream/60 text-right text-xs text-muted"><tr><th className="p-3 text-left font-medium">Property</th><th className="p-3 font-medium">Landing wkday</th><th className="p-3 font-medium">Landing wkend</th><th className="p-3 font-medium">Listing wkday</th><th className="p-3 font-medium">Listing wkend</th><th className="p-3 font-medium">Margin wkday</th><th className="p-3 font-medium">Margin wkend</th><th className="p-3 font-medium">Margin %</th><th className="p-3 font-medium">Per week</th></tr></thead>
            <tbody className="divide-y divide-line">
              {list.map((r) => (
                <tr key={r.id} className={`text-right hover:bg-cream/60 ${r.margins.negative ? "bg-blush/50" : ""}`}>
                  <td className="p-3 text-left"><a href={`#p/${r.id}`} className="font-medium text-plum hover:underline">{r.code}</a> <StatusChip s={r.status} /><p className="max-w-56 truncate text-xs text-muted">{r.title} · {r.host?.name || "Own"}</p></td>
                  <td className="p-3">{inr(r.pricing.landing.weekday) || <Miss />}</td><td className="p-3">{inr(r.pricing.landing.weekend) || <Miss />}</td>
                  <td className="p-3">{inr(r.pricing.listing.weekday) || <Miss />}</td><td className="p-3">{inr(r.pricing.listing.weekend) || <Miss />}</td>
                  <td className={`p-3 font-semibold ${r.margins.weekday !== null && r.margins.weekday < 0 ? "text-coral" : "text-teal"}`}>{r.margins.weekday !== null ? inr(r.margins.weekday) : "—"}</td>
                  <td className={`p-3 font-semibold ${r.margins.weekend !== null && r.margins.weekend < 0 ? "text-coral" : "text-teal"}`}>{r.margins.weekend !== null ? inr(r.margins.weekend) : "—"}</td>
                  <td className="p-3 text-xs">{r.margins.weekdayPct !== null ? `${r.margins.weekdayPct}% / ${r.margins.weekendPct ?? "—"}%` : "—"}</td>
                  <td className="p-3">{r.margins.perWeek !== null ? inr(r.margins.perWeek) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
const Miss = () => <span className="text-xs font-semibold text-coral">missing</span>;

// ---------------- settings ----------------

export function SettingsScreen() {
  const { settings, amenities, reloadBoot, toast } = useAdmin();
  const [s, setS] = useState<Settings>(settings);
  const [busy, setBusy] = useState(false);
  const [am, setAm] = useState({ label: "", category: "Facilities" });
  const set = (p: Partial<Settings>) => setS({ ...s, ...p });
  const lines = (a: string[]) => a.join("\n");
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const r = await api<{ settings: Settings; error?: string }>("admin", "settings_save", s);
      if (r.error) toast(r.error, false); else { await reloadBoot(); toast("Settings saved"); }
    } catch (er) { toast((er as Error).message, false); } finally { setBusy(false); }
  }
  async function addAmenity() {
    if (!am.label.trim()) return;
    try { await api("admin", "amenity_add", am); setAm({ ...am, label: "" }); await reloadBoot(); toast("Amenity added"); } catch (e) { toast((e as Error).message, false); }
  }
  async function delAmenity(key: string) {
    try { await api("admin", "amenity_delete", { key }); await reloadBoot(); toast("Amenity removed"); } catch (e) { toast((e as Error).message, false); }
  }
  const tpl = (k: keyof Settings["templates"], label: string) => (
    <Field label={label}><textarea className="s-input font-mono text-xs" rows={7} value={s.templates[k]} onChange={(e) => set({ templates: { ...s.templates, [k]: e.target.value } })} /></Field>
  );
  return (
    <form onSubmit={save} className="space-y-4 pb-24">
      <h1 className="font-display text-3xl">Settings</h1>
      <Section title="Website and contact" open>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Website name"><input className="s-input" value={s.siteName} onChange={(e) => set({ siteName: e.target.value })} /></Field>
          <Field label="Logo URL (https)" hint="Upload the logo in the main admin (Content → Images) and paste its link."><input className="s-input" value={s.logoUrl} onChange={(e) => set({ logoUrl: e.target.value })} /></Field>
          <Field label="Tagline" className="sm:col-span-2"><input className="s-input" value={s.tagline} onChange={(e) => set({ tagline: e.target.value })} /></Field>
          <Field label="WhatsApp number for all enquiries *" hint="10-digit Indian mobile, or with country code. Guests never see hosts' numbers."><input className="s-input" value={s.whatsappNumber} onChange={(e) => set({ whatsappNumber: e.target.value })} /></Field>
          <Field label="Contact number shown on the site"><input className="s-input" value={s.contactNumber} onChange={(e) => set({ contactNumber: e.target.value })} /></Field>
          <Field label="Email for new-submission alerts" hint="Needs BREVO_API_KEY to actually send."><input className="s-input" type="email" value={s.adminEmail} onChange={(e) => set({ adminEmail: e.target.value })} /></Field>
          <Field label="Currency"><input className="s-input" value="INR (₹)" disabled /></Field>
        </div>
      </Section>
      <Section title="WhatsApp message templates">
        <p className="mb-3 text-sm text-muted">Placeholders: {"{title} {id} {location} {checkin} {checkout} {adults} {children} {guests}"}</p>
        <div className="grid gap-4 lg:grid-cols-2">
          {tpl("simple", "Simple enquiry (Enquire on WhatsApp)")}{tpl("dates", "Enquiry with dates and guests (Check Availability)")}{tpl("location", "Ask for exact location")}{tpl("general", "Default message (general WhatsApp button)")}
        </div>
      </Section>
      <Section title="Defaults for new properties">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Default visibility"><select className="s-input" value={s.defaultVisibility} onChange={(e) => set({ defaultVisibility: e.target.value as Settings["defaultVisibility"] })}><option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option></select></Field>
          <Field label="Default price visibility"><select className="s-input" value={s.defaultShowPrice ? "1" : "0"} onChange={(e) => set({ defaultShowPrice: e.target.value === "1" })}><option value="1">Show guest price</option><option value="0">Hide price</option></select></Field>
          <Field label="ID prefix: my own properties" hint="New IDs only; existing IDs never change."><input className="s-input uppercase" maxLength={5} value={s.ownPrefix} onChange={(e) => set({ ownPrefix: e.target.value })} /></Field>
          <Field label="ID prefix: hosts' properties"><input className="s-input uppercase" maxLength={5} value={s.hostPrefix} onChange={(e) => set({ hostPrefix: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm text-plum"><input type="checkbox" className="size-4 accent-plum" checked={s.showSocietyPublicly} onChange={(e) => set({ showSocietyPublicly: e.target.checked })} />Show society names to guests by default</label>
        </div>
      </Section>
      <Section title="Lists: property types, categories, standout features">
        <div className="grid gap-4 lg:grid-cols-3">
          <Field label="Property types (one per line)"><textarea className="s-input" rows={10} value={lines(s.propertyTypes)} onChange={(e) => set({ propertyTypes: e.target.value.split("\n") })} /></Field>
          <Field label="Listing categories"><textarea className="s-input" rows={10} value={lines(s.categories)} onChange={(e) => set({ categories: e.target.value.split("\n") })} /></Field>
          <Field label="Standout features"><textarea className="s-input" rows={10} value={lines(s.features)} onChange={(e) => set({ features: e.target.value.split("\n") })} /></Field>
        </div>
      </Section>
      <Section title={`Amenities (${amenities.length})`}>
        <div className="flex flex-wrap gap-2">
          {amenities.map((a) => (
            <span key={a.key} className="s-chip">{a.label} <span className="text-[10px] text-muted">{a.category}</span>{a.custom && <button type="button" onClick={() => delAmenity(a.key)} aria-label={`Remove ${a.label}`} className="text-muted hover:text-coral"><X className="size-3" /></button>}</span>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <input className="s-input !w-auto flex-1" placeholder="New amenity, e.g. Jacuzzi" value={am.label} onChange={(e) => setAm({ ...am, label: e.target.value })} />
          <select className="s-input !w-auto" value={am.category} onChange={(e) => setAm({ ...am, category: e.target.value })}>{AMENITY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          <button type="button" onClick={addAmenity} className="s-btn s-btn-ghost">Add amenity</button>
        </div>
      </Section>
      <Section title="Map">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tile URL" className="sm:col-span-2" hint="Default: free OpenStreetMap tiles. Must contain {z}, {x} and {y}."><input className="s-input" value={s.map.tileUrl} onChange={(e) => set({ map: { ...s.map, tileUrl: e.target.value } })} /></Field>
          <Field label="Attribution" className="sm:col-span-2"><input className="s-input" value={s.map.attribution} onChange={(e) => set({ map: { ...s.map, attribution: e.target.value } })} /></Field>
          <Field label="Default centre latitude"><input className="s-input" value={s.map.defaultLat} onChange={(e) => set({ map: { ...s.map, defaultLat: Number(e.target.value) } })} /></Field>
          <Field label="Default centre longitude"><input className="s-input" value={s.map.defaultLng} onChange={(e) => set({ map: { ...s.map, defaultLng: Number(e.target.value) } })} /></Field>
        </div>
      </Section>
      <Section title="Search engines (SEO)">
        <div className="grid gap-4">
          <Field label="Home page title"><input className="s-input" value={s.seo.title} onChange={(e) => set({ seo: { ...s.seo, title: e.target.value } })} /></Field>
          <Field label="Home page description"><textarea className="s-input" rows={2} value={s.seo.description} onChange={(e) => set({ seo: { ...s.seo, description: e.target.value } })} /></Field>
          <Field label="Default share image URL (https)"><input className="s-input" value={s.seo.ogImage} onChange={(e) => set({ seo: { ...s.seo, ogImage: e.target.value } })} /></Field>
        </div>
      </Section>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 backdrop-blur lg:left-60">
        <div className="mx-auto flex max-w-7xl justify-end px-4 py-3 sm:px-6"><button className="s-btn s-btn-primary" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />}Save settings</button></div>
      </div>
    </form>
  );
}

// ---------------- offline ----------------

export function OfflineScreen({ standalone = false }: { standalone?: boolean }) {
  const [items, setItems] = useState<OfflineListing[] | null>(null);
  const [queue, setQueue] = useState<QueuedEdit[]>([]);
  const [last, setLast] = useState<number | null>(null);
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);
  const [busy, setBusy] = useState("");
  const [edit, setEdit] = useState<OfflineListing | null>(null);
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const refresh = useCallback(async () => {
    try {
      setItems((await listListings()).sort((a, b) => a.code.localeCompare(b.code)));
      setQueue((await listQueue()).sort((a, b) => b.at - a.at));
      setLast(((await getMeta("lastSync")) as number) || null);
      setUsage(await storageUsage());
    } catch { setItems([]); setMsg("This browser doesn't allow offline storage (private mode?)."); }
  }, []);
  // Loading from IndexedDB on mount: the state updates happen after the awaits.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh(); }, [refresh]);
  async function sync(force?: string[]) {
    setBusy("sync"); setMsg("");
    const r = await syncQueue({ force });
    setMsg(navigator.onLine ? `Sent ${r.sent}. ${r.failed ? `${r.failed} failed. ` : ""}${r.conflicts ? `${r.conflicts} need your decision.` : ""}` : "You're offline. Changes will be sent when you're back online.");
    setBusy(""); refresh();
  }
  async function refreshAll() {
    if (!items?.length) return;
    setBusy("refresh");
    try { await saveOffline(items.map((i) => i.id)); setMsg("Listings refreshed"); } catch (e) { setMsg((e as Error).message); }
    setBusy(""); refresh();
  }
  const pending = queue.filter((x) => x.status !== "synced");
  const shown = (items || []).filter((l) => !q || [l.code, l.title, l.place].join(" ").toLowerCase().includes(q.toLowerCase()));
  const mb = (n: number) => `${(n / 1048576).toFixed(1)} MB`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl"><CloudOff className="size-6" /> Saved offline</h1>
          <p className="text-sm text-muted">On this device only · last download {fmtDate(last)} · {usage ? `${mb(usage.used)} used of ${mb(usage.quota)}` : "storage size unknown"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={refreshAll} disabled={!!busy || !navigator.onLine} className="s-btn s-btn-ghost s-btn-sm"><RefreshCw className={`size-4 ${busy === "refresh" ? "animate-spin" : ""}`} /> Refresh all</button>
          <button type="button" onClick={() => sync()} disabled={!!busy} className="s-btn s-btn-primary s-btn-sm">{busy === "sync" && <Loader2 className="size-4 animate-spin" />}Sync now ({pending.length})</button>
        </div>
      </div>
      <p className="rounded-2xl bg-lavender p-3 text-sm text-plum">Save listings from a property page (&quot;Save offline&quot;) or several at once from Properties (select → Save offline). Only guest-facing details are kept on the phone: no addresses, host details, landing prices or notes.{standalone ? " You're offline, so only this screen is available." : ""}</p>
      {msg && <p className="rounded-xl bg-white px-3 py-2 text-sm text-plum ring-1 ring-line" role="status">{msg}</p>}

      {queue.length > 0 && (
        <section className="s-card rounded-2xl p-4">
          <div className="flex items-center justify-between"><h2 className="font-sans text-base font-semibold text-plum">Offline changes</h2>{queue.some((x) => x.status === "synced") && <button type="button" className="text-xs text-plum underline" onClick={() => clearSynced().then(refresh)}>Clear synchronised</button>}</div>
          <ul className="mt-2 divide-y divide-line text-sm">
            {queue.map((x) => (
              <li key={x.id} className="py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`s-chip ${x.status === "synced" ? "!bg-mint !text-teal" : x.status === "pending" ? "!bg-sand !text-marigold-deep" : "!bg-blush !text-coral"}`}>{x.status === "pending" ? (navigator.onLine ? "Pending sync" : "Saved locally") : x.status === "synced" ? "Synchronised" : x.status === "conflict" ? "Conflict" : "Sync failed"}</span>
                  <span className="font-medium text-plum">{x.code}</span><span className="text-xs text-muted">{Object.keys(x.fields).join(", ")} · {fmtDate(x.at)}</span>
                </div>
                {x.error && <p className="mt-1 text-xs text-coral">{x.error}</p>}
                {x.status === "conflict" && (
                  <div className="mt-2 rounded-xl bg-blush/60 p-2 text-xs">
                    {x.conflicts?.map((c) => <p key={c.field}><strong>{c.field}</strong>: server now has “{String(c.server ?? "—")}”, yours is “{String(c.mine ?? "—")}”</p>)}
                    <div className="mt-2 flex gap-2"><button type="button" className="s-btn s-btn-primary s-btn-sm" onClick={() => sync([x.id])}>Keep mine</button><button type="button" className="s-btn s-btn-ghost s-btn-sm !bg-white" onClick={() => discardEdit(x.id).then(refresh)}>Keep server&apos;s</button></div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!items ? <div className="s-skeleton h-40" /> : items.length === 0 ? <div className="s-card rounded-2xl"><Empty>Nothing saved on this device yet.</Empty></div> : (
        <>
          <input className="s-input max-w-sm" placeholder="Search saved listings" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((l) => (
              <li key={l.id} className="s-card overflow-hidden rounded-2xl">
                <div className="aspect-[16/9] bg-sand">{l.cover && <Img src={l.cover} />}</div>
                <div className="space-y-1 p-3">
                  <p className="text-xs text-muted">{l.code} · {l.propertyType} · saved {fmtDay(l.savedAt)}</p>
                  <p className="font-semibold text-plum">{l.title}</p>
                  <p className="text-sm text-muted">{l.place}</p>
                  <p className="text-sm">{inr(l.price.weekday) || "—"} weekday · {inr(l.price.weekend) || "—"} weekend</p>
                  <p className="text-xs text-muted">{[l.rooms.bedrooms && `${l.rooms.bedrooms} bedrooms`, l.rooms.bathrooms && `${l.rooms.bathrooms} baths`, l.rooms.maxGuests && `${l.rooms.maxGuests} guests`].filter(Boolean).join(" · ")}</p>
                  {l.features.length > 0 && <p className="text-xs text-teal">{l.features.join(" · ")}</p>}
                  <details className="text-xs"><summary className="cursor-pointer text-plum">Details & amenities</summary><p className="mt-1 whitespace-pre-line">{l.description}</p><p className="mt-1 text-muted">{l.amenities.join(", ")}</p></details>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button type="button" onClick={() => setEdit(l)} className="s-btn s-btn-ghost s-btn-sm"><Pencil className="size-4" /> Edit</button>
                    <button type="button" onClick={() => navigator.clipboard?.writeText(`${location.origin}/stay/${l.slug}`)} className="s-btn s-btn-ghost s-btn-sm"><Copy className="size-4" /> Link</button>
                    <button type="button" onClick={() => removeOffline(l.id).then(refresh)} className="rounded-lg p-2 text-muted hover:bg-blush hover:text-coral" aria-label="Remove from device"><Trash2 className="size-4" /></button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <button type="button" className="text-sm text-coral underline" onClick={async () => { if (confirm("Remove all offline listings and queued changes from this device?")) { await clearDevice(); refresh(); } }}>Remove everything from this device</button>
      {edit && <OfflineEdit l={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); refresh(); if (navigator.onLine) sync(); }} />}
    </div>
  );
}

function OfflineEdit({ l, onClose, onSaved }: { l: OfflineListing; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ title: l.title, shortDescription: l.shortDescription, description: l.description, availability: l.availability, listingWeekday: l.price.weekday ?? "", listingWeekend: l.price.weekend ?? "" });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const changes: Record<string, unknown> = {};
    if (f.title !== l.title) changes.title = f.title;
    if (f.shortDescription !== l.shortDescription) changes.shortDescription = f.shortDescription;
    if (f.description !== l.description) changes.description = f.description;
    if (f.availability !== l.availability) changes.availability = f.availability;
    const n = (v: unknown) => (v === "" ? null : Number(v));
    if (n(f.listingWeekday) !== l.price.weekday) changes.listingWeekday = n(f.listingWeekday);
    if (n(f.listingWeekend) !== l.price.weekend) changes.listingWeekend = n(f.listingWeekend);
    if (Object.keys(changes).length) await queueEdit(l, changes);
    onSaved();
  }
  return (
    <Modal title={`Edit ${l.code}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <p className="text-xs text-muted">Saved on this device first, then sent when you&apos;re online. If someone changed the same field meanwhile, you&apos;ll be asked which to keep.</p>
        <Field label="Title"><input className="s-input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Short description"><input className="s-input" value={f.shortDescription} onChange={(e) => setF({ ...f, shortDescription: e.target.value })} /></Field>
        <Field label="Description"><textarea className="s-input" rows={5} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Guest price weekday ₹"><input className="s-input" inputMode="numeric" value={f.listingWeekday} onChange={(e) => setF({ ...f, listingWeekday: e.target.value.replace(/\D/g, "") })} /></Field>
          <Field label="Guest price weekend ₹"><input className="s-input" inputMode="numeric" value={f.listingWeekend} onChange={(e) => setF({ ...f, listingWeekend: e.target.value.replace(/\D/g, "") })} /></Field>
        </div>
        <Field label="Availability"><select className="s-input" value={f.availability} onChange={(e) => setF({ ...f, availability: e.target.value })}><option value="available">Available</option><option value="limited">Limited dates</option><option value="unavailable">Not available</option></select></Field>
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="s-btn s-btn-ghost">Cancel</button><button className="s-btn s-btn-primary">Save</button></div>
      </form>
    </Modal>
  );
}

// ---------------- activity ----------------

export function ActivityScreen() {
  const { toast } = useAdmin();
  type Item = Parameters<typeof HistoryList>[0]["items"][number] & { code?: string | null; propertyId?: string | null };
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => { api<Item[]>("admin", "audit").then(setItems).catch((e) => toast(e.message, false)); }, [toast]);
  return (
    <div className="space-y-4">
      <div><h1 className="font-display text-3xl">Activity</h1><p className="text-sm text-muted">Every sensitive change: prices, addresses, hosts, publication and approvals (latest 300).</p></div>
      <div className="s-card rounded-2xl p-4">
        {!items ? <div className="s-skeleton h-40" /> : (
          <ul className="space-y-4">
            {items.map((h) => (
              <li key={h._id}>
                {h.propertyId && <a href={`#p/${h.propertyId}`} className="text-xs font-semibold text-plum underline">{h.code}</a>}
                <HistoryList items={[h]} />
              </li>
            ))}
            {!items.length && <Empty>No activity yet.</Empty>}
          </ul>
        )}
      </div>
    </div>
  );
}
