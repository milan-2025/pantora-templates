import { describe, expect, it } from "vitest";
import { busyNights, cleanSite, cleanSlug, cleanWhatsApp, datesFree, enquiryText, isSitePhoto, listingIdFromPath, listingPath, publicListing, showsOnSite } from "../lib/hostbook/site";

const photo = "https://res.cloudinary.com/demo/image/upload/v1/hostbook-site/abc/x1.jpg";

describe("host booking website rules", () => {
  it("turns a business name into a website address, and refuses short or reserved ones", () => {
    expect(cleanSlug("Pine View Homestays!")).toEqual({ slug: "pine-view-homestays" });
    expect(cleanSlug("  sunny__homes  ")).toEqual({ slug: "sunny-homes" });
    expect(cleanSlug("ab")).toHaveProperty("error");
    expect(cleanSlug("admin")).toHaveProperty("error");
    expect(cleanSlug("hostbook")).toHaveProperty("error");
    expect(cleanSlug("x".repeat(41))).toHaveProperty("error");
  });

  it("adds +91 to Indian mobiles and refuses numbers WhatsApp can't open", () => {
    expect(cleanWhatsApp("98765 43210")).toBe("919876543210");
    expect(cleanWhatsApp("+91 98765-43210")).toBe("919876543210");
    expect(cleanWhatsApp("09876543210")).toBe("919876543210");
    expect(cleanWhatsApp("+44 7911 123456")).toBe("447911123456");
    expect(cleanWhatsApp("12345")).toBe("");
  });

  it("only shows photos uploaded through HostBook", () => {
    expect(isSitePhoto(photo, "demo")).toBe(true);
    expect(isSitePhoto(photo, "other")).toBe(false);
    expect(isSitePhoto("http://res.cloudinary.com/demo/image/upload/x.jpg")).toBe(false);
    expect(isSitePhoto('https://res.cloudinary.com/demo/image/upload/x.jpg" onerror="x')).toBe(false);
    expect(isSitePhoto("https://evil.example/x.jpg")).toBe(false);
    expect(cleanSite({ on: true, heroUrl: "https://evil.example/x.jpg", whatsapp: "9876543210", instagram: "@pine.view!" }, "demo")).toMatchObject({ on: true, heroUrl: "", whatsapp: "919876543210", instagram: "pine.view" });
  });

  it("never puts the exact address, Wi-Fi, money or owner details on the public page", () => {
    const l = publicListing({
      _id: "L1", name: "Sea View 2BHK", city: "Goa", area: "Calangute", address: "Flat 4, Lane 9", mapUrl: "https://maps.app.goo.gl/x", wifiName: "home", wifiPass: "secret",
      guidebook: "door code 1234", cleaningFee: 500, commission: 10, ownerId: "o1", gstin: "X", ical: [{ url: "https://airbnb/ical" }],
      photos: [photo, "https://evil.example/y.jpg"], price: 3500, maxGuests: 4, amenities: ["Wi-Fi", "Hot tub of doom"], onSite: true,
    }, "demo");
    const text = JSON.stringify(l);
    for (const secret of ["Flat 4", "maps.app", "secret", "door code", "airbnb/ical", "evil.example", "Hot tub"]) expect(text).not.toContain(secret);
    expect(l).toMatchObject({ id: "L1", name: "Sea View 2BHK", area: "Calangute", price: 3500, maxGuests: 4, photos: [photo], amenities: ["Wi-Fi"] });
    expect(showsOnSite({ onSite: true })).toBe(true);
    expect(showsOnSite({ onSite: true, archived: true })).toBe(false);
    expect(showsOnSite({})).toBe(false);
  });

  it("works out booked nights: check-in night taken, check-out day free, cancelled bookings ignored", () => {
    const bookings = [
      { listingId: "L1", start: "2026-12-10", end: "2026-12-13", status: "confirmed" },
      { listingId: "L1", start: "2026-12-20", end: "2026-12-22", status: "cancelled" },
      { listingId: "L2", start: "2026-12-10", end: "2026-12-12" },
      { listingId: "L1", start: "2026-11-25", end: "2026-12-02" },
    ];
    const busy = busyNights(bookings, "L1", "2026-12-01", 60);
    expect(busy).toEqual(["2026-12-01", "2026-12-10", "2026-12-11", "2026-12-12"]);
    expect(datesFree(busy, "2026-12-13", "2026-12-15")).toBe(true); // arrive on the day others leave
    expect(datesFree(busy, "2026-12-08", "2026-12-11")).toBe(false);
    expect(datesFree(busy, "2026-12-05", "2026-12-05")).toBe(false);
  });

  it("writes the guest's WhatsApp message", () => {
    const t = enquiryText({ site: "Pine View", listing: "Sea View 2BHK", start: "2026-12-13", end: "2026-12-15", guests: 3, name: "Riya" });
    expect(t).toContain("Hi Pine View! I'd like to book Sea View 2BHK.");
    expect(t).toContain("(2 nights)");
    expect(t).toContain("Guests: 3");
    expect(t).toContain("Name: Riya");
    expect(enquiryText({ site: "", listing: "X" })).toContain("Dates: flexible");
  });

  it("makes readable listing addresses that still work after a rename", () => {
    const p = listingPath({ id: "a1B_c2", name: "Sea View 2BHK!" });
    expect(p).toBe("sea-view-2bhk--a1B_c2");
    expect(listingIdFromPath(p)).toBe("a1B_c2");
    expect(listingIdFromPath("old-name--a1B_c2")).toBe("a1B_c2");
    expect(listingIdFromPath("a1B_c2")).toBe("a1B_c2");
  });
});
