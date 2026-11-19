"use client";
/** Admin: property list (table / grid / map, filters, bulk actions) and the property editor. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowLeft, Archive, CheckCircle2, CloudDownload, Copy, ExternalLink, Eye, LayoutGrid, Link2, Loader2, Map as MapIcon,
  MessageCircle, Plus, Search, ShieldCheck, Table2, Trash2,
} from "lucide-react";
import { STATUSES, STATUS_LABEL, type Status } from "@/lib/stays/constants";
import { inr, margins } from "@/lib/stays/core";
import MapView from "../MapView";
import { api, ApiError, fmtDate, fmtDay } from "../client/api";
import { MediaManager, type MediaRow } from "../client/MediaManager";
import { PropertyForm, Section, toForm, toPayload, type FormVal } from "../client/PropertyForm";
import { go, useAdmin, useHash } from "./AdminApp";
import { listListings, removeOffline, saveOffline } from "./offline";
import { ContactButtons } from "../ui";

type Pair = { weekday: number | null; weekend: number | null };
type Row = {
  id: string; code: string; slug: string; title: string; ownership: "own" | "host"; host: { id: string; name: string; phone: string; whatsapp?: string } | null;
  status: Status; statusLabel: string; visibility: string; availability: string; featured: boolean; showPrice: boolean;
  city: string; locality: string; society: string; lat: number | null; lng: number | null; propertyType: string;
  bedrooms: number | null; bathrooms: number | null; beds: number | null; maxGuests: number | null; amenities: string[]; features: string[];
  pricing: { landing: Pair; listing: Pair }; margins: ReturnType<typeof margins>; cover: string | null; mediaCount: number; pendingMedia: number;
  hostChanges: boolean; publishRequested: boolean; archived: boolean; createdAt: number; updatedAt: number; lastVerifiedAt: number | null;
};

/** Thumbnail from Cloudinary (already resized there, so a plain <img> is right). */
export function Img({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="size-full object-cover" loading="lazy" />;
}

export const STATUS_TONE: Record<Status, string> = {
  draft: "bg-lavender text-plum", submitted: "bg-sand text-marigold-deep", under_review: "bg-sand text-marigold-deep", approved: "bg-mint text-teal",
  rejected: "bg-blush text-coral", changes_requested: "bg-blush text-coral", published: "bg-teal text-white", inactive: "bg-charcoal/10 text-charcoal",
};
export const StatusChip = ({ s }: { s: Status }) => <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[s]}`}>{STATUS_LABEL[s]}</span>;
const VIS: Record<string, string> = { public: "Public", unlisted: "Unlisted", private: "Private" };

function readQuery(hash: string) {
  return Object.fromEntries(new URLSearchParams(hash.split("?")[1] || ""));
}
const lsGet = (k: string, fb: string) => { try { return localStorage.getItem(k) || fb; } catch { return fb; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

export function PropertiesScreen() {
  const { hosts, settings, amenities, toast } = useAdmin();
  const hash = useHash();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [f, setF] = useState<Record<string, string>>(() => readQuery(hash));
  const [view, setView] = useState<"table" | "grid" | "map">(() => lsGet("stays-view", "table") as "table");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);
  // Follow the address bar when it changes (React's "adjust state on prop change" pattern).
  const [seenHash, setSeenHash] = useState(hash);
  if (hash !== seenHash) { setSeenHash(hash); setF(readQuery(hash)); }
  const archived = f.archived === "1";
  const load = useCallback(() => api<Row[]>("admin", "properties", undefined, archived ? "&archived=1" : "").then(setRows).catch((e) => toast(e.message, false)), [archived, toast]);
  useEffect(() => { load(); }, [load]);

  const setFilter = (k: string, v: string) => {
    const next = { ...f, [k]: v };
    if (!v) delete next[k];
    const q = new URLSearchParams(next).toString();
    history.replaceState(null, "", `#properties${q ? `?${q}` : ""}`);
    setF(next);
  };
  const cities = useMemo(() => [...new Set((rows || []).map((r) => r.city).filter(Boolean))].sort(), [rows]);
  const list = useMemo(() => {
    if (!rows) return [];
    const q = (f.q || "").toLowerCase().trim();
    let out = rows.filter((r) => {
      if (q && ![r.code, r.title, r.city, r.locality, r.society, r.host?.name, r.host?.phone].join(" ").toLowerCase().includes(q)) return false;
      if (f.status === "pending" ? !["submitted", "under_review"].includes(r.status) : f.status && r.status !== f.status) return false;
      if (f.visibility && r.visibility !== f.visibility) return false;
      if (f.ownership && r.ownership !== f.ownership) return false;
      if (f.host && r.host?.id !== f.host) return false;
      if (f.city && r.city !== f.city) return false;
      if (f.type && r.propertyType !== f.type) return false;
      if (f.guests && (r.maxGuests ?? 0) < Number(f.guests)) return false;
      if (f.bedrooms && (r.bedrooms ?? 0) < Number(f.bedrooms)) return false;
      if (f.amenity && !r.amenities.includes(f.amenity)) return false;
      if (f.review === "1" && !(r.hostChanges || r.pendingMedia || r.publishRequested)) return false;
      if (f.missing === "1" && !r.margins.missing) return false;
      if (f.featured === "1" && !r.featured) return false;
      if (f.maxPrice && !((r.pricing.listing.weekday ?? Infinity) <= Number(f.maxPrice))) return false;
      return true;
    });
    const s = f.sort || "updated";
    const by: Record<string, (a: Row, b: Row) => number> = {
      updated: (a, b) => b.updatedAt - a.updatedAt, created: (a, b) => b.createdAt - a.createdAt, code: (a, b) => a.code.localeCompare(b.code), title: (a, b) => a.title.localeCompare(b.title),
      price: (a, b) => (a.pricing.listing.weekday ?? 1e9) - (b.pricing.listing.weekday ?? 1e9), margin: (a, b) => (b.margins.weekday ?? -1e9) - (a.margins.weekday ?? -1e9),
      guests: (a, b) => (b.maxGuests ?? 0) - (a.maxGuests ?? 0), bedrooms: (a, b) => (b.bedrooms ?? 0) - (a.bedrooms ?? 0),
    };
    out = [...out].sort(by[s] || by.updated);
    return out;
  }, [rows, f]);

  const allSel = list.length > 0 && list.every((r) => sel.has(r.id));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function runBulk() {
    if (!bulk || !sel.size) return;
    setBusy(true);
    try {
      if (bulk === "offline") {
        const n = await saveOffline([...sel]);
        toast(`Saved ${n} listing${n === 1 ? "" : "s"} for offline use`);
      } else {
        const r = await api<{ done: string[]; failed: { error: string }[] }>("admin", "bulk", { ids: [...sel], op: bulk });
        toast(`${r.done.length} updated${r.failed.length ? `, ${r.failed.length} skipped: ${r.failed.slice(0, 2).map((x) => x.error).join("; ")}` : ""}`, !r.failed.length);
        await load();
      }
      setSel(new Set()); setBulk("");
    } catch (e) { toast((e as Error).message, false); } finally { setBusy(false); }
  }

  const sel_ = (k: string, label: string, opts: [string, string][]) => (
    <select className="s-input !min-h-0 !w-auto !py-1.5 text-sm" value={f[k] || ""} onChange={(e) => setFilter(k, e.target.value)} aria-label={label}>
      <option value="">{label}</option>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-3xl">{archived ? "Archived properties" : "Properties"}</h1><p className="text-sm text-muted">{rows ? `${list.length} of ${rows.length}` : "Loading…"}</p></div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-line bg-white p-0.5">
            {([["table", Table2], ["grid", LayoutGrid], ["map", MapIcon]] as const).map(([v, I]) => (
              <button key={v} type="button" onClick={() => { setView(v); lsSet("stays-view", v); }} className={`rounded-full px-3 py-1.5 ${view === v ? "bg-plum text-white" : "text-plum"}`} aria-pressed={view === v} aria-label={`${v} view`}><I className="size-4" /></button>
            ))}
          </div>
          <a href="#new" className="s-btn s-btn-primary s-btn-sm"><Plus className="size-4" /> Add</a>
        </div>
      </div>

      <div className="s-card flex flex-wrap items-center gap-2 rounded-2xl p-3">
        <div className="relative min-w-48 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><input className="s-input !min-h-0 !py-1.5 pl-9 text-sm" placeholder="Search ID, title, area, host, phone…" value={f.q || ""} onChange={(e) => setFilter("q", e.target.value)} /></div>
        {sel_("status", "Any status", [["pending", "Pending approval"], ...STATUSES.map((s) => [s, STATUS_LABEL[s]] as [string, string])])}
        {sel_("visibility", "Any visibility", [["public", "Public"], ["unlisted", "Unlisted"], ["private", "Private"]])}
        {sel_("ownership", "All owners", [["own", "My own"], ["host", "Hosts'"]])}
        {sel_("host", "Any host", hosts.map((h) => [h.id, h.name]))}
        {sel_("city", "Any city", cities.map((c) => [c, c]))}
        {sel_("type", "Any type", settings.propertyTypes.map((t) => [t, t]))}
        {sel_("guests", "Guests", [2, 4, 6, 8, 10, 15].map((n) => [String(n), `${n}+ guests`]))}
        {sel_("bedrooms", "Bedrooms", [1, 2, 3, 4, 5].map((n) => [String(n), `${n}+ bedrooms`]))}
        {sel_("amenity", "Amenity", amenities.map((a) => [a.key, a.label]))}
        {sel_("sort", "Recently updated", [["created", "Recently added"], ["code", "Property ID"], ["title", "Title"], ["price", "Lowest guest price"], ["margin", "Highest margin"], ["guests", "Most guests"], ["bedrooms", "Most bedrooms"]])}
        <label className="flex items-center gap-1.5 text-sm text-plum"><input type="checkbox" className="accent-plum" checked={f.review === "1"} onChange={(e) => setFilter("review", e.target.checked ? "1" : "")} />Needs review</label>
        <label className="flex items-center gap-1.5 text-sm text-plum"><input type="checkbox" className="accent-plum" checked={f.missing === "1"} onChange={(e) => setFilter("missing", e.target.checked ? "1" : "")} />Missing prices</label>
        <label className="flex items-center gap-1.5 text-sm text-plum"><input type="checkbox" className="accent-plum" checked={f.featured === "1"} onChange={(e) => setFilter("featured", e.target.checked ? "1" : "")} />Featured</label>
        <label className="flex items-center gap-1.5 text-sm text-plum"><input type="checkbox" className="accent-plum" checked={archived} onChange={(e) => setFilter("archived", e.target.checked ? "1" : "")} />Archived</label>
        {Object.keys(f).length > 0 && <button type="button" className="text-sm text-plum underline" onClick={() => { history.replaceState(null, "", "#properties"); setF({}); }}>Clear</button>}
      </div>

      {sel.size > 0 && (
        <div className="sticky top-14 z-30 flex flex-wrap items-center gap-2 rounded-2xl bg-plum p-2.5 text-white lg:top-2">
          <span className="px-2 text-sm">{sel.size} selected</span>
          <select className="s-input !min-h-0 !w-auto !py-1.5 text-sm text-charcoal" value={bulk} onChange={(e) => setBulk(e.target.value)} aria-label="Bulk action">
            <option value="">Choose action…</option>
            <option value="publish">Publish</option><option value="unpublish">Unpublish</option><option value="approve">Approve</option><option value="deactivate">Deactivate</option><option value="reactivate">Reactivate</option>
            <option value="visibility:public">Make public</option><option value="visibility:unlisted">Make unlisted</option><option value="visibility:private">Make private</option>
            <option value="availability:available">Mark available</option><option value="availability:unavailable">Mark not available</option>
            <option value="show_price">Show prices</option><option value="hide_price">Hide prices</option>
            <option value="feature">Feature</option><option value="unfeature">Unfeature</option>
            <option value={archived ? "unarchive" : "archive"}>{archived ? "Restore from archive" : "Archive"}</option>
            <option value="offline">Save offline on this device</option>
          </select>
          <button type="button" onClick={runBulk} disabled={!bulk || busy} className="s-btn s-btn-accent s-btn-sm">{busy && <Loader2 className="size-4 animate-spin" />}Apply</button>
          <button type="button" onClick={() => setSel(new Set())} className="ml-auto px-2 text-sm underline">Clear selection</button>
        </div>
      )}

      {!rows ? <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <div key={i} className="s-skeleton h-14" />)}</div>
        : rows.length === 0 ? (
          <div className="s-card rounded-3xl p-10 text-center">
            <p className="font-display text-2xl text-plum">{archived ? "Nothing archived" : "No properties yet"}</p>
            {!archived && <><p className="mt-2 text-sm text-muted">Add your own properties here, or invite hosts to submit theirs.</p><a href="#new" className="s-btn s-btn-primary mt-5"><Plus className="size-4" /> Add property</a></>}
          </div>
        ) : list.length === 0 ? <p className="s-card rounded-2xl p-8 text-center text-sm text-muted">No properties match these filters.</p>
        : view === "map" ? <AdminMap rows={list} />
        : view === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.map((r) => (
              <div key={r.id} className={`s-card relative overflow-hidden rounded-2xl ${sel.has(r.id) ? "ring-2 ring-plum" : ""}`}>
                <input type="checkbox" className="absolute left-3 top-3 z-10 size-5 accent-plum" checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.code}`} />
                <a href={`#p/${r.id}`} className="block">
                  <div className="aspect-[4/3] bg-sand">{r.cover && <Img src={r.cover} />}</div>
                  <div className="space-y-1 p-3">
                    <div className="flex items-center gap-2"><StatusChip s={r.status} /><span className="text-xs text-muted">{r.code} · {VIS[r.visibility]}</span></div>
                    <p className="truncate font-semibold text-plum">{r.title || "Untitled"}</p>
                    <p className="truncate text-xs text-muted">{[r.locality, r.city].filter(Boolean).join(", ")} · {r.host?.name || "Own"}</p>
                    <p className="text-xs"><span className="text-muted">Guest </span>{inr(r.pricing.listing.weekday) || "—"} <span className="text-muted">· Margin </span><span className={r.margins.negative ? "text-coral" : "text-teal"}>{r.margins.weekday !== null ? inr(r.margins.weekday) : "—"}</span></p>
                  </div>
                </a>
              </div>
            ))}
          </div>
        ) : (
          <div className="s-card overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[60rem] text-sm">
              <thead className="border-b border-line bg-cream/60 text-left text-xs text-muted">
                <tr>
                  <th className="w-10 p-3"><input type="checkbox" className="accent-plum" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(list.map((r) => r.id)))} aria-label="Select all" /></th>
                  <th className="p-3 font-medium">Property</th><th className="p-3 font-medium">Status</th><th className="p-3 font-medium">Location</th><th className="p-3 font-medium">Host</th>
                  <th className="p-3 text-right font-medium">Landing</th><th className="p-3 text-right font-medium">Listing</th><th className="p-3 text-right font-medium">Margin</th><th className="p-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((r) => (
                  <tr key={r.id} className={`hover:bg-cream/60 ${sel.has(r.id) ? "bg-lavender/50" : ""}`}>
                    <td className="p-3"><input type="checkbox" className="accent-plum" checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.code}`} /></td>
                    <td className="p-3">
                      <a href={`#p/${r.id}`} className="flex items-center gap-3">
                        <span className="size-11 shrink-0 overflow-hidden rounded-lg bg-sand">{r.cover && <Img src={r.cover} />}</span>
                        <span className="min-w-0"><span className="block truncate font-medium text-plum hover:underline">{r.title || "Untitled"}</span><span className="text-xs text-muted">{r.code} · {r.propertyType || "—"} · {r.maxGuests ?? "—"} guests{r.featured ? " · ★" : ""}</span></span>
                      </a>
                    </td>
                    <td className="p-3"><StatusChip s={r.status} /><div className="mt-1 text-xs text-muted">{VIS[r.visibility]}{!r.showPrice ? " · price hidden" : ""}{(r.hostChanges || r.pendingMedia || r.publishRequested) ? <span className="ml-1 font-semibold text-marigold-deep">· review</span> : null}</div></td>
                    <td className="p-3 text-xs"><span className="text-plum">{r.locality || "—"}</span><br /><span className="text-muted">{r.city}</span></td>
                    <td className="p-3 text-xs">{r.host ? <><span className="text-plum">{r.host.name}</span><br /><span className="text-muted">{r.host.phone}</span>{r.host.phone && <div className="mt-1"><ContactButtons phone={r.host.whatsapp || r.host.phone} size="xs" greet={`Hi ${r.host.name}, about ${r.title} (${r.code}):`} /></div>}</> : <span className="text-muted">Own</span>}</td>
                    <td className="p-3 text-right text-xs tabular-nums">{inr(r.pricing.landing.weekday) || "—"}<br /><span className="text-muted">{inr(r.pricing.landing.weekend) || "—"}</span></td>
                    <td className="p-3 text-right text-xs tabular-nums">{inr(r.pricing.listing.weekday) || "—"}<br /><span className="text-muted">{inr(r.pricing.listing.weekend) || "—"}</span></td>
                    <td className={`p-3 text-right text-xs tabular-nums ${r.margins.negative ? "text-coral" : "text-teal"}`}>{r.margins.weekday !== null ? inr(r.margins.weekday) : "—"}<br />{r.margins.weekend !== null ? inr(r.margins.weekend) : "—"}</td>
                    <td className="p-3 text-xs text-muted">{fmtDay(r.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}

function AdminMap({ rows }: { rows: Row[] }) {
  const { settings } = useAdmin();
  const pts = rows.filter((r) => r.lat !== null && r.lng !== null).map((r) => ({
    key: r.id, lat: r.lat!, lng: r.lng!, title: `${r.code} · ${r.title}`,
    tone: (r.status === "published" ? "default" : r.status === "inactive" || r.archived ? "muted" : "warn") as "default" | "muted" | "warn",
    sub: [`${r.statusLabel} · ${VIS[r.visibility]}`, r.host ? `Host: ${r.host.name} ${r.host.phone}` : "Own property", `Landing ${inr(r.pricing.landing.weekday) || "—"} / ${inr(r.pricing.landing.weekend) || "—"} · Listing ${inr(r.pricing.listing.weekday) || "—"} / ${inr(r.pricing.listing.weekend) || "—"}`].join("\n"),
    href: `#p/${r.id}`, image: r.cover,
  }));
  const missing = rows.length - pts.length;
  return (
    <div>
      <MapView cfg={settings.map} mode="admin" points={pts} className="h-[calc(100dvh-16rem)] min-h-[420px]" />
      <p className="mt-2 text-xs text-muted">Exact locations (admin only). Purple: published · Coral: not live yet · Grey: inactive.{missing ? ` ${missing} propert${missing === 1 ? "y has" : "ies have"} no pin yet.` : ""}</p>
    </div>
  );
}

// ---------------- editor ----------------

type Full = Row & {
  hostId: string | null; shortDescription: string; description: string; category: string; location: FormVal["location"] & { showSociety: boolean }; rooms: Record<string, unknown>;
  policies: Record<string, unknown>; airbnbUrl: string; adminNotes: string; ownerName: string; hostNotes: string;
  contactName: string; contactPhone: string; slugText: string; roomList: { id: string; name: string; description: string; amenities: string[] }[];
  hostFull?: never; media: (MediaRow & { publicId: string })[]; coverId: string | null;
  hostChanges: { data: Record<string, unknown>; at: number } | null; review: { reason: string; action: string; at: number } | null;
  approvedAt: number | null; publishedAt: number | null; submittedAt: number | null;
  shares: { _id: string; showPrice: boolean; label: string; createdAt: number; createdBy: string; revoked: boolean; views: number; lastViewedAt?: number }[];
  history: { _id: string; at: number; action: string; actor: { name: string; role: string }; changes: { field: string; from: unknown; to: unknown }[]; reason?: string }[];
};

const ACTIONS: { action: string; label: string; from: Status[]; tone: string; reason?: boolean }[] = [
  { action: "review", label: "Start review", from: ["submitted"], tone: "s-btn-ghost" },
  { action: "approve", label: "Approve", from: ["draft", "submitted", "under_review", "changes_requested", "rejected"], tone: "s-btn-ghost" },
  { action: "publish", label: "Publish", from: ["draft", "submitted", "under_review", "approved", "inactive", "changes_requested"], tone: "s-btn-primary" },
  { action: "request_changes", label: "Request changes", from: ["submitted", "under_review", "approved", "rejected"], tone: "s-btn-ghost", reason: true },
  { action: "reject", label: "Reject", from: ["submitted", "under_review", "approved", "changes_requested"], tone: "s-btn-danger", reason: true },
  { action: "unpublish", label: "Unpublish", from: ["published"], tone: "s-btn-ghost" },
  { action: "deactivate", label: "Deactivate", from: ["draft", "submitted", "under_review", "approved", "rejected", "changes_requested", "published"], tone: "s-btn-ghost" },
  { action: "reactivate", label: "Reactivate", from: ["inactive"], tone: "s-btn-ghost" },
];

export function PropertyEditor({ id }: { id: string | null }) {
  const { settings, amenities, hosts, toast, online } = useAdmin();
  const [p, setP] = useState<Full | null>(null);
  const [form, setForm] = useState<FormVal | null>(id ? null : toForm({ visibility: settings.defaultVisibility, showPrice: settings.defaultShowPrice, location: { showSociety: settings.showSocietyPublicly } }));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [offline, setOffline] = useState(false);
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const loaded = useRef(false);

  const accept = useCallback((x: Full) => { setP(x); setForm(toForm(x)); setDirty(false); }, []);
  useEffect(() => {
    if (!id || loaded.current) return;
    loaded.current = true;
    api<Full>("admin", "property", undefined, `&id=${id}`).then(accept).catch((e) => setErr(e.message));
    listListings().then((l) => setOffline(l.some((x) => x.id === id))).catch(() => {});
  }, [id, accept]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (err) return <p className="rounded-2xl bg-blush p-4 text-coral">{err} <a href="#properties" className="underline">Back to properties</a></p>;
  if (!form) return <div className="space-y-3"><div className="s-skeleton h-10 w-1/2" /><div className="s-skeleton h-96" /></div>;

  async function save(force = false) {
    if (!form!.title.trim()) { toast("Give the property a title first", false); return null; }
    if (form!.ownership === "host" && !form!.hostId) { toast("Choose the host", false); return null; }
    setBusy("save");
    try {
      const body = { ...toPayload(form!, "admin"), ...(p ? { id: p.id, updatedAt: p.updatedAt, force } : {}) };
      const r = await api<Full>("admin", p ? "property_save" : "property_create", body);
      accept(r);
      if (!p) history.replaceState(null, "", `#p/${r.id}`);
      if (offline) saveOffline([r.id]).catch(() => {});
      toast(p ? "Saved" : `Created ${r.code}`);
      return r;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && confirm(`${e.message}\n\nOK = overwrite with my version, Cancel = keep editing.`)) { setBusy(""); return save(true); }
      toast((e as Error).message, false);
      return null;
    } finally { setBusy(""); }
  }
  async function act(action: string, reason = "") {
    let cur = p;
    if (dirty) cur = await save();
    if (!cur) return;
    setBusy(action);
    try { accept(await api<Full>("admin", "property_action", { id: cur.id, action, reason })); toast(`${ACTIONS.find((a) => a.action === action)?.label || action}: done`); }
    catch (e) { toast((e as Error).message, false); } finally { setBusy(""); }
  }
  async function simple(a: string, body: Record<string, unknown> = {}, ok = "Done") {
    if (!p) return;
    setBusy(a);
    try { const r = await api<Full>("admin", a, { id: p.id, ...body }); if (r && (r as Full).id) accept(r); toast(ok); return r; }
    catch (e) { toast((e as Error).message, false); } finally { setBusy(""); }
  }
  async function toggleOffline() {
    if (!p) return;
    try {
      if (offline) { await removeOffline(p.id); setOffline(false); toast("Removed from this device"); }
      else { await saveOffline([p.id]); setOffline(true); toast("Saved for offline use on this device"); }
    } catch (e) { toast((e as Error).message, false); }
  }

  const status = p?.status || "draft";
  const live = ["approved", "published", "inactive"].includes(status);

  return (
    <div className="pb-28">
      <a href="#properties" className="inline-flex items-center gap-1 text-sm text-muted hover:text-plum"><ArrowLeft className="size-4" /> Properties</a>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-3xl">{p ? p.title || "Untitled" : "Add property"}</h1>
        {p && <><StatusChip s={status} /><span className="text-sm font-medium text-muted">{p.code}</span><span className="s-chip">{VIS[p.visibility]}</span>{p.archived && <span className="s-chip !bg-charcoal !text-white">Archived</span>}</>}
      </div>
      {p && <p className="mt-1 text-xs text-muted">Created {fmtDay(p.createdAt)} · Updated {fmtDate(p.updatedAt)}{p.approvedAt ? ` · Approved ${fmtDay(p.approvedAt)}` : ""}{p.publishedAt ? ` · Published ${fmtDay(p.publishedAt)}` : ""} · Last verified {p.lastVerifiedAt ? fmtDay(p.lastVerifiedAt) : "never"}</p>}

      {p && (
        <div className="mt-4 flex flex-wrap gap-2">
          {ACTIONS.filter((a) => a.from.includes(status)).map((a) => (
            <button key={a.action} type="button" disabled={!!busy || !online} onClick={() => (a.reason ? setReasonFor(a.action) : act(a.action))} className={`s-btn s-btn-sm ${a.tone}`}>{busy === a.action && <Loader2 className="size-4 animate-spin" />}{a.label}</button>
          ))}
          {status === "published" && p.visibility === "public" && <a href={`/stay/${p.slug}`} target="_blank" className="s-btn s-btn-ghost s-btn-sm"><ExternalLink className="size-4" /> Public page</a>}
          <button type="button" onClick={() => simple("property_verify", {}, "Marked as verified today")} className="s-btn s-btn-ghost s-btn-sm" title="Record that you checked the details are still correct"><ShieldCheck className="size-4" /> Verified today</button>
          <button type="button" onClick={toggleOffline} className="s-btn s-btn-ghost s-btn-sm"><CloudDownload className="size-4" /> {offline ? "Saved offline ✓" : "Save offline"}</button>
          <a href={`/api/stays/admin?a=browse&to=${encodeURIComponent(`/stay/${p.slug}`)}`} target="_blank" rel="noopener" className="s-btn s-btn-ghost s-btn-sm" title="Open the guest page with host details and contacts (only you)"><Eye className="size-4" /> View as admin</a>
        </div>
      )}

      {p?.review && ["rejected", "changes_requested"].includes(status) && <p className="mt-3 rounded-2xl bg-blush p-3 text-sm text-coral">Note sent to host: {p.review.reason}</p>}
      {p?.publishRequested && <p className="mt-3 rounded-2xl bg-sand p-3 text-sm text-marigold-deep">The host asked for this listing to be published.</p>}
      {p && (p.host || p.contactPhone) && <ContactsCard p={p} />}
      {p?.hostChanges && <HostChanges p={p} onDone={accept} />}
      {p && p.media.some((m) => m.pending || m.removalRequested) && <p className="mt-3 rounded-2xl bg-sand p-3 text-sm text-marigold-deep">The host added photos or asked for removals: see Photos and videos below.</p>}

      {p && <SharePanel p={p} onChange={accept} />}

      <div className="mt-5" onChangeCapture={() => setDirty(true)}>
        <PropertyForm role="admin" value={form} onChange={(v) => { setForm(v); setDirty(true); }} amenities={amenities} opts={settings} hosts={hosts} code={p?.code} />
      </div>

      <div className="mt-4 space-y-4">
        <Section title={`Photos and videos (${p?.media.length || 0})`} open>
          {p ? <MediaManager<Full> base="admin" propertyId={p.id} media={p.media} coverId={p.coverId} live={live} onChange={accept} rooms={p.roomList} /> : <p className="text-sm text-muted">Save the property first, then add photos and videos.</p>}
        </Section>
        {p && (
          <Section title={`History (${p.history.length})`}>
            <HistoryList items={p.history} />
          </Section>
        )}
        {p && (
          <Section title="More actions">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="s-btn s-btn-ghost s-btn-sm" onClick={async () => { const r = await simple("property_duplicate", {}, "Duplicated (photos are not copied)"); if (r) { loaded.current = false; go(`p/${(r as Full).id}`); } }}><Copy className="size-4" /> Duplicate</button>
              <button type="button" className="s-btn s-btn-ghost s-btn-sm" onClick={() => simple("property_archive", { archived: !p.archived }, p.archived ? "Restored" : "Archived")}><Archive className="size-4" /> {p.archived ? "Restore from archive" : "Archive"}</button>
              <button type="button" className="s-btn s-btn-danger s-btn-sm" onClick={async () => {
                const c = prompt(`This permanently deletes ${p.code}, its photos and videos. Its ID will never be reused.\n\nType ${p.code} to confirm:`);
                if (c === null) return;
                try { await api("admin", "property_delete", { id: p.id, confirm: c.trim() }); setDirty(false); toast(`${p.code} deleted`); go("properties"); } catch (e) { toast((e as Error).message, false); }
              }}><Trash2 className="size-4" /> Delete permanently</button>
            </div>
            <p className="s-hint mt-2">Archiving hides the property everywhere but keeps all its data and media. Prefer it over deleting.</p>
          </Section>
        )}
      </div>

      {reasonFor && <ReasonDialog title={reasonFor === "reject" ? "Reject this property" : "Request changes"} onCancel={() => setReasonFor(null)} onOk={(r) => { const a = reasonFor; setReasonFor(null); act(a, r); }} />}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 backdrop-blur lg:left-60" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <span className="min-w-0 flex-1 text-sm text-muted">{dirty ? "Unsaved changes" : p ? <span className="inline-flex items-center gap-1 text-teal"><CheckCircle2 className="size-4" /> All changes saved</span> : ""}</span>
          <button type="button" onClick={() => save()} disabled={!!busy || !online} className="s-btn s-btn-primary">{busy === "save" && <Loader2 className="size-4 animate-spin" />}{p ? "Save" : "Create property"}</button>
        </div>
      </div>
    </div>
  );
}

function ReasonDialog({ title, onOk, onCancel }: { title: string; onOk: (r: string) => void; onCancel: () => void }) {
  const [r, setR] = useState("");
  const d = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (d.current && !d.current.open) d.current.showModal(); }, []);
  return (
    <dialog ref={d} onCancel={onCancel} className="m-auto w-[min(92vw,30rem)] rounded-3xl bg-paper p-0 shadow-lift backdrop:bg-plum/40">
      <form onSubmit={(e) => { e.preventDefault(); if (r.trim()) onOk(r.trim()); }} className="space-y-3 p-5">
        <h2 className="font-display text-2xl">{title}</h2>
        <label className="block"><span className="s-label">Message for the host (they will see this)</span><textarea className="s-input" rows={4} required autoFocus value={r} onChange={(e) => setR(e.target.value)} placeholder="e.g. Please add photos of both bathrooms and the kitchen." /></label>
        <div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className="s-btn s-btn-ghost">Cancel</button><button className="s-btn s-btn-primary">Send</button></div>
      </form>
    </dialog>
  );
}

/** Field-by-field view of a host's edits to a live listing, with apply / discard. */
function HostChanges({ p, onDone }: { p: Full; onDone: (x: Full) => void }) {
  const { toast } = useAdmin();
  const flat = (o: unknown, pre = ""): Record<string, unknown> => {
    if (o && typeof o === "object" && !Array.isArray(o)) return Object.entries(o as Record<string, unknown>).reduce((acc, [k, v]) => ({ ...acc, ...flat(v, pre ? `${pre}.${k}` : k) }), {});
    return { [pre]: o };
  };
  const cur = flat({ title: p.title, shortDescription: p.shortDescription, description: p.description, propertyType: p.propertyType, category: p.category, location: p.location, rooms: p.rooms, amenities: p.amenities, features: p.features, policies: p.policies, landing: p.pricing.landing, airbnbUrl: p.airbnbUrl, hostNotes: p.hostNotes });
  const next = flat(p.hostChanges!.data);
  const diffs = Object.keys(next).filter((k) => JSON.stringify(next[k] ?? null) !== JSON.stringify(cur[k] ?? null) && !(next[k] === "" && cur[k] === undefined));
  const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : Array.isArray(v) ? v.join(", ") : String(v));
  async function decide(decision: "apply" | "discard") {
    const reason = decision === "discard" ? prompt("Optional note for the host about why the changes weren't applied:") ?? "" : "";
    try { onDone(await api<Full>("admin", "host_changes", { id: p.id, decision, reason })); toast(decision === "apply" ? "Host changes applied" : "Host changes discarded"); } catch (e) { toast((e as Error).message, false); }
  }
  return (
    <div className="mt-4 rounded-2xl border-2 border-marigold bg-paper p-4">
      <p className="flex items-center gap-2 font-semibold text-plum"><AlertTriangle className="size-4 text-marigold" /> The host edited this live listing ({fmtDate(p.hostChanges!.at)})</p>
      {diffs.length === 0 ? <p className="mt-2 text-sm text-muted">No visible differences.</p> : (
        <div className="mt-3 max-h-72 overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted"><tr><th className="py-1 pr-3 font-medium">Field</th><th className="py-1 pr-3 font-medium">Now</th><th className="py-1 font-medium">Host wants</th></tr></thead>
            <tbody className="divide-y divide-line">{diffs.map((k) => <tr key={k}><td className="py-1.5 pr-3 text-xs text-muted">{k}</td><td className="py-1.5 pr-3 text-coral line-through decoration-coral/40">{show(cur[k])}</td><td className="py-1.5 text-teal">{show(next[k])}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      <div className="mt-3 flex gap-2"><button type="button" onClick={() => decide("apply")} className="s-btn s-btn-primary s-btn-sm">Apply changes</button><button type="button" onClick={() => decide("discard")} className="s-btn s-btn-ghost s-btn-sm">Discard</button></div>
    </div>
  );
}

function SharePanel({ p, onChange }: { p: Full; onChange: (x: Full) => void }) {
  const { toast } = useAdmin();
  const [made, setMade] = useState<{ url: string; showPrice: boolean } | null>(null);
  const site = typeof window !== "undefined" ? location.origin : "";
  const live = p.status === "published";
  const canShare = live && p.visibility !== "private";
  async function create(showPrice: boolean) {
    try {
      const r = await api<{ url: string; showPrice: boolean }>("admin", "share_create", { id: p.id, showPrice });
      setMade(r);
      try { await navigator.clipboard.writeText(r.url); toast("Link created and copied"); } catch { toast("Link created"); }
      onChange(await api<Full>("admin", "property", undefined, `&id=${p.id}`));
    } catch (e) { toast((e as Error).message, false); }
  }
  async function revoke(shareId: string) {
    if (!confirm("Turn off this link? Anyone who has it won't be able to open the page any more.")) return;
    try { await api("admin", "share_revoke", { id: p.id, shareId }); onChange(await api<Full>("admin", "property", undefined, `&id=${p.id}`)); toast("Link turned off"); } catch (e) { toast((e as Error).message, false); }
  }
  const copy = async (u: string) => { try { await navigator.clipboard.writeText(u); toast("Copied"); } catch { prompt("Copy this link:", u); } };
  const wa = (u: string) => `https://wa.me/?text=${encodeURIComponent(`${p.title}\n${u}`)}`;
  const publicUrl = `${site}/stay/${p.slug}`;
  const active = p.shares.filter((s) => !s.revoked);
  return (
    <div className="s-card mt-4 rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-sans text-base font-semibold text-plum"><Link2 className="size-4" /> Share with a guest</h2>
        {canShare && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => create(true)} className="s-btn s-btn-primary s-btn-sm">Share with price</button>
            <button type="button" onClick={() => create(false)} className="s-btn s-btn-ghost s-btn-sm">Share without price</button>
          </div>
        )}
      </div>
      {!live ? <p className="mt-2 text-sm text-muted">Publish the property to share it. (Private properties can&apos;t be shared.)</p>
        : p.visibility === "private" ? <p className="mt-2 text-sm text-muted">This property is private. Make it public or unlisted to share it.</p>
        : (
          <>
            {made && (
              <div className="mt-3 rounded-xl bg-mint p-3">
                <p className="text-xs font-semibold text-teal">New link ({made.showPrice ? "with price" : "price hidden"})</p>
                <p className="mt-1 break-all text-sm text-plum">{made.url}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => copy(made.url)} className="s-btn s-btn-ghost s-btn-sm !bg-white"><Copy className="size-4" /> Copy</button>
                  <a href={made.url} target="_blank" className="s-btn s-btn-ghost s-btn-sm !bg-white"><Eye className="size-4" /> Preview</a>
                  <a href={wa(made.url)} target="_blank" rel="noopener noreferrer" className="s-btn s-btn-wa s-btn-sm"><MessageCircle className="size-4" /> WhatsApp</a>
                </div>
              </div>
            )}
            {p.visibility === "public" && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted">Public page ({p.showPrice ? "price shown" : "price hidden"}):</span>
                <button type="button" onClick={() => copy(publicUrl)} className="text-plum underline">Copy link</button>
                <a href={publicUrl} target="_blank" className="text-plum underline">Open</a>
                <a href={wa(publicUrl)} target="_blank" rel="noopener noreferrer" className="text-plum underline">WhatsApp</a>
              </div>
            )}
            {active.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-plum">{active.length} active share link{active.length === 1 ? "" : "s"}</summary>
                <ul className="mt-2 divide-y divide-line text-sm">
                  {active.map((s) => {
                    const u = `${site}/stay/s/${s._id}`;
                    return (
                      <li key={s._id} className="flex flex-wrap items-center gap-2 py-2">
                        <span className={`s-chip ${s.showPrice ? "" : "!bg-sand !text-marigold-deep"}`}>{s.showPrice ? "With price" : "No price"}</span>
                        <span className="text-xs text-muted">{fmtDay(s.createdAt)} · {s.views} view{s.views === 1 ? "" : "s"}</span>
                        <span className="ml-auto flex gap-3">
                          <button type="button" onClick={() => copy(u)} className="text-plum underline">Copy</button>
                          <a href={u} target="_blank" className="text-plum underline">Open</a>
                          <a href={wa(u)} target="_blank" rel="noopener noreferrer" className="text-plum underline">WhatsApp</a>
                          <button type="button" onClick={() => revoke(s._id)} className="text-coral underline">Turn off</button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}
          </>
        )}
    </div>
  );
}

export function HistoryList({ items }: { items: Full["history"] }) {
  if (!items.length) return <p className="text-sm text-muted">No history yet.</p>;
  const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
  return (
    <ul className="space-y-3">
      {items.map((h) => (
        <li key={h._id} className="text-sm">
          <p><span className="font-medium text-plum">{h.action.replace(/_/g, " ")}</span> <span className="text-muted">by {h.actor.name} ({h.actor.role}) · {fmtDate(h.at)}</span></p>
          {h.reason && <p className="text-xs text-muted">“{h.reason}”</p>}
          {h.changes.length > 0 && <ul className="mt-1 space-y-0.5 text-xs">{h.changes.map((c, i) => <li key={i}><span className="text-muted">{c.field}:</span> {show(c.from)} → <strong>{show(c.to)}</strong></li>)}</ul>}
        </li>
      ))}
    </ul>
  );
}

/** One-tap WhatsApp / call to the property's host and on-site contact. */
function ContactsCard({ p }: { p: Full }) {
  const greet = (n: string) => `Hi ${n}, about ${p.title} (${p.code}):`;
  return (
    <div className="s-card mt-4 grid gap-4 rounded-2xl p-4 sm:grid-cols-2">
      {p.host && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Host</p>
          <p className="mt-0.5 font-semibold text-plum">{p.host.name} <span className="text-xs font-normal text-muted">{p.host.phone}</span></p>
          {p.host.phone || p.host.whatsapp ? <div className="mt-2"><ContactButtons phone={p.host.whatsapp || p.host.phone} greet={greet(p.host.name)} /></div> : <p className="text-xs text-muted">No number saved: add it in Hosts.</p>}
        </div>
      )}
      {p.contactPhone && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Property contact</p>
          <p className="mt-0.5 font-semibold text-plum">{p.contactName || "Contact"} <span className="text-xs font-normal text-muted">{p.contactPhone}</span></p>
          <div className="mt-2"><ContactButtons phone={p.contactPhone} greet={greet(p.contactName || "")} /></div>
        </div>
      )}
    </div>
  );
}
