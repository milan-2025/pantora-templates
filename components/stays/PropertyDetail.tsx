/** The guest-facing property page (used by /stay/<slug> and share links /stay/s/<token>). Server component. */
import Link from "next/link";
import { BedDouble, Check, CircleSlash, Clock, ExternalLink, MapPin, Navigation, Pencil, Sparkles } from "lucide-react";
import type { AdminExtras, PublicCard, PublicProperty } from "@/lib/stays/views";
import type { TemplateKey } from "@/lib/stays/constants";
import { AVAILABILITY_LABEL } from "@/lib/stays/constants";
import { inr } from "@/lib/stays/core";
import { EnquiryButtons, EnquiryQuickLinks } from "./Enquiry";
import { Gallery, RoomCards, ShareButton, Videos } from "./Gallery";
import { CardGrid, ContactButtons, Facts, Footer, Header, PriceLine, type SiteInfo } from "./ui";
import MapView from "./MapView";

type Site = SiteInfo & { templates: Partial<Record<TemplateKey, string>>; map: { tileUrl: string; attribution: string; defaultLat: number; defaultLng: number; defaultZoom: number } };

const yesNo = (v: unknown) => (v === true ? "Yes" : v === false ? "No" : null);

export function PropertyDetail({ property: p, site, similar, shareId, admin = null }: { property: PublicProperty; site: Site; similar: (PublicCard & { admin?: AdminExtras })[]; shareId: string | null; admin?: AdminExtras | null }) {
  const r = p.rooms;
  const config = [
    ["Bedrooms", r.bedrooms], ["Bathrooms", r.bathrooms], ["Attached bathrooms", r.attachedBathrooms], ["Beds", r.beds], ["Bed setup", r.bedConfig || null],
    ["Maximum guests", r.maxGuests], ["Living room", yesNo(r.livingRoom as boolean | null)], ["Kitchen", yesNo(r.kitchen as boolean | null)], ["Balconies", r.balconies],
    ["Floor", r.floor !== null && r.floor !== undefined ? `${r.floor}${r.totalFloors ? ` of ${r.totalFloors}` : ""}` : null], ["Lift", yesNo(r.lift as boolean | null)],
    ["Parking", r.parking !== null && r.parking !== undefined ? (r.parking ? `${r.parking} car${r.parking === 1 ? "" : "s"}` : "No") : null], ["Size", r.sizeSqft ? `${Number(r.sizeSqft).toLocaleString("en-IN")} sq ft` : null],
  ].filter(([, v]) => v !== null && v !== undefined && v !== "") as [string, string | number][];
  const pol = p.policies;
  const rules = [
    ["Check-in", pol.checkIn], ["Check-out", pol.checkOut], ["Early check-in", pol.earlyCheckIn], ["Late checkout", pol.lateCheckout],
    ["Couples", yesNo(pol.couples)], ["Unmarried couples", yesNo(pol.unmarriedCouples)], ["Family-friendly", yesNo(pol.familyFriendly)], ["Pets", yesNo(pol.pets)],
    ["Smoking", pol.smoking], ["Alcohol", pol.alcohol], ["Visitors", pol.visitors], ["Age", pol.ageRestriction], ["ID required", pol.idRequirements],
  ].filter(([, v]) => v) as [string, string][];
  const groups = p.amenityList.reduce<Record<string, string[]>>((acc, a) => ((acc[a.category] ||= []).push(a.label), acc), {});
  const roomInfo = p.roomSections.rooms.map((r) => ({ id: r.id, name: r.name, description: r.description, amenities: r.amenities }));
  const enquiry = { code: p.code, title: p.title, place: p.place, whatsappNumber: site.whatsappNumber, templates: site.templates, shareId };

  return (
    <>
      <Header site={site} admin={!!admin} />
      <main className="mx-auto max-w-6xl px-4 pb-28 pt-0 sm:px-6 sm:pt-5 lg:pb-10">
        {/* Phones: photos first, edge to edge (like Airbnb); larger screens: title, then the photo grid. */}
        <div className="flex flex-col">
        <div className="order-2 mb-4 mt-4 flex flex-wrap items-end justify-between gap-3 sm:order-1 sm:mt-0">
          <div className="min-w-0">
            <h1 className="font-display text-3xl leading-tight sm:text-4xl">{p.title}</h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1"><MapPin className="size-4" aria-hidden />{p.place}</span>
              <span>Property ID <strong className="text-plum">{p.code}</strong></span>
            </p>
          </div>
          <ShareButton title={p.title} />
        </div>

        {admin && <div className="order-3 sm:order-2"><AdminPanel a={admin} title={p.title} code={p.code} /></div>}

        <div className="order-1 sm:order-3"><Gallery photos={p.photos} rooms={roomInfo} title={p.title} /></div>
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem]">
          <div className="min-w-0 space-y-10">
            <section>
              <div className="flex flex-wrap items-center gap-2">
                {p.propertyType && <span className="s-chip">{p.propertyType}</span>}
                {p.category && <span className="s-chip !bg-neutral-100 !text-charcoal">{p.category}</span>}
                <span className={`s-chip ${p.availability === "available" ? "!bg-mint !text-teal" : p.availability === "limited" ? "!bg-neutral-100 !text-charcoal" : "!bg-blush !text-coral"}`}>{AVAILABILITY_LABEL[p.availability]}</span>
              </div>
              <Facts bedrooms={p.bedrooms} bathrooms={p.bathrooms} maxGuests={p.maxGuests} className="mt-3 !text-base" />
              {p.shortDescription && <p className="mt-4 text-lg text-charcoal">{p.shortDescription}</p>}
            </section>

            {p.allFeatures.length > 0 && (
              <section aria-labelledby="h-feat">
                <h2 id="h-feat" className="font-display text-2xl">What makes it special</h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {p.allFeatures.map((f) => (
                    <li key={f} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-line"><Sparkles className="size-5 shrink-0 text-marigold" aria-hidden /><span className="font-medium text-plum">{f}</span></li>
                  ))}
                </ul>
              </section>
            )}

            {p.description && (
              <section aria-labelledby="h-about">
                <h2 id="h-about" className="font-display text-2xl">About this stay</h2>
                <p className="s-prose mt-3 text-[15px] text-charcoal">{p.description}</p>
              </section>
            )}

            {roomInfo.length > 0 && (
              <section aria-labelledby="h-rbr">
                <RoomCards photos={p.photos} rooms={roomInfo} title={p.title} />
              </section>
            )}

            {config.length > 0 && (
              <section aria-labelledby="h-rooms">
                <h2 id="h-rooms" className="font-display text-2xl">Rooms and space</h2>
                <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  {config.map(([k, v]) => (
                    <div key={k} className="border-b border-line pb-2"><dt className="text-xs text-muted">{k}</dt><dd className="font-medium text-plum">{v}</dd></div>
                  ))}
                </dl>
              </section>
            )}

            {p.amenityList.length > 0 && (
              <section aria-labelledby="h-am">
                <h2 id="h-am" className="font-display text-2xl">Amenities</h2>
                <div className="mt-4 grid gap-6 sm:grid-cols-2">
                  {Object.entries(groups).map(([cat, items]) => (
                    <div key={cat}>
                      <h3 className="font-sans text-sm font-semibold uppercase tracking-wide text-muted">{cat}</h3>
                      <ul className="mt-2 space-y-1.5">{items.map((a) => <li key={a} className="flex items-center gap-2 text-[15px]"><Check className="size-4 text-teal" aria-hidden />{a}</li>)}</ul>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {p.videos.length > 0 && (
              <section aria-labelledby="h-vid">
                <h2 id="h-vid" className="font-display text-2xl">Videos</h2>
                <div className="mt-4"><Videos videos={p.videos} /></div>
              </section>
            )}

            {(rules.length > 0 || pol.rules) && (
              <section aria-labelledby="h-rules">
                <h2 id="h-rules" className="font-display text-2xl">House rules</h2>
                {rules.length > 0 && (
                  <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                    {rules.map(([k, v]) => (
                      <div key={k} className="border-b border-line pb-2"><dt className="text-xs text-muted">{k}</dt><dd className="font-medium text-plum">{v}</dd></div>
                    ))}
                  </dl>
                )}
                {pol.rules && <p className="s-prose mt-4 rounded-2xl bg-white p-4 text-[15px] ring-1 ring-line">{pol.rules}</p>}
              </section>
            )}

            <section aria-labelledby="h-loc">
              <h2 id="h-loc" className="font-display text-2xl">Location</h2>
              <p className="mt-2 flex items-center gap-2 text-[15px]"><MapPin className="size-4 text-coral" aria-hidden />{p.place}</p>
              <p className="mt-1 text-sm text-muted">The exact address is shared after booking. Ask us for directions any time.</p>
              {p.approx && (
                <div className="mt-4">
                  <MapView cfg={site.map} className="h-72" points={[{ key: p.code, lat: p.approx.lat, lng: p.approx.lng, title: p.title, sub: p.place }]} selected={p.code} showCard={false} />
                </div>
              )}
            </section>
          </div>

          <aside className="hidden lg:block">
            <div className="s-card sticky top-24 rounded-3xl p-5">
              {p.price ? (
                <div className="mb-4">
                  <PriceLine price={p.price} size="lg" />
                  {p.price.weekday && p.price.weekend && p.price.weekday !== p.price.weekend && (
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-xl border border-line bg-white p-2.5"><dt className="text-xs text-muted">Weekdays</dt><dd className="font-semibold text-plum">₹{p.price.weekday.toLocaleString("en-IN")}</dd></div>
                      <div className="rounded-xl border border-line bg-white p-2.5"><dt className="text-xs text-muted">Weekends</dt><dd className="font-semibold text-plum">₹{p.price.weekend.toLocaleString("en-IN")}</dd></div>
                    </dl>
                  )}
                </div>
              ) : (
                <p className="mb-4 text-sm text-muted">Message us for today&apos;s best price.</p>
              )}
              <EnquiryButtons {...enquiry} />
              <ul className="mt-4 space-y-1.5 text-xs text-muted">
                <li className="flex items-center gap-1.5"><Clock className="size-3.5" aria-hidden />Replies on WhatsApp, usually within the hour</li>
                <li className="flex items-center gap-1.5"><BedDouble className="size-3.5" aria-hidden />Property ID {p.code}</li>
              </ul>
            </div>
          </aside>
        </div>

        {similar.length > 0 && (
          <section className="mt-16" aria-labelledby="h-sim">
            <h2 id="h-sim" className="font-display text-2xl">Similar stays</h2>
            <div className="mt-5"><CardGrid cards={similar} /></div>
          </section>
        )}
        {p.availability === "unavailable" && (
          <p className="mt-6 flex items-center gap-2 rounded-2xl bg-blush p-3 text-sm text-coral"><CircleSlash className="size-4" />This stay is not taking bookings right now. Message us and we&apos;ll suggest something similar.</p>
        )}
      </main>

      {/* phones: price + main action always in reach */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <EnquiryButtons {...enquiry} layout="bar" priceSlot={p.price ? <PriceLine price={p.price} /> : <span className="text-sm text-muted">Ask for price</span>} />
        <EnquiryQuickLinks {...enquiry} />
      </div>
      <Footer site={site} />
    </>
  );
}

/** Admin browsing view: the private details you need when answering an enquiry. */
function AdminPanel({ a, title, code }: { a: AdminExtras; title: string; code: string }) {
  const greet = (name: string) => `Hi ${name}, about ${title} (${code}):`;
  return (
    <section aria-label="Private details (admin only)" className="mb-5 rounded-3xl border-2 border-plum bg-lavender/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-plum px-2.5 py-1 text-xs font-semibold text-white">Admin only</span>
        <span className="text-sm font-semibold text-plum">{a.statusLabel} · {a.visibility}{a.archived ? " · archived" : ""}{!a.showPrice ? " · price hidden for guests" : ""}</span>
        <Link href={`/stays/admin#p/${a.id}`} className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-plum underline"><Pencil className="size-3.5" /> Edit in dashboard</Link>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{a.ownership === "own" ? "Own property" : "Host"}</p>
          {a.host ? (
            <>
              <p className="mt-1 text-lg font-semibold text-plum">{a.host.name} <span className="text-xs font-normal text-muted">{a.host.hostCode}</span></p>
              {(a.host.ownerName || a.ownerName) && <p className="text-sm text-muted">Owner: {a.host.ownerName || a.ownerName}</p>}
              {a.host.phone && <p className="mt-1 text-sm">Phone: <strong>{a.host.phone}</strong>{a.host.whatsapp && a.host.whatsapp !== a.host.phone ? <> · WhatsApp: <strong>{a.host.whatsapp}</strong></> : null}</p>}
              <div className="mt-2"><ContactButtons phone={a.host.whatsapp || a.host.phone} greet={greet(a.host.name)} /></div>
              {a.host.whatsapp && a.host.phone && a.host.whatsapp !== a.host.phone && <div className="mt-2"><ContactButtons phone={a.host.phone} greet={greet(a.host.name)} /></div>}
            </>
          ) : <p className="mt-1 text-sm text-muted">{a.ownerName ? `Owner: ${a.ownerName}` : "No host linked"}</p>}
          {a.contact && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Property contact</p>
              <p className="mt-1 font-semibold text-plum">{a.contact.name || "Contact"} · <span className="font-normal">{a.contact.phone}</span></p>
              <div className="mt-2"><ContactButtons phone={a.contact.phone} greet={greet(a.contact.name || "")} /></div>
            </div>
          )}
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Exact address</p>
            <p className="mt-1 text-charcoal">{a.address || "Not added"}</p>
            {a.directions && <a href={a.directions} target="_blank" rel="noopener noreferrer" className="s-btn s-btn-ghost s-btn-sm mt-2 !bg-white"><Navigation className="size-3.5" /> Directions</a>}
          </div>
          {a.airbnbUrl && <a href={a.airbnbUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-teal underline">Airbnb listing <ExternalLink className="size-3.5" /></a>}
          <table className="w-full max-w-sm text-sm">
            <thead><tr className="text-left text-xs text-muted"><th className="font-medium"> </th><th className="font-medium">Weekday</th><th className="font-medium">Weekend</th></tr></thead>
            <tbody>
              <tr><td className="pr-3 text-muted">Guest price</td><td>{inr(a.listing.weekday) || "—"}</td><td>{inr(a.listing.weekend) || "—"}</td></tr>
              <tr><td className="pr-3 text-muted">Landing</td><td>{inr(a.landing.weekday) || "—"}</td><td>{inr(a.landing.weekend) || "—"}</td></tr>
              <tr className={a.margins.negative ? "text-coral" : "font-semibold text-teal"}><td className="pr-3">Margin</td><td>{a.margins.weekday !== null ? `${inr(a.margins.weekday)} (${a.margins.weekdayPct}%)` : "—"}</td><td>{a.margins.weekend !== null ? `${inr(a.margins.weekend)} (${a.margins.weekendPct}%)` : "—"}</td></tr>
            </tbody>
          </table>
          {a.adminNotes && <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Private notes</p><p className="s-prose mt-1">{a.adminNotes}</p></div>}
          {a.hostNotes && <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Host&apos;s notes</p><p className="s-prose mt-1">{a.hostNotes}</p></div>}
        </div>
      </div>
    </section>
  );
}
