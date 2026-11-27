"use client";
import { useState } from "react";
import { ArrowRight, BedDouble, LogIn, LogOut as LogOutIcon, Plus, RefreshCw, Sparkles, Wallet } from "lucide-react";
import { addDays, buildReport, istDay } from "@/lib/hostbook/core";
import { api } from "../api";
import { useLookups, useStore } from "../store";
import { Button, Card, Empty, Stat, fmtDay, money } from "../ui";
import { BookingEditor, BookingRow } from "./Bookings";
import { ExpenseEditor } from "./Money";
import { TaskRow } from "./Tasks";
import { NoticeRow, useNotices } from "./Updates";
import { go } from "../App";

export function Today() {
  const s = useStore();
  const { listings } = useLookups();
  const [addB, setAddB] = useState(false), [addE, setAddE] = useState(false), [syncing, setSyncing] = useState(false);
  const t = istDay(), tm = addDays(t, 1);
  const live = s.of("booking").filter((b) => b.status !== "cancelled" && b.status !== "blocked");
  const ins = live.filter((b) => b.start === t || b.start === tm).sort((a, b) => a.start.localeCompare(b.start));
  const outs = live.filter((b) => b.end === t);
  const now = live.filter((b) => b.start <= t && b.end > t);
  const review = live.filter((b) => b.checkinStatus === "submitted");
  const waiting = live.filter((b) => b.checkinStatus === "changes" && b.end >= t);
  const noDetails = s.has("checkin") ? live.filter((b) => b.start >= t && b.start <= addDays(t, 3) && !b.checkinStatus && !b.guestId) : [];
  const mine = (x: { assignee?: string; [k: string]: unknown }) => s.me.role === "owner" || !x.assignee || x.assignee === s.me.email;
  const tasks = s.has("tasks") && s.can("tasks") ? s.of("task").filter((x) => x.active !== false && x.due <= t && mine(x)).sort((a, b) => a.due.localeCompare(b.due)) : [];
  const cleans = s.has("cleaning") && s.can("tasks") ? s.of("clean").filter((c) => !c.doneAt && c.date >= addDays(t, -3)) : [];
  const low = s.has("inventory") ? s.of("inventory").filter((x) => Number(x.min) > 0 && Number(x.qty) <= Number(x.min)) : [];
  const month = t.slice(0, 7);
  const r = s.can("money") ? buildReport(s.items, `${month}-01`, t) : null;
  const sync = async () => {
    setSyncing(true);
    try { const x = await api("sync", { body: {} }); await s.refresh(); s.toast(`Synced: ${x.added} new, ${x.updated} changed${x.cancelled ? `, ${x.cancelled} cancelled` : ""}${x.errors.length ? `. ${x.errors.length} feed(s) failed` : ""}`, x.errors.length ? "bad" : "ok"); }
    catch (e) { s.toast((e as Error).message, "bad"); } finally { setSyncing(false); }
  };
  const { unread, markRead } = useNotices();
  const hour = new Date().getHours();
  const hasFeeds = listings.some((l) => Array.isArray(l.ical) && l.ical.length);

  if (!listings.length && s.can("owner")) {
    return (
      <div className="mx-auto max-w-xl pt-6 text-center">
        <h1 className="font-serif text-4xl">Welcome to HostBook</h1>
        <p className="mt-2 text-muted">Three quick steps and you&apos;re set.</p>
        <div className="mt-6 space-y-3 text-left">
          {[["1", "Add your first listing", "Name, address, house rules and Wi-Fi. Paste its Airbnb calendar link to bring in bookings automatically."], ["2", "Add or sync bookings", "Every booking gets a check-in link guests fill in with their details and ID."], ["3", "Add regular tasks", "AC service, bills, deep cleaning: they come back on schedule and land in your morning email."]].map(([n, h, p]) => (
            <Card key={n} className="flex gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-teal font-semibold text-white">{n}</span><div><b>{h}</b><p className="text-sm text-muted">{p}</p></div></Card>
          ))}
        </div>
        <Button className="mt-6" onClick={() => go("listings?add=1")}><Plus className="size-4" /> Add my first listing</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="font-serif text-3xl">Good {hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {s.has("ical") && hasFeeds && s.can("bookings") && <Button tone="soft" onClick={sync} disabled={syncing}><RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} /> Sync</Button>}
          {(s.can("expenses") || s.can("money")) && <Button tone="soft" onClick={() => setAddE(true)}><Wallet className="size-4" /> Expense</Button>}
          {s.can("bookings") && listings.length > 0 && <Button onClick={() => setAddB(true)}><Plus className="size-4" /> Booking</Button>}
        </div>
      </div>

      {unread.length > 0 && (
        <section className="mb-5">
          <div className="mb-1.5 flex items-center justify-between"><h2 className="text-sm font-semibold text-ink/70">New updates</h2><span className="flex gap-3"><button onClick={() => markRead()} className="text-xs font-semibold text-muted">Mark all read</button><a href="#updates" className="text-xs font-semibold text-teal">All</a></span></div>
          <div className="overflow-hidden rounded-2xl border border-line bg-white">{unread.slice(0, 4).map((n) => <NoticeRow key={n.id} n={n} onOpen={() => markRead([n.id])} />)}</div>
        </section>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Arriving" value={ins.filter((b) => b.start === t).length} sub={`${ins.filter((b) => b.start === tm).length} tomorrow`} />
        <Stat label="Leaving today" value={outs.length} />
        <Stat label="Staying now" value={now.length} sub={`of ${listings.length} listing${listings.length === 1 ? "" : "s"}`} />
        {r ? <Stat label={`${fmtDay(`${month}-01`).split(" ")[1]} profit so far`} value={money(r.profit)} tone={r.profit >= 0 ? "ok" : "bad"} sub={`${money(r.income)} in · ${money(r.expenses)} out`} /> : <Stat label="Tasks due" value={tasks.length} />}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Arriving" icon={<LogIn className="size-4" />} empty="No check-ins today or tomorrow.">{ins.map((b) => <BookingRow key={b.id} b={b} />)}</Section>
        <Section title="Leaving today" icon={<LogOutIcon className="size-4" />} empty="No check-outs today.">{outs.map((b) => <BookingRow key={b.id} b={b} />)}</Section>
        {review.length > 0 && <Section title="Guest details to review" icon={<Sparkles className="size-4" />}>{review.map((b) => <BookingRow key={b.id} b={b} />)}</Section>}
        {waiting.length > 0 && <Section title="Waiting for guests to fix details" hint="You asked these guests to update their check-in details.">{waiting.map((b) => <BookingRow key={b.id} b={b} />)}</Section>}
        {noDetails.length > 0 && <Section title="Send check-in links" icon={<BedDouble className="size-4" />} hint="Arriving in the next 3 days, no guest details yet.">{noDetails.map((b) => <BookingRow key={b.id} b={b} />)}</Section>}
        {s.has("tasks") && s.can("tasks") && <Section title="Tasks due" action={<a href="#tasks" className="text-xs font-semibold text-teal">All tasks</a>} empty="Nothing due today. 🎉">{tasks.map((x) => <TaskRow key={x.id} t={x} compact />)}</Section>}
        {cleans.length > 0 && <Section title="Cleaning to finish" action={<a href="#tasks" className="text-xs font-semibold text-teal">Open</a>}>{cleans.map((c) => <a href="#tasks" key={c.id} className="flex justify-between border-b border-line px-4 py-3 text-sm last:border-0"><span>{s.byId.get(c.listingId)?.name}</span><span className="text-muted">{(c.items ?? []).filter((i: { done: boolean }) => i.done).length}/{(c.items ?? []).length} done</span></a>)}</Section>}
        {low.length > 0 && <Section title="Running low" action={<a href="#upkeep" className="text-xs font-semibold text-teal">Stock</a>}>{low.map((x) => <div key={x.id} className="flex justify-between border-b border-line px-4 py-3 text-sm last:border-0"><span>{x.name}{x.listingId ? <span className="text-muted"> · {s.byId.get(x.listingId)?.name}</span> : null}</span><b className="text-rust">{x.qty} {x.unit}</b></div>)}</Section>}
      </div>
      {s.me.access.plan.isFree && s.can("owner") && (
        <a href="#plan" className="mt-5 flex items-center justify-between rounded-2xl bg-teal p-4 text-white"><span><b>Unlock profit reports, WhatsApp templates and more</b><br /><span className="text-sm text-white/75">Starter from {money(999)} a year</span></span><ArrowRight className="size-5" /></a>
      )}
      {addB && <BookingEditor booking={null} onClose={() => setAddB(false)} onSaved={(b) => go(`booking/${b.id}`)} />}
      {addE && <ExpenseEditor expense={null} onClose={() => setAddE(false)} />}
    </div>
  );
}

function Section({ title, icon, children, empty, action, hint }: { title: string; icon?: React.ReactNode; children: React.ReactNode; empty?: string; action?: React.ReactNode; hint?: string }) {
  const has = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between"><h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink/70">{icon}{title}</h2>{action}</div>
      {hint && <p className="-mt-1 mb-1.5 text-xs text-muted">{hint}</p>}
      {has ? <div className="overflow-hidden rounded-2xl border border-line bg-white">{children}</div> : <Empty title={empty ?? "Nothing here"} />}
    </section>
  );
}
