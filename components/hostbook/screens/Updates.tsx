"use client";
import { useEffect } from "react";
import { Bell, BellRing } from "lucide-react";
import type { Rec } from "@/lib/hostbook/core";
import { api } from "../api";
import { useStore } from "../store";
import { Button, Empty, PageHead, cx } from "../ui";
import { usePush } from "./Settings";

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
};

export function useNotices() {
  const s = useStore();
  const list = s.of("notice").sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  const unread = list.filter((n) => !n.read);
  const markRead = async (ids?: string[]) => {
    const target = ids ?? unread.map((n) => n.id);
    if (!target.length) return;
    for (const id of target) { const n = s.byId.get(id); if (n) s.put({ ...n, read: true }); }
    await api("notices/read", { body: { ids: ids ?? null } }).catch(() => null);
  };
  return { list, unread, markRead };
}

export function NoticeRow({ n, onOpen }: { n: Rec; onOpen?: () => void }) {
  return (
    <a href={n.link ? `#${n.link}` : undefined} onClick={onOpen} className={cx("flex gap-3 border-b border-line px-4 py-3 last:border-0", !n.read && "bg-mist/40")}>
      <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-teal")} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{n.title}</span>
        {n.text && <span className="line-clamp-2 block text-xs text-muted">{n.text}</span>}
        <span className="mt-0.5 block text-[11px] text-muted">{ago(n.createdAt)}</span>
      </span>
    </a>
  );
}

export function BellLink({ className }: { className?: string }) {
  const { unread } = useNotices();
  return (
    <a href="#updates" className={cx("relative grid size-9 place-items-center rounded-full hover:bg-ink/5", className)} aria-label={`Notifications${unread.length ? `, ${unread.length} new` : ""}`}>
      <Bell className="size-5" />
      {unread.length > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-rust px-1 text-[10px] font-bold leading-4 text-white">{unread.length > 9 ? "9+" : unread.length}</span>}
    </a>
  );
}

export function Updates() {
  const { list, unread, markRead } = useNotices();
  const push = usePush();
  // Opening the list counts as seeing them; the dots stay until the next visit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(() => markRead(), 1500); return () => clearTimeout(t); }, []);
  return (
    <div className="max-w-2xl">
      <PageHead title="Notifications" sub={unread.length ? `${unread.length} new` : "You're all caught up"} />
      {push.supported && !push.on && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
          <BellRing className="size-6 shrink-0 text-teal" />
          <p className="flex-1 text-sm">Get these on this phone too, even when HostBook is closed.</p>
          <Button size="sm" onClick={push.enable} disabled={push.busy}>Turn on</Button>
        </div>
      )}
      {list.length ? <div className="overflow-hidden rounded-2xl border border-line bg-white">{list.map((n) => <NoticeRow key={n.id} n={n} />)}</div>
        : <Empty icon={<Bell />} title="No notifications yet" text="Guest details coming in, new synced bookings, today's check-ins and tasks will show up here." />}
    </div>
  );
}
