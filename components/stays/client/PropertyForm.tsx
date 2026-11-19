"use client";
/**
 * The property form, shared by the host portal and the admin dashboard. `role` decides which sections show:
 * hosts never see guest prices, margins, visibility or admin notes (and the server ignores them if sent anyway).
 */
import { useId, useMemo, useState } from "react";
import { ChevronDown, Crosshair, Loader2 } from "lucide-react";
import { AMENITY_CATEGORIES } from "@/lib/stays/constants";
import { coordsFromMapsUrl, inr, margins } from "@/lib/stays/core";
import MapView from "../MapView";
import { api } from "./api";

type Pair = { weekday: number | null; weekend: number | null };
export type RoomVal = { id: string; name: string; description: string; amenities: string[] };
const newRoomId = () => "r" + Math.random().toString(36).slice(2, 10);
const ROOM_PRESETS = ["Living room", "Bedroom 1", "Bedroom 2", "Bedroom 3", "Kitchen", "Bathroom", "Balcony", "Dining area", "Pool", "Garden", "Terrace", "Entrance"];
export type FormVal = {
  title: string; shortDescription: string; description: string; propertyType: string; category: string;
  location: { address: string; society: string; street: string; locality: string; city: string; state: string; pin: string; country: string; lat: number | null; lng: number | null; mapsUrl: string };
  rooms: Record<string, number | boolean | string | null>;
  amenities: string[]; features: string[];
  policies: Record<string, string | boolean | null>;
  landing: Pair; listing: Pair; airbnbUrl: string; hostNotes: string;
  roomList: RoomVal[]; contactName: string; contactPhone: string; slugText: string;
  // admin only
  ownership: "own" | "host"; hostId: string; visibility: "public" | "unlisted" | "private"; availability: "available" | "limited" | "unavailable";
  featured: boolean; showPrice: boolean; showSociety: boolean; adminNotes: string; ownerName: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export function toForm(p: any): FormVal {
  const L = p?.location || {};
  return {
    title: p?.title || "", shortDescription: p?.shortDescription || "", description: p?.description || "", propertyType: p?.propertyType || "", category: p?.category || "",
    location: { address: L.address || "", society: L.society || "", street: L.street || "", locality: L.locality || "", city: L.city || "", state: L.state || "", pin: L.pin || "", country: L.country || "India", lat: L.lat ?? null, lng: L.lng ?? null, mapsUrl: L.mapsUrl || "" },
    rooms: { ...(p?.rooms || {}) }, amenities: [...(p?.amenities || [])], features: [...(p?.features || [])], policies: { ...(p?.policies || {}) },
    landing: { ...(p?.pricing?.landing || p?.landing || { weekday: null, weekend: null }) },
    listing: { ...(p?.pricing?.listing || { weekday: null, weekend: null }) },
    airbnbUrl: p?.airbnbUrl || "", hostNotes: p?.hostNotes || "",
    roomList: (p?.roomList || []).map((x: RoomVal) => ({ ...x, amenities: [...(x.amenities || [])] })), contactName: p?.contactName || "", contactPhone: p?.contactPhone || "", slugText: p?.slugText || "",
    ownership: p?.ownership || "own", hostId: p?.hostId || "", visibility: p?.visibility || "public", availability: p?.availability || "available",
    featured: !!p?.featured, showPrice: p?.showPrice !== false, showSociety: L.showSociety !== false, adminNotes: p?.adminNotes || "", ownerName: p?.ownerName || "",
  };
}
export function toPayload(v: FormVal, role: "host" | "admin") {
  const common = { title: v.title, shortDescription: v.shortDescription, description: v.description, propertyType: v.propertyType, category: v.category, location: v.location, rooms: v.rooms, amenities: v.amenities, features: v.features, policies: v.policies, airbnbUrl: v.airbnbUrl, roomList: v.roomList, contactName: v.contactName, contactPhone: v.contactPhone };
  if (role === "host") return { ...common, landing: v.landing, hostNotes: v.hostNotes };
  return { ...common, ownership: v.ownership, hostId: v.hostId, visibility: v.visibility, availability: v.availability, featured: v.featured, showPrice: v.showPrice, showSociety: v.showSociety, pricing: { landing: v.landing, listing: v.listing }, adminNotes: v.adminNotes, ownerName: v.ownerName, slugText: v.slugText };
}

type Opts = { propertyTypes: string[]; categories: string[]; features: string[]; map: { tileUrl: string; attribution: string; defaultLat: number; defaultLng: number; defaultZoom: number } };

export function PropertyForm({ role, value, onChange, amenities, opts, hosts, code }: {
  role: "host" | "admin"; value: FormVal; onChange: (v: FormVal) => void; code?: string;
  amenities: { key: string; label: string; category: string }[]; opts: Opts; hosts?: { id: string; name: string; hostCode: string }[];
}) {
  const v = value;
  const set = (patch: Partial<FormVal>) => onChange({ ...v, ...patch });
  const loc = (patch: Partial<FormVal["location"]>) => set({ location: { ...v.location, ...patch } });
  const room = (k: string, x: unknown) => set({ rooms: { ...v.rooms, [k]: x as never } });
  const pol = (k: string, x: unknown) => set({ policies: { ...v.policies, [k]: x as never } });
  const admin = role === "admin";
  const m = useMemo(() => margins({ landing: v.landing, listing: v.listing }), [v.landing, v.listing]);
  const [resolving, setResolving] = useState(false);
  const [locMsg, setLocMsg] = useState("");
  const [customFeature, setCustomFeature] = useState("");

  async function readMapsLink(url: string) {
    loc({ mapsUrl: url });
    setLocMsg("");
    if (!url) return;
    const c = coordsFromMapsUrl(url);
    if (c) { onChange({ ...v, location: { ...v.location, mapsUrl: url, lat: c.lat, lng: c.lng } }); setLocMsg("Pin placed from the link."); return; }
    if (!admin) { setLocMsg("Saved. We'll place the pin from this link; you can also tap the map."); return; }
    setResolving(true);
    try {
      const r = await api<{ lat: number; lng: number }>("admin", "maps_resolve", { url });
      onChange({ ...v, location: { ...v.location, mapsUrl: url, lat: r.lat, lng: r.lng } });
      setLocMsg("Pin placed from the link.");
    } catch (e) { setLocMsg((e as Error).message); } finally { setResolving(false); }
  }
  function useMyLocation() {
    if (!navigator.geolocation) return setLocMsg("Your browser can't share location.");
    setLocMsg("Finding you…");
    navigator.geolocation.getCurrentPosition(
      (pos) => { loc({ lat: Math.round(pos.coords.latitude * 1e5) / 1e5, lng: Math.round(pos.coords.longitude * 1e5) / 1e5 }); setLocMsg("Pin placed at your current location. Drag it to adjust."); },
      () => setLocMsg("Couldn't get your location. Tap the map instead."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const num = (x: string) => (x === "" ? null : Number(x));
  const money = (x: string) => (x === "" ? null : Number(x.replace(/\D/g, "")));
  const triSel = (val: unknown, on: (x: boolean | null) => void, label: string) => (
    <Field label={label}>
      <select className="s-input" value={val === true ? "yes" : val === false ? "no" : ""} onChange={(e) => on(e.target.value === "yes" ? true : e.target.value === "no" ? false : null)}>
        <option value="">—</option><option value="yes">Yes</option><option value="no">No</option>
      </select>
    </Field>
  );
  const numIn = (k: string, label: string, min = 0) => (
    <Field label={label}><input type="number" min={min} inputMode="numeric" className="s-input" value={(v.rooms[k] as number | null) ?? ""} onChange={(e) => room(k, num(e.target.value))} /></Field>
  );

  return (
    <div className="space-y-4">
      <Section title="Basics" open>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Property title *" className="sm:col-span-2"><input className="s-input" maxLength={120} value={v.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Sunlit 2BHK with mountain view" /></Field>
          <Field label="Short description" className="sm:col-span-2" hint="One line shown on cards and link previews."><input className="s-input" maxLength={300} value={v.shortDescription} onChange={(e) => set({ shortDescription: e.target.value })} /></Field>
          {admin && (
            <Field label="Custom link words" className="sm:col-span-2" hint={`Page address: /stay/${linkWords(v.slugText || v.title) || "…"}-${code || "ID"}. Leave empty to use the title. Old links keep working.`}>
              <input className="s-input" maxLength={60} value={v.slugText} onChange={(e) => set({ slugText: e.target.value })} placeholder="e.g. sea-view-mohali" />
            </Field>
          )}
          <Field label="Full description" className="sm:col-span-2"><textarea className="s-input" rows={6} maxLength={6000} value={v.description} onChange={(e) => set({ description: e.target.value })} /></Field>
          <Field label="Property type">
            <select className="s-input" value={v.propertyType} onChange={(e) => set({ propertyType: e.target.value })}>
              <option value="">Choose…</option>{[...new Set([...opts.propertyTypes, v.propertyType].filter(Boolean))].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Listing category">
            <select className="s-input" value={v.category} onChange={(e) => set({ category: e.target.value })}>
              <option value="">Choose…</option>{[...new Set([...opts.categories, v.category].filter(Boolean))].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      {admin && (
        <Section title="Ownership and visibility" open>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Whose property?">
              <select className="s-input" value={v.ownership} onChange={(e) => set({ ownership: e.target.value as FormVal["ownership"] })}>
                <option value="own">My own property</option><option value="host">A collaborating host&apos;s</option>
              </select>
            </Field>
            {v.ownership === "host" && (
              <Field label="Host *">
                <select className="s-input" value={v.hostId} onChange={(e) => set({ hostId: e.target.value })}>
                  <option value="">Choose host…</option>{(hosts || []).map((h) => <option key={h.id} value={h.id}>{h.name} ({h.hostCode})</option>)}
                </select>
              </Field>
            )}
            <Field label="Who can find it" hint={v.visibility === "public" ? "Shown in search, on the map and on Google once published." : v.visibility === "unlisted" ? "Hidden from search and Google; opens only through share links." : "Only you and its host. Share links don't work."}>
              <select className="s-input" value={v.visibility} onChange={(e) => set({ visibility: e.target.value as FormVal["visibility"] })}>
                <option value="public">Public</option><option value="unlisted">Unlisted (link only)</option><option value="private">Private</option>
              </select>
            </Field>
            <Field label="Availability shown to guests">
              <select className="s-input" value={v.availability} onChange={(e) => set({ availability: e.target.value as FormVal["availability"] })}>
                <option value="available">Available</option><option value="limited">Limited dates</option><option value="unavailable">Not available</option>
              </select>
            </Field>
            <Check label="Featured (shown first and on the home page)" checked={v.featured} on={(x) => set({ featured: x })} />
            <Check label="Show guest price by default" checked={v.showPrice} on={(x) => set({ showPrice: x })} />
          </div>
        </Section>
      )}

      <Section title="Location" open={admin}>
        <p className="mb-3 rounded-xl bg-mint px-3 py-2 text-sm text-teal">Guests only ever see the locality{v.showSociety ? ", society" : ""} and city, and an approximate area on the map. The full address and pin stay private.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Complete address" className="sm:col-span-2"><textarea className="s-input" rows={2} value={v.location.address} onChange={(e) => loc({ address: e.target.value })} placeholder="Flat / house no., tower, building" /></Field>
          <Field label="Society / building name"><input className="s-input" value={v.location.society} onChange={(e) => loc({ society: e.target.value })} /></Field>
          <Field label="Street"><input className="s-input" value={v.location.street} onChange={(e) => loc({ street: e.target.value })} /></Field>
          <Field label="Locality / area *"><input className="s-input" value={v.location.locality} onChange={(e) => loc({ locality: e.target.value })} /></Field>
          <Field label="City *"><input className="s-input" value={v.location.city} onChange={(e) => loc({ city: e.target.value })} /></Field>
          <Field label="State"><input className="s-input" value={v.location.state} onChange={(e) => loc({ state: e.target.value })} /></Field>
          <Field label="PIN code"><input className="s-input" inputMode="numeric" maxLength={6} value={v.location.pin} onChange={(e) => loc({ pin: e.target.value.replace(/\D/g, "") })} /></Field>
          {admin && <Check label="Show society name to guests" checked={v.showSociety} on={(x) => set({ showSociety: x })} />}
          <Field label="Google Maps link" className="sm:col-span-2" hint="Paste the link from Google Maps → Share. The pin is placed automatically.">
            <div className="flex gap-2">
              <input className="s-input" value={v.location.mapsUrl} onChange={(e) => loc({ mapsUrl: e.target.value })} onBlur={(e) => readMapsLink(e.target.value.trim())} placeholder="https://maps.app.goo.gl/…" />
              {resolving && <Loader2 className="size-5 shrink-0 animate-spin self-center text-muted" />}
            </div>
          </Field>
        </div>
        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-plum">Exact location: <strong>{v.location.lat !== null ? `${v.location.lat}, ${v.location.lng}` : "not set"}</strong> <span className="text-muted">(tap the map or drag the pin)</span></p>
            <div className="flex gap-2">
              <button type="button" onClick={useMyLocation} className="s-btn s-btn-ghost s-btn-sm"><Crosshair className="size-4" /> I&apos;m at the property</button>
              {v.location.lat !== null && <button type="button" onClick={() => loc({ lat: null, lng: null })} className="s-btn s-btn-ghost s-btn-sm">Clear pin</button>}
            </div>
          </div>
          {locMsg && <p className="mb-2 text-sm text-muted" aria-live="polite">{locMsg}</p>}
          <MapView cfg={opts.map} mode="admin" className="h-72" points={[]} fit={false} picker={{ lat: v.location.lat, lng: v.location.lng, onChange: (lat, lng) => loc({ lat, lng }) }} />
        </div>
      </Section>

      <Section title="Rooms and space">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {numIn("bedrooms", "Bedrooms")}{numIn("bathrooms", "Bathrooms")}{numIn("attachedBathrooms", "Attached bathrooms")}{numIn("beds", "Total beds")}
          {numIn("maxGuests", "Maximum guests *", 1)}{numIn("balconies", "Balconies")}{numIn("floor", "Floor number", -5)}{numIn("totalFloors", "Total floors")}
          {numIn("parking", "Parking (cars)")}{numIn("sizeSqft", "Size (sq ft)")}
          {triSel(v.rooms.livingRoom, (x) => room("livingRoom", x), "Living room")}{triSel(v.rooms.kitchen, (x) => room("kitchen", x), "Kitchen")}{triSel(v.rooms.lift, (x) => room("lift", x), "Lift")}
          <Field label="Bed setup" className="col-span-2 sm:col-span-4"><input className="s-input" value={(v.rooms.bedConfig as string) || ""} onChange={(e) => room("bedConfig", e.target.value)} placeholder="e.g. 2 king beds, 1 sofa-cum-bed" /></Field>
        </div>
      </Section>

      <Section title={`Room by room (${v.roomList.length})`}>
        <RoomsEditor rooms={v.roomList} onChange={(roomList) => set({ roomList })} suggestions={amenities.map((a) => a.label)} />
      </Section>

      <Section title={`Amenities (${v.amenities.length})`}>
        <div className="space-y-4">
          {AMENITY_CATEGORIES.map((cat) => {
            const list = amenities.filter((a) => a.category === cat);
            if (!list.length) return null;
            return (
              <div key={cat}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{cat}</p>
                <div className="flex flex-wrap gap-2">
                  {list.map((a) => {
                    const on = v.amenities.includes(a.key);
                    return <button key={a.key} type="button" aria-pressed={on} onClick={() => set({ amenities: on ? v.amenities.filter((x) => x !== a.key) : [...v.amenities, a.key] })} className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-plum bg-plum text-white" : "border-line bg-white text-plum"}`}>{a.label}</button>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title={`Standout features (${v.features.length})`}>
        <div className="flex flex-wrap gap-2">
          {[...new Set([...opts.features, ...v.features])].map((f) => {
            const on = v.features.includes(f);
            return <button key={f} type="button" aria-pressed={on} onClick={() => set({ features: on ? v.features.filter((x) => x !== f) : [...v.features, f] })} className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-teal bg-teal text-white" : "border-line bg-white text-plum"}`}>{f}</button>;
          })}
        </div>
        <div className="mt-3 flex gap-2">
          <input className="s-input" value={customFeature} maxLength={60} onChange={(e) => setCustomFeature(e.target.value)} placeholder="Add your own, e.g. Rooftop jacuzzi" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (customFeature.trim()) { set({ features: [...v.features, customFeature.trim()] }); setCustomFeature(""); } } }} />
          <button type="button" className="s-btn s-btn-ghost" onClick={() => { if (customFeature.trim()) { set({ features: [...v.features, customFeature.trim()] }); setCustomFeature(""); } }}>Add</button>
        </div>
      </Section>

      <Section title="House rules and policies">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Check-in time"><input type="time" className="s-input" value={(v.policies.checkIn as string) || ""} onChange={(e) => pol("checkIn", e.target.value)} /></Field>
          <Field label="Check-out time"><input type="time" className="s-input" value={(v.policies.checkOut as string) || ""} onChange={(e) => pol("checkOut", e.target.value)} /></Field>
          {triSel(v.policies.couples, (x) => pol("couples", x), "Couples allowed")}
          {triSel(v.policies.unmarriedCouples, (x) => pol("unmarriedCouples", x), "Unmarried couples")}
          {triSel(v.policies.familyFriendly, (x) => pol("familyFriendly", x), "Family-friendly")}
          {triSel(v.policies.pets, (x) => pol("pets", x), "Pets allowed")}
          {(["earlyCheckIn:Early check-in", "lateCheckout:Late checkout", "smoking:Smoking", "alcohol:Alcohol", "visitors:Visitors", "ageRestriction:Age restrictions", "idRequirements:ID requirements"] as const).map((s) => {
            const [k, l] = s.split(":");
            return <Field key={k} label={l} className="col-span-2"><input className="s-input" value={(v.policies[k] as string) || ""} onChange={(e) => pol(k, e.target.value)} /></Field>;
          })}
          <Field label="Additional rules" className="col-span-2 sm:col-span-4"><textarea className="s-input" rows={3} value={(v.policies.rules as string) || ""} onChange={(e) => pol("rules", e.target.value)} /></Field>
        </div>
      </Section>

      <Section title={admin ? "Pricing and margin" : "Your payout"} open={admin}>
        {admin ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <PricePairIn label="Landing price (paid to host) ₹/night" value={v.landing} on={(x) => set({ landing: x })} money={money} />
              <PricePairIn label="Listing price (quoted to guests) ₹/night" value={v.listing} on={(x) => set({ listing: x })} money={money} />
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[22rem] text-sm">
                <thead><tr className="text-left text-xs text-muted"><th className="py-1.5 font-medium"> </th><th className="font-medium">Weekday</th><th className="font-medium">Weekend</th></tr></thead>
                <tbody className="divide-y divide-line">
                  <tr><td className="py-2 text-muted">Landing</td><td>{inr(v.landing.weekday) || "—"}</td><td>{inr(v.landing.weekend) || "—"}</td></tr>
                  <tr><td className="py-2 text-muted">Listing</td><td>{inr(v.listing.weekday) || "—"}</td><td>{inr(v.listing.weekend) || "—"}</td></tr>
                  <tr className={m.negative ? "text-coral" : "text-teal"}><td className="py-2 font-semibold">My margin</td><td className="font-semibold">{m.weekday !== null ? `${inr(m.weekday)} (${m.weekdayPct}%)` : "—"}</td><td className="font-semibold">{m.weekend !== null ? `${inr(m.weekend)} (${m.weekendPct}%)` : "—"}</td></tr>
                </tbody>
              </table>
              <p className="s-hint">Per week (5 weekday + 2 weekend nights): <strong>{m.perWeek !== null ? inr(m.perWeek) : "—"}</strong>. Landing prices and margins are never shown to guests or hosts.</p>
              {m.negative && <p className="mt-2 rounded-xl bg-blush px-3 py-2 text-sm text-coral">The listing price is below the landing price: you would lose money.</p>}
            </div>
          </>
        ) : (
          <>
            <PricePairIn label="Amount you want per night (₹)" value={v.landing} on={(x) => set({ landing: x })} money={money} />
            <p className="s-hint">This is private between you and us; guests never see it.</p>
          </>
        )}
      </Section>

      <Section title={admin ? "Private details (admin only)" : "Links and notes for us"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Property contact name (caretaker, optional)" hint="Private, never shown to guests."><input className="s-input" value={v.contactName} onChange={(e) => set({ contactName: e.target.value })} placeholder="e.g. Sunil (caretaker)" /></Field>
          <Field label="Property contact number"><input className="s-input" type="tel" value={v.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} placeholder="10-digit mobile" /></Field>
          <Field label="Airbnb listing link" className="sm:col-span-2" hint="Private, never shown to guests."><input className="s-input" type="url" value={v.airbnbUrl} onChange={(e) => set({ airbnbUrl: e.target.value })} placeholder="https://www.airbnb.co.in/rooms/…" /></Field>
          {admin ? (
            <>
              <Field label="Owner name"><input className="s-input" value={v.ownerName} onChange={(e) => set({ ownerName: e.target.value })} /></Field>
              <Field label="Private notes" className="sm:col-span-2"><textarea className="s-input" rows={3} value={v.adminNotes} onChange={(e) => set({ adminNotes: e.target.value })} /></Field>
              {v.hostNotes && <div className="sm:col-span-2"><p className="s-label">Host&apos;s notes</p><p className="s-prose rounded-xl bg-white p-3 text-sm ring-1 ring-line">{v.hostNotes}</p></div>}
            </>
          ) : (
            <Field label="Anything we should know?" className="sm:col-span-2"><textarea className="s-input" rows={3} value={v.hostNotes} onChange={(e) => set({ hostNotes: e.target.value })} placeholder="Caretaker timings, key handover, special requests…" /></Field>
          )}
        </div>
      </Section>
    </div>
  );
}

function PricePairIn({ label, value, on, money }: { label: string; value: Pair; on: (x: Pair) => void; money: (x: string) => number | null }) {
  return (
    <fieldset>
      <legend className="s-label">{label}</legend>
      <div className="grid grid-cols-2 gap-3">
        <label><span className="text-xs text-muted">Weekday</span><input className="s-input" inputMode="numeric" value={value.weekday ?? ""} onChange={(e) => on({ ...value, weekday: money(e.target.value) })} placeholder="₹" /></label>
        <label><span className="text-xs text-muted">Weekend</span><input className="s-input" inputMode="numeric" value={value.weekend ?? ""} onChange={(e) => on({ ...value, weekend: money(e.target.value) })} placeholder="₹" /></label>
      </div>
    </fieldset>
  );
}

export function Section({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group s-card rounded-2xl">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 sm:px-5 [&::-webkit-details-marker]:hidden">
        <h3 className="font-sans text-base font-semibold text-plum">{title}</h3>
        <ChevronDown className="size-5 text-muted transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-line px-4 py-4 sm:px-5">{children}</div>
    </details>
  );
}

export function Field({ label, children, className = "", hint }: { label: string; children: React.ReactNode; className?: string; hint?: string }) {
  return <label className={`block ${className}`}><span className="s-label">{label}</span>{children}{hint && <span className="s-hint block">{hint}</span>}</label>;
}

function Check({ label, checked, on }: { label: string; checked: boolean; on: (x: boolean) => void }) {
  return <label className="flex items-center gap-2 self-end pb-2 text-sm text-plum"><input type="checkbox" className="size-4 accent-plum" checked={checked} onChange={(e) => on(e.target.checked)} />{label}</label>;
}

/** Same rules as the server's cleanSlugText (preview only). */
const linkWords = (v: string) => v.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/g, "");

function RoomsEditor({ rooms, onChange, suggestions }: { rooms: RoomVal[]; onChange: (r: RoomVal[]) => void; suggestions: string[] }) {
  const upd = (i: number, patch: Partial<RoomVal>) => onChange(rooms.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: number) => { const n = [...rooms]; const [x] = n.splice(i, 1); n.splice(Math.max(0, Math.min(n.length, i + d)), 0, x); onChange(n); };
  const add = (name = "") => onChange([...rooms, { id: newRoomId(), name, description: "", amenities: [] }]);
  const unused = ROOM_PRESETS.filter((n) => !rooms.some((r) => r.name.toLowerCase() === n.toLowerCase()));
  return (
    <div>
      <p className="mb-3 text-sm text-muted">Describe each room and tag photos to it (in Photos and videos). Guests see the property room by room, and photos are sorted in this order.</p>
      <ul className="space-y-3">
        {rooms.map((r, i) => (
          <li key={r.id} className="rounded-xl bg-white p-3 ring-1 ring-line">
            <div className="flex gap-2">
              <input className="s-input" value={r.name} maxLength={60} onChange={(e) => upd(i, { name: e.target.value })} placeholder="Room name, e.g. Bedroom 1" aria-label="Room name" />
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-lg px-2 text-muted hover:bg-plum/5 disabled:opacity-30" aria-label="Move up">↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === rooms.length - 1} className="rounded-lg px-2 text-muted hover:bg-plum/5 disabled:opacity-30" aria-label="Move down">↓</button>
              <button type="button" onClick={() => { if (confirm(`Remove ${r.name || "this room"}? Its photos stay, untagged.`)) onChange(rooms.filter((_, k) => k !== i)); }} className="rounded-lg px-2 text-coral hover:bg-blush" aria-label="Remove room">✕</button>
            </div>
            <textarea className="s-input mt-2 !min-h-0" rows={2} maxLength={600} value={r.description} onChange={(e) => upd(i, { description: e.target.value })} placeholder="Short description, e.g. King bed, mountain-facing window, attached bathroom" aria-label="Room description" />
            <ChipsInput values={r.amenities} onChange={(amenities) => upd(i, { amenities })} suggestions={suggestions} placeholder="Add amenity (e.g. AC, Smart TV, Wardrobe) and press Enter" />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => add()} className="s-btn s-btn-ghost s-btn-sm">+ Add custom room</button>
        {unused.slice(0, 8).map((n) => <button key={n} type="button" onClick={() => add(n)} className="rounded-full border border-dashed border-line px-3 py-1 text-xs text-plum hover:border-plum">+ {n}</button>)}
      </div>
    </div>
  );
}

function ChipsInput({ values, onChange, suggestions, placeholder }: { values: string[]; onChange: (v: string[]) => void; suggestions: string[]; placeholder: string }) {
  const [t, setT] = useState("");
  const listId = useId();
  const add = () => { const x = t.trim().slice(0, 50); if (x && !values.some((v) => v.toLowerCase() === x.toLowerCase()) && values.length < 30) onChange([...values, x]); setT(""); };
  return (
    <div className="mt-2">
      {values.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {values.map((v) => <span key={v} className="s-chip !bg-mint !text-teal">{v}<button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`} className="ml-0.5">×</button></span>)}
        </div>
      )}
      <input className="s-input" list={listId} value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }} onBlur={add} placeholder={placeholder} aria-label="Room amenities" />
      <datalist id={listId}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
    </div>
  );
}
