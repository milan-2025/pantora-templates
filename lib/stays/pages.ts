/**
 * Stays: data for the public pages (server components). Guest-safe by construction: everything goes through
 * publicProperty()/publicCard(), and the visibility rules live in guestCanView().
 */
import "server-only";
import { CODE_RE, codeFromSlug } from "./core";
import { destinations, search, sortCards } from "./search";
import { adminCards, amenityDefs, dbs, getSettings, listedCards, publicSettings, type Actor } from "./server";
import { adminExtras, guestCanView, publicProperty, slugOf, type AdminExtras, type PublicCard, type StoredProperty } from "./views";

/** A card, plus private extras in the admin browsing view. */
export type Card = PublicCard & { admin?: AdminExtras };

export async function loadSite() {
  const c = await dbs();
  const [s, am] = await Promise.all([getSettings(c), amenityDefs(c)]);
  return { settings: publicSettings(s), amenities: am };
}

/** Similar = same city first, then similar size, never the property itself. */
function similarTo(cards: PublicCard[], code: string, city: string, guests: number | null) {
  return sortCards(cards.filter((x) => x.code !== code), "recommended")
    .map((x) => ({ x, score: (x.city.toLowerCase() === city.toLowerCase() ? 2 : 0) + (guests && x.maxGuests && Math.abs(x.maxGuests - guests) <= 2 ? 1 : 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((s) => s.x);
}

/** /stay/<slug>: public, published properties only. Returns the canonical slug so old titles can redirect. */
export async function loadBySlug(slug: string, admin: Actor | null = null) {
  const code = codeFromSlug(slug);
  if (!CODE_RE.test(code)) return null;
  const c = await dbs();
  const p: StoredProperty | null = await c.properties.findOne({ code });
  // Admin browsing view: any property (drafts, private, unlisted, archived), with the guest price always shown.
  if (!p || (!admin && !guestCanView(p, false))) return null;
  const [site, cards] = await Promise.all([loadSite(), admin ? adminCards(c) : listedCards(c)]);
  const property = publicProperty(p, admin ? true : p.showPrice !== false, site.amenities);
  const host = admin && p.hostId ? await c.hosts.findOne({ _id: p.hostId }) : null;
  return {
    property, canonical: slugOf(p), site, similar: similarTo(cards, p.code, property.city, property.maxGuests) as Card[], shareId: null as string | null,
    indexable: !admin && guestCanView(p, false),
    admin: admin ? adminExtras(p, host) : null,
  };
}

/** /stay/s/<token>: a share link. Its own price setting wins; unlisted properties work here; revoked links don't. */
export async function loadShare(token: string) {
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(token)) return null;
  const c = await dbs();
  const sh = await c.shares.findOne({ _id: token });
  if (!sh || sh.revoked) return null;
  const p: StoredProperty | null = await c.properties.findOne({ _id: sh.propertyId });
  if (!p || !guestCanView(p, true)) return null;
  await c.shares.updateOne({ _id: sh._id }, { $inc: { views: 1 }, $set: { lastViewedAt: Date.now() } });
  const [site, cards] = await Promise.all([loadSite(), listedCards(c)]);
  return {
    property: publicProperty(p, !!sh.showPrice, site.amenities),
    canonical: slugOf(p),
    site,
    // Similar listings follow the link's price choice too.
    similar: p.visibility === "public" ? similarTo(cards, p.code, p.location?.city || "", (p.rooms?.maxGuests as number) ?? null).map((x) => (sh.showPrice ? x : { ...x, price: null })) : [],
    shareId: sh._id as string,
    indexable: false,
    admin: null,
  };
}

export async function loadHome(admin: Actor | null = null) {
  const c = await dbs();
  const [site, cards] = await Promise.all([loadSite(), admin ? adminCards(c) : listedCards(c)]) as [Awaited<ReturnType<typeof loadSite>>, Card[]];
  return {
    site,
    featured: search(cards, { featured: true, sort: "recommended", perPage: 8 }).results,
    recent: search(cards, { sort: "newest", perPage: 8 }).results,
    destinations: destinations(cards),
    total: cards.length,
    cities: [...new Set(cards.map((x) => x.city).filter(Boolean))].sort(),
    mapPoints: cards.filter((x) => x.approx).map((x) => ({ code: x.code, slug: x.slug, title: x.title, approx: x.approx!, place: x.place, price: x.price, cover: x.cover, maxGuests: x.maxGuests, bedrooms: x.bedrooms })),
  };
}

export async function loadSitemap() {
  const c = await dbs();
  return (await listedCards(c)).map((x) => ({ slug: x.slug, updatedAt: x.updatedAt }));
}
