"use client";
/** Host portal: sign up / sign in / accept invite, list own properties, add and edit them, submit for review, profile. */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, Loader2, LogOut, Plus, Send, Undo2 } from "lucide-react";
import { STATUS_LABEL, type Status } from "@/lib/stays/constants";
import { api } from "../client/api";
import { MediaManager, type MediaRow } from "../client/MediaManager";
import { PropertyForm, Section, Field, toForm, toPayload, type FormVal } from "../client/PropertyForm";
import { Brand } from "../ui";

type Host = { id: string; hostCode: string; name: string; email: string; phone: string; whatsapp: string; payout: string };
type HostProp = {
  id: string; code: string; slug: string; title: string; status: Status; statusLabel: string; visibility: string; media: MediaRow[]; coverId: string | null;
  review: { reason: string; action: string; at: number } | null; hostChangesPending: boolean; publishRequested: boolean; updatedAt: number;
  location: { city: string; locality: string };
  [k: string]: unknown;
};
type Me = { host: Host | null; settings: { siteName: string; logoUrl: string; propertyTypes: string[]; categories: string[]; features: string[]; map: { tileUrl: string; attribution: string; defaultLat: number; defaultLng: number; defaultZoom: number } }; amenities: { key: string; label: string; category: string }[] };

const STATUS_TONE: Record<Status, string> = {
  draft: "bg-lavender text-plum", submitted: "bg-sand text-marigold-deep", under_review: "bg-sand text-marigold-deep", approved: "bg-mint text-teal",
  rejected: "bg-blush text-coral", changes_requested: "bg-blush text-coral", published: "bg-teal text-white", inactive: "bg-charcoal/10 text-charcoal",
};
const HELP: Record<Status, string> = {
  draft: "Only you can see this. Fill in the details, add photos, then submit it for review.",
  submitted: "Thanks! We'll review it soon. You can still make changes.",
  under_review: "We're reviewing your property. You can still make changes.",
  approved: "Approved. We'll publish it shortly, or you can ask us to.",
  rejected: "Not accepted this time. See the reason below; you can update it and submit again.",
  changes_requested: "We need a few changes. See the note below, update it, and submit again.",
  published: "Live! Changes you make now are reviewed before guests see them.",
  inactive: "Paused: guests can't see it. Ask us to publish it again when ready.",
};

function useHash() {
  const [h, setH] = useState("");
  useEffect(() => {
    const on = () => setH(location.hash.slice(1));
    on();
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return h;
}

export function HostApp() {
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => api<Me>("host", "me").then(setMe).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => registerHostSW(), []);
  if (err) return <Center><p className="text-coral">{err}</p></Center>;
  if (!me) return <Center><Loader2 className="size-6 animate-spin text-plum" /></Center>;
  if (!me.host) return <Auth site={me.settings} onIn={load} />;
  return <Portal me={me as Me & { host: Host }} onOut={() => { api("host", "logout", {}).finally(() => { location.hash = ""; load(); }); }} onMe={(host) => setMe({ ...me, host })} />;
}

/**
 * Offline: the host-only worker keeps the portal and the host's last data on this device, and sends property edits
 * made offline when the connection is back (see public/stays/host-sw.js).
 */
function registerHostSW() {
  if (!("serviceWorker" in navigator)) return;
  const flush = () => navigator.serviceWorker.ready.then((r) => r.active?.postMessage({ type: "flush" })).catch(() => null);
  navigator.serviceWorker.register("/stays/host-sw.js", { scope: "/stays/host" }).then(async () => {
    const r = await navigator.serviceWorker.ready;
    // Files this first visit loaded before the worker started, so the next start works offline too.
    const urls = performance.getEntriesByType("resource").map((x) => x.name).filter((u) => u.includes("/_next/static/"));
    r.active?.postMessage({ type: "cache", urls });
    if (navigator.onLine) flush();
  }).catch(() => null);
  window.addEventListener("online", flush);
  return () => window.removeEventListener("online", flush);
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-dvh place-items-center p-6">{children}</div>;
}

function Auth({ site, onIn }: { site: Me["settings"]; onIn: () => void }) {
  const invite = typeof window !== "undefined" ? new URLSearchParams(location.search).get("invite") : null;
  const [mode, setMode] = useState<"login" | "register" | "invite">(invite ? "invite" : "login");
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [inv, setInv] = useState<{ name: string; email: string } | null>(null);
  useEffect(() => {
    if (!invite) return;
    api<{ name: string; email: string }>("host", "invite", undefined, `&token=${encodeURIComponent(invite)}`).then((r) => { setInv(r); setF((x) => ({ ...x, email: r.email })); }).catch((e) => setMsg(e.message));
  }, [invite]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      if (mode === "invite") await api("host", "invite_accept", { token: invite, email: f.email, password: f.password });
      else await api("host", mode, f);
      if (invite) history.replaceState(null, "", "/stays/host");
      onIn();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <Brand site={site} />
      <div className="s-card mt-6 rounded-3xl p-6">
        <h1 className="font-display text-3xl">{mode === "invite" ? `Welcome${inv ? `, ${inv.name}` : ""}` : mode === "register" ? "List your property" : "Host sign in"}</h1>
        <p className="mt-1 text-sm text-muted">{mode === "invite" ? "Set a password to manage your properties." : mode === "register" ? "Create a free host account. Your contact details are never shown to guests." : "Manage your properties, photos and prices."}</p>
        <form onSubmit={submit} className="mt-5 space-y-3">
          {mode === "register" && <Field label="Your name"><input className="s-input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></Field>}
          <Field label="Email"><input className="s-input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" /></Field>
          {mode === "register" && <Field label="Phone / WhatsApp"><input className="s-input" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" /></Field>}
          <Field label={mode === "login" ? "Password" : "Choose a password (8+ characters)"}><input className="s-input" type="password" required minLength={mode === "login" ? 1 : 8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete={mode === "login" ? "current-password" : "new-password"} /></Field>
          {msg && <p className="rounded-xl bg-blush px-3 py-2 text-sm text-coral" role="alert">{msg}</p>}
          <button className="s-btn s-btn-primary w-full" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />}{mode === "login" ? "Sign in" : mode === "register" ? "Create account" : "Set password"}</button>
        </form>
        {mode !== "invite" && (
          <p className="mt-4 text-center text-sm text-muted">
            {mode === "login" ? <>New here? <button type="button" className="font-semibold text-plum underline" onClick={() => setMode("register")}>Create a host account</button></> : <>Already registered? <button type="button" className="font-semibold text-plum underline" onClick={() => setMode("login")}>Sign in</button></>}
          </p>
        )}
        {mode === "login" && <p className="mt-2 text-center text-xs text-muted">Forgot your password? Message us on WhatsApp and we&apos;ll send you a reset link.</p>}
      </div>
      <Link href="/stays" className="mt-6 text-center text-sm text-muted hover:text-plum">← Back to stays</Link>
    </div>
  );
}

function Portal({ me, onOut, onMe }: { me: Me & { host: Host }; onOut: () => void; onMe: (h: Host) => void }) {
  const hash = useHash();
  const [list, setList] = useState<HostProp[] | null>(null);
  const [err, setErr] = useState("");
  const reload = useCallback(() => api<HostProp[]>("host", "properties").then(setList).catch((e) => setErr(e.message)), []);
  useEffect(() => { reload(); }, [reload]);
  const route = hash.split("/");
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-cream/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
          <Brand site={me.settings} />
          <nav className="flex items-center gap-1 text-sm">
            <a href="#" className={`rounded-full px-3 py-2 ${!route[0] ? "bg-plum text-white" : "text-plum hover:bg-plum/5"}`}>My properties</a>
            <a href="#profile" className={`rounded-full px-3 py-2 ${route[0] === "profile" ? "bg-plum text-white" : "text-plum hover:bg-plum/5"}`}>Profile</a>
            <button type="button" onClick={onOut} className="rounded-full p-2 text-muted hover:bg-plum/5" aria-label="Sign out" title="Sign out"><LogOut className="size-4" /></button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        {err && <p className="mb-4 rounded-xl bg-blush px-3 py-2 text-sm text-coral">{err}</p>}
        {route[0] === "profile" ? <Profile host={me.host} onMe={onMe} />
          : route[0] === "p" && route[1] ? <Editor key={route[1]} id={route[1]} me={me} onSaved={reload} />
          : route[0] === "new" ? <Editor key="new" id={null} me={me} onSaved={reload} />
          : <List list={list} name={me.host.name} />}
      </main>
    </div>
  );
}

function List({ list, name }: { list: HostProp[] | null; name: string }) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-3xl">Hello, {name.split(" ")[0]}</h1><p className="text-sm text-muted">Your properties and their review status.</p></div>
        <a href="#new" className="s-btn s-btn-primary"><Plus className="size-4" /> Add a property</a>
      </div>
      {!list ? <div className="mt-6 space-y-3">{[0, 1].map((i) => <div key={i} className="s-skeleton h-24" />)}</div> : list.length === 0 ? (
        <div className="s-card mt-6 rounded-3xl p-10 text-center">
          <p className="font-display text-2xl text-plum">Add your first property</p>
          <p className="mt-2 text-sm text-muted">It takes about 10 minutes: details, photos, location and your payout. We review it before it goes live.</p>
          <a href="#new" className="s-btn s-btn-primary mt-5"><Plus className="size-4" /> Add a property</a>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {list.map((p) => {
            const cover = p.media.find((m) => m.id === p.coverId) || p.media.find((m) => m.type === "image");
            return (
              <li key={p.id}>
                <a href={`#p/${p.id}`} className="s-card flex gap-4 rounded-2xl p-3 hover:shadow-lift">
                  <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-sand sm:h-24 sm:w-32">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {cover && <img src={cover.thumb} alt="" className="size-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                      <span className="text-xs text-muted">{p.code}</span>
                      {p.hostChangesPending && <span className="text-xs text-marigold-deep">Changes awaiting review</span>}
                    </div>
                    <p className="mt-1 truncate font-semibold text-plum">{p.title || "Untitled property"}</p>
                    <p className="truncate text-sm text-muted">{[p.location.locality, p.location.city].filter(Boolean).join(", ") || "Location not added"} · {p.media.length} photo{p.media.length === 1 ? "" : "s"}</p>
                    {p.review && ["rejected", "changes_requested"].includes(p.status) && <p className="mt-1 line-clamp-1 text-sm text-coral">Note: {p.review.reason}</p>}
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function Editor({ id, me, onSaved }: { id: string | null; me: Me; onSaved: () => void }) {
  const [p, setP] = useState<HostProp | null>(null);
  const [form, setForm] = useState<FormVal | null>(id ? null : toForm({}));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    if (!id) return;
    api<HostProp>("host", "property", undefined, `&id=${id}`).then((x) => { setP(x); setForm(toForm(x.pendingChanges ? { ...x, ...(x.pendingChanges as object) } : x)); }).catch((e) => setMsg({ ok: false, text: e.message }));
  }, [id]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  if (!form) return msg ? <p className="text-coral">{msg.text}</p> : <div className="s-skeleton h-96" />;

  async function save(): Promise<HostProp | null> {
    if (!form!.title.trim()) { setMsg({ ok: false, text: "Please give the property a title." }); return null; }
    setBusy("save"); setMsg(null);
    try {
      const r = await api<HostProp & { notice?: string }>("host", p ? "property_save" : "property_create", { ...(p ? { id: p.id } : {}), ...toPayload(form!, "host") });
      setP(r); setDirty(false); onSaved();
      if (!p) history.replaceState(null, "", `#p/${r.id}`);
      setMsg({ ok: true, text: r.notice || "Saved." });
      return r;
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); return null; } finally { setBusy(""); }
  }
  async function act(action: string) {
    let cur = p;
    if (dirty || !cur) cur = await save();
    if (!cur) return;
    setBusy(action); setMsg(null);
    try {
      const r = await api<HostProp>("host", "property_action", { id: cur.id, action });
      setP(r); onSaved();
      setMsg({ ok: true, text: action === "submit" ? "Submitted for review. We'll let you know." : action === "withdraw" ? "Moved back to draft." : "Request sent. We'll publish it shortly." });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(""); }
  }
  const status = p?.status || "draft";
  const live = ["approved", "published", "inactive"].includes(status);

  return (
    <div className="pb-28">
      <a href="#" className="inline-flex items-center gap-1 text-sm text-muted hover:text-plum"><ArrowLeft className="size-4" /> My properties</a>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-3xl">{p ? p.title || "Untitled property" : "Add a property"}</h1>
        {p && <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>}
        {p && <span className="text-sm text-muted">{p.code}</span>}
      </div>
      <p className="mt-1 text-sm text-muted">{HELP[status]}</p>
      {p?.review && ["rejected", "changes_requested"].includes(status) && (
        <div className="mt-3 flex gap-2 rounded-2xl bg-blush p-3 text-sm text-coral"><AlertTriangle className="size-4 shrink-0" /><p><strong>{status === "rejected" ? "Reason:" : "Please change:"}</strong> {p.review.reason}</p></div>
      )}
      {p?.review?.action === "changes_declined" && <p className="mt-3 rounded-2xl bg-sand p-3 text-sm text-marigold-deep">Your last edits weren&apos;t applied: {p.review.reason}</p>}
      {p?.hostChangesPending && <p className="mt-3 rounded-2xl bg-sand p-3 text-sm text-marigold-deep">Your latest changes are waiting for our review. The live listing shows the previous version until then.</p>}
      {p?.status === "published" && p.visibility === "public" && <Link href={`/stay/${p.slug}`} target="_blank" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-teal underline">View the live page <ExternalLink className="size-3.5" /></Link>}

      <div className="mt-5" onChangeCapture={() => setDirty(true)} onClickCapture={(e) => { if ((e.target as HTMLElement).closest("button[aria-pressed]")) setDirty(true); }}>
        <PropertyForm role="host" value={form} onChange={(v) => { setForm(v); setDirty(true); }} amenities={me.amenities} opts={me.settings} code={p?.code} />
      </div>

      <div className="mt-4">
        <Section title={`Photos and videos (${p?.media.length || 0})`} open>
          {p ? <MediaManager<HostProp> base="host" propertyId={p.id} media={p.media} coverId={p.coverId} live={live} onChange={(x) => setP(x)} rooms={(p.roomList as { id: string; name: string }[]) || []} /> : <p className="text-sm text-muted">Save the property first, then add photos and videos.</p>}
        </Section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3">
          <div className="min-w-0 flex-1 text-sm" aria-live="polite">
            {msg ? <span className={msg.ok ? "inline-flex items-center gap-1 text-teal" : "text-coral"}>{msg.ok && <CheckCircle2 className="size-4" />}{msg.text}</span> : dirty ? <span className="text-muted">Unsaved changes</span> : null}
          </div>
          <button type="button" onClick={save} disabled={!!busy} className="s-btn s-btn-ghost">{busy === "save" && <Loader2 className="size-4 animate-spin" />}{live ? "Save changes" : "Save draft"}</button>
          {["draft", "changes_requested", "rejected"].includes(status) && <button type="button" onClick={() => act("submit")} disabled={!!busy} className="s-btn s-btn-primary">{busy === "submit" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Submit for review</button>}
          {status === "submitted" && <button type="button" onClick={() => act("withdraw")} disabled={!!busy} className="s-btn s-btn-ghost"><Undo2 className="size-4" /> Withdraw</button>}
          {["approved", "inactive"].includes(status) && <button type="button" onClick={() => act("request_publish")} disabled={!!busy || p?.publishRequested} className="s-btn s-btn-primary">{p?.publishRequested ? "Publication requested" : "Request publication"}</button>}
        </div>
      </div>
    </div>
  );
}

function Profile({ host, onMe }: { host: Host; onMe: (h: Host) => void }) {
  const [f, setF] = useState({ name: host.name, phone: host.phone, whatsapp: host.whatsapp, payout: host.payout });
  const [pw, setPw] = useState({ current: "", password: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try { const r = await api<{ host: Host }>("host", "profile_save", f); onMe(r.host); setMsg({ ok: true, text: "Profile saved." }); } catch (er) { setMsg({ ok: false, text: (er as Error).message }); }
  }
  async function change(e: React.FormEvent) {
    e.preventDefault();
    try { await api("host", "password_change", pw); setPw({ current: "", password: "" }); setMsg({ ok: true, text: "Password changed. Other devices are signed out." }); } catch (er) { setMsg({ ok: false, text: (er as Error).message }); }
  }
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="font-display text-3xl">Your profile</h1>
      <p className="text-sm text-muted">Host ID {host.hostCode} · {host.email}. These details are only seen by us, never by guests.</p>
      {msg && <p className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-mint text-teal" : "bg-blush text-coral"}`} role="status">{msg.text}</p>}
      <form onSubmit={save} className="s-card space-y-3 rounded-2xl p-5">
        <Field label="Name"><input className="s-input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Phone"><input className="s-input" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="WhatsApp"><input className="s-input" type="tel" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} /></Field>
        </div>
        <Field label="Payout details" hint="UPI ID or bank account for your payouts."><textarea className="s-input" rows={3} value={f.payout} onChange={(e) => setF({ ...f, payout: e.target.value })} /></Field>
        <button className="s-btn s-btn-primary">Save profile</button>
      </form>
      <form onSubmit={change} className="s-card space-y-3 rounded-2xl p-5">
        <h2 className="font-sans text-base font-semibold text-plum">Change password</h2>
        <Field label="Current password"><input className="s-input" type="password" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" /></Field>
        <Field label="New password (8+ characters)"><input className="s-input" type="password" required minLength={8} value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} autoComplete="new-password" /></Field>
        <button className="s-btn s-btn-ghost">Change password</button>
      </form>
    </div>
  );
}
