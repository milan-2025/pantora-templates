import type { StoredProperty } from "@/lib/stays/views";

/** A full stored property full of recognisable private values, for leak tests. */
export function blankPropertyForTests(): StoredProperty {
  return {
    _id: "p1", code: "LAC-0001", ownership: "host", hostId: "h1",
    title: "Test Stay", shortDescription: "Short", description: "Long", propertyType: "2BHK", category: "Family stay",
    status: "published", visibility: "public", availability: "available", featured: false, showPrice: true,
    location: { address: "SECRET ADDRESS", society: "Palm", street: "secret street", locality: "Sector 9", city: "Mohali", state: "Punjab", pin: "123456", country: "India", lat: 30.11111, lng: 76.22222, mapsUrl: "https://maps.app.goo.gl/secretlink", showSociety: true },
    approx: { lat: 30.114, lng: 76.219 },
    rooms: { bedrooms: 2, bathrooms: 2, maxGuests: 4 }, amenities: [], features: ["Mountain view"], policies: {},
    pricing: { landing: { weekday: 1111, weekend: 1111 }, listing: { weekday: 3000, weekend: 4000 } },
    private: { airbnbUrl: "https://www.airbnb.com/rooms/1", adminNotes: "ADMIN NOTE", ownerName: "OWNER", hostNotes: "HOST NOTE" },
    media: [], coverId: null, hostChanges: null, publishRequested: false, review: null, archived: false, createdAt: 1, updatedAt: 2,
  };
}
