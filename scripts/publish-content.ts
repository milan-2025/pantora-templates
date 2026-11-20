/**
 * Publishes the new homepage, the real Workout Challenge page and ten blog posts (content in lib/content/).
 * The live site also does this by itself, once, the first time it starts after deploying (lib/content/autoPublish.ts),
 * so this is only needed to preview the changes or to publish to another database.
 *   npm run publish-content         → shows what would change (nothing is saved)
 *   npm run publish-content:apply   → saves and publishes the changes
 * Safe to run more than once. Everything can be edited in the admin afterwards.
 */
import { getPayload } from "payload";
import config from "@payload-config";
import { planContent } from "../lib/content/publish";

// `payload run` passes on plain words only (not --flags), hence "apply".
const apply = process.argv.slice(2).includes("apply");
const payload = await getPayload({ config });
const plan = await planContent(payload);
for (const n of plan.notes) console.log(`Note: ${n}`);

if (!plan.changes.length) {
  console.log("Nothing to change: the homepage, Workout Challenge page and blog posts are already up to date.");
  process.exit(0);
}
console.log(`${apply ? "Applying" : "Would make"} these changes:\n${plan.changes.map((c) => `  • ${c}`).join("\n")}`);
if (!apply) {
  console.log("\nNothing saved. Run `npm run publish-content:apply` to save and publish these changes.");
  process.exit(0);
}
await plan.apply();
console.log("\nSaved and published. The live site shows the changes within 5 minutes.");
process.exit(0);
