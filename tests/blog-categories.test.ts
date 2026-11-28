import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mdLinks, mdToLexical } from "../lib/cms/richTextMd";
import { BLOG_POSTS } from "../lib/content/blogPosts";
import { BLOG_POSTS_2 } from "../lib/content/blogPosts2";
import { COVER_DIR, coverFileFor } from "../lib/content/blogRelease";
import { CATEGORIES, LANDING_PAGES } from "../lib/siteLinks";

const ALL = [...BLOG_POSTS, ...BLOG_POSTS_2];
const slugs = new Set(ALL.map((p) => p.slug));
const LIVE = new Set(["/", "/blog", "/contact", "/workout_challange", "/wedding_planner_sheet", ...LANDING_PAGES.map((p) => p.url), ...CATEGORIES.map((c) => c.url)]);

describe("category blog posts", () => {
  it("has five posts for each of self-improvement, business and hospitality, with unique slugs", () => {
    for (const c of ["self-improvement", "business", "hospitality"]) expect(BLOG_POSTS_2.filter((p) => p.category === c), c).toHaveLength(5);
    expect(slugs.size).toBe(ALL.length);
    for (const p of BLOG_POSTS_2) {
      expect(p.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(p.excerpt.length, p.slug).toBeLessThanOrEqual(160);
    }
  });
  it("links each post to its category page and only to live pages or other posts", () => {
    for (const p of BLOG_POSTS_2) {
      const links = mdLinks(p.md);
      expect(links, p.slug).toContain(`/${p.category}`);
      for (const url of links) expect(LIVE.has(url) || (url.startsWith("/blog/") && slugs.has(url.slice(6))), `${p.slug}: ${url}`).toBe(true);
    }
  });
  it("leaves no stray Markdown in the rich text", () => {
    for (const p of BLOG_POSTS_2) expect(JSON.stringify(mdToLexical(p.md)), p.slug).not.toMatch(/\]\(|\*\*|"## |"- /);
  });
  it("has a cover image for every post, and one per category for posts written later", () => {
    for (const p of ALL) expect(coverFileFor(p), p.slug).toBe(`${COVER_DIR}/${p.slug}.jpg`);
    for (const c of ["weddings", "self-improvement", "business", "hospitality"]) expect(existsSync(`${COVER_DIR}/cover-${c}.jpg`), c).toBe(true);
    expect(coverFileFor({ slug: "my-new-airbnb-tips", title: "Airbnb host tips" })).toBe(`${COVER_DIR}/cover-hospitality.jpg`);
    expect(coverFileFor({ slug: "mehndi-ideas", title: "Mehndi ideas" })).toBe(`${COVER_DIR}/cover-weddings.jpg`);
  });
});
