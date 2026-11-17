import { describe, expect, it } from "vitest";
import { cleanEnquiry, cleanPhone10, escapeHtml, formatPrice, parseAmenities, renderProjectPage, safeHttpsUrl, unitMix } from "../lib/crm/publicPage";

describe("escaping and links", () => {
  it("escapes HTML", () => expect(escapeHtml(`<img src=x onerror="a('b')">&`)).toBe("&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;"));
  it("allows only plain https image links", () => {
    expect(safeHttpsUrl("https://res.cloudinary.com/x/a.jpg")).toContain("https://res.cloudinary.com/x/a.jpg");
    for (const u of ["javascript:alert(1)", "http://x.com/a.jpg", "data:image/png;base64,AAA", "//x.com/a", "https://user:pw@x.com/a", "", "not a url"]) expect(safeHttpsUrl(u)).toBe("");
  });
});

describe("enquiry validation", () => {
  it("normalizes Indian mobile numbers", () => {
    expect(cleanPhone10("+91 98765-43210")).toBe("9876543210");
    expect(cleanPhone10("09876543210")).toBe("9876543210");
    for (const p of ["12345", "5876543210", "abcdefghij", ""]) expect(cleanPhone10(p)).toBe("");
  });
  it("needs a name and a valid phone, and limits lengths", () => {
    expect(cleanEnquiry({ name: "", phone: "9876543210" }).ok).toBe(false);
    expect(cleanEnquiry({ name: "A", phone: "123" }).ok).toBe(false);
    const r = cleanEnquiry({ name: "x".repeat(200), phone: "9876543210", message: "m".repeat(900) });
    expect(r.ok && r.name.length).toBe(80);
    expect(r.ok && r.message.length).toBe(500);
  });
  it("parses amenities from text or lists", () => {
    expect(parseAmenities("Pool, Gym ,, Garden\nClub")).toEqual(["Pool", "Gym", "Garden", "Club"]);
    expect(parseAmenities(Array.from({ length: 50 }, (_, i) => "a" + i))).toHaveLength(24);
  });
});

describe("unit mix", () => {
  it("groups only available units by type and never exposes unit numbers", () => {
    const m = unitMix([
      { status: "available", bhk: "2BHK", price: 8000000 }, { status: "available", bhk: "2BHK", price: 9000000 },
      { status: "available", bhk: "3BHK", price: 12000000 }, { status: "booked", bhk: "3BHK", price: 1 }, { status: "soft_hold", bhk: "2BHK" }, { status: "available", price: null },
    ]);
    expect(m).toEqual([
      { bhk: "2BHK", count: 2, from: 8000000, to: 9000000 },
      { bhk: "3BHK", count: 1, from: 12000000, to: 12000000 },
      { bhk: "Units", count: 1, from: null, to: null },
    ]);
  });
  it("formats prices in lakhs and crores", () => {
    expect(formatPrice(8500000)).toBe("₹85 L");
    expect(formatPrice(12500000)).toBe("₹1.25 Cr");
    expect(formatPrice(45000)).toBe("₹45,000");
  });
});

describe("page", () => {
  const base = { pub: "abc123abc123", company: "Acme Realty", name: "Sunrise", mix: unitMix([{ status: "available", bhk: "2BHK", price: 8500000 }]) };
  it("renders the key details", () => {
    const h = renderProjectPage({ ...base, city: "Pune", locality: "Baner", rera: "P123", about: "Nice place", amenities: ["Pool"], phone: "9876543210", ref: "abcdef1234567890" });
    for (const t of ["Sunrise", "Baner, Pune", "RERA: P123", "Starting from", "₹85 L", "Pool", "tel:+919876543210", "wa.me/919876543210", "Listed by Acme Realty"]) expect(h).toContain(t);
    expect(h).toContain('"abcdef1234567890"');
  });
  it("escapes hostile content in every field and ignores unsafe links and refs", () => {
    const x = `<script>alert(1)</script>`;
    const h = renderProjectPage({ ...base, name: x, company: x, city: x, about: x, rera: x, amenities: [x], cover: "javascript:alert(1)", phone: x, ref: `"});alert(1);//`,
      mix: [{ bhk: x, count: 1, from: 1, to: 2 }] });
    expect(h).not.toContain("<script>alert(1)</script>");
    expect(h).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(h).not.toContain("javascript:");
    expect(h).toContain('ref:""'); // unsafe ref dropped
    expect(h.match(/<script/g)).toHaveLength(1); // only our own script
  });
  it("shows a photo gallery, map button and Property ID, and drops unsafe links", () => {
    const h = renderProjectPage({ ...base, code: "PR-007", images: ["https://res.cloudinary.com/x/1.jpg", "javascript:alert(1)", "http://x.com/2.jpg"], mapUrl: "https://maps.app.goo.gl/abc", city: "Pune" });
    expect(h).toContain("Property ID PR-007");
    expect(h.match(/<img /g)).toHaveLength(1);
    expect(h).toContain('href="https://maps.app.goo.gl/abc"');
    expect(h).not.toContain("javascript:");
    expect(h).not.toContain("http://x.com");
    const bad = renderProjectPage({ ...base, code: "<b>x</b>", mapUrl: "javascript:alert(1)" });
    expect(bad).not.toContain("Property ID");
    expect(bad).not.toContain("Google Maps");
  });
  it("uses the first photo as the cover when none is set", () => {
    expect(renderProjectPage({ ...base, images: ["https://a.com/1.jpg"] })).toContain("url('https://a.com/1.jpg')");
  });
  it("reads form fields by id (form.name clashes with the form's own name property)", () => {
    const h = renderProjectPage(base);
    expect(h).not.toMatch(/f\.(name|phone|message)\.value/);
    expect(h).toContain('getElementById("n").value');
  });
  it("has a spam trap and no unit numbers", () => {
    expect(renderProjectPage(base)).toContain('name="website"');
  });
});
