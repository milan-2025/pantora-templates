"use client";
/** Hero search: where (with suggestions), guests, type and budget. Submits to /stays/search. */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Search } from "lucide-react";

type Suggestion = { label: string; kind: "city" | "locality" | "type"; count: number };

export function SearchBar({ types, compact = false, initial = {} }: { types: string[]; compact?: boolean; initial?: Record<string, string> }) {
  const router = useRouter();
  const [where, setWhere] = useState(initial.q || initial.city || "");
  const [guests, setGuests] = useState(initial.guests || "");
  const [type, setType] = useState(initial.type || "");
  const [budget, setBudget] = useState(initial.maxPrice || "");
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [showSugs, setShowSugs] = useState(false);
  const pick = useRef<Suggestion | null>(null);

  useEffect(() => {
    if (where.trim().length < 2) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/stays/public?a=suggest&q=${encodeURIComponent(where)}`, { signal: ctl.signal }).then((r) => r.json()).then(setSugs).catch(() => {});
    }, 180);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [where]);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const q = new URLSearchParams();
    const s = pick.current;
    if (s && s.label === where) q.set(s.kind === "city" ? "city" : s.kind === "type" ? "type" : "locality", s.label);
    else if (where.trim()) q.set("q", where.trim());
    if (guests) q.set("guests", guests);
    if (type) q.set("type", type);
    if (budget) q.set("maxPrice", budget);
    router.push(`/stays/search${q.size ? `?${q}` : ""}`);
  }

  return (
    <form onSubmit={submit} role="search" className={`s-card relative grid gap-2 rounded-3xl p-2 sm:grid-cols-[1.6fr_0.8fr_1fr_1fr_auto] sm:items-center sm:rounded-full ${compact ? "" : "shadow-lift"}`}>
      <label className="relative block rounded-2xl px-3 py-1.5 sm:rounded-full hover:bg-neutral-100">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-plum">Where</span>
        <input
          value={where}
          onChange={(e) => { setWhere(e.target.value); pick.current = null; setShowSugs(true); }}
          onFocus={() => setShowSugs(true)}
          onBlur={() => setTimeout(() => setShowSugs(false), 150)}
          placeholder="City, area or society"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
          autoComplete="off"
          aria-autocomplete="list"
        />
        {showSugs && where.trim().length >= 2 && sugs.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl bg-white py-1 shadow-lift sm:w-80" role="listbox">
            {sugs.map((s) => (
              <li key={s.kind + s.label}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { pick.current = s; setWhere(s.label); setShowSugs(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-100">
                  <MapPin className="size-4 text-muted" /> <span className="flex-1">{s.label}</span>
                  <span className="text-xs text-muted">{s.kind === "type" ? "type" : `${s.count} stay${s.count === 1 ? "" : "s"}`}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </label>
      <label className="block rounded-2xl px-3 py-1.5 sm:rounded-full hover:bg-neutral-100">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-plum">Guests</span>
        <input type="number" min={1} max={50} inputMode="numeric" value={guests} onChange={(e) => setGuests(e.target.value)} placeholder="Add guests" className="w-full bg-transparent text-sm outline-none placeholder:text-muted" />
      </label>
      <label className="block rounded-2xl px-3 py-1.5 sm:rounded-full hover:bg-neutral-100">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-plum">Type</span>
        <select value={type} onChange={(e) => setType(e.target.value)} className="w-full bg-transparent text-sm outline-none">
          <option value="">Any type</option>
          {types.map((t) => <option key={t}>{t}</option>)}
        </select>
      </label>
      <label className="block rounded-2xl px-3 py-1.5 sm:rounded-full hover:bg-neutral-100">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-plum">Budget / night</span>
        <select value={budget} onChange={(e) => setBudget(e.target.value)} className="w-full bg-transparent text-sm outline-none">
          <option value="">Any budget</option>
          {[2000, 3000, 5000, 8000, 12000, 20000].map((b) => <option key={b} value={b}>Up to ₹{b.toLocaleString("en-IN")}</option>)}
        </select>
      </label>
      <button type="submit" className="s-btn s-btn-primary h-12 sm:size-12 sm:!p-0" aria-label="Search">
        <Search className="size-5" /> <span className="sm:hidden">Search</span>
      </button>
    </form>
  );
}
