/** The guest-facing property page (used by /stay/<slug> and share links /stay/s/<token>). Server component. */
import { BedDouble, Check, CircleSlash, Clock, MapPin, Sparkles } from "lucide-react";
import type { PublicCard, PublicProperty } from "@/lib/stays/views";
import type { TemplateKey } from "@/lib/stays/constants";
import { AVAILABILITY_LABEL } from "@/lib/stays/constants";
import { EnquiryButtons, EnquiryQuickLinks } from "./Enquiry";
import { Gallery, ShareButton, Videos } from "./Gallery";
import { CardGrid, Facts, Footer, Header, PriceLine, type SiteInfo } from "./ui";
import MapView from "./MapView";

type Site = SiteInfo & { templates: Partial<Record<TemplateKey, string>>; map: { tileUrl: string; attribution: string; defaultLat: number; defaultLng: number; defaultZoom: number } };

const yesNo = (v: unknown) => (v === true ? "Yes" : v === false ? "No" : null);

export function PropertyDetail({ property: p, site, similar, shareId }: { property: PublicProperty; site: Site; similar: PublicCard[]; shareId: string | null }) {
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
  const enquiry = { code: p.code, title: p.title, place: p.place, whatsappNumber: site.whatsappNumber, templates: site.templates, shareId };

  return (
    <>
      <Header site={site} />
      <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:pb-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-3xl leading-tight sm:text-4xl">{p.title}</h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1"><MapPin className="size-4" aria-hidden />{p.place}</span>
              <span>Property ID <strong className="text-plum">{p.code}</strong></span>
            </p>
          </div>
          <ShareButton title={p.title} />
        </div>

        <Gallery photos={p.photos} title={p.title} />

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem]">
          <div className="min-w-0 space-y-10">
            <section>
              <div className="flex flex-wrap items-center gap-2">
                {p.propertyType && <span className="s-chip">{p.propertyType}</span>}
                {p.category && <span className="s-chip !bg-sand !text-marigold-deep">{p.category}</span>}
                <span className={`s-chip ${p.availability === "available" ? "!bg-mint !text-teal" : p.availability === "limited" ? "!bg-sand !text-marigold-deep" : "!bg-blush !text-coral"}`}>{AVAILABILITY_LABEL[p.availability]}</span>
              </div>
              <Facts bedrooms={p.bedrooms} bathrooms={p.bathrooms} maxGuests={p.maxGuests} className="mt-3 !text-base" />
              {p.shortDescription && <p className="mt-4 text-lg text-charcoal">{p.shortDescription}</p>}
            </section>

            {p.allFeatures.length > 0 && (
              <section aria-labelledby="h-feat">
                <h2 id="h-feat" className="font-display text-2xl">What makes it special</h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {p.allFeatures.map((f) => (
                    <li key={f} className="flex items-center gap-3 rounded-2xl bg-paper p-3 ring-1 ring-line"><Sparkles className="size-5 shrink-0 text-marigold" aria-hidden /><span className="font-medium text-plum">{f}</span></li>
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
                {pol.rules && <p className="s-prose mt-4 rounded-2xl bg-paper p-4 text-[15px] ring-1 ring-line">{pol.rules}</p>}
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
                      <div className="rounded-xl bg-cream p-2.5"><dt className="text-xs text-muted">Weekdays</dt><dd className="font-semibold text-plum">₹{p.price.weekday.toLocaleString("en-IN")}</dd></div>
                      <div className="rounded-xl bg-cream p-2.5"><dt className="text-xs text-muted">Weekends</dt><dd className="font-semibold text-plum">₹{p.price.weekend.toLocaleString("en-IN")}</dd></div>
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
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur lg:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <EnquiryButtons {...enquiry} layout="bar" priceSlot={p.price ? <PriceLine price={p.price} /> : <span className="text-sm text-muted">Ask for price</span>} />
        <EnquiryQuickLinks {...enquiry} />
      </div>
      <Footer site={site} />
    </>
  );
}
