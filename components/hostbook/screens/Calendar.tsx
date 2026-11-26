"use client";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { addDays, dayDiff, istDay, type Rec } from "@/lib/hostbook/core";
import { useLookups, useStore } from "../store";
import { Button, Empty, PageHead, cx } from "../ui";
import { BookingEditor } from "./Bookings";
import { go } from "../App";

const W = 44; // px per day
const SRC_COLOR: Record<string, string> = { Airbnb: "bg-[#e8505b]", "Booking.com": "bg-[#1f4fa3]", Direct: "bg-teal", MakeMyTrip: "bg-[#d9534f]", Agoda: "bg-[#6c4fb3]" };

/** All listings on one timeline: listings down the side, days across. Tap a free day to add a booking. */
export function CalendarScreen() {
  const s = useStore();
  const { listings, guestName } = useLookups();
  const [start, setStart] = useState(() => addDays(istDay(), -3));
  const [days, setDays] = useState(21);
  const [add, setAdd] = useState<{ listingId: string; start: string } | null>(null);
  const today = istDay();
  const end = addDays(start, days);
  const cols = Array.from({ length: days }, (_, i) => addDays(start, i));
  const rows = useMemo(() => listings.map((l) => ({
    l, bookings: s.of("booking").filter((b) => b.listingId === l.id && b.status !== "cancelled" && b.start < end && b.end > start),
  })), [listings, s, start, end]);
  if (!listings.length) return <div><PageHead title="Calendar" /><Empty title="Add a listing first" action={<Button onClick={() => go("listings")}>Add listing</Button>} /></div>;
  const occ = (lid: string, d: string) => rows.find((r) => r.l.id === lid)?.bookings.some((b) => b.start <= d && b.end > d);
  return (
    <div>
      <PageHead title="Calendar" sub={`${new Date(start + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${new Date(addDays(end, -1) + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
        action={<div className="flex gap-1">
          <Button tone="soft" size="sm" onClick={() => setStart(addDays(start, -7))} aria-label="Earlier"><ChevronLeft className="size-4" /></Button>
          <Button tone="soft" size="sm" onClick={() => setStart(addDays(today, -3))}>Today</Button>
          <Button tone="soft" size="sm" onClick={() => setStart(addDays(start, 7))} aria-label="Later"><ChevronRight className="size-4" /></Button>
          <Button tone="soft" size="sm" onClick={() => setDays(days === 21 ? 45 : 21)}>{days === 21 ? "6 wks" : "3 wks"}</Button>
        </div>} />
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <div style={{ width: 140 + days * W }}>
          <div className="sticky top-0 flex border-b border-line bg-sand/60 text-[10px]">
            <div className="sticky left-0 z-10 w-[140px] shrink-0 bg-sand px-3 py-2 font-semibold text-muted">Listing</div>
            {cols.map((d) => {
              const dt = new Date(d + "T00:00:00");
              return <div key={d} style={{ width: W }} className={cx("shrink-0 py-1 text-center", d === today && "bg-teal text-white", (dt.getDay() === 0 || dt.getDay() === 6) && d !== today && "bg-ink/[.03]")}>
                <div className="font-semibold">{dt.getDate()}</div><div className="opacity-70">{dt.toLocaleDateString("en-IN", { weekday: "narrow" })}</div>
              </div>;
            })}
          </div>
          {rows.map(({ l, bookings }) => (
            <div key={l.id} className="relative flex h-14 border-b border-line last:border-0">
              <div className="sticky left-0 z-10 flex w-[140px] shrink-0 items-center border-r border-line bg-white px-3 text-sm font-medium"><span className="truncate">{l.name}</span></div>
              {cols.map((d) => (
                <button key={d} style={{ width: W }} disabled={!s.can("bookings")} onClick={() => !occ(l.id, d) && setAdd({ listingId: l.id, start: d })} className={cx("group shrink-0 border-r border-line/60", d === today && "bg-mist/50")} aria-label={`Add booking ${d}`}>
                  {!occ(l.id, d) && <Plus className="mx-auto size-3.5 text-teal opacity-0 group-hover:opacity-60" />}
                </button>
              ))}
              {bookings.map((b: Rec) => {
                // From midday of check-in to midday of check-out, clipped to what's on screen.
                const clip = (v: number) => Math.max(0, Math.min(days, v));
                const a = clip(dayDiff(start, b.start) + 0.5), z = clip(dayDiff(start, b.end) + 0.5);
                const left = 140 + a * W + 2, width = Math.max(8, (z - a) * W - 4);
                return (
                  <a key={b.id} href={`#booking/${b.id}`} style={{ left, width }} className={cx("absolute top-2 flex h-10 items-center overflow-hidden rounded-lg px-2 text-[11px] font-semibold text-white shadow-sm", b.status === "blocked" ? "bg-ink/30" : SRC_COLOR[b.source] ?? "bg-teal")}>
                    <span className="truncate">{b.status === "blocked" ? "Blocked" : guestName(b)}</span>
                  </a>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted">{Object.entries(SRC_COLOR).map(([k, c]) => <span key={k} className="flex items-center gap-1"><i className={cx("size-2.5 rounded-sm", c)} />{k}</span>)}<span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-ink/30" />Blocked</span></div>
      {add && <BookingEditor booking={null} defaults={{ listingId: add.listingId, start: add.start, end: addDays(add.start, 1), source: "Direct" }} onClose={() => setAdd(null)} />}
    </div>
  );
}
