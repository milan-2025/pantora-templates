/**
 * Content release "2026-11-blog-categories" (runs once on the live site, see autoPublish.ts):
 *  1. publishes the fifteen category posts in blogPosts2.ts (a slug that already exists is left alone), and
 *  2. gives every blog post that has no cover image one: its own cover from content/blog-covers/<slug>.jpg,
 *     or the cover for its category (cover-<category>.jpg) for posts written in the admin.
 * Covers are uploaded to Images & videos once (found again by their alt text, so a retry never uploads twice).
 * Images are drawn by scripts/make-blog-covers.mjs.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import type { Payload } from "payload";
import type { ApplyResult, ContentPlan } from "./publish";
import { BLOG_POSTS } from "./blogPosts";
import { BLOG_POSTS_2 } from "./blogPosts2";
import { mdToLexical } from "../cms/richTextMd";
import { productCategory } from "../siteLinks";

export const BLOG_RELEASE_ID = "2026-11-blog-categories";
export const COVER_DIR = path.join(process.cwd(), "content/blog-covers");

const coverAlt = (title: string) => `Illustration for the article "${title}"`.slice(0, 250);

/** The cover file for a post: its own, else its category's. */
export function coverFileFor(post: { slug: string; title: string }, dir = COVER_DIR): string | null {
  const own = path.join(dir, `${post.slug}.jpg`);
  if (existsSync(own)) return own;
  const known = BLOG_POSTS_2.find((p) => p.slug === post.slug)?.category;
  const cat = known ?? productCategory({ slug: post.slug, name: post.title });
  const generic = path.join(dir, `cover-${cat}.jpg`);
  return existsSync(generic) ? generic : null;
}

type PostDoc = { id: string | number; slug: string; title: string; coverImage?: unknown };

async function mediaFor(payload: Payload, post: { slug: string; title: string }, file: string): Promise<string | number> {
  const alt = coverAlt(post.title);
  const found = await payload.find({ collection: "media", where: { alt: { equals: alt } }, limit: 1, depth: 0 });
  if (found.docs[0]) return found.docs[0].id;
  const doc = await payload.create({ collection: "media", data: { alt } as never, filePath: file });
  return doc.id;
}

export async function planBlogRelease(payload: Payload): Promise<ContentPlan> {
  const changes: string[] = [];
  const notes: string[] = [];
  const todo: Array<{ step: string; run: () => Promise<unknown> }> = [];

  if (!existsSync(COVER_DIR)) notes.push(`Cover images not found at ${COVER_DIR}; posts are published without covers.`);

  // 1. New posts, newest first in the order of the file (categories interleaved so the blog list mixes them).
  const existing = await payload.find({ collection: "posts", where: { slug: { in: BLOG_POSTS_2.map((p) => p.slug) } }, limit: 100, depth: 0, draft: true });
  const have = new Set(existing.docs.map((d) => d.slug));
  const all = [0, 1, 2, 3, 4].flatMap((i) => ["self-improvement", "business", "hospitality"].map((c) => BLOG_POSTS_2.filter((p) => p.category === c)[i])).filter(Boolean);
  const now = Date.now();
  all.forEach((post, i) => {
    if (have.has(post.slug)) return;
    changes.push(`Blog: new post "${post.title}" at /blog/${post.slug}`);
    todo.push({
      step: `Blog post "${post.title}"`,
      run: async () => {
        const file = coverFileFor(post);
        const coverImage = file ? await mediaFor(payload, post, file) : undefined;
        return payload.create({
          collection: "posts",
          data: {
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            publishedAt: new Date(now - i * 5 * 60_000).toISOString(),
            author: "Pandora Templates",
            content: mdToLexical(post.md) as never,
            ...(coverImage ? { coverImage: coverImage as never } : {}),
            seo: { title: post.seoTitle ?? post.title, description: post.excerpt },
            _status: "published",
          },
        });
      },
    });
  });

  // 2. A cover for every existing post that has none (the first ten posts and any written in the admin).
  const posts = (await payload.find({ collection: "posts", limit: 500, depth: 0, draft: true })).docs as unknown as PostDoc[];
  for (const p of posts) {
    if (p.coverImage) continue;
    const file = coverFileFor(p);
    if (!file) continue;
    changes.push(`Blog: cover image for "${p.title}"`);
    todo.push({
      step: `Cover for "${p.title}"`,
      run: async () => payload.update({ collection: "posts", id: p.id, data: { coverImage: (await mediaFor(payload, p, file)) as never } }),
    });
  }

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

/** All blog post slugs this site ships with (the first pack and this one), for link checks. */
export const ALL_PACK_SLUGS = [...BLOG_POSTS, ...BLOG_POSTS_2].map((p) => p.slug);
