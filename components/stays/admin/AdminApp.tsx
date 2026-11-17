"use client";
/** Stays admin dashboard: shell, navigation, overview. The other screens live in AdminProperties / AdminPanels. */
import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Bell, Building2, CloudOff, History, Home, IndianRupee, Inbox, Loader2, LogOut, Menu, Plus, Settings as Cog, Users, X } from "lucide-react";
import type { Settings } from "@/lib/stays/constants";
import { api, fmtDate } from "../client/api";
import { registerSW, syncQueue, clearDevice } from "./offline";
import { PropertiesScreen, PropertyEditor } from "./AdminProperties";
import { ActivityScreen, EnquiriesScreen, HostsScreen, OfflineScreen, PricingScreen, SettingsScreen } from "./AdminPanels";

export type Amenity = { key: string; label: string; category: string; custom?: boolean };
export type HostRow = { id: string; hostCode: string; name: string; ownerName: string; email: string; phone: string; whatsapp: string; payout: string; notes: string; status: string; hasLogin: boolean; invited: boolean; createdAt: number; lastLoginAt: number | null; total: number; approved: number; pending: number };
type Ctx = { settings: Settings; amenities: Amenity[]; hosts: HostRow[]; me: { name: string; email: string }; online: boolean; reloadBoot: () => Promise<void>; toast: (t: string, ok?: boolean) => void };
const AdminCtx = createContext<Ctx | null>(null);
export const useAdmin = () => useContext(AdminCtx)!;

export function useHash() {
  const [h, setH] = useState("");
  useEffect(() => {
    const on = () => setH(decodeURIComponent(location.hash.slice(1)));
    on();
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return h;
}
export const go = (h: string) => { location.hash = h; };
const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
};

const NAV: [string, string, typeof Home][] = [
  ["", "Overview", Home], ["properties", "Properties", Building2], ["hosts", "Hosts", Users], ["enquiries", "Enquiries", Inbox],
  ["pricing", "Pricing", IndianRupee], ["offline", "Saved offline", CloudOff], ["activity", "Activity", History], ["settings", "Settings", Cog],
];

export function AdminApp() {
  const hash = useHash();
  const [boot, setBoot] = useState<Omit<Ctx, "online" | "reloadBoot" | "toast"> | null>(null);
  const [err, setErr] = useState("");
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [toastMsg, setToast] = useState<{ t: string; ok: boolean } | null>(null);
  const [nav, setNav] = useState(false);
  const toast = useCallback((t: string, ok = true) => { setToast({ t, ok }); setTimeout(() => setToast(null), 3500); }, []);

  const reloadBoot = useCallback(async () => {
    try {
      const [s, hosts] = await Promise.all([api<{ settings: Settings; amenities: Amenity[]; me: { name: string; email: string } }>("admin", "settings"), api<HostRow[]>("admin", "hosts")]);
      setBoot({ settings: s.settings, amenities: s.amenities, me: s.me, hosts });
      setErr("");
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  useEffect(() => {
    registerSW();
    const on = () => { syncQueue().then((r) => r.sent && toast(`Synced ${r.sent} offline change${r.sent === 1 ? "" : "s"}`)); reloadBoot(); };
    const msg = (e: MessageEvent) => { if (e.data?.type === "stays-sync") syncQueue(); };
    window.addEventListener("online", on);
    navigator.serviceWorker?.addEventListener("message", msg);
    // First load: data arrives asynchronously (state is set after the awaits).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (navigator.onLine) { reloadBoot(); syncQueue(); } else location.hash = "offline";
    return () => { window.removeEventListener("online", on); navigator.serviceWorker?.removeEventListener("message", msg); };
  }, [reloadBoot, toast]);

  const route = hash.split("?")[0].split("/");
  const section = route[0] === "p" || route[0] === "new" ? "properties" : route[0];

  // Offline (or not yet loaded while offline): only the saved-offline screen can work.
  if (!boot) {
    if (!online || hash === "offline") return <Shell section="offline" nav={nav} setNav={setNav} online={online} toastMsg={toastMsg}><OfflineScreen standalone /></Shell>;
    if (err) return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div><p className="text-coral">{err}</p>{/sign-in/i.test(err) && <Link className="s-btn s-btn-primary mt-4" href="/admin/login?redirect=%2Fstays%2Fadmin">Sign in</Link>}</div>
      </div>
    );
    return <div className="grid min-h-dvh place-items-center"><Loader2 className="size-6 animate-spin text-plum" /></div>;
  }

  const ctx: Ctx = { ...boot, online, reloadBoot, toast };
  return (
    <AdminCtx.Provider value={ctx}>
      <Shell section={section} nav={nav} setNav={setNav} online={online} toastMsg={toastMsg} me={boot.me}>
        {route[0] === "p" && route[1] ? <PropertyEditor key={route[1]} id={route[1]} />
          : route[0] === "new" ? <PropertyEditor key="new" id={null} />
          : section === "properties" ? <PropertiesScreen />
          : section === "hosts" ? <HostsScreen />
          : section === "enquiries" ? <EnquiriesScreen />
          : section === "pricing" ? <PricingScreen />
          : section === "settings" ? <SettingsScreen />
          : section === "offline" ? <OfflineScreen />
          : section === "activity" ? <ActivityScreen />
          : <Overview />}
      </Shell>
    </AdminCtx.Provider>
  );
}

function Shell({ section, children, nav, setNav, online, toastMsg, me }: { section: string; children: React.ReactNode; nav: boolean; setNav: (b: boolean) => void; online: boolean; toastMsg: { t: string; ok: boolean } | null; me?: { name: string } }) {
  async function signOut() {
    if (!confirm("Sign out and remove saved offline listings from this device?")) return;
    await clearDevice();
    // A full page load is needed so Payload clears its login cookie.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    location.assign(`${location.origin}/admin/logout`);
  }
  const links = (
    <nav className="flex flex-col gap-0.5 p-3">
      {NAV.map(([h, label, I]) => (
        <a key={h} href={`#${h}`} onClick={() => setNav(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${section === h ? "bg-plum text-white" : "text-plum hover:bg-plum/5"}`}><I className="size-4" />{label}</a>
      ))}
      <a href="#new" onClick={() => setNav(false)} className="s-btn s-btn-accent s-btn-sm mt-3"><Plus className="size-4" /> Add property</a>
      <div className="mt-6 border-t border-line pt-3 text-xs text-muted">
        <Link href="/stays" target="_blank" className="block rounded-lg px-3 py-1.5 hover:bg-plum/5">Open public site ↗</Link>
        <Link href="/admin" className="block rounded-lg px-3 py-1.5 hover:bg-plum/5">Main website admin</Link>
        <button type="button" onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left hover:bg-plum/5"><LogOut className="size-3.5" /> Sign out{me ? ` (${me.name})` : ""}</button>
      </div>
    </nav>
  );
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh overflow-y-auto border-r border-line bg-paper lg:block">
        <div className="flex h-16 items-center gap-2 border-b border-line px-5"><span className="grid size-8 place-items-center rounded-xl bg-plum font-display text-marigold">S</span><span className="font-display text-xl text-plum">Stays admin</span></div>
        {links}
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-cream/95 px-4 backdrop-blur lg:hidden">
          <button type="button" onClick={() => setNav(true)} className="rounded-lg p-2 text-plum" aria-label="Menu"><Menu className="size-5" /></button>
          <span className="font-display text-lg text-plum">Stays admin</span>
          <a href="#new" className="rounded-lg p-2 text-plum" aria-label="Add property"><Plus className="size-5" /></a>
        </header>
        {nav && (
          <div className="fixed inset-0 z-50 bg-plum/40 lg:hidden" onClick={() => setNav(false)}>
            <div className="h-full w-72 overflow-y-auto bg-paper" onClick={(e) => e.stopPropagation()}>
              <div className="flex h-14 items-center justify-between border-b border-line px-4"><span className="font-display text-lg text-plum">Menu</span><button type="button" onClick={() => setNav(false)} aria-label="Close"><X className="size-5" /></button></div>
              {links}
            </div>
          </div>
        )}
        {!online && <div className="bg-charcoal px-4 py-2 text-center text-sm text-white">You&apos;re offline. Saved listings are available; edits will sync when you&apos;re back online.</div>}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
      </div>
      {toastMsg && <div role="status" className={`fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-full px-4 py-2.5 text-sm shadow-lift ${toastMsg.ok ? "bg-plum text-white" : "bg-coral text-white"}`}>{toastMsg.t}</div>}
    </div>
  );
}

type OverviewData = {
  counts: Record<string, number>;
  recentSubmissions: { id: string; code: string; title: string; statusLabel: string; host: { name: string } | null; updatedAt: number }[];
  recentUpdates: { id: string; code: string; title: string; statusLabel: string; updatedAt: number }[];
  recentEnquiries: { _id: string; kind: string; type: string; code: string | null; title: string; createdAt: number; status: string; guestName?: string }[];
  notifications: { _id: string; at: number; text: string; propertyId: string | null }[];
};

function Overview() {
  const { toast } = useAdmin();
  const [d, setD] = useState<OverviewData | null>(null);
  const load = useCallback(() => api<OverviewData>("admin", "overview").then(setD).catch((e) => toast(e.message, false)), [toast]);
  useEffect(() => { load(); }, [load]);
  if (!d) return <div className="grid gap-3 sm:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="s-skeleton h-24" />)}</div>;
  const c = d.counts;
  const tiles: [string, number, string, string?][] = [
    ["Total properties", c.total, "properties"], ["My own", c.own, "properties?ownership=own"], ["Other hosts'", c.host, "properties?ownership=host"],
    ["Published", c.published, "properties?status=published"], ["Unlisted", c.unlisted, "properties?visibility=unlisted"], ["Pending approval", c.pending, "properties?status=pending", c.pending ? "warn" : undefined],
    ["Inactive", c.inactive, "properties?status=inactive"], ["Registered hosts", c.hosts, "hosts"],
  ];
  const alerts = [
    c.pending && [`${c.pending} propert${c.pending === 1 ? "y is" : "ies are"} waiting for approval`, "properties?status=pending"],
    c.hostChanges && [`${c.hostChanges} propert${c.hostChanges === 1 ? "y has" : "ies have"} host edits or photos to review`, "properties?review=1"],
    c.publishRequests && [`${c.publishRequests} publication request${c.publishRequests === 1 ? "" : "s"} from hosts`, "properties?review=1"],
    c.missingPrices && [`${c.missingPrices} propert${c.missingPrices === 1 ? "y is" : "ies are"} missing prices`, "pricing"],
  ].filter(Boolean) as [string, string][];
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-3xl">Overview</h1><p className="text-sm text-muted">{c.enquiries30} enquiries in the last 30 days</p></div>
        <a href="#new" className="s-btn s-btn-primary"><Plus className="size-4" /> Add property</a>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([label, n, href, tone]) => (
          <a key={label} href={`#${href}`} className={`s-card rounded-2xl p-4 hover:shadow-lift ${tone ? "ring-2 ring-marigold" : ""}`}>
            <p className="text-xs font-medium text-muted">{label}</p>
            <p className="mt-1 font-display text-3xl text-plum">{n}</p>
          </a>
        ))}
      </div>
      {alerts.length > 0 && (
        <ul className="space-y-2">
          {alerts.map(([t, h]) => <li key={t}><a href={`#${h}`} className="flex items-center gap-2 rounded-2xl bg-sand px-4 py-3 text-sm font-medium text-marigold-deep hover:underline"><Bell className="size-4" />{t} →</a></li>)}
        </ul>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Recent submissions">
          {d.recentSubmissions.length ? d.recentSubmissions.map((p) => <Row key={p.id} href={`p/${p.id}`} title={`${p.code} · ${p.title || "Untitled"}`} sub={`${p.statusLabel}${p.host ? ` · ${p.host.name}` : ""}`} />) : <Empty>No submissions yet.</Empty>}
        </Panel>
        <Panel title="Recently updated">
          {d.recentUpdates.map((p) => <Row key={p.id} href={`p/${p.id}`} title={`${p.code} · ${p.title || "Untitled"}`} sub={`${p.statusLabel} · ${fmtDate(p.updatedAt)}`} />)}
          {!d.recentUpdates.length && <Empty>Nothing yet. <a href="#new" className="underline">Add your first property</a>.</Empty>}
        </Panel>
        <Panel title="Recent enquiries" more="enquiries">
          {d.recentEnquiries.length ? d.recentEnquiries.map((e) => <Row key={e._id} href="enquiries" title={`${e.code || "General"} · ${e.title || e.guestName || ""}`} sub={`${e.kind === "click" ? "Button click" : "Recorded"} · ${e.type} · ${fmtDate(e.createdAt)}`} />) : <Empty>No enquiries yet.</Empty>}
        </Panel>
      </div>
      {d.notifications.length > 0 && (
        <Panel title="Notifications" action={<button type="button" className="text-xs text-plum underline" onClick={() => api("admin", "notifications_read", {}).then(load)}>Mark all read</button>}>
          {d.notifications.map((n) => <Row key={n._id} href={n.propertyId ? `p/${n.propertyId}` : "hosts"} title={n.text} sub={fmtDate(n.at)} />)}
        </Panel>
      )}
    </div>
  );
}

export function Panel({ title, children, more, action }: { title: string; children: React.ReactNode; more?: string; action?: React.ReactNode }) {
  return (
    <section className="s-card rounded-2xl">
      <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="font-sans text-sm font-semibold text-plum">{title}</h2>{action}{more && <a href={`#${more}`} className="text-xs text-plum underline">See all</a>}</div>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}
function Row({ href, title, sub }: { href: string; title: string; sub: string }) {
  return <a href={`#${href}`} className="block px-4 py-2.5 hover:bg-cream"><p className="truncate text-sm font-medium text-plum">{title}</p><p className="truncate text-xs text-muted">{sub}</p></a>;
}
export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-center text-sm text-muted">{children}</p>;
}
