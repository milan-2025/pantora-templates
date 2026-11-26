"use client";
import { useState } from "react";
import { Plus, Trash2, Users2 } from "lucide-react";
import { STAFF_PERMS, type StaffPerm } from "@/lib/hostbook/features";
import { api } from "../api";
import { useLookups, useStore, type StaffV } from "../store";
import { Badge, Button, Card, Empty, Field, Input, PageHead, Sheet } from "../ui";

const DEFAULT_PERMS: StaffPerm[] = ["bookings", "guests", "tasks", "expenses"];

export function Team() {
  const s = useStore();
  const { listings, listingName } = useLookups();
  const staff = s.me.account.staff;
  const [edit, setEdit] = useState<number | "new" | null>(null);
  const [f, setF] = useState<StaffV>({ email: "", name: "", phone: "", perms: DEFAULT_PERMS, listings: [] });
  const limit = s.me.access.staffLimit;
  const saveAll = async (next: StaffV[]) => {
    try { await api("account", { body: { staff: next } }); await s.reloadMe(); s.toast("Team saved"); setEdit(null); }
    catch (e) { s.toast((e as Error).message, "bad"); if ((e as { status?: number }).status === 402) s.upsell("staff"); }
  };
  const open = (i: number | "new") => {
    if (i === "new" && staff.length >= limit) return s.upsell("staff");
    setEdit(i); setF(i === "new" ? { email: "", name: "", phone: "", perms: DEFAULT_PERMS, listings: [] } : { ...staff[i] });
  };
  const save = () => saveAll(edit === "new" ? [...staff, f] : staff.map((x, i) => (i === edit ? f : x)));
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <div>
      <PageHead title="Team" sub={`${staff.length} of ${limit} staff on your plan`} action={<Button onClick={() => open("new")}><Plus className="size-4" /> Add person</Button>} />
      <p className="mb-4 text-sm text-muted">Caretakers, cleaners or managers sign in with their own email. They only see what you allow, and get their tasks in a morning email.</p>
      {staff.length ? <div className="grid gap-3 md:grid-cols-2">{staff.map((x, i) => (
        <Card key={x.email} className="cursor-pointer hover:border-teal/40" onClick={() => open(i)}>
          <b>{x.name || x.email}</b><p className="text-xs text-muted">{x.email}{x.phone ? ` · ${x.phone}` : ""}</p>
          <div className="mt-2 flex flex-wrap gap-1">{x.perms.map((p) => <Badge key={p} tone="teal">{STAFF_PERMS.find((y) => y.key === p)?.label.split(" ").slice(0, 3).join(" ")}</Badge>)}</div>
          <p className="mt-2 text-xs text-muted">{x.listings.length ? x.listings.map(listingName).join(", ") : "All listings"}</p>
        </Card>
      ))}</div> : <Empty icon={<Users2 />} title="Just you for now" text="Add a caretaker so they can see check-ins, tick off cleaning and add expenses." />}
      {edit !== null && <Sheet open onClose={() => setEdit(null)} title={edit === "new" ? "Add a team member" : f.name || f.email} footer={<>{edit !== "new" && <Button tone="danger" onClick={() => confirm("Remove this person?") && saveAll(staff.filter((_, i) => i !== edit))}><Trash2 className="size-4" /> Remove</Button>}<Button onClick={save}>Save</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email (they sign in with it)" className="col-span-2"><Input type="email" value={f.email} disabled={edit !== "new"} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        </div>
        <p className="mb-1 mt-4 text-xs font-semibold text-ink/70">They can</p>
        {STAFF_PERMS.map((p) => <label key={p.key} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={f.perms.includes(p.key)} onChange={() => setF({ ...f, perms: toggle(f.perms, p.key) })} />{p.label}</label>)}
        {listings.length > 1 && <>
          <p className="mb-1 mt-4 text-xs font-semibold text-ink/70">Listings (none ticked = all)</p>
          {listings.map((l) => <label key={l.id} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={f.listings.includes(l.id)} onChange={() => setF({ ...f, listings: toggle(f.listings, l.id) })} />{l.name}</label>)}
        </>}
        {edit === "new" && <p className="mt-3 text-xs text-muted">We&apos;ll email them a link to sign in.</p>}
      </Sheet>}
    </div>
  );
}
