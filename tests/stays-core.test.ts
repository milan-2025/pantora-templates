import { describe, expect, it } from "vitest";
import {
  approxCoords, cleanGuests, cleanMapsUrl, cleanMoney, codeFromSlug, coordsFromMapsUrl, distanceM, enquiryMessage, fillTemplate, formatCode,
  inr, margins, propertySlug, waLink, waNumber, cleanDate, cleanPrefix,
} from "@/lib/stays/core";
import { cleanAdminInput, cleanAirbnbUrl, cleanHostInput, auditDiff, missingForReview } from "@/lib/stays/property";
import { transition } from "@/lib/stays/workflow";
import { coverOf, imgUrl, inFolder, posterUrl, reorder, validDeliveryUrl, type MediaItem } from "@/lib/stays/media";
import { guestCanView, hostProperty, publicCard, publicProperty, type StoredProperty } from "@/lib/stays/views";
import { matches, parseQuery, search, sortCards, suggest } from "@/lib/stays/search";
import { blankPropertyForTests } from "./staysFixtures";

describe("property IDs and slugs", () => {
  it("formats and parses", () => {
    expect(formatCode("LAC", 1)).toBe("LAC-0001");
    expect(formatCode("HST", 12345)).toBe("HST-12345");
    expect(propertySlug("Sea View 2BHK!", "LAC-0007")).toBe("sea-view-2bhk-LAC-0007");
    expect(codeFromSlug("sea-view-2bhk-LAC-0007")).toBe("LAC-0007");
    expect(codeFromSlug("whatever-lac-0007")).toBe("LAC-0007");
    expect(codeFromSlug("no-code-here")).toBe("");
    expect(cleanPrefix("l4c!", "X")).toBe("LC");
    expect(cleanPrefix("a", "LAC")).toBe("LAC");
  });
});

describe("7. pricing", () => {
  it("calculates margins from the brief's example", () => {
    const m = margins({ landing: { weekday: 2000, weekend: 2500 }, listing: { weekday: 2500, weekend: 3000 } });
    expect(m).toMatchObject({ weekday: 500, weekend: 500, weekdayPct: 20, weekendPct: 16.7, perWeek: 3500, missing: false, negative: false });
  });
  it("flags missing and negative margins", () => {
    expect(margins({ landing: { weekday: 2000, weekend: null }, listing: { weekday: 1800, weekend: 3000 } })).toMatchObject({ weekday: -200, weekend: null, missing: true, negative: true, perWeek: null });
  });
  it("cleans money input", () => {
    expect(cleanMoney("₹2,500")).toBe(2500);
    expect(cleanMoney("")).toBeNull();
    expect(cleanMoney(-5)).toBeNull();
    expect(cleanMoney("abc")).toBeNull();
    expect(inr(250000)).toBe("₹2,50,000");
  });
});

describe("maps and approximate location", () => {
  it("reads coordinates from Google Maps links", () => {
    expect(coordsFromMapsUrl("https://www.google.com/maps/place/X/@30.7046,76.7179,17z")).toEqual({ lat: 30.7046, lng: 76.7179 });
    expect(coordsFromMapsUrl("https://maps.google.com/?q=30.70461,76.71791")).toEqual({ lat: 30.70461, lng: 76.71791 });
    expect(coordsFromMapsUrl("https://www.google.com/maps/place/X/data=!3d30.1!4d76.2")).toEqual({ lat: 30.1, lng: 76.2 });
    expect(coordsFromMapsUrl("30.5, 76.5")).toEqual({ lat: 30.5, lng: 76.5 });
    expect(coordsFromMapsUrl("https://maps.app.goo.gl/abc")).toBeNull();
  });
  it("only keeps real Google Maps links", () => {
    expect(cleanMapsUrl("https://maps.app.goo.gl/abc")).toBe("https://maps.app.goo.gl/abc");
    expect(cleanMapsUrl("https://evil.com/maps")).toBe("");
    expect(cleanMapsUrl("http://maps.google.com/")).toBe("");
    expect(cleanMapsUrl("https://www.google.com/search?q=x")).toBe("");
  });
  it("approximate position is 250–650 m away, rounded, and different per seed", () => {
    for (let i = 0; i < 50; i++) {
      const seed = new Uint8Array([i * 5, i * 7, i * 11, i * 13]);
      const a = approxCoords(30.70123, 76.71456, seed);
      const d = distanceM({ lat: 30.70123, lng: 76.71456 }, a);
      expect(d).toBeGreaterThan(150); // rounding to 3 decimals moves it up to ~80 m
      expect(d).toBeLessThan(750);
      expect(String(a.lat).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(3);
    }
  });
});

describe("16–17. WhatsApp messages", () => {
  it("normalises numbers (default number gets the India code)", () => {
    expect(waNumber("8437512120")).toBe("918437512120");
    expect(waNumber("+91 84375 12120")).toBe("918437512120");
    expect(waNumber("08437512120")).toBe("918437512120");
    expect(waNumber("12345")).toBe("");
  });
  it("simple enquiry contains title and property ID, properly URL-encoded", () => {
    const msg = enquiryMessage("simple", { title: "Sea & Sky Villa", id: "LAC-0001" });
    expect(msg).toBe("Hello, I am interested in this property.\n\nProperty: Sea & Sky Villa\nProperty ID: LAC-0001\n\nPlease share more details.");
    const link = waLink("8437512120", msg);
    expect(link.startsWith("https://wa.me/918437512120?text=")).toBe(true);
    expect(decodeURIComponent(link.split("text=")[1])).toBe(msg);
    expect(link).not.toContain(" ");
    expect(link).toContain("%26"); // & encoded
  });
  it("dates and guests fill in", () => {
    const g = cleanGuests({ adults: 2, children: 1 });
    const msg = enquiryMessage("dates", { title: "T", id: "HST-0002", location: "Sector 70, Mohali", checkin: "2026-12-24", checkout: "2026-12-27", ...g });
    expect(msg).toContain("Property ID: HST-0002");
    expect(msg).toContain("Location: Sector 70, Mohali");
    expect(msg).toContain("Check-in: 24 Dec 2026");
    expect(msg).toContain("Check-out: 27 Dec 2026");
    expect(msg).toContain("Adults: 2\nChildren: 1\nTotal Guests: 3");
  });
  it("exact location template and custom templates", () => {
    expect(enquiryMessage("location", { title: "T", id: "LAC-0003" })).toContain("Please share the exact location and directions.");
    expect(enquiryMessage("simple", { id: "LAC-1" }, { simple: "Hi {id} {unknown}" })).toBe("Hi LAC-1 {unknown}");
    expect(fillTemplate("{guests}", { guests: 4 })).toBe("4");
  });
  it("guest counts and dates are sane", () => {
    expect(cleanGuests({ adults: 0, children: -1 })).toEqual({ adults: 1, children: 0, guests: 1 });
    expect(cleanGuests({ adults: 2, children: 0, guests: 5 }).guests).toBe(5);
    expect(cleanDate("2026-02-30")).toBe("");
    expect(cleanDate("2026-02-28")).toBe("2026-02-28");
  });
});

describe("input cleaning by role", () => {
  const keys = new Set(["wifi", "pool"]);
  it("host input cannot carry admin-only fields", () => {
    const h = cleanHostInput({ title: "X", status: "published", visibility: "public", featured: true, pricing: { listing: { weekday: 1 } }, adminNotes: "x", hostId: "other", amenities: ["wifi", "nope"] }, keys) as Record<string, unknown>;
    for (const k of ["status", "visibility", "featured", "pricing", "adminNotes", "hostId", "showPrice", "ownership"]) expect(h).not.toHaveProperty(k);
    expect(h.amenities).toEqual(["wifi"]);
  });
  it("admin input whitelists enums and links", () => {
    const a = cleanAdminInput({ visibility: "everyone", availability: "x", airbnbUrl: "https://evil.com/rooms/1" }, keys);
    expect(a.visibility).toBe("public");
    expect(a.availability).toBe("available");
    expect(a.airbnbUrl).toBe("");
    expect(cleanAirbnbUrl("https://www.airbnb.co.in/rooms/1")).toBe("https://www.airbnb.co.in/rooms/1");
  });
  it("coordinates come from the maps link when not typed", () => {
    const a = cleanAdminInput({ location: { mapsUrl: "https://www.google.com/maps/@30.7,76.7,15z" } }, keys);
    expect(a.location).toMatchObject({ lat: 30.7, lng: 76.7 });
  });
  it("review needs the basics", () => {
    expect(missingForReview({ title: "", location: { city: "", locality: "" }, rooms: {} })).toEqual(["title", "city", "locality", "maximum guests"]);
  });
  it("audit diff lists only changed audited fields", () => {
    const d = auditDiff({ pricing: { landing: { weekday: 1 } }, title: "a" }, { pricing: { landing: { weekday: 2 } }, title: "b" });
    expect(d).toEqual([{ field: "pricing.landing.weekday", from: 1, to: 2 }]);
  });
});

describe("workflow", () => {
  it("hosts can submit but never approve or publish", () => {
    expect(transition("host", "submit", "draft")).toEqual({ ok: true, to: "submitted" });
    expect(transition("host", "approve", "submitted").ok).toBe(false);
    expect(transition("host", "publish", "approved").ok).toBe(false);
    expect(transition("host", "submit", "published").ok).toBe(false);
  });
  it("admin transitions", () => {
    expect(transition("admin", "publish", "approved")).toEqual({ ok: true, to: "published" });
    expect(transition("admin", "unpublish", "draft").ok).toBe(false);
    expect(transition("admin", "reactivate", "inactive")).toEqual({ ok: true, to: "approved" });
  });
});

describe("media", () => {
  const item = (id: string, over: Partial<MediaItem> = {}): MediaItem => ({ id, type: "image", publicId: `stays/p1/${id}`, url: `https://res.cloudinary.com/c/image/upload/v1/stays/p1/${id}.jpg`, width: 1, height: 1, bytes: 1, duration: null, caption: "", pending: false, removalRequested: false, by: "admin", at: 1, ...over });
  it("folder and URL checks", () => {
    expect(inFolder("stays/p1/abc", "p1")).toBe(true);
    expect(inFolder("stays/p1/../p2/abc", "p1")).toBe(false);
    expect(inFolder("stays/p2/abc", "p1")).toBe(false);
    expect(inFolder("stays/p1/sub/abc", "p1")).toBe(false);
    expect(validDeliveryUrl("https://res.cloudinary.com/c/image/upload/v12/stays/p1/a.jpg", "c", "image", "stays/p1/a")).toBe(true);
    expect(validDeliveryUrl("https://evil.com/c/image/upload/v12/stays/p1/a.jpg", "c", "image", "stays/p1/a")).toBe(false);
  });
  it("transformations", () => {
    expect(imgUrl("https://res.cloudinary.com/c/image/upload/v1/a.jpg", 800)).toBe("https://res.cloudinary.com/c/image/upload/f_auto,q_auto,c_limit,w_800/v1/a.jpg");
    expect(posterUrl("https://res.cloudinary.com/c/video/upload/v1/a.mp4", 400)).toBe("https://res.cloudinary.com/c/video/upload/so_1,f_auto,q_auto,c_limit,w_400/v1/a.jpg");
  });
  it("cover and order", () => {
    const list = [item("a"), item("b", { pending: true }), item("c")];
    expect(coverOf(list, "b")?.id).toBe("a"); // pending can't be the public cover
    expect(coverOf(list, "c")?.id).toBe("c");
    expect(reorder(list, ["c", "zz", "a"]).map((m) => m.id)).toEqual(["c", "a", "b"]);
  });
});

describe("views never leak", () => {
  const p: StoredProperty = blankPropertyForTests();
  it("guest views", () => {
    const pub = JSON.stringify(publicProperty(p, false, []));
    for (const s of ["SECRET ADDRESS", "secret street", "123456", "30.11111", "76.22222", "airbnb", "ADMIN NOTE", "HOST NOTE", "OWNER"]) expect(pub).not.toContain(s);
    expect(publicProperty(p, false, []).price).toBeNull();
    expect(publicCard(p, true).price).toEqual({ weekday: 3000, weekend: 4000, from: 3000 });
    expect(JSON.stringify(publicCard(p, true))).not.toContain("1111"); // landing
  });
  it("host view has no listing price or admin notes", () => {
    const h = JSON.stringify(hostProperty(p));
    expect(h).not.toContain("3000");
    expect(h).not.toContain("ADMIN NOTE");
    expect(h).not.toContain("margin");
  });
  it("visibility rules", () => {
    expect(guestCanView({ status: "published", visibility: "public", archived: false }, false)).toBe(true);
    expect(guestCanView({ status: "published", visibility: "unlisted", archived: false }, false)).toBe(false);
    expect(guestCanView({ status: "published", visibility: "unlisted", archived: false }, true)).toBe(true);
    expect(guestCanView({ status: "published", visibility: "private", archived: false }, true)).toBe(false);
    expect(guestCanView({ status: "approved", visibility: "public", archived: false }, true)).toBe(false);
    expect(guestCanView({ status: "published", visibility: "public", archived: true }, true)).toBe(false);
  });
});

describe("search", () => {
  const base = blankPropertyForTests();
  const card = (code: string, over: Partial<StoredProperty> = {}, showPrice = true) => publicCard({ ...base, code, ...over } as StoredProperty, showPrice);
  const cards = [
    card("A-0001", { title: "Cheap studio", propertyType: "Studio", pricing: { landing: { weekday: 1, weekend: 1 }, listing: { weekday: 1500, weekend: 1800 } } }),
    card("A-0002", { title: "Big villa", propertyType: "Villa", featured: true, rooms: { bedrooms: 5, maxGuests: 14 }, location: { ...base.location, city: "Kasauli", locality: "Upper Mall" } }),
    card("A-0003", { title: "Secret price", pricing: { landing: { weekday: 1, weekend: 1 }, listing: { weekday: 900, weekend: 900 } } }, false),
  ];
  it("filters and sorts", () => {
    expect(search(cards, parseQuery(new URLSearchParams("maxPrice=2000"))).results.map((c) => c.code)).toEqual(["A-0001"]);
    expect(sortCards(cards, "price_asc").map((c) => c.code)).toEqual(["A-0001", "A-0002", "A-0003"]);
    expect(sortCards(cards, "recommended")[0].code).toBe("A-0002");
    expect(matches(cards[1], parseQuery(new URLSearchParams("type=4BHK%2B")))).toBe(true);
    expect(search(cards, parseQuery(new URLSearchParams("q=villa kasauli"))).results.map((c) => c.code)).toEqual(["A-0002"]);
    expect(search(cards, parseQuery(new URLSearchParams("guests=10"))).total).toBe(1);
  });
  it("suggests places", () => {
    expect(suggest(cards, "kas")[0]).toMatchObject({ label: "Kasauli", kind: "city" });
  });
});
