"use client";
import { useEffect, useState } from "react";
import { BellRing, Download, LogOut } from "lucide-react";
import { CHECKIN_FIELDS, toCsv, type CheckinField } from "@/lib/hostbook/core";
import { api, session } from "../api";
import { useStore } from "../store";
import { Badge, Button, Card, Field, Input, Locked, PageHead, Select, download } from "../ui";

const b64ToBytes = (b64: string) => { const s = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (b64.length % 4)) % 4)); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };

/** Keeps the sign-in token where the background worker can read it, to fetch the newest notification after a push. */
export async function shareTokenWithWorker() {
  try { const t = session.token(); if (t && "caches" in window) await (await caches.open("hb-auth")).put("/__hb_token", new Response(t)); } catch { /* not supported */ }
}

/** Phone notifications (web push). Free: no SMS or email cost. */
export function usePush() {
  const { toast } = useStore();
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const [on, setOn] = useState(false), [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.getRegistration("/hostbook/").then((r) => r?.pushManager.getSubscription()).then((sub) => setOn(Boolean(sub) && Notification.permission === "granted")).catch(() => null);
  }, [supported]);
  const enable = async () => {
    setBusy(true);
    try {
      if ((await Notification.requestPermission()) !== "granted") throw new Error("Notifications are blocked. Allow them for this site in your browser settings.");
      const reg = (await navigator.serviceWorker.getRegistration("/hostbook/")) ?? (await navigator.serviceWorker.register("/hostbook-sw.js", { scope: "/hostbook/" }));
      await navigator.serviceWorker.ready;
      const { publicKey } = await api<{ publicKey: string }>("push/key");
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) }));
      await api("push/subscribe", { body: { sub: { endpoint: sub.endpoint } } });
      await shareTokenWithWorker();
      setOn(true); toast("Notifications are on for this device");
    } catch (e) { toast((e as Error).message, "bad"); } finally { setBusy(false); }
  };
  const disable = async () => {
    setBusy(true);
    try {
      const sub = await (await navigator.serviceWorker.getRegistration("/hostbook/"))?.pushManager.getSubscription();
      await api("push/subscribe", { body: { sub: sub ? { endpoint: sub.endpoint } : null, off: true } });
      await sub?.unsubscribe();
      setOn(false);
    } catch (e) { toast((e as Error).message, "bad"); } finally { setBusy(false); }
  };
  return { supported, on, busy, enable, disable };
}

function CheckinForm() {
  const s = useStore();
  const a = s.me.account;
  const [req, setReq] = useState<CheckinField[]>(a.checkinRequired);
  const [all, setAll] = useState(a.checkinAllGuests);
  const toggle = (k: CheckinField) => setReq((r) => (r.includes(k) ? r.filter((x) => x !== k) : [...r, k]));
  const save = async () => { try { await api("account", { body: { checkinRequired: req, checkinAllGuests: all } }); await s.reloadMe(); s.toast("Check-in form saved"); } catch (e) { s.toast((e as Error).message, "bad"); } };
  return (
    <Card className="mb-4 space-y-2">
      <h2 className="font-semibold">Check-in form</h2>
      <p className="text-sm text-muted">Pick what guests must fill in before they can send the form. Name is always needed. ID numbers, phones and emails are always checked for the right format.</p>
      {s.has("checkin") ? <>
        <div className="grid grid-cols-2 gap-x-4">
          {CHECKIN_FIELDS.map((f) => <label key={f.key} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={req.includes(f.key)} onChange={() => toggle(f.key)} />{f.label}</label>)}
        </div>
        <label className="flex items-center gap-2 pt-1 text-sm"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Apply to every adult, not just the main guest (phone stays main guest only)</label>
        <Button onClick={save}>Save</Button>
      </> : <Locked feature="checkin" />}
    </Card>
  );
}

export function SettingsScreen({ onSwitch, onOut }: { onSwitch: (id: string) => void; onOut: () => void }) {
  const s = useStore();
  const a = s.me.account;
  const [f, setF] = useState({ business: a.business, phone: a.phone, city: a.city, logoUrl: a.logoUrl, idDays: a.idDays, digestOn: a.digestOn });
  const [pw, setPw] = useState("");
  const save = async () => { try { await api("account", { body: f }); await s.reloadMe(); s.toast("Saved"); } catch (e) { s.toast((e as Error).message, "bad"); } };
  const setPassword = async (remove = false) => { try { await api("password", { body: { password: pw, remove } }); setPw(""); await s.reloadMe(); s.toast(remove ? "Password removed" : "Password set"); } catch (e) { s.toast((e as Error).message, "bad"); } };
  const exportGuests = () => {
    if (!s.has("export")) return s.upsell("export");
    download("hostbook-guests.csv", toCsv([["Name", "Phone", "Other phone", "Email", "City", "Address", "Nationality", "ID type", "ID", "Flag", "Rating", "Notes"], ...s.of("guest").map((g) => [g.name, g.phone, g.phone2, g.email, g.city, g.address, g.nationality, g.idType, s.can("ids") ? g.idNumber : g.idMasked, g.flag, g.rating, g.notes])]));
  };
  return (
    <div className="max-w-2xl">
      <PageHead title="Settings" sub={s.me.email} />
      {s.me.teams.length > 1 && <Card className="mb-4">
        <Field label="Account you're working in"><Select value={a.id} onChange={(e) => onSwitch(e.target.value)} options={s.me.teams.map((t) => ({ value: t.id, label: `${t.name}${t.role === "staff" ? " (team member)" : ""}` }))} /></Field>
      </Card>}
      {s.can("owner") && <Card className="mb-4 space-y-3">
        <h2 className="font-semibold">Your business</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Business name"><Input value={f.business} onChange={(e) => setF({ ...f, business: e.target.value })} /></Field>
          <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="City"><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
          {s.me.access.plan.hostChoosesIdDays && <Field label={`Keep guest ID photos (days, up to ${s.me.access.plan.idDays})`}><Input type="number" min={1} max={s.me.access.plan.idDays} value={f.idDays} onChange={(e) => setF({ ...f, idDays: Number(e.target.value) })} /></Field>}
        </div>
        {s.has("branding") ? <Field label="Logo for guest pages (image link, https://…)"><Input value={f.logoUrl} onChange={(e) => setF({ ...f, logoUrl: e.target.value })} /></Field> : <p className="text-xs text-muted">Your logo on guest pages <Locked feature="branding" compact /></p>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.digestOn} onChange={(e) => setF({ ...f, digestOn: e.target.checked })} /> Also email me a morning summary (today&apos;s check-ins, check-outs and tasks). It&apos;s always in the app under Notifications.</label>
        <Button onClick={save}>Save</Button>
      </Card>}
      <PushCard />
      {s.can("owner") && <CheckinForm />}
      <Card className="mb-4 space-y-2">
        <h2 className="font-semibold">Sign-in {s.me.hasPassword && <Badge tone="ok">Password set</Badge>}</h2>
        <p className="text-sm text-muted">You can always sign in with a code sent to your email. Add a password if you&apos;d rather type one.</p>
        <div className="flex gap-2"><Input type="password" placeholder="New password (8+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /><Button onClick={() => setPassword()} disabled={pw.length < 8}>Set</Button></div>
        {s.me.hasPassword && <Button size="sm" tone="ghost" onClick={() => setPassword(true)}>Remove password</Button>}
      </Card>
      <Card className="mb-4 space-y-2">
        <h2 className="font-semibold">Privacy</h2>
        <p className="text-sm text-muted">Guest ID photos are stored privately and deleted automatically after {s.me.access.idDays} days. The written guest register (name, ID type and number, dates) stays for your records. Only you, and team members you allow, can see IDs.</p>
        {s.can("guests") && <Button size="sm" tone="soft" onClick={exportGuests}><Download className="size-3.5" /> Download guest list (Excel)</Button>}
      </Card>
      {a.staysLinked && <p className="mb-4 text-sm text-muted">Linked to your Pandora Stays host account.</p>}
      <Button tone="ghost" onClick={onOut}><LogOut className="size-4" /> Sign out on this device</Button>
    </div>
  );
}

function PushCard() {
  const p = usePush();
  return (
    <Card className="mb-4 space-y-2">
      <h2 className="flex items-center gap-2 font-semibold"><BellRing className="size-4 text-teal" /> Notifications on this device {p.on && <Badge tone="ok">On</Badge>}</h2>
      <p className="text-sm text-muted">Guest details coming in, new bookings, today&apos;s check-ins and tasks appear under the bell in the app. Turn this on to also get them on this phone or computer when HostBook is closed.</p>
      {!p.supported ? <p className="text-xs text-muted">This browser doesn&apos;t support notifications. On iPhone, add HostBook to your Home Screen first (Share → Add to Home Screen), then open it from there.</p>
        : p.on ? <Button size="sm" tone="ghost" onClick={p.disable} disabled={p.busy}>Turn off on this device</Button>
        : <Button size="sm" onClick={p.enable} disabled={p.busy}>Turn on notifications</Button>}
    </Card>
  );
}
