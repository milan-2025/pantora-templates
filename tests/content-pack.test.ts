import { describe, expect, it } from "vitest";
import { inline, mdLinks, mdToLexical } from "../lib/cms/richTextMd";
import { BLOG_POSTS } from "../lib/content/blogPosts";
import { HOME_LAYOUT, buildHomeLayout } from "../lib/content/homepage";
import { WORKOUT_FIELDS, cleanPlaceholders, isPlaceholder, planWorkoutUpdate } from "../lib/content/workoutProduct";
import { LEGACY_REDIRECTS } from "../lib/siteLinks";
import { pageBlocks } from "../blocks";

// Pages that exist on the live site (admin pages, products, landing pages and the blog itself).
const LIVE_PAGES = new Set(["/", "/blog", "/planner", "/shaadi", "/stays", "/crm-software", "/wedding_planner_sheet", "/workout_challange", "/contact", "/refund", "/#products"]);
const slugs = new Set(BLOG_POSTS.map((p) => p.slug));

describe("markdown → rich text", () => {
  it("builds headings, lists and paragraphs", () => {
    const root = mdToLexical("## Title\n\nSome text\nwrapped.\n\n- one\n- two\n\n1. first\n2. second").root;
    expect(root.children.map((c) => c.type)).toEqual(["heading", "paragraph", "list", "list"]);
    expect(root.children[0]).toMatchObject({ tag: "h2" });
    expect(root.children[1]).toMatchObject({ children: [{ text: "Some text wrapped." }] });
    expect(root.children[2]).toMatchObject({ listType: "bullet", tag: "ul" });
    expect(root.children[3]).toMatchObject({ listType: "number", tag: "ol" });
  });
  it("turns [text](url) into links and **x** into bold", () => {
    const nodes = inline("Try the [online planner](/planner) **today**.");
    expect(nodes.map((n) => n.type)).toEqual(["text", "link", "text", "text", "text"]);
    expect(nodes[1]).toMatchObject({ fields: { linkType: "custom", url: "/planner", newTab: false }, children: [{ text: "online planner" }] });
    expect(nodes[3]).toMatchObject({ text: "today", format: 1 });
  });
});

describe("blog posts", () => {
  it("has ten posts with unique, valid slugs", () => {
    expect(BLOG_POSTS).toHaveLength(10);
    expect(slugs.size).toBe(10);
    for (const p of BLOG_POSTS) expect(p.slug).toMatch(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/);
  });
  it("only links to live pages or other posts in this set", () => {
    const moved = new Set(LEGACY_REDIRECTS.map((r) => r.source));
    for (const p of BLOG_POSTS) {
      const links = mdLinks(p.md);
      expect(links.length, p.slug).toBeGreaterThan(0);
      for (const url of links) {
        expect(moved.has(url), `${p.slug}: ${url} is an old address`).toBe(false);
        const ok = LIVE_PAGES.has(url) || (url.startsWith("/blog/") && slugs.has(url.slice(6)));
        expect(ok, `${p.slug}: ${url}`).toBe(true);
      }
    }
  });
  it("leaves no stray Markdown in the rich text", () => {
    for (const p of BLOG_POSTS) {
      const json = JSON.stringify(mdToLexical(p.md));
      expect(json, p.slug).not.toMatch(/\]\(|\*\*|"## |"- /);
    }
  });
});

describe("homepage", () => {
  const known = new Set(pageBlocks.map((b) => b.slug));
  it("uses only page-builder blocks that exist", () => {
    for (const b of HOME_LAYOUT) expect(known.has(b.blockType), b.blockType).toBe(true);
  });
  it("keeps the owner's chosen products in the Product cards block", () => {
    const out = buildHomeLayout([{ blockType: "productCards", heading: "Mine", text: "", products: ["p1"] }]);
    expect(out.find((b) => b.blockType === "productCards")).toMatchObject({ heading: "Mine", text: "Done for you, made for you.", products: ["p1"] });
  });
  it("leaves Product cards on 'show all' when none were chosen", () => {
    expect(buildHomeLayout([]).find((b) => b.blockType === "productCards")).not.toHaveProperty("products");
  });
});

describe("Workout Challenge page", () => {
  it("recognises the placeholder text it was created with, and nothing real", () => {
    for (const v of ["headline for workout challange", "text 1", "emoji 3", "4", "CTA Label for workout challange"]) expect(isPlaceholder(v), v).toBe(true);
    for (const v of ["Push-ups", "30", "Day 1", "Excel", "6 challenge types"]) expect(isPlaceholder(v), v).toBe(false);
  });
  it("removes placeholder rows and keeps real ones", () => {
    const changes: string[] = [];
    const out = cleanPlaceholders({ items: [{ id: "a", name: "name 1", text: "text 1" }, { id: "b", name: "Riya", text: "Loved it" }] }, changes, "testimonials");
    expect(out.items).toEqual([{ id: "b", name: "Riya", text: "Loved it" }]);
    expect(changes.length).toBeGreaterThan(0);
  });
  it("fills in every section and leaves price and slug alone", () => {
    const product = {
      slug: "workout_challange",
      price: 4999,
      name: "Workout Challange",
      hero: { headline: "headline for workout challange", badge: "badge for workout challange" },
      testimonials: { heading: "heading for workout challange", items: [{ name: "name 1", text: "text 1" }] },
    };
    const { data, changes } = planWorkoutUpdate(product);
    expect(data).not.toHaveProperty("price");
    expect(data).not.toHaveProperty("slug");
    expect(data.name).toBe("Workout Challenge Tracker");
    expect((data.hero as Record<string, unknown>).headline).toBe(WORKOUT_FIELDS.hero.headline);
    expect(data.testimonials).toEqual({ heading: "", items: [] });
    expect(changes.length).toBeGreaterThan(5);
    expect(JSON.stringify(data)).not.toMatch(/workout challange/i);
  });
  it("has a sheet preview of at most 5 tabs, each matched by a product tour tab", () => {
    expect(WORKOUT_FIELDS.preview.sheets.length).toBeLessThanOrEqual(5);
    expect(WORKOUT_FIELDS.showcase.tabs).toHaveLength(WORKOUT_FIELDS.preview.sheets.length);
    for (const s of WORKOUT_FIELDS.preview.sheets) if ("rows" in s) expect(s.rows.split("\n").length).toBeLessThanOrEqual(8);
  });
});
