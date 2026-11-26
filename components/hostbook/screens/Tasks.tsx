"use client";
import { useState } from "react";
import { Check, CheckCircle2, ClipboardList, Pencil, Plus, Repeat, SkipForward, Sparkles } from "lucide-react";
import { addDays, istDay, repeatLabel, type Rec } from "@/lib/hostbook/core";
import { api } from "../api";
import { useLookups, useStore } from "../store";
import { Badge, Button, Card, Empty, Field, Input, Locked, PageHead, Select, Sheet, Tabs, Textarea, cx, fmtDay } from "../ui";

const IDEAS = [
  { title: "AC service", every: 3, unit: "month" }, { title: "Pay electricity bill", every: 1, unit: "month" }, { title: "Deep clean", every: 1, unit: "month" },
  { title: "Pest control", every: 3, unit: "month" }, { title: "Water tank cleaning", every: 6, unit: "month" }, { title: "Fire extinguisher check", every: 1, unit: "year" },
  { title: "Wash curtains & sofa covers", every: 2, unit: "month" }, { title: "Renew homestay registration", every: 1, unit: "year" }, { title: "Check smoke alarm batteries", every: 6, unit: "month" },
];

export function dueTone(due: string) {
  const t = istDay();
  return due < t ? "bad" : due === t ? "warn" : "plain";
}

export function TaskRow({ t, compact }: { t: Rec; compact?: boolean }) {
  const s = useStore();
  const { listingName } = useLookups();
  const [busy, setBusy] = useState(false), [edit, setEdit] = useState(false);
  const staff = s.me.account.staff.find((x) => x.email === t.assignee);
  const done = async (status: "done" | "skipped") => {
    setBusy(true);
    try {
      const r = await api("tasks/done", { body: { id: t.id, status } });
      s.put(r.task); s.put(r.run);
      s.toast(status === "done" ? (r.task.active === false ? "Done" : `Done. Next: ${fmtDay(r.task.due)}`) : `Skipped. Next: ${fmtDay(r.task.due)}`);
    } catch (e) { s.toast((e as Error).message, "bad"); } finally { setBusy(false); }
  };
  const tone = dueTone(t.due);
  return (
    <div className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
      <button disabled={busy} onClick={() => done("done")} className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-teal/40 text-teal hover:bg-mist" aria-label="Mark done"><Check className="size-4" /></button>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{t.title}</div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <Badge tone={tone as "bad" | "warn" | "plain"}>{tone === "bad" ? `Overdue · ${fmtDay(t.due)}` : tone === "warn" ? "Today" : fmtDay(t.due)}</Badge>
          {!compact && <span className="flex items-center gap-1"><Repeat className="size-3" />{repeatLabel(t.every, t.unit)}</span>}
          {t.listingId && <span>· {listingName(t.listingId)}</span>}
          {t.assignee && <span>· {staff?.name || t.assignee}</span>}
        </div>
      </div>
      {!compact && t.unit !== "once" && <button onClick={() => done("skipped")} disabled={busy} className="rounded-full p-2 text-muted hover:bg-ink/5" title="Skip this time"><SkipForward className="size-4" /></button>}
      {!compact && <button onClick={() => setEdit(true)} className="rounded-full p-2 text-muted hover:bg-ink/5" title="Edit"><Pencil className="size-4" /></button>}
      {edit && <TaskEditor task={t} onClose={() => setEdit(false)} />}
    </div>
  );
}

export function TaskEditor({ task, onClose }: { task: Rec | null; onClose: () => void }) {
  const s = useStore();
  const { listings } = useLookups();
  const [f, setF] = useState<Record<string, any>>(() => task ?? { title: "", every: 1, unit: "month", due: istDay(), listingId: "", assignee: "" }); // eslint-disable-line @typescript-eslint/no-explicit-any
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => { try { await s.save("task", f, task?.id); s.toast("Task saved"); onClose(); } catch (e) { s.toast((e as Error).message, "bad"); } };
  const del = async () => { if (!task || !confirm("Delete this task?")) return; try { await s.remove(task.id); onClose(); } catch (e) { s.toast((e as Error).message, "bad"); } };
  return (
    <Sheet open onClose={onClose} title={task ? "Edit task" : "New regular task"} footer={<>{task && <Button tone="danger" onClick={del}>Delete</Button>}<Button tone="ghost" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}>
      {!task && <div className="mb-3 flex flex-wrap gap-1.5">{IDEAS.map((i) => <button key={i.title} onClick={() => setF((x) => ({ ...x, ...i }))} className="rounded-full border border-line bg-white px-2.5 py-1 text-xs">{i.title}</button>)}</div>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Task" className="col-span-2"><Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. AC service" /></Field>
        <Field label="Repeat every"><Input type="number" min={1} value={f.every} onChange={(e) => set("every", e.target.value)} disabled={f.unit === "once"} /></Field>
        <Field label="&nbsp;"><Select value={f.unit} onChange={(e) => set("unit", e.target.value)} options={[{ value: "day", label: "day(s)" }, { value: "week", label: "week(s)" }, { value: "month", label: "month(s)" }, { value: "year", label: "year(s)" }, { value: "once", label: "One time only" }]} /></Field>
        <Field label={task ? "Next due" : "First due"}><Input type="date" value={f.due} onChange={(e) => set("due", e.target.value)} /></Field>
        <Field label="Listing"><Select value={f.listingId} onChange={(e) => set("listingId", e.target.value)} options={[{ value: "", label: "All / general" }, ...listings.map((l) => ({ value: l.id, label: l.name }))]} /></Field>
        <Field label="Who does it" className="col-span-2"><Select value={f.assignee} onChange={(e) => set("assignee", e.target.value)} options={[{ value: "", label: "Me (owner)" }, ...s.me.account.staff.map((x) => ({ value: x.email, label: x.name || x.email }))]} /></Field>
        <Field label="Notes" className="col-span-2"><Textarea value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="Vendor phone, what to check…" /></Field>
      </div>
      <p className="mt-3 text-xs text-muted">The person gets it in their morning email on the due date. When it&apos;s ticked off, the next date is set automatically.</p>
    </Sheet>
  );
}

function Checklist({ c }: { c: Rec }) {
  const s = useStore();
  const { listingName, guestName } = useLookups();
  const b = s.byId.get(c.bookingId);
  const list = (c.items ?? []) as { text: string; done: boolean }[];
  const toggle = async (i: number) => {
    const items = list.map((x, j) => (j === i ? { ...x, done: !x.done } : x));
    const all = items.every((x) => x.done);
    try { await s.save("clean", { items, doneAt: all ? new Date().toISOString() : "", by: all ? s.me.email : "" }, c.id); if (all) s.toast("All clean ✨"); } catch (e) { s.toast((e as Error).message, "bad"); }
  };
  const doneN = list.filter((x) => x.done).length;
  return (
    <Card className={cx(c.doneAt && "opacity-70")}>
      <div className="mb-2 flex items-start justify-between">
        <div><b>{listingName(c.listingId)}</b><p className="text-xs text-muted">After {b ? guestName(b) : "checkout"} · {fmtDay(c.date)}</p></div>
        <Badge tone={c.doneAt ? "ok" : "warn"}>{doneN}/{list.length}</Badge>
      </div>
      {list.map((x, i) => (
        <button key={i} onClick={() => toggle(i)} className="flex w-full items-center gap-2 py-1 text-left text-sm">
          <span className={cx("grid size-5 place-items-center rounded-md border", x.done ? "border-teal bg-teal text-white" : "border-line")}>{x.done && <Check className="size-3.5" />}</span>
          <span className={cx(x.done && "text-muted line-through")}>{x.text}</span>
        </button>
      ))}
    </Card>
  );
}

export function TasksScreen() {
  const s = useStore();
  const [tab, setTab] = useState<"due" | "all" | "cleaning" | "history">("due");
  const [add, setAdd] = useState(false);
  const { listingName } = useLookups();
  const mine = (t: Rec) => s.me.role === "owner" || !t.assignee || t.assignee === s.me.email;
  const tasks = s.of("task").filter((t) => t.active !== false && mine(t)).sort((a, b) => a.due.localeCompare(b.due));
  const soon = addDays(istDay(), 7);
  const due = tasks.filter((t) => t.due <= soon);
  const cleans = s.of("clean").sort((a, b) => (a.doneAt ? 1 : 0) - (b.doneAt ? 1 : 0) || b.date.localeCompare(a.date)).slice(0, 30);
  const runs = s.of("taskrun").sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).slice(0, 60);
  const groupMap = new Map<string, Rec[]>();
  for (const t of tasks) { const k = t.listingId || ""; groupMap.set(k, [...(groupMap.get(k) ?? []), t]); }
  const grouped = [...groupMap];
  if (!s.has("tasks")) return <div><PageHead title="Tasks" /><Locked feature="tasks" /></div>;
  return (
    <div>
      <PageHead title="Tasks" sub="Regular jobs for each listing, with reminders" action={<Button onClick={() => setAdd(true)}><Plus className="size-4" /> Task</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "due", label: `Due soon${due.length ? ` (${due.length})` : ""}` }, { value: "all", label: "All tasks" }, { value: "cleaning", label: "Cleaning" }, { value: "history", label: "History" }]} />
      {tab === "due" && (due.length ? <div className="overflow-hidden rounded-2xl border border-line bg-white">{due.map((t) => <TaskRow key={t.id} t={t} />)}</div>
        : <Empty icon={<CheckCircle2 />} title="Nothing due this week" text="Add regular jobs like AC service, bills or deep cleaning. They come back on schedule." action={<Button onClick={() => setAdd(true)}><Sparkles className="size-4" /> Add a task</Button>} />)}
      {tab === "all" && (grouped.length ? grouped.map(([lid, list]) => (
        <div key={lid} className="mb-4"><h3 className="mb-1.5 text-sm font-semibold text-muted">{lid ? listingName(lid) : "General"}</h3><div className="overflow-hidden rounded-2xl border border-line bg-white">{list.map((t) => <TaskRow key={t.id} t={t} />)}</div></div>
      )) : <Empty icon={<ClipboardList />} title="No tasks yet" />)}
      {tab === "cleaning" && (s.has("cleaning") ? (cleans.length ? <div className="grid gap-3 md:grid-cols-2">{cleans.map((c) => <Checklist key={c.id} c={c} />)}</div>
        : <Empty title="No checklists yet" text="A cleaning checklist appears here on each checkout day. Edit the list for each listing under Listings." />) : <Locked feature="cleaning" />)}
      {tab === "history" && (runs.length ? <div className="overflow-hidden rounded-2xl border border-line bg-white">{runs.map((r) => {
        const t = s.byId.get(r.taskId);
        return <div key={r.id} className="flex items-center justify-between border-b border-line px-4 py-2.5 text-sm last:border-0"><span><b>{t?.title ?? "Task"}</b><span className="text-muted">{r.listingId ? ` · ${listingName(r.listingId)}` : ""}</span></span><span className="text-xs text-muted">{r.status === "skipped" ? "Skipped" : "Done"} {fmtDay(r.date)}{r.due && r.date > r.due ? ` (due ${fmtDay(r.due)})` : ""} · {r.by?.split("@")[0]}</span></div>;
      })}</div> : <Empty title="Nothing done yet" />)}
      {add && <TaskEditor task={null} onClose={() => setAdd(false)} />}
    </div>
  );
}
