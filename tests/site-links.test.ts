import { describe, expect, it } from "vitest";
import { CATEGORIES, LANDING_PAGES, LEGACY_REDIRECTS, PRODUCT_SLUG_ALIASES, ROBOTS_DISALLOW, SITEMAP_LANDING_PAGES, categoryByKey, isStandalonePage, productCategory, relatedLandingPages } from "../lib/siteLinks";
import robots from "../app/robots";
import nextConfig from "../next.config";
import { fixUrl, PRODUCT_HUB_BLOCK, planHomeLayout, planMenu } from "../lib/cms/homeUpgrade";
import { clip, mainHeadingPlan, pageDescription, withMainHeading } from "../lib/cms/pageText";

/** How search engines read robots.txt: a rule blocks every path that starts with it. */
const blocked = (path: string) => ROBOTS_DISALLOW.some((rule) => path.startsWith(rule));

describe("link map", () => {
  it("keeps every landing page crawlable", () => {
    for (const p of [...LANDING_PAGES.map((l) => l.url), "/", "/blog", "/stays/search", "/wedding_planner_sheet", "/planner/signup"]) {
      expect(blocked(p), p).toBe(false);
    }
  });
  it("keeps dashboards, checkout and private share links out of search", () => {
    for (const p of ["/admin", "/api/crm", "/checkout", "/success", "/stays/admin", "/stays/host", "/stay/s/abc", "/planner/share/abc", "/CRM/index.html"]) {
      expect(blocked(p), p).toBe(true);
    }
  });
  it("does not block guest invites, so WhatsApp can still show their previews", () => expect(blocked("/i/aanya-weds-rohan")).toBe(false));
  it("robots.txt uses the same rules and points to the sitemap", () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule.disallow).toEqual([...ROBOTS_DISALLOW]);
    expect(r.sitemap).toMatch(/\/sitemap\.xml$/);
  });
  it("lists the landing pages that are not in the admin in the sitemap", () => {
    for (const u of ["/planner", "/shaadi", "/photos", "/workout", "/crm-software", "/hostbook", "/weddings", "/business"]) expect(SITEMAP_LANDING_PAGES.map((p) => p.url)).toContain(u);
    for (const p of SITEMAP_LANDING_PAGES) expect(blocked(p.url)).toBe(false);
  });
  it("never redirects an address to itself or into a loop", () => {
    const sources = new Set(LEGACY_REDIRECTS.map((r) => r.source));
    for (const r of LEGACY_REDIRECTS) {
      expect(r.source).not.toBe(r.destination);
      expect(sources.has(r.destination), `${r.destination} is also redirected`).toBe(false);
    }
  });
  it("finds moved products by their old slug at checkout", () => {
    expect(PRODUCT_SLUG_ALIASES).toEqual({ wedding_planner: "wedding_planner_sheet", workout_challenge: "workout_challange" });
  });
  it("knows which pages are outside the Next.js app, so they get plain links", () => {
    for (const u of ["/planner", "/planner/login", "/shaadi", "/shaadi?x=1", "/crm-software", "/crm", "/CRM/login.html", "/i/abc", "/property/x", "/photos", "/p/aditi-kabir", "/p/aditi-kabir/manage"]) expect(isStandalonePage(u), u).toBe(true);
    for (const u of ["/", "/stays", "/blog", "/plannerx", "/wedding_planner_sheet", "/contact", "/#products", "/information"]) expect(isStandalonePage(u), u).toBe(false);
  });
  it("suggests the apps in the same category on a product's page", () => {
    expect(relatedLandingPages("weddings").map((p) => p.key)).toEqual(["planner", "invites", "photos"]);
    expect(relatedLandingPages("self-improvement").map((p) => p.key)).toEqual(["workout"]);
    expect(relatedLandingPages("hospitality").map((p) => p.key)).toEqual(["hostbook", "stays"]);
  });
});

describe("categories", () => {
  it("has four categories, each with its own page and at least one app", () => {
    expect(CATEGORIES.map((c) => c.url)).toEqual(["/weddings", "/self-improvement", "/business", "/hospitality"]);
    for (const c of CATEGORIES) {
      expect(LANDING_PAGES.some((p) => p.category === c.key), c.key).toBe(true);
      expect(blocked(c.url)).toBe(false);
      expect(SITEMAP_LANDING_PAGES.map((p) => p.url)).toContain(c.url);
      expect(c.accent).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
  it("puts every app in exactly one known category", () => {
    for (const p of LANDING_PAGES) expect(categoryByKey(p.category), p.key).toBeDefined();
  });
  it("files shop products by the admin's choice, then their address, then their name", () => {
    expect(productCategory({ slug: "wedding_planner_sheet", name: "The Wedding Planner Sheet" })).toBe("weddings");
    expect(productCategory({ slug: "workout_challange", name: "Workout Challenge Tracker" })).toBe("self-improvement");
    expect(productCategory({ slug: "anything", name: "Anything", category: "business" })).toBe("business");
    expect(productCategory({ slug: "gst_invoice", name: "GST Invoice Template" })).toBe("business");
    expect(productCategory({ slug: "airbnb_host_checklist", name: "Airbnb Host Checklist" })).toBe("hospitality");
    expect(productCategory({ slug: "habit_tracker", name: "Habit Tracker" })).toBe("self-improvement");
    expect(productCategory({ slug: "mehndi_planner", name: "Mehndi Planner" })).toBe("weddings");
  });
  it("keeps the colour of each category's text readable on a light background", () => {
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    for (const c of CATEGORIES) {
      expect(contrast(c.accent, "#FBF5EA"), `${c.key} on cream`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.accent, c.tint), `${c.key} on its tint`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("next.config routes", () => {
  it("permanently redirects the old addresses", async () => {
    const redirects = await nextConfig.redirects!();
    expect(redirects).toEqual(
      expect.arrayContaining([
        { source: "/wedding_planner", destination: "/wedding_planner_sheet", permanent: true },
        { source: "/workout_challenge", destination: "/workout_challange", permanent: true },
        { source: "/crm-software.html", destination: "/crm-software", permanent: true },
      ]),
    );
  });
  it("serves the CRM sales page at /crm-software and keeps the CRM app and planner where they were", async () => {
    const rewrites = await nextConfig.rewrites!();
    const before = (Array.isArray(rewrites) ? rewrites : rewrites.beforeFiles) ?? [];
    const to = (source: string) => before.find((r) => r.source === source)?.destination;
    expect(to("/crm-software")).toBe("/crm-software.html");
    expect(to("/CRM")).toBe("/CRM/index.html");
    expect(to("/CRM/api.php")).toBe("/api/crm");
    expect(to("/planner")).toBe("/planner/index.html");
    expect(to("/planner/login")).toBe("/planner/index.html");
    expect(to("/planner/signup")).toBe("/planner/index.html");
    // Rewrites ignore letter case, so a "/crm" rule would never be reached (the "/CRM" rule wins); none should exist.
    expect(before.filter((r) => r.source.toLowerCase() === "/crm")).toHaveLength(1);
  });
});

describe("homepage upgrade", () => {
  const starterHome = [
    {
      blockType: "hero",
      heading: "Open the box.",
      text: "Beautifully designed, ready-to-use templates for life's big projects.",
      primaryLabel: "Shop templates",
      primaryUrl: "/#products",
      secondaryLabel: "See the Wedding Planner",
      secondaryUrl: "/wedding_planner",
    },
    { blockType: "productCards", heading: "Templates" },
    { blockType: "cta", heading: "Planning a wedding?", buttonLabel: "See it", buttonUrl: "https://pandoratemplates.com/wedding_planner?ref=AB#top" },
  ];

  it("points old addresses at their new ones, keeping ?ref= and #anchors", () => {
    expect(fixUrl("/wedding_planner")).toBe("/wedding_planner_sheet");
    expect(fixUrl("/wedding_planner/")).toBe("/wedding_planner_sheet");
    expect(fixUrl("/wedding_planner?ref=AB")).toBe("/wedding_planner_sheet?ref=AB");
    expect(fixUrl("https://pandoratemplates.com/wedding_planner#faq")).toBe("https://pandoratemplates.com/wedding_planner_sheet#faq");
    for (const u of ["/wedding_planner_sheet", "/planner", "/#products", "https://wa.me/91", "/blog"]) expect(fixUrl(u)).toBe(u);
  });

  it("adds the products block after the hero, fixes links and updates a starter hero", () => {
    const { layout, changes } = planHomeLayout(starterHome);
    expect(layout.map((b) => b.blockType)).toEqual(["hero", "productHub", "productCards", "cta"]);
    expect(layout[1]).toMatchObject(PRODUCT_HUB_BLOCK);
    expect(layout[0]).toMatchObject({ primaryUrl: "/#products", secondaryUrl: "/planner", heading: "Open the box." });
    expect(layout[3].buttonUrl).toBe("https://pandoratemplates.com/wedding_planner_sheet?ref=AB#top");
    expect(changes.length).toBeGreaterThanOrEqual(3);
  });

  it("changes nothing the second time", () => {
    const once = planHomeLayout(starterHome).layout;
    const twice = planHomeLayout(once);
    expect(twice.changes).toEqual([]);
    expect(twice.layout).toEqual(once);
  });

  it("leaves a hero the owner has rewritten alone", () => {
    const own = [{ blockType: "hero", heading: "Hi", text: "My own words", secondaryUrl: "/blog" }];
    const { layout } = planHomeLayout(own);
    expect(layout[0]).toEqual(own[0]);
    expect(layout[1].blockType).toBe("productHub");
  });

  it("adds the planner, invites and stays to the menu before Blog and Contact, once", () => {
    const nav = [
      { label: "Wedding Planner", url: "/wedding_planner" },
      { label: "Blog", url: "/blog" },
      { label: "Contact", url: "/contact" },
    ];
    const footer = [{ label: "Terms", url: "/terms" }];
    const first = planMenu(nav, footer);
    expect(first.navLinks.map((l) => l.url)).toEqual(["/wedding_planner_sheet", "/planner", "/shaadi", "/stays", "/blog", "/contact"]);
    expect(first.footerLinks).toEqual(footer);
    expect(nav[0].url).toBe("/wedding_planner"); // the input is not changed
    const second = planMenu(first.navLinks, first.footerLinks);
    expect(second.changes).toEqual([]);
    expect(second.navLinks).toEqual(first.navLinks);
  });
});

describe("page text", () => {
  const rich = (...children: object[]) => ({ root: { type: "root", children } });
  const h = (tag: string, text: string) => ({ type: "heading", tag, children: [{ type: "text", text }] });
  const p = (text: string) => ({ type: "paragraph", children: [{ type: "text", text }] });

  it("describes legal pages from their first paragraphs, skipping 'Last updated'", () => {
    const layout = [{ blockType: "richText", content: rich(h("h2", "Terms"), p("Last updated: October 2026"), p("By purchasing from Pandora Templates you agree to these terms."), p("More text follows here to fill the description out nicely.")) }];
    expect(pageDescription(layout)).toBe("By purchasing from Pandora Templates you agree to these terms. More text follows here to fill the description out nicely.");
  });
  it("describes the contact page from the form's intro", () => {
    expect(pageDescription([{ blockType: "contactForm", heading: "Hi", text: "Questions? Send a message." }])).toBe("Questions? Send a message.");
  });
  it("clips long descriptions at a word", () => {
    const out = clip("word ".repeat(80));
    expect(out.length).toBeLessThanOrEqual(155);
    expect(out.endsWith("word…")).toBe(true);
  });
  it("gives every page one main heading", () => {
    expect(mainHeadingPlan([{ blockType: "hero" }, { blockType: "richText", content: rich(h("h2", "x")) }])).toBe("hero");
    expect(mainHeadingPlan([{ blockType: "html" }])).toBe("hero");
    expect(mainHeadingPlan([{ blockType: "richText", content: rich(h("h2", "Terms"), p("x")) }])).toBe("promote");
    expect(mainHeadingPlan([{ blockType: "contactForm" }])).toBe("promote");
    expect(mainHeadingPlan([{ blockType: "faq" }])).toBe("hidden");
    expect(mainHeadingPlan([{ blockType: "richText", content: rich(p("no heading")) }])).toBe("hidden");
  });
  it("turns only the first heading into the <h1>, without changing the original", () => {
    const content = rich(p("intro"), h("h2", "Terms"), h("h3", "Licence"), h("h2", "Payments"));
    const out = withMainHeading(content);
    expect(out.root.children.map((n) => (n as { tag?: string }).tag ?? "p")).toEqual(["p", "h1", "h3", "h2"]);
    expect(content.root.children[1]).toMatchObject({ tag: "h2" });
    const already = rich(h("h1", "A"), h("h2", "B"));
    expect(withMainHeading(already)).toBe(already);
  });
});
