/**
 * Stays: what each kind of viewer is allowed to receive. Pure.
 *
 * Every response is BUILT from a whitelist (never "the stored document minus some fields"), so a field added to the
 * database later can't leak by accident. Guests never get: host or owner details, the exact address, street, PIN or
 * coordinates, the Google Maps link, landing prices, margins, the Airbnb link or any notes.
 * Hosts additionally never get the guest (listing) price, so they can't work out the margin.
 */
import { AVAILABILITY_LABEL, STATUS_LABEL, type Availability, type Status } from "./constants";
import { fromPrice, margins, propertySlug, type PricePair } from "./core";
import { coverOf, imgUrl, posterUrl, srcSet, videoUrl, type MediaItem } from "./media";

/** The property as stored in MongoDB (stay_properties). */
export type StoredProperty = {
  _id: string; code: string; ownership: "own" | "host"; hostId: string | null;
  title: string; shortDescription: string; description: string; propertyType: string; category: string;
  status: Status; visibility: "public" | "unlisted" | "private"; availability: Availability; featured: boolean; showPrice: boolean;
  location: {
    address: string; society: string; street: string; locality: string; city: string; state: string; pin: string; country: string;
    lat: number | null; lng: number | null; mapsUrl: string; showSociety: boolean;
  };
  approx: { lat: number; lng: number } | null;
  rooms: Record<string, number | boolean | string | null>;
  amenities: string[]; features: string[];
  policies: Record<string, string | boolean | null>;
  pricing: { landing: PricePair; listing: PricePair };
  private: { airbnbUrl: string; adminNotes: string; ownerName: string; hostNotes: string; contactName?: string; contactPhone?: string };
  /** Custom words for the property's address (/stay/<words>-<ID>); empty = use the title. */
  slugText?: string;
  /** Rooms (living room, bedroom 1 …) with their own description and amenities; photos point to a room by roomId. */
  roomList?: Room[];
  media: MediaItem[]; coverId: string | null;
  hostChanges: { data: Record<string, unknown>; at: number } | null;
  publishRequested: boolean;
  review: { reason: string; at: number; action: string } | null;
  archived: boolean;
  createdAt: number; updatedAt: number; approvedAt?: number; publishedAt?: number; submittedAt?: number; lastVerifiedAt?: number;
};

export type AmenityDef = { key: string; label: string; category: string };
export type Room = { id: string; name: string; description: string; amenities: string[] };

/** The words-plus-ID address of a property (custom words when set, else the title). */
export const slugOf = (p: Pick<StoredProperty, "title" | "code" | "slugText">) => propertySlug(p.slugText || p.title, p.code);

/** Media ordered room by room (in the order rooms are listed), untagged last; order inside a room is kept. */
export function byRoom<T extends { roomId?: string | null }>(media: T[], rooms: Room[] = []): T[] {
  const rank = new Map(rooms.map((r, i) => [r.id, i]));
  const key = (m: T) => (m.roomId && rank.has(m.roomId) ? rank.get(m.roomId)! : rooms.length);
  return media.map((m, i) => ({ m, i })).sort((a, b) => key(a.m) - key(b.m) || a.i - b.i).map((x) => x.m);
}

const visibleMedia = (p: StoredProperty) => (p.media || []).filter((m) => !m.pending);
const coverFirst = (list: MediaItem[], coverId: string | null) => {
  const c = list.find((m) => m.id === coverId);
  return c ? [c, ...list.filter((m) => m !== c)] : list;
};

/** Each room with its description, amenities and photos/videos; then the untagged photos as "More photos". */
function roomSections(p: StoredProperty, media: MediaItem[]) {
  const rooms = (p.roomList || []).map((r) => ({
    id: r.id, name: r.name, description: r.description, amenities: r.amenities,
    media: guestMedia(media.filter((m) => m.roomId === r.id), p.roomList),
  }));
  const known = new Set(rooms.map((r) => r.id));
  const other = guestMedia(media.filter((m) => m.type === "image" && !(m.roomId && known.has(m.roomId))), p.roomList);
  return { rooms, other };
}

function guestMedia(list: MediaItem[], rooms: Room[] = []) {
  const names = new Map(rooms.map((r) => [r.id, r.name]));
  const room = (m: MediaItem) => (m.roomId && names.has(m.roomId) ? { roomId: m.roomId, room: names.get(m.roomId)! } : { roomId: null, room: "" });
  return list.map((m) =>
    m.type === "image"
      ? { id: m.id, type: "image" as const, src: imgUrl(m.url, 1600), thumb: imgUrl(m.url, 480, 360), srcSet: srcSet(m.url), caption: m.caption, width: m.width, height: m.height, ...room(m) }
      : { id: m.id, type: "video" as const, src: videoUrl(m.url), thumb: posterUrl(m.url, 480), poster: posterUrl(m.url, 1280), caption: m.caption, width: m.width, height: m.height, ...room(m) },
  );
}

/** Locality line guests see: "Society, Locality, City" (society only when allowed). */
export function publicPlace(p: Pick<StoredProperty, "location">) {
  const l = p.location || ({} as StoredProperty["location"]);
  return [l.showSociety !== false ? l.society : "", l.locality, l.city].filter(Boolean).join(", ");
}

/** Can a guest open this property at all? (`viaShare`: arrived with a valid share link.) */
export function guestCanView(p: Pick<StoredProperty, "status" | "visibility" | "archived">, viaShare: boolean) {
  if (p.archived || p.status !== "published") return false;
  return p.visibility === "public" || (viaShare && p.visibility === "unlisted");
}
/** Listed in search, home page, public map and sitemap. */
export const isListed = (p: Pick<StoredProperty, "status" | "visibility" | "archived">) => !p.archived && p.status === "published" && p.visibility === "public";

/** Property card for lists and the map. */
export function publicCard(p: StoredProperty, showPrice: boolean) {
  const cover = coverOf(p.media || [], p.coverId);
  const price = showPrice ? { weekday: p.pricing?.listing?.weekday ?? null, weekend: p.pricing?.listing?.weekend ?? null, from: fromPrice(p.pricing?.listing || { weekday: null, weekend: null }) } : null;
  return {
    code: p.code,
    slug: slugOf(p),
    title: p.title,
    shortDescription: p.shortDescription,
    propertyType: p.propertyType,
    category: p.category,
    place: publicPlace(p),
    locality: p.location?.locality || "",
    society: p.location?.showSociety !== false ? p.location?.society || "" : "",
    city: p.location?.city || "",
    approx: p.approx ? { lat: p.approx.lat, lng: p.approx.lng } : null,
    bedrooms: (p.rooms?.bedrooms as number) ?? null,
    bathrooms: (p.rooms?.bathrooms as number) ?? null,
    beds: (p.rooms?.beds as number) ?? null,
    maxGuests: (p.rooms?.maxGuests as number) ?? null,
    features: (p.features || []).slice(0, 3),
    allFeatures: p.features || [],
    amenities: p.amenities || [],
    availability: p.availability,
    availabilityLabel: AVAILABILITY_LABEL[p.availability] || "",
    featured: !!p.featured,
    cover: cover ? { src: imgUrl(cover.url, 800, 600), srcSet: srcSet(cover.url, [400, 800, 1200]), alt: cover.caption || p.title } : null,
    // Up to 8 photos (cover first, then your order) for the swipeable card carousel.
    images: (cover ? [cover, ...(p.media || []).filter((m) => m.type === "image" && !m.pending && m.id !== cover.id)] : []).slice(0, 8).map((m) => ({ src: imgUrl(m.url, 800, 600), alt: m.caption || p.title })),
    price,
    createdAt: p.publishedAt || p.createdAt,
    updatedAt: p.updatedAt,
  };
}
export type PublicCard = ReturnType<typeof publicCard>;

/** Full public property page. */
export function publicProperty(p: StoredProperty, showPrice: boolean, amenityDefs: AmenityDef[]) {
  const media = visibleMedia(p);
  const byKey = new Map(amenityDefs.map((a) => [a.key, a]));
  const pol = p.policies || {};
  return {
    ...publicCard(p, showPrice),
    description: p.description,
    rooms: {
      bedrooms: p.rooms?.bedrooms ?? null, bathrooms: p.rooms?.bathrooms ?? null, attachedBathrooms: p.rooms?.attachedBathrooms ?? null,
      beds: p.rooms?.beds ?? null, bedConfig: p.rooms?.bedConfig ?? "", maxGuests: p.rooms?.maxGuests ?? null,
      livingRoom: p.rooms?.livingRoom ?? null, kitchen: p.rooms?.kitchen ?? null, balconies: p.rooms?.balconies ?? null,
      floor: p.rooms?.floor ?? null, totalFloors: p.rooms?.totalFloors ?? null, lift: p.rooms?.lift ?? null,
      parking: p.rooms?.parking ?? null, sizeSqft: p.rooms?.sizeSqft ?? null,
    },
    amenityList: (p.amenities || []).map((k) => byKey.get(k)).filter((a): a is AmenityDef => !!a).map((a) => ({ key: a.key, label: a.label, category: a.category })),
    policies: {
      checkIn: pol.checkIn ?? "", checkOut: pol.checkOut ?? "", earlyCheckIn: pol.earlyCheckIn ?? "", lateCheckout: pol.lateCheckout ?? "",
      couples: pol.couples ?? null, unmarriedCouples: pol.unmarriedCouples ?? null, familyFriendly: pol.familyFriendly ?? null, pets: pol.pets ?? null,
      smoking: pol.smoking ?? "", alcohol: pol.alcohol ?? "", visitors: pol.visitors ?? "", ageRestriction: pol.ageRestriction ?? "",
      idRequirements: pol.idRequirements ?? "", rules: pol.rules ?? "",
    },
    // Your own order, cover first (the room-wise view is built from each photo's room).
    photos: guestMedia(coverFirst(media.filter((m) => m.type === "image"), p.coverId), p.roomList),
    videos: guestMedia(media.filter((m) => m.type === "video"), p.roomList),
    roomSections: roomSections(p, media),
    state: p.location?.state || "",
  };
}
export type PublicProperty = ReturnType<typeof publicProperty>;

/** What a host sees of their OWN property: no listing price, margin, admin notes or other hosts. */
export function hostProperty(p: StoredProperty) {
  const l = p.location || ({} as StoredProperty["location"]);
  return {
    id: p._id, code: p.code, slug: slugOf(p),
    title: p.title, shortDescription: p.shortDescription, description: p.description, propertyType: p.propertyType, category: p.category,
    status: p.status, statusLabel: STATUS_LABEL[p.status], visibility: p.visibility, availability: p.availability,
    location: { address: l.address, society: l.society, street: l.street, locality: l.locality, city: l.city, state: l.state, pin: l.pin, country: l.country, lat: l.lat, lng: l.lng, mapsUrl: l.mapsUrl },
    rooms: p.rooms, amenities: p.amenities, features: p.features, policies: p.policies,
    landing: { weekday: p.pricing?.landing?.weekday ?? null, weekend: p.pricing?.landing?.weekend ?? null },
    airbnbUrl: p.private?.airbnbUrl || "",
    hostNotes: p.private?.hostNotes || "",
    contactName: p.private?.contactName || "", contactPhone: p.private?.contactPhone || "",
    roomList: p.roomList || [],
    media: (p.media || []).map((m) => ({ id: m.id, type: m.type, url: m.url, thumb: m.type === "image" ? imgUrl(m.url, 320, 240) : posterUrl(m.url, 320), caption: m.caption, pending: m.pending, removalRequested: m.removalRequested, by: m.by, roomId: m.roomId || null })),
    coverId: p.coverId,
    hostChangesPending: !!p.hostChanges,
    pendingChanges: p.hostChanges?.data || null,
    publishRequested: !!p.publishRequested,
    review: p.review ? { reason: p.review.reason, action: p.review.action, at: p.review.at } : null,
    createdAt: p.createdAt, updatedAt: p.updatedAt,
  };
}

/** Everything, for the administrator, plus calculated margins. */
export function adminProperty(p: StoredProperty, host?: { _id: string; name: string; phone?: string; whatsapp?: string; email?: string; hostCode?: string } | null) {
  return {
    id: p._id, code: p.code, slug: slugOf(p), ownership: p.ownership, hostId: p.hostId,
    host: host ? { id: host._id, name: host.name, phone: host.phone || "", whatsapp: host.whatsapp || "", email: host.email || "", hostCode: host.hostCode || "" } : null,
    title: p.title, shortDescription: p.shortDescription, description: p.description, propertyType: p.propertyType, category: p.category,
    status: p.status, statusLabel: STATUS_LABEL[p.status], visibility: p.visibility, availability: p.availability, featured: !!p.featured, showPrice: p.showPrice !== false,
    location: p.location, approx: p.approx, rooms: p.rooms, amenities: p.amenities, features: p.features, policies: p.policies,
    pricing: p.pricing, margins: margins(p.pricing || { landing: { weekday: null, weekend: null }, listing: { weekday: null, weekend: null } }),
    airbnbUrl: p.private?.airbnbUrl || "", adminNotes: p.private?.adminNotes || "", ownerName: p.private?.ownerName || "", hostNotes: p.private?.hostNotes || "",
    contactName: p.private?.contactName || "", contactPhone: p.private?.contactPhone || "",
    slugText: p.slugText || "", roomList: p.roomList || [],
    media: (p.media || []).map((m) => ({ ...m, roomId: m.roomId || null, thumb: m.type === "image" ? imgUrl(m.url, 320, 240) : posterUrl(m.url, 320) })),
    coverId: p.coverId, hostChanges: p.hostChanges, publishRequested: !!p.publishRequested, review: p.review, archived: !!p.archived,
    createdAt: p.createdAt, updatedAt: p.updatedAt, approvedAt: p.approvedAt ?? null, publishedAt: p.publishedAt ?? null,
    submittedAt: p.submittedAt ?? null, lastVerifiedAt: p.lastVerifiedAt ?? null,
  };
}

/** Guest-safe bundle the admin can save on their phone for offline use (no private data, by design). */
export function offlineBundle(p: StoredProperty, amenityDefs: AmenityDef[]) {
  const pub = publicProperty(p, true, amenityDefs);
  return {
    id: p._id, code: p.code, slug: pub.slug, title: pub.title, shortDescription: pub.shortDescription, description: pub.description,
    place: pub.place, propertyType: pub.propertyType, rooms: pub.rooms, amenities: pub.amenityList.map((a) => a.label), features: pub.allFeatures,
    price: { weekday: p.pricing?.listing?.weekday ?? null, weekend: p.pricing?.listing?.weekend ?? null },
    availability: p.availability, cover: pub.cover?.src || null,
    thumbs: pub.photos.slice(0, 6).map((x) => x.thumb),
    updatedAt: p.updatedAt,
  };
}

type HostLite = { _id: string; name: string; phone?: string; whatsapp?: string; hostCode?: string; ownerName?: string } | null | undefined;

/**
 * Extra details for the ADMIN-ONLY browsing view of the guest site (never sent unless the request carries a valid
 * admin login AND the admin switched browsing view on). Includes landing prices and margins.
 */
export function adminExtras(p: StoredProperty, host: HostLite) {
  const l = p.location || ({} as StoredProperty["location"]);
  const exact = l.lat !== null && l.lng !== null && l.lat !== undefined ? `${l.lat},${l.lng}` : "";
  return {
    id: p._id, status: p.status, statusLabel: STATUS_LABEL[p.status], visibility: p.visibility, archived: !!p.archived, showPrice: p.showPrice !== false,
    ownership: p.ownership,
    host: host ? { name: host.name, ownerName: host.ownerName || "", hostCode: host.hostCode || "", phone: host.phone || "", whatsapp: host.whatsapp || host.phone || "" } : null,
    ownerName: p.private?.ownerName || "",
    contact: p.private?.contactPhone ? { name: p.private?.contactName || "", phone: p.private.contactPhone } : null,
    // Full address, adding society/street/locality/… only when the typed address doesn't already contain them.
    address: [l.address, ...[l.society, l.street, l.locality, l.city, l.state, l.pin].filter((x) => x && !(l.address || "").toLowerCase().includes(x.toLowerCase()))].filter(Boolean).join(", "),
    directions: l.mapsUrl || (exact ? `https://www.google.com/maps/search/?api=1&query=${exact}` : ""),
    airbnbUrl: p.private?.airbnbUrl || "", adminNotes: p.private?.adminNotes || "", hostNotes: p.private?.hostNotes || "",
    listing: { weekday: p.pricing?.listing?.weekday ?? null, weekend: p.pricing?.listing?.weekend ?? null },
    landing: { weekday: p.pricing?.landing?.weekday ?? null, weekend: p.pricing?.landing?.weekend ?? null },
    margins: margins(p.pricing || { landing: { weekday: null, weekend: null }, listing: { weekday: null, weekend: null } }),
  };
}
export type AdminExtras = ReturnType<typeof adminExtras>;
