"use client";
/** Pandora HostBook app (/hostbook/app): sign-in, the shell with navigation, and the screens. */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BedDouble, CalendarDays, ChevronRight, ClipboardList, Home, IndianRupee, Loader2, LogOut, Menu, MessageCircle, Package, Settings as Cog, ShieldCheck, Sparkles, Users, Users2, WifiOff, Building2, Globe } from "lucide-react";
import { api, ApiError, session } from "./api";
import { StoreProvider, useStore, type Me } from "./store";
import { Button, Field, Input, cx } from "./ui";
import { Today } from "./screens/Today";
import { CalendarScreen } from "./screens/Calendar";
import { Bookings, BookingDetail } from "./screens/Bookings";
import { Guests, GuestDetail } from "./screens/Guests";
import { MoneyScreen } from "./screens/Money";
import { TasksScreen } from "./screens/Tasks";
import { Listings } from "./screens/Listings";
import { Compliance } from "./screens/Compliance";
import { Upkeep } from "./screens/Upkeep";
import { Templates } from "./screens/Templates";
import { Team } from "./screens/Team";
import { PlanScreen, UpsellSheet } from "./screens/Plan";
import { SettingsScreen, shareTokenWithWorker } from "./screens/Settings";
import { WebsiteScreen } from "./screens/Website";
import { BellLink, Updates } from "./screens/Updates";

export function useRoute() {
  const [h, setH] = useState("today");
  useEffect(() => {
    const on = () => setH(location.hash.slice(1) || "today");
    on();
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return h;
}
export const go = (r: string) => { location.hash = r; window.scrollTo({ top: 0 }); };

export function HostBookApp() {
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<"loading" | "out" | "in">("loading");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    if (!session.token()) { setState("out"); return; }
    const fetchMe = async () => {
      const m = await api<Me & { token?: string }>("me");
      if (m.token) session.setToken(m.token);
      if (!session.account()) session.setAccount(m.account.id);
      shareTokenWithWorker();
      setMe(m); setState("in");
    };
    try {
      await fetchMe().catch(async (e) => {
        // Removed from the team this device was on: fall back to their own account.
        if (e instanceof ApiError && e.status === 403 && session.account()) { session.setAccount(null); return fetchMe(); }
        throw e;
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { session.setToken(null); setState("out"); }
      else { setErr((e as Error).message); setState("out"); }
    }
  }, []);

  useEffect(() => {
    // Opened from the Pandora Stays host portal: sign in with the Stays session.
    const q = new URLSearchParams(location.search);
    const via = q.get("via");
    const ref = q.get("utm_source") || q.get("ref");
    if (ref) try { sessionStorage.setItem("hb_source", ref); } catch { /* ignore */ }
    if (via === "stays") {
      api<{ token: string }>("auth/stays", { body: {} })
        .then((r) => { session.setToken(r.token); session.setAccount(null); history.replaceState(null, "", location.pathname + location.hash); load(); })
        .catch((e) => { setErr(e.message); load(); });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load: who is signed in on this device
    } else load();
    const out = () => { session.setToken(null); setState("out"); };
    window.addEventListener("hb-signed-out", out);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/hostbook-sw.js", { scope: "/hostbook/" }).catch(() => null);
    return () => window.removeEventListener("hb-signed-out", out);
  }, [load]);

  if (state === "loading") return <div className="grid min-h-dvh place-items-center"><Loader2 className="size-6 animate-spin text-teal" /></div>;
  if (state === "out" || !me) return <Auth error={err} onIn={() => { setErr(""); load(); }} />;
  return (
    <StoreProvider key={me.account.id} me={me}>
      <Shell onSwitch={(id) => { session.setAccount(id); setState("loading"); load(); }} onOut={() => { session.clear(); setMe(null); setState("out"); }} />
    </StoreProvider>
  );
}

/* ---------------- sign in / sign up ---------------- */

function Auth({ onIn, error }: { onIn: () => void; error?: string }) {
  const signupFirst = typeof location !== "undefined" && /signup/.test(location.search + location.hash);
  const [mode, setMode] = useState<"in" | "up">(signupFirst ? "up" : "in");
  const [step, setStep] = useState<"email" | "code" | "password">("email");
  const [email, setEmail] = useState(""), [code, setCode] = useState(""), [pw, setPw] = useState("");
  const [business, setBusiness] = useState(""), [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState(error ?? "");

  const sendCode = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await api<{ devCode?: string }>("auth/start", { body: { email } });
      setStep("code");
      if (r.devCode) setCode(r.devCode);
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  const finish = (token: string) => { session.setToken(token); session.setAccount(null); onIn(); };
  const verify = async () => {
    setBusy(true); setMsg("");
    let source = ""; try { source = sessionStorage.getItem("hb_source") ?? ""; } catch { /* ignore */ }
    try { const r = await api<{ token: string }>("auth/verify", { body: { email, code, signup: mode === "up", business, phone, source } });
      if (mode === "up") (window as { ptTrack?: (e: string, p?: object) => void }).ptTrack?.("CompleteRegistration", { currency: "INR" });
      finish(r.token); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  const withPassword = async () => {
    setBusy(true); setMsg("");
    try { const r = await api<{ token: string }>("auth/password", { body: { email, password: pw } }); finish(r.token); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-[radial-gradient(ellipse_at_top,var(--mist),var(--sand)_60%)] p-5">
      <div className="w-full max-w-sm">
        <Link href="/hostbook" className="mb-6 flex items-center justify-center gap-2"><Logo /><span className="font-serif text-2xl">HostBook</span></Link>
        <div className="rounded-3xl border border-line bg-white p-6 shadow-sm">
          <div className="mb-5 grid grid-cols-2 rounded-full bg-sand p-1 text-sm font-semibold">
            {(["in", "up"] as const).map((m) => <button key={m} onClick={() => { setMode(m); setStep("email"); }} className={cx("rounded-full py-2", mode === m ? "bg-white shadow-sm" : "text-muted")}>{m === "in" ? "Sign in" : "Create account"}</button>)}
          </div>
          {step === "email" && (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); sendCode(); }}>
              {mode === "up" && <>
                <Field label="Business or home name"><Input value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="e.g. Pine View Stays" /></Field>
                <Field label="Phone (WhatsApp)"><Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="98765 43210" /></Field>
              </>}
              <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></Field>
              <Button className="w-full" disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : "Email me a code"}</Button>
              {mode === "in" && <button type="button" onClick={() => setStep("password")} className="w-full text-center text-xs text-muted underline">Use my password instead</button>}
              {mode === "up" && <p className="text-center text-[11px] text-muted">Free for one listing. No card needed.</p>}
            </form>
          )}
          {step === "code" && (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); verify(); }}>
              <p className="text-sm text-muted">We sent a 6-digit code to <b className="text-ink">{email}</b>.</p>
              <Input autoFocus inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="text-center text-2xl tracking-[.5em]" placeholder="••••••" />
              <Button className="w-full" disabled={busy || code.length !== 6}>{busy ? <Loader2 className="size-4 animate-spin" /> : mode === "up" ? "Create my HostBook" : "Sign in"}</Button>
              <button type="button" onClick={() => setStep("email")} className="w-full text-center text-xs text-muted underline">Use a different email</button>
            </form>
          )}
          {step === "password" && (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); withPassword(); }}>
              <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
              <Field label="Password"><Input type="password" required value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></Field>
              <Button className="w-full" disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}</Button>
              <button type="button" onClick={() => setStep("email")} className="w-full text-center text-xs text-muted underline">Email me a code instead</button>
            </form>
          )}
          {msg && <p className="mt-3 rounded-xl bg-rust/10 px-3 py-2 text-sm text-rust">{msg}</p>}
        </div>
        <p className="mt-4 text-center text-xs text-muted">Host on Pandora Stays? <Link className="underline" href="/stays/host">Open it from your host portal</Link> to get it free.</p>
      </div>
    </div>
  );
}

export function Logo({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="#1F5F5B" />
      <path d="M10 19.5 20 11l10 8.5V29a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 10 29z" fill="#F6F1E9" />
      <path d="M16 30.5v-7h8v7" fill="#E9A23B" />
      <circle cx="20" cy="18.5" r="2" fill="#1F5F5B" />
    </svg>
  );
}

/* ---------------- shell ---------------- */

type NavItem = { r: string; label: string; icon: React.ReactNode; show: boolean };

function Shell({ onSwitch, onOut }: { onSwitch: (id: string) => void; onOut: () => void }) {
  const s = useStore();
  const route = useRoute();
  const [path, query = ""] = route.split("?");
  const [section, id] = path.split("/");
  const { me, can } = s;
  const main: NavItem[] = [
    { r: "today", label: "Today", icon: <Home className="size-5" />, show: true },
    { r: "calendar", label: "Calendar", icon: <CalendarDays className="size-5" />, show: can("bookings") },
    { r: "bookings", label: "Bookings", icon: <BedDouble className="size-5" />, show: can("bookings") },
    { r: "guests", label: "Guests", icon: <Users className="size-5" />, show: can("guests") },
    { r: "money", label: "Money", icon: <IndianRupee className="size-5" />, show: can("money") || can("expenses") },
    { r: "tasks", label: "Tasks", icon: <ClipboardList className="size-5" />, show: can("tasks") },
  ].filter((x) => x.show);
  const more: NavItem[] = [
    { r: "listings", label: "Listings", icon: <Building2 className="size-5" />, show: can("bookings") },
    { r: "website", label: "Website", icon: <Globe className="size-5" />, show: can("owner") },
    { r: "compliance", label: "Police & Form C", icon: <ShieldCheck className="size-5" />, show: can("guests") },
    { r: "upkeep", label: "Stock & upkeep", icon: <Package className="size-5" />, show: can("tasks") },
    { r: "templates", label: "WhatsApp messages", icon: <MessageCircle className="size-5" />, show: can("bookings") },
    { r: "team", label: "Team", icon: <Users2 className="size-5" />, show: can("owner") },
    { r: "plan", label: "Plan", icon: <Sparkles className="size-5" />, show: can("owner") },
    { r: "settings", label: "Settings", icon: <Cog className="size-5" />, show: true },
  ].filter((x) => x.show);
  const phoneNav = main.slice(0, 4);
  const active = (r: string) => section === r || (r === "bookings" && section === "booking") || (r === "guests" && section === "guest");

  const screen = (() => {
    switch (section) {
      case "calendar": return <CalendarScreen />;
      case "bookings": return <Bookings />;
      case "booking": return <BookingDetail id={id} />;
      case "guests": return <Guests key={query} query={query} />;
      case "guest": return <GuestDetail id={id} />;
      case "money": return <MoneyScreen />;
      case "tasks": return <TasksScreen />;
      case "listings": return <Listings key={query} query={query} />;
      case "website": return <WebsiteScreen />;
      case "compliance": return <Compliance />;
      case "upkeep": return <Upkeep />;
      case "templates": return <Templates />;
      case "team": return <Team />;
      case "plan": return <PlanScreen />;
      case "settings": return <SettingsScreen onSwitch={onSwitch} onOut={onOut} />;
      case "updates": return <Updates />;
      case "more": return <MoreScreen items={[...main.slice(4), ...more]} onOut={onOut} />;
      default: return <Today />;
    }
  })();

  return (
    <div className="min-h-dvh md:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-white/70 p-3 md:flex">
        <div className="mb-4 flex items-center justify-between gap-1">
          <a href="#today" className="flex min-w-0 items-center gap-2 px-2 py-1"><Logo className="size-8" /><div className="min-w-0"><div className="font-serif text-xl leading-none">HostBook</div><div className="max-w-28 truncate text-[11px] text-muted">{me.account.business || me.email}</div></div></a>
          <BellLink />
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto">
          {[...main, ...more].map((n, i) => (
            <div key={n.r}>
              {i === main.length && <div className="mx-2 my-2 border-t border-line" />}
              <a href={`#${n.r}`} className={cx("flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium", active(n.r) ? "bg-teal text-white" : "text-ink/75 hover:bg-ink/5")}>{n.icon}{n.label}</a>
            </div>
          ))}
        </nav>
        <PlanPill />
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-sand/90 px-4 py-2.5 backdrop-blur md:hidden">
          <a href="#today" className="flex items-center gap-2"><Logo className="size-7" /><span className="max-w-48 truncate font-serif text-lg">{me.account.business || "HostBook"}</span></a>
          <div className="flex items-center gap-1"><BellLink /><PlanPill small /></div>
        </header>
        {s.offline && <div className="flex items-center justify-center gap-2 bg-sun/25 px-4 py-1.5 text-xs font-medium text-[#8a5a10]"><WifiOff className="size-3.5" /> Offline: showing what was saved on this phone. Changes need internet.</div>}
        <main className="mx-auto max-w-5xl px-4 pb-28 pt-4 md:px-8 md:pb-10 md:pt-8">{screen}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {phoneNav.map((n) => (
          <a key={n.r} href={`#${n.r}`} className={cx("flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold", active(n.r) ? "text-teal" : "text-ink/50")}>{n.icon}{n.label}</a>
        ))}
        <a href="#more" className={cx("flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold", section === "more" || (!phoneNav.some((n) => active(n.r)) && section !== "today") ? "text-teal" : "text-ink/50")}><Menu className="size-5" />More</a>
      </nav>
      <UpsellSheet />
    </div>
  );
}

function PlanPill({ small }: { small?: boolean }) {
  const { me } = useStore();
  const p = me.access.plan;
  const [now] = useState(() => Date.now());
  const days = me.access.expiresAt ? Math.ceil((Date.parse(me.access.expiresAt) - now) / 864e5) : null;
  return (
    <a href={me.role === "owner" ? "#plan" : "#settings"} className={cx("flex items-center gap-2 rounded-xl", small ? "rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold" : "border border-line bg-white p-3 text-xs")}>
      <Sparkles className="size-3.5 text-sun" />
      <span><b>{p.name}</b>{!small && me.access.viaStays && " · via Pandora Stays"}{!small && days !== null && days <= 30 && <span className="text-rust"> · ends in {days}d</span>}</span>
      {!small && p.isFree && me.role === "owner" && <span className="ml-auto text-teal">Upgrade</span>}
    </a>
  );
}

function MoreScreen({ items, onOut }: { items: NavItem[]; onOut: () => void }) {
  const { me } = useStore();
  return (
    <div>
      <h1 className="mb-1 font-serif text-3xl">More</h1>
      <p className="mb-4 text-sm text-muted">{me.email}{me.role === "staff" && " · team member"}</p>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {items.map((n) => (
          <a key={n.r} href={`#${n.r}`} className="flex items-center gap-3 border-b border-line px-4 py-3.5 text-sm font-medium last:border-0">{n.icon}<span className="flex-1">{n.label}</span><ChevronRight className="size-4 text-muted" /></a>
        ))}
      </div>
      <Button tone="ghost" className="mt-4 w-full" onClick={onOut}><LogOut className="size-4" /> Sign out</Button>
    </div>
  );
}
