/**
 * Works out and applies the content pack in lib/content/: the new homepage, the Workout Challenge
 * page and ten blog posts. Used by `npm run publish-content[:apply]` and, once, automatically when
 * the live site starts (see autoPublish.ts).
 *
 *  - Homepage: replaces the page sections with the new layout, keeping the Product cards block's chosen products.
 *  - Workout Challenge (slug workout_challange): fills in name, copy, sheet preview and product tour, and clears
 *    leftover placeholder text. Price, slug, files and offers are left alone.
 *  - Blog: creates each post that doesn't exist yet (matched by slug) and publishes it. Existing posts are untouched.
 */
import type { Payload } from "payload";
import { buildHomeLayout } from "./homepage";
import { WORKOUT_SLUG, planWorkoutUpdate } from "./workoutProduct";
import { BLOG_POSTS } from "./blogPosts";
import { mdToLexical } from "../cms/richTextMd";

export type ContentPlan = { changes: string[]; notes: string[]; apply: () => Promise<void> };

export async function planContent(payload: Payload): Promise<ContentPlan> {
  const changes: string[] = [];
  const notes: string[] = [];
  const todo: Array<() => Promise<unknown>> = [];

  // Homepage (depth 0 keeps relationships as ids, so they are saved back unchanged).
  const home = (await payload.find({ collection: "pages", where: { slug: { equals: "home" } }, limit: 1, depth: 0, draft: true })).docs[0];
  if (!home) {
    notes.push("No page with the slug 'home'; skipped the homepage.");
  } else {
    const layout = buildHomeLayout(home.layout as Parameters<typeof buildHomeLayout>[0]);
    const strip = (v: unknown) => JSON.stringify(v, (k, x) => (k === "id" || k === "blockName" ? undefined : x));
    if (strip(layout) !== strip(home.layout) || home._status !== "published") {
      changes.push(`Homepage: new layout (${layout.map((b) => b.blockType).join(" → ")}), published`);
      todo.push(() => payload.update({ collection: "pages", id: home.id, data: { layout: layout as typeof home.layout, _status: "published" } }));
    }
  }

  // Workout Challenge product.
  const workout = (await payload.find({ collection: "products", where: { slug: { equals: WORKOUT_SLUG } }, limit: 1, depth: 0, draft: true })).docs[0];
  if (!workout) {
    notes.push(`No product with the slug '${WORKOUT_SLUG}'; skipped the Workout Challenge page.`);
  } else {
    const plan = planWorkoutUpdate(workout as unknown as Record<string, unknown>);
    if (plan.changes.length) {
      changes.push(...plan.changes.map((c) => `Workout Challenge: ${c}`));
      todo.push(() => payload.update({ collection: "products", id: workout.id, data: { ...(plan.data as Partial<typeof workout>), _status: "published" } }));
    }
    if (!workout.downloadFile && !workout.googleSheetsCopyUrl) {
      notes.push("The Workout Challenge has no download file or Google Sheets link yet. Upload the .xlsx under Products → Workout Challenge Tracker → Download file, so buyers receive it.");
    }
  }

  // Blog posts.
  const existing = await payload.find({ collection: "posts", where: { slug: { in: BLOG_POSTS.map((p) => p.slug) } }, limit: 100, depth: 0, draft: true });
  const have = new Set(existing.docs.map((d) => d.slug));
  const now = Date.now();
  BLOG_POSTS.forEach((post, i) => {
    if (have.has(post.slug)) return;
    changes.push(`Blog: new post "${post.title}" at /blog/${post.slug}`);
    // Space the dates a few minutes apart so the blog list shows them in this order (first post on top).
    const publishedAt = new Date(now - i * 5 * 60_000).toISOString();
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

  return {
    changes,
    notes,
    apply: async () => {
      for (const run of todo) await run();
    },
  };
}
