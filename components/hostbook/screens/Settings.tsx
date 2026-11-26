"use client";
import { useState } from "react";
import { Download, LogOut } from "lucide-react";
import { toCsv } from "@/lib/hostbook/core";
import { api } from "../api";
import { useStore } from "../store";
import { Badge, Button, Card, Field, Input, Locked, PageHead, Select, download } from "../ui";

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
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.digestOn} onChange={(e) => setF({ ...f, digestOn: e.target.checked })} /> Morning email with today&apos;s check-ins, check-outs and tasks (also sent to staff)</label>
        <Button onClick={save}>Save</Button>
      </Card>}
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
