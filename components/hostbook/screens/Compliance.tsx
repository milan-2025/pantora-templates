"use client";
import { useState } from "react";
import { Copy, Download, ExternalLink, Printer } from "lucide-react";
import { addDays, istDay, nights, toCsv, type Rec } from "@/lib/hostbook/core";
import { useLookups, useStore } from "../store";
import { Badge, Button, Card, Empty, Field, Input, Locked, PageHead, Select, Tabs, download, escHtml, fmtDay, printPage } from "../ui";

const foreign = (g?: Rec) => Boolean(g?.nationality) && !/^(india|indian|in)$/i.test(String(g!.nationality).trim());

export function Compliance() {
  const s = useStore();
  const [tab, setTab] = useState<"police" | "formc">("police");
  return (
    <div>
      <PageHead title="Police & Form C" sub="Guest register for local police, and Form C details for foreign guests" />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "police", label: "Police guest register" }, { value: "formc", label: "Form C" }]} />
      {tab === "police" ? (s.has("police") ? <Police /> : <Locked feature="police" />) : s.has("formC") ? <FormC /> : <Locked feature="formC" />}
    </div>
  );
}

function Police() {
  const s = useStore();
  const { listings, listingName } = useLookups();
  const [from, setFrom] = useState(addDays(istDay(), -30)), [to, setTo] = useState(istDay()), [lid, setLid] = useState("");
  const rows: { b: Rec; g: Rec | null }[] = [];
  for (const b of s.of("booking").filter((b) => b.status !== "cancelled" && b.status !== "blocked" && b.start >= from && b.start <= to && (!lid || b.listingId === lid)).sort((a, b) => a.start.localeCompare(b.start))) {
    const ids = (b.guestIds?.length ? b.guestIds : b.guestId ? [b.guestId] : []) as string[];
    if (!ids.length) rows.push({ b, g: null });
    for (const id of ids) rows.push({ b, g: s.byId.get(id) ?? null });
  }
  const showId = s.can("ids");
  const idOf = (g: Rec | null) => (g ? `${g.idType ?? ""} ${showId ? g.idNumber || g.idMasked || "" : g.idMasked || ""}`.trim() : "");
  const header = ["#", "Listing", "Guest name", "Gender / age", "Phone", "Home address", "Nationality", "ID", "Arrival", "Departure", "Nights"];
  const data = rows.map(({ b, g }, i) => [i + 1, listingName(b.listingId), g?.name || b.guestName || "(details missing)", [g?.gender, g?.age].filter(Boolean).join(" / "), g?.phone || b.phone || "", [g?.address, g?.city].filter(Boolean).join(", "), g?.nationality ?? "", idOf(g), fmtDay(b.start, true), fmtDay(b.end, true), nights(b)]);
  const print = () => printPage("Guest register", `<h1>Guest register</h1><p class="muted">${escHtml(s.me.account.business || "")} · ${lid ? escHtml(listingName(lid)) : "All listings"} · arrivals ${fmtDay(from, true)} to ${fmtDay(to, true)}</p>
    <table><tr>${header.map((h) => `<th>${h}</th>`).join("")}</tr>${data.map((r) => `<tr>${r.map((c) => `<td>${escHtml(c)}</td>`).join("")}</tr>`).join("")}</table>
    <p class="muted" style="margin-top:16px">Printed ${new Date().toLocaleString("en-IN")}. Signature of host: ____________________</p>`);
  const missing = rows.filter((r) => !r.g || !r.g.idType).length;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Field label="Arrivals from"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="to"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        {listings.length > 1 && <Field label="Listing"><Select value={lid} onChange={(e) => setLid(e.target.value)} options={[{ value: "", label: "All" }, ...listings.map((l) => ({ value: l.id, label: l.name }))]} /></Field>}
        <div className="ml-auto flex gap-2"><Button tone="soft" onClick={print}><Printer className="size-4" /> Print / PDF</Button><Button tone="soft" onClick={() => download(`guest-register-${from}-${to}.csv`, toCsv([header, ...data]))}><Download className="size-4" /> Excel</Button></div>
      </div>
      {missing > 0 && <p className="mb-3 rounded-xl bg-sun/20 px-3 py-2 text-xs text-[#8a5a10]">{missing} guest{missing === 1 ? " is" : "s are"} missing details or an ID. Send them the check-in link from the booking.</p>}
      {rows.length ? (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[720px] text-sm"><thead className="bg-sand text-left text-xs text-muted"><tr>{header.slice(1).map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>{data.map((r, i) => <tr key={i} className="border-t border-line">{r.slice(1).map((c, j) => <td key={j} className="px-3 py-2">{c}</td>)}</tr>)}</tbody></table>
        </div>
      ) : <Empty title="No arrivals in these dates" />}
    </div>
  );
}

function FormC() {
  const s = useStore();
  const { listingName } = useLookups();
  const stays = s.of("booking").filter((b) => b.status !== "cancelled" && b.end >= addDays(istDay(), -30)).flatMap((b) => ((b.guestIds?.length ? b.guestIds : b.guestId ? [b.guestId] : []) as string[]).map((id) => ({ b, g: s.byId.get(id) })).filter((x) => foreign(x.g)));
  const copy = (v: string) => { navigator.clipboard?.writeText(v); s.toast("Copied"); };
  return (
    <div>
      <Card className="mb-4 bg-mist/60">
        <p className="text-sm">Foreign guests must be reported on Form C within 24 hours of arrival. HostBook lays out each guest&apos;s details with copy buttons; you submit them on the Bureau of Immigration site.</p>
        <a href="https://indianfrro.gov.in/frro/FormC" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-teal">Open the Form C site <ExternalLink className="size-3.5" /></a>
      </Card>
      {stays.length ? stays.map(({ b, g }) => {
        const [given, ...rest] = String(g!.name ?? "").trim().split(/\s+/);
        const fields: [string, string][] = [
          ["Surname", rest.join(" ") || given], ["Given name", rest.length ? given : ""], ["Gender", g!.gender ?? ""], ["Nationality", g!.nationality ?? ""], ["Address in home country", g!.address ?? ""],
          ["Passport no.", s.can("ids") ? g!.passport ?? "" : g!.passport ? "(hidden)" : ""], ["Passport expiry", g!.passportExpiry ?? ""], ["Visa no.", g!.visa ?? ""], ["Visa type", g!.visaType ?? ""], ["Visa valid till", g!.visaExpiry ?? ""],
          ["Arrived from", g!.arrivedFrom ?? ""], ["Arrival in India", g!.arrivalInIndia ?? ""], ["Arrival at your place", b.start], ["Expected departure", b.end], ["Next destination", g!.nextDestination ?? ""], ["Phone", g!.phone ?? ""],
        ];
        return (
          <Card key={`${b.id}-${g!.id}`} className="mb-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div><b>{g!.name}</b><p className="text-xs text-muted">{listingName(b.listingId)} · {fmtDay(b.start)} → {fmtDay(b.end)}</p></div>{fields.some(([, v]) => !v) ? <Badge tone="warn">Some details missing</Badge> : <Badge tone="ok">Ready</Badge>}</div>
            <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
              {fields.map(([k, v]) => <button key={k} disabled={!v} onClick={() => copy(v)} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-left text-sm hover:bg-sand disabled:opacity-50"><span className="text-muted">{k}</span><span className="flex items-center gap-1 truncate font-medium">{v || "—"}{v && <Copy className="size-3 shrink-0 text-muted" />}</span></button>)}
            </div>
            <Button size="sm" tone="ghost" className="mt-2" onClick={() => (location.hash = `guest/${g!.id}`)}>Edit details</Button>
          </Card>
        );
      }) : <Empty title="No foreign guests in the last 30 days" text="When a guest's nationality isn't Indian, they appear here and a Form C task is added." />}
    </div>
  );
}
