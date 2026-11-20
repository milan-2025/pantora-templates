/**
 * One-off, for a live database: publishes the new homepage, the real Workout Challenge page and ten blog posts.
 *   npm run publish-content         → shows what would change (nothing is saved)
 *   npm run publish-content:apply   → saves and publishes the changes
 *
 * Content lives in lib/content/ (homepage.ts, workoutProduct.ts, blogPosts.ts).
 *  - Homepage: replaces the page sections with the new layout, keeping the Product cards block's chosen products.
 *  - Workout Challenge (slug workout_challange): fills in name, copy, sheet preview and product tour, and clears
 *    any leftover placeholder text. Price, slug, files and offers are left alone.
 *  - Blog: creates each post that doesn't exist yet (matched by slug) and publishes it. Existing posts are untouched.
 * Safe to run more than once. Everything can be edited in the admin afterwards.
 */
import { getPayload } from "payload";
import config from "@payload-config";
import { buildHomeLayout } from "../lib/content/homepage";
import { WORKOUT_SLUG, planWorkoutUpdate } from "../lib/content/workoutProduct";
import { BLOG_POSTS } from "../lib/content/blogPosts";
import { mdToLexical } from "../lib/cms/richTextMd";

// `payload run` passes on plain words only (not --flags), hence "apply".
const apply = process.argv.slice(2).includes("apply");
const payload = await getPayload({ config });
const changes: string[] = [];
const todo: Array<() => Promise<unknown>> = [];

// --- Homepage (depth 0 keeps relationships as ids, so they are saved back unchanged) ---
const home = (await payload.find({ collection: "pages", where: { slug: { equals: "home" } }, limit: 1, depth: 0, draft: true })).docs[0];
if (!home) {
  console.log("No page with the slug 'home'; skipping the homepage.");
} else {
  const layout = buildHomeLayout(home.layout as Parameters<typeof buildHomeLayout>[0]);
  const strip = (v: unknown) => JSON.stringify(v, (k, x) => (k === "id" || k === "blockName" ? undefined : x));
  if (strip(layout) !== strip(home.layout) || home._status !== "published") {
    changes.push(`Homepage: new layout (${layout.map((b) => b.blockType).join(" → ")}), published`);
    todo.push(() => payload.update({ collection: "pages", id: home.id, data: { layout: layout as typeof home.layout, _status: "published" } }));
  }
}

// --- Workout Challenge product ---
const workout = (await payload.find({ collection: "products", where: { slug: { equals: WORKOUT_SLUG } }, limit: 1, depth: 0, draft: true })).docs[0];
if (!workout) {
  console.log(`No product with the slug '${WORKOUT_SLUG}'; skipping the Workout Challenge page.`);
} else {
  const plan = planWorkoutUpdate(workout as unknown as Record<string, unknown>);
  if (plan.changes.length) {
    changes.push(...plan.changes.map((c) => `Workout Challenge: ${c}`));
    todo.push(() =>
      payload.update({ collection: "products", id: workout.id, data: { ...(plan.data as Partial<typeof workout>), _status: "published" } }),
    );
  }
  if (!workout.downloadFile && !workout.googleSheetsCopyUrl) {
    console.log("Note: the Workout Challenge has no download file or Google Sheets link yet. Upload the .xlsx under Products → Workout Challenge Tracker → Download file, so buyers receive it.");
  }
}

// --- Blog posts ---
const existing = await payload.find({ collection: "posts", where: { slug: { in: BLOG_POSTS.map((p) => p.slug) } }, limit: 100, depth: 0, draft: true });
const have = new Set(existing.docs.map((d) => d.slug));
BLOG_POSTS.forEach((post, i) => {
  if (have.has(post.slug)) return;
  changes.push(`Blog: new post "${post.title}" at /blog/${post.slug}`);
  // Space the dates a few minutes apart so the blog list shows them in this order (first post on top).
  const publishedAt = new Date(Date.now() - i * 5 * 60_000).toISOString();
  todo.push(() =>
    payload.create({
      collection: "posts",
      data: {
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        publishedAt,
        author: "Pandora Templates",
        content: mdToLexical(post.md) as never,
        seo: { title: post.seoTitle ?? post.title, description: post.excerpt },
        _status: "published",
      },
    }),
  );
});

if (!changes.length) {
  console.log("Nothing to change: the homepage, Workout Challenge page and blog posts are already up to date.");
  process.exit(0);
}
console.log(`${apply ? "Applying" : "Would make"} these changes:\n${changes.map((c) => `  • ${c}`).join("\n")}`);
if (!apply) {
  console.log("\nNothing saved. Run `npm run publish-content:apply` to save and publish these changes.");
  process.exit(0);
}
for (const run of todo) await run();
console.log("\nSaved and published. The live site shows the changes within 5 minutes.");
process.exit(0);
