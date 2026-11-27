/**
 * Content release "2026-11-categories": makes the homepage and menu brand-neutral now that the site is organised
 * into four categories (Weddings, Self-Improvement, Business, Hospitality).
 *
 * Runs once by itself after deploy (see autoPublish.ts). Every change is conditional: a value is only replaced
 * while it still has the old default wording, so anything the owner has written in the admin is left alone.
 * The planning part is pure (unit-tested in tests/categories-release.test.ts).
 */
import type { Payload } from "payload";
import type { ContentPlan, ApplyResult } from "./publish";

type Block = { blockType: string; [k: string]: unknown };
type Link = { label: string; url: string; id?: string | null };

export const CATEGORIES_RELEASE_ID = "2026-11-categories";

const OLD_HERO_TEXT =
  "Plan your wedding online with your whole family, send digital invites your guests will love, use ready-made planner sheets, find a stay or follow up every sales lead. Simple tools, made for Indian families and small businesses.";
export const NEW_HERO_TEXT =
  "Apps and ready-made templates for life's big projects: weddings and events, fitness and habits, sales teams and small businesses, and hosts who welcome guests. Simple tools, ready on your phone in minutes.";

const OLD_HUB_TEXT = "Plan your wedding together with family, send invites your guests will love, find a stay or grow your business. Pick where to start.";
export const NEW_HUB_TEXT = "Four areas, one simple way of working: weddings and events, self-improvement, business software, and tools for hosts. Pick where to start.";

const OLD_FAQ_ANSWER =
  "Pandora is a small family of ready-to-use tools for big life projects: an online wedding planner your family can share, a digital wedding invite maker, planner sheets for Excel and Google Sheets, Pandora Stays for holiday homes, and LeadFlow CRM for teams that get leads from ads.";
export const NEW_FAQ_ANSWER =
  "Pandora Templates makes simple apps and ready-made templates in four areas: weddings and events (the online wedding planner, invite maker and photo sharing), self-improvement (Pandora Workout and trackers), business software (LeadFlow CRM) and hospitality (HostBook for hosts and Pandora Stays). The apps start free; the templates are yours to keep after a one-time payment.";

export const NEUTRAL_CTA = {
  heading: "Not sure where to start?",
  text: "Tell us what you are working on and we will point you to the right tool. Every app has a free start, so you can try before you pay.",
  buttonLabel: "Ask us on WhatsApp or email",
  buttonUrl: "/contact",
};

const OLD_TAGLINE = "Beautifully designed, ready-to-use templates for life's big projects.";
export const NEW_TAGLINE = "Simple apps and ready-made templates for weddings, self-improvement, business and hosting.";
const OLD_HOME_TITLE = "Pandora Templates: ready-to-use templates for life's big projects";
export const NEW_HOME_TITLE = "Pandora Templates: apps and templates for weddings, fitness, business and hosts";

/** Menu links the new Products menu now covers; removed only while they still have their default label and address. */
const MENU_COVERED = [
  { label: "Wedding Planner", urls: ["/wedding_planner_sheet", "/wedding_planner"] },
  { label: "Online Planner", urls: ["/planner"] },
  { label: "Invites", urls: ["/shaadi"] },
  { label: "Stays", urls: ["/stays"] },
];

export function planHomeForCategories(layout: Block[] | null | undefined): { layout: Block[]; changes: string[] } {
  const changes: string[] = [];
  const out = (layout ?? []).map((b) => {
    if (b.blockType === "hero") {
      const next = { ...b };
      if (b.text === OLD_HERO_TEXT) {
        next.text = NEW_HERO_TEXT;
        changes.push("home hero: neutral text for all four categories");
      }
      if (b.primaryLabel === "Plan your wedding online" && b.primaryUrl === "/planner") {
        next.primaryLabel = "Explore our products";
        next.primaryUrl = "/#explore";
        changes.push("home hero: main button → Explore our products (/#explore)");
      }
      return next;
    }
    if (b.blockType === "productHub" && b.text === OLD_HUB_TEXT) {
      changes.push("home products section: text names the four categories");
      return { ...b, text: NEW_HUB_TEXT };
    }
    if (b.blockType === "faq" && Array.isArray(b.items)) {
      const items = (b.items as { question?: string; answer?: string }[]).map((q) => (q.answer === OLD_FAQ_ANSWER ? { ...q, answer: NEW_FAQ_ANSWER } : q));
      if (items.some((q, i) => q !== (b.items as unknown[])[i])) {
        changes.push('home FAQ: "What is Pandora Templates?" describes the four categories');
        return { ...b, items };
      }
      return b;
    }
    if (b.blockType === "cta" && b.heading === "Planning a wedding?" && b.buttonUrl === "/planner") {
      changes.push("home closing section: Not sure where to start? → /contact");
      return { ...b, ...NEUTRAL_CTA };
    }
    return b;
  });
  return { layout: out, changes };
}

export function planMenuForCategories(navLinks: Link[] | null | undefined): { navLinks: Link[]; changes: string[] } {
  const links = navLinks ?? [];
  const covered = (l: Link) => MENU_COVERED.some((m) => m.label === l.label && m.urls.includes(l.url.replace(/\/$/, "")));
  const removed = links.filter(covered);
  return {
    navLinks: links.filter((l) => !covered(l)),
    changes: removed.length ? [`menu: removed ${removed.map((l) => l.label).join(", ")} (now in the Products menu)`] : [],
  };
}

export async function planCategoriesRelease(payload: Payload): Promise<ContentPlan> {
  const changes: string[] = [];
  const notes: string[] = [];
  const todo: Array<{ step: string; run: () => Promise<unknown> }> = [];

  const home = (await payload.find({ collection: "pages", where: { slug: { equals: "home" } }, limit: 1, depth: 0, draft: true })).docs[0] as
    | { id: string; layout?: Block[]; seo?: { title?: string | null } | null; _status?: string }
    | undefined;
  if (!home) notes.push("No page with the slug 'home'; skipped the homepage.");
  else {
    const plan = planHomeForCategories(home.layout);
    const titleChange = home.seo?.title === OLD_HOME_TITLE;
    if (titleChange) plan.changes.push(`home search title → ${NEW_HOME_TITLE}`);
    if (plan.changes.length) {
      changes.push(...plan.changes);
      const data: Record<string, unknown> = { layout: plan.layout, _status: "published" };
      if (titleChange) data.seo = { ...home.seo, title: NEW_HOME_TITLE };
      todo.push({ step: "Homepage", run: () => payload.update({ collection: "pages", id: home.id, data: data as never }) });
    }
  }

  const settings = (await payload.findGlobal({ slug: "site-settings", depth: 0 })) as { navLinks?: Link[]; tagline?: string | null };
  const menu = planMenuForCategories(settings.navLinks);
  const data: Record<string, unknown> = {};
  if (menu.changes.length) {
    changes.push(...menu.changes);
    data.navLinks = menu.navLinks;
  }
  if (settings.tagline === OLD_TAGLINE) {
    changes.push(`site tagline → ${NEW_TAGLINE}`);
    data.tagline = NEW_TAGLINE;
  }
  if (Object.keys(data).length) todo.push({ step: "Site settings", run: () => payload.updateGlobal({ slug: "site-settings", data: data as never }) });

  return {
    changes,
    notes,
    apply: async () => {
      const result: ApplyResult = { done: [], failed: [] };
      for (const t of todo) {
        try { await t.run(); result.done.push(t.step); }
        catch (err) { result.failed.push({ step: t.step, error: err instanceof Error ? err.message : String(err) }); }
      }
      return result;
    },
  };
}
