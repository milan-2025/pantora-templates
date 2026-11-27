import { describe, expect, it } from "vitest";
import { appJsonLd, jsonLdScript, stickyCtaHtml } from "../lib/appPage";
import { REVIEW_PRODUCTS, reviewsHtml } from "../lib/reviews";

describe("app page pieces", () => {
  it("gives Google the live prices, lowest to highest", () => {
    const ld = appJsonLd({ name: "X", url: "https://x/y", description: "d", offers: [{ name: "Free", price: 0 }, { name: "Basic", price: 1299 }, { name: "Royal", price: 5999 }] });
    expect(ld).toMatchObject({ "@type": "SoftwareApplication", offers: { "@type": "AggregateOffer", priceCurrency: "INR", lowPrice: 0, highPrice: 5999, offerCount: 3 } });
    expect(appJsonLd({ name: "X", url: "u", description: "d", offers: [] })).not.toHaveProperty("offers");
    expect(jsonLdScript({ a: "</script><b>" })).not.toContain("</script><b>");
  });
  it("shows reviews safely, and nothing when there are none", () => {
    expect(reviewsHtml([], "Heading")).toBe("");
    const h = reviewsHtml([{ name: "Riya <b>", detail: "Bride", quote: 'Loved it "a lot"' }], "Couples");
    expect(h).toContain("Riya &lt;b&gt;");
    expect(h).toContain("&quot;a lot&quot;");
    expect(REVIEW_PRODUCTS.map((p) => p.key)).toEqual(["invites", "photos", "workout", "hostbook", "crm"]);
  });
  it("hides the phone button over the closing section and on wide screens", () => {
    const h = stickyCtaHtml('Make "it"', "/shaadi/create?x=1&y=2", { bg: "#7a1424", fg: "#fff" });
    expect(h).toContain('href="/shaadi/create?x=1&amp;y=2"');
    expect(h).toContain("Make &quot;it&quot;");
    expect(h).toContain("[data-pt-final],footer");
    expect(h).toContain("@media(min-width:900px){.pt-sticky{display:none}}");
  });
});
