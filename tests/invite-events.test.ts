import { describe, it, expect, vi, beforeAll } from "vitest";
vi.mock("server-only", () => ({}));

import { cleanState, mapsOk, ogImage } from "@/lib/invites";

const C = "https://res.cloudinary.com/democloud/image/upload/v1/shaadi/x";
beforeAll(() => {
  process.env.CLOUDINARY_URL = "cloudinary://key:secret@democloud";
});

describe("event photo, icon and Google Maps link", () => {
  it("keeps real Google Maps links and drops anything else", () => {
    expect(mapsOk("https://maps.app.goo.gl/AbC123xyz")).toBe(true);
    expect(mapsOk("https://www.google.com/maps/place/Leela+Palace/@28.5,77.1,17z")).toBe(true);
    expect(mapsOk("https://goo.gl/maps/abc")).toBe(true);
    expect(mapsOk("https://maps.google.co.in/?q=Leela")).toBe(true);
    expect(mapsOk("https://evil.com/maps.app.goo.gl/")).toBe(false);
    expect(mapsOk("javascript:alert(1)")).toBe(false);
    expect(mapsOk("http://maps.app.goo.gl/x")).toBe(false);
  });
  it("saves only our own photo uploads, Maps links and short icon keys on events", () => {
    const st = cleanState({
      b: "A",
      g: "B",
      ev: [
        { n: "Haldi", d: "2026-12-01T10:00", v: "Home", im: `${C}/haldi.jpg`, mp: "https://maps.app.goo.gl/AbC", ic: "haldi" },
        { n: "Wedding", im: "https://evil.com/x.jpg", mp: "https://evil.com", ic: "<script>" },
      ],
    })!;
    const ev = st.ev as Record<string, unknown>[];
    expect(ev[0]).toMatchObject({ im: `${C}/haldi.jpg`, mp: "https://maps.app.goo.gl/AbC", ic: "haldi" });
    expect(ev[1]).toEqual({ n: "Wedding" });
  });
});

describe("link preview image", () => {
  it("uses the chosen picture, cropped to the WhatsApp shape", () => {
    expect(ogImage({ og: `${C}/og.jpg`, ph: [`${C}/p1.jpg`] })).toBe(
      "https://res.cloudinary.com/democloud/image/upload/c_fill,g_auto,w_1200,h_630,q_auto:good,f_jpg/v1/shaadi/x/og.jpg",
    );
  });
  it("falls back to the first photo, skipping videos, else the site default", () => {
    expect(ogImage({ ph: ["https://res.cloudinary.com/democloud/video/upload/v1/a.mp4", `${C}/p1.jpg`] })).toContain("/p1.jpg");
    expect(ogImage({ ph: [] })).toBeNull();
  });
  it("never saves a preview image from another site", () => {
    expect(cleanState({ b: "A", g: "B", og: "https://evil.com/x.jpg" })!.og).toBeUndefined();
    expect(cleanState({ b: "A", g: "B", og: `${C}/og.jpg` })!.og).toBe(`${C}/og.jpg`);
  });
});
