import { describe, expect, it } from "vitest";
import { HOME_LAYOUT } from "../lib/content/homepage";
import { NEUTRAL_CTA, NEW_FAQ_ANSWER, NEW_HERO_TEXT, NEW_HUB_TEXT, planHomeForCategories, planMenuForCategories } from "../lib/content/categoriesRelease";

describe("making the homepage brand-neutral", () => {
  it("rewrites the wedding-led defaults of the published homepage", () => {
    const { layout, changes } = planHomeForCategories(HOME_LAYOUT);
    const hero = layout.find((b) => b.blockType === "hero")!;
    expect(hero).toMatchObject({ text: NEW_HERO_TEXT, primaryLabel: "Explore our products", primaryUrl: "/#explore", secondaryUrl: "/#products" });
    expect(layout.find((b) => b.blockType === "productHub")).toMatchObject({ text: NEW_HUB_TEXT });
    expect(layout.find((b) => b.blockType === "cta")).toMatchObject(NEUTRAL_CTA);
    const faq = layout.find((b) => b.blockType === "faq")!.items as { answer: string }[];
    expect(faq[0].answer).toBe(NEW_FAQ_ANSWER);
    expect(changes).toHaveLength(5);
    expect(layout.map((b) => b.blockType)).toEqual(HOME_LAYOUT.map((b) => b.blockType));
  });

  it("changes nothing the second time, and leaves the owner's own wording alone", () => {
    const once = planHomeForCategories(HOME_LAYOUT).layout;
    expect(planHomeForCategories(once).changes).toEqual([]);
    const own = [
      { blockType: "hero", text: "My own words", primaryLabel: "Plan your wedding online", primaryUrl: "/planner?v=family" },
      { blockType: "cta", heading: "Planning a wedding?", buttonUrl: "/planner?utm_source=home" },
    ];
    expect(planHomeForCategories(own)).toEqual({ layout: own, changes: [] });
  });

  it("drops the wedding links from the menu (they are in the Products menu now), keeping the rest", () => {
    const nav = [
      { label: "Wedding Planner", url: "/wedding_planner_sheet" },
      { label: "Online Planner", url: "/planner" },
      { label: "Invites", url: "/shaadi" },
      { label: "Stays", url: "/stays" },
      { label: "Blog", url: "/blog" },
      { label: "Contact", url: "/contact" },
      { label: "Our planner", url: "/planner" },
    ];
    const { navLinks, changes } = planMenuForCategories(nav);
    expect(navLinks.map((l) => l.label)).toEqual(["Blog", "Contact", "Our planner"]);
    expect(changes).toHaveLength(1);
    expect(planMenuForCategories(navLinks).changes).toEqual([]);
  });
});
