"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import type { Rec } from "@/lib/hostbook/core";
import { useStore } from "../store";
import { Button, Card, Field, Input, Locked, PageHead, Sheet, Textarea } from "../ui";

const VARS = ["guest", "listing", "checkin", "checkout", "checkinTime", "checkoutTime", "address", "wifi", "wifiPass", "checkinLink", "host", "nights"];

export function Templates() {
  const s = useStore();
  const [edit, setEdit] = useState<Rec | "new" | null>(null);
  const [f, setF] = useState({ name: "", body: "" });
  if (!s.has("whatsapp")) return <div><PageHead title="WhatsApp messages" /><Locked feature="whatsapp" /></div>;
  const own = s.of("template");
  const open = (x: Rec | "new") => { setEdit(x); setF(x === "new" ? { name: "", body: "" } : { name: x.name, body: x.body }); };
  const save = async () => { try { await s.save("template", f, edit === "new" ? undefined : (edit as Rec).id); setEdit(null); s.toast("Saved"); } catch (e) { s.toast((e as Error).message, "bad"); } };
  const del = async () => { if (edit && edit !== "new" && confirm("Delete this message?")) { await s.remove(edit.id); setEdit(null); } };
  const copyDefaults = async () => { try { for (const t of s.defaultTemplates) await s.save("template", t); s.toast("Added"); await s.refresh(); } catch (e) { s.toast((e as Error).message, "bad"); } };
  return (
    <div>
      <PageHead title="WhatsApp messages" sub="Ready-made messages, filled in from the booking. Send them from any booking." action={s.can("owner") && <Button onClick={() => open("new")}><Plus className="size-4" /> Message</Button>} />
      {!own.length && s.defaultTemplates.length > 0 && <Card className="mb-3 bg-mist/60"><p className="text-sm">You&apos;re using the starter messages below. Make them your own to edit them.</p>{s.can("owner") && <Button size="sm" className="mt-2" onClick={copyDefaults}>Edit these messages</Button>}</Card>}
      <div className="grid gap-3 md:grid-cols-2">
        {(own.length ? own : s.defaultTemplates.map((t, i) => ({ ...t, id: `d${i}`, kind: "template" as const }))).map((t) => (
          <Card key={t.id} className={own.length && s.can("owner") ? "cursor-pointer hover:border-teal/40" : ""} onClick={() => own.length && s.can("owner") && open(t as Rec)}>
            <b>{t.name}</b><p className="mt-1 whitespace-pre-line text-sm text-muted">{t.body}</p>
          </Card>
        ))}
      </div>
      {edit && <Sheet open onClose={() => setEdit(null)} title="Message" footer={<>{edit !== "new" && <Button tone="danger" onClick={del}>Delete</Button>}<Button onClick={save}>Save</Button></>}>
        <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Message" className="mt-3"><Textarea rows={7} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
        <div className="mt-2 flex flex-wrap gap-1">{VARS.map((v) => <button key={v} onClick={() => setF({ ...f, body: `${f.body}{${v}}` })} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-teal ring-1 ring-line">{`{${v}}`}</button>)}</div>
      </Sheet>}
    </div>
  );
}
