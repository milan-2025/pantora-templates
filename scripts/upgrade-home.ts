/**
 * One-off, for a live database: links the homepage and menu to every product and landing page.
 *   npm run upgrade-home        → shows what would change (nothing is saved)
 *   npm run upgrade-home:apply  → saves the changes
 *
 * What it does (see lib/cms/homeUpgrade.ts): fixes links to old addresses (e.g. /wedding_planner),
 * adds the "Our products" block below the homepage hero, gives a still-unchanged starter hero a button to
 * the online planner, and adds Online Planner / Invites / Stays to the main menu.
 * Safe to run more than once. Everything it adds can be edited or removed in the admin afterwards.
 */
import { getPayload } from "payload";
import config from "@payload-config";
import { planHomeLayout, planMenu } from "../lib/cms/homeUpgrade";

// `payload run` passes on plain words only (not --flags), hence "apply".
const apply = process.argv.slice(2).includes("apply");
const payload = await getPayload({ config });

const changes: string[] = [];

// Homepage: the published version (depth 0 keeps relationships as ids, so they are saved back unchanged).
const home = (await payload.find({ collection: "pages", where: { slug: { equals: "home" } }, limit: 1, depth: 0 })).docs[0];
let newLayout: ReturnType<typeof planHomeLayout> | null = null;
if (!home) {
  console.log("No page with the slug 'home' yet; skipping the homepage (run `npm run seed` on an empty database first).");
} else {
  newLayout = planHomeLayout(home.layout as Parameters<typeof planHomeLayout>[0]);
  changes.push(...newLayout.changes);
}

const settings = await payload.findGlobal({ slug: "site-settings", depth: 0 });
const menu = planMenu(settings.navLinks, settings.footerLinks);
changes.push(...menu.changes);

if (!changes.length) {
  console.log("Nothing to change: the homepage and menu are already up to date.");
  process.exit(0);
}
console.log(`${apply ? "Applying" : "Would make"} these changes:\n${changes.map((c) => `  • ${c}`).join("\n")}`);
if (!apply) {
  console.log("\nNothing saved. Run `npm run upgrade-home:apply` to save these changes.");
  process.exit(0);
}

if (home && newLayout?.changes.length) {
  await payload.update({
    collection: "pages",
    id: home.id,
    data: { layout: newLayout.layout as typeof home.layout, _status: "published" },
  });
}
if (menu.changes.length) {
  await payload.updateGlobal({ slug: "site-settings", data: { navLinks: menu.navLinks, footerLinks: menu.footerLinks } });
}
console.log("\nSaved. The live site shows the changes within 5 minutes (or straight away after the next save in the admin).");
process.exit(0);
