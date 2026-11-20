/**
 * Works out the changes `npm run upgrade-home` makes to a live database (pure, so it is unit-tested):
 *  1. links that point at old addresses (e.g. /wedding_planner) are pointed at their new ones,
 *  2. the homepage gets an "Our products" block (links to every product and landing page) below its hero,
 *  3. the homepage hero gets a button to the online planner, if it still has the starter text,
 *  4. the main menu gets the online planner, invite maker and stays.
 * Anything the owner has already changed is left alone, and running it twice changes nothing the second time.
 */
import { LEGACY_REDIRECTS } from "@/lib/siteLinks";

type Link = { label: string; url: string; id?: string | null };
type Block = { blockType: string; [k: string]: unknown };

const MOVED: Record<string, string> = Object.fromEntries(LEGACY_REDIRECTS.map((r) => [r.source, r.destination]));

/** "/wedding_planner?ref=X#top" → "/wedding_planner_sheet?ref=X#top"; anything else is returned unchanged. */
export function fixUrl(url: string): string {
  const m = /^(?:https?:\/\/(?:www\.)?pandoratemplates\.com)?(\/[^?#]*)(.*)$/i.exec(url);
  if (!m) return url;
  const to = MOVED[m[1]] ?? MOVED[m[1].replace(/\/$/, "")];
  return to ? url.replace(m[1], to) : url;
}

/** Fixes every link field in a block (fields named url, …Url), including inside arrays of items. */
function fixLinksDeep<T>(value: T, changes: string[], where: string): T {
  if (Array.isArray(value)) return value.map((v, i) => fixLinksDeep(v, changes, `${where}[${i}]`)) as T;
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "string" && (k === "url" || /Url$/.test(k))) {
      const fixed = fixUrl(v);
      if (fixed !== v) changes.push(`${where}.${k}: ${v} → ${fixed}`);
      out[k] = fixed;
    } else if (v && typeof v === "object" && k !== "content") {
      out[k] = fixLinksDeep(v, changes, `${where}.${k}`);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

export const PRODUCT_HUB_BLOCK = {
  blockType: "productHub",
  eyebrow: "Everything Pandora",
  heading: "One place for life's big projects",
  text: "Plan your wedding together with family, send invites your guests will love, find a stay or grow your business. Pick where to start.",
} as const;

/** The starter hero text from the first seed; only a hero that still has it is updated. */
const STARTER_HERO_TEXT = "Beautifully designed, ready-to-use templates for life's big projects";

export function planHomeLayout(layout: Block[] | null | undefined): { layout: Block[]; changes: string[] } {
  const changes: string[] = [];
  let blocks = fixLinksDeep(layout ?? [], changes, "home");

  const heroAt = blocks.findIndex((b) => b.blockType === "hero");
  if (heroAt >= 0) {
    const hero = blocks[heroAt];
    const starter = typeof hero.text === "string" && hero.text.startsWith(STARTER_HERO_TEXT);
    const hasPlannerButton = hero.primaryUrl === "/planner" || hero.secondaryUrl === "/planner";
    if (starter && !hasPlannerButton) {
      blocks = blocks.map((b, i) =>
        i === heroAt
          ? {
              ...b,
              text: "Ready-to-use tools for life's big projects: plan your wedding online with your family, make digital invites, use planner sheets, find a stay and more.",
              secondaryLabel: "Plan your wedding online",
              secondaryUrl: "/planner",
            }
          : b,
      );
      changes.push("home hero: text updated, second button → Plan your wedding online (/planner)");
    }
  }

  if (!blocks.some((b) => b.blockType === "productHub")) {
    const at = heroAt >= 0 ? heroAt + 1 : 0;
    blocks = [...blocks.slice(0, at), { ...PRODUCT_HUB_BLOCK }, ...blocks.slice(at)];
    changes.push(`home: added the "Our products" block at position ${at + 1}`);
  }
  return { layout: blocks, changes };
}

const MENU_ADDITIONS: Link[] = [
  { label: "Online Planner", url: "/planner" },
  { label: "Invites", url: "/shaadi" },
  { label: "Stays", url: "/stays" },
];

export function planMenu(navLinks: Link[] | null | undefined, footerLinks: Link[] | null | undefined) {
  const changes: string[] = [];
  const nav = fixLinksDeep(navLinks ?? [], changes, "menu");
  const footer = fixLinksDeep(footerLinks ?? [], changes, "footer");
  const has = (url: string) => nav.some((l) => l.url.replace(/\/$/, "") === url);
  const missing = MENU_ADDITIONS.filter((l) => !has(l.url));
  if (missing.length) {
    // Before Blog/Contact if they are there, so the products come first.
    const at = nav.findIndex((l) => /^\/(blog|contact)\b/.test(l.url));
    const pos = at < 0 ? nav.length : at;
    nav.splice(pos, 0, ...missing);
    changes.push(`menu: added ${missing.map((l) => `${l.label} (${l.url})`).join(", ")}`);
  }
  return { navLinks: nav, footerLinks: footer, changes };
}
