import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import { CONTENT_RELEASE_ID, autoPublishContent, autoPublishEnabled } from "../lib/content/autoPublish";
import { BLOG_POSTS } from "../lib/content/blogPosts";

/** A tiny stand-in for Payload + MongoDB: enough to see what the content pack writes, and how often. */
function fakeSite(opts: { failOnce?: boolean } = {}) {
  const markers = new Map<string, Record<string, unknown>>();
  const writes: string[] = [];
  let fail = !!opts.failOnce;
  const collection = {
    insertOne: async (doc: { _id: string }) => {
      if (markers.has(doc._id)) throw Object.assign(new Error("duplicate key"), { code: 11000 });
      markers.set(doc._id, { ...doc });
    },
    updateOne: async (f: { _id: string }, u: { $set: Record<string, unknown> }) => {
      markers.set(f._id, { ...markers.get(f._id), ...u.$set });
    },
    deleteOne: async (f: { _id: string }) => {
      markers.delete(f._id);
    },
  };
  const docs: Record<string, Record<string, unknown>[]> = {
    pages: [{ id: "home", slug: "home", _status: "published", layout: [{ blockType: "hero", heading: "Open the box." }] }],
    products: [{ id: "w", slug: "workout_challange", price: 4999, name: "Workout Challange", hero: { headline: "headline for workout challange" } }],
    posts: [],
  };
  const payload = {
    db: { connection: { db: { collection: () => collection } } },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    find: async ({ collection: c }: { collection: string }) => ({ docs: docs[c] }),
    update: async ({ collection: c, id }: { collection: string; id: string }) => {
      if (fail) {
        fail = false;
        throw new Error("database hiccup");
      }
      writes.push(`update ${c}/${id}`);
      return {};
    },
    create: async ({ collection: c, data }: { collection: string; data: { slug: string } }) => {
      writes.push(`create ${c}/${data.slug}`);
      docs[c].push({ slug: data.slug });
      return {};
    },
  } as unknown as Payload;
  return { payload, markers, writes };
}

const withEnv = async (env: Record<string, string | undefined>, run: () => Promise<void>) => {
  const old = { ...process.env };
  Object.assign(process.env, env);
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
  try {
    await run();
  } finally {
    process.env = old;
  }
};

describe("auto-publishing the content pack", () => {
  it("runs on the production site only, unless switched on or off by hand", () => {
    expect(autoPublishEnabled({ VERCEL_ENV: "production" })).toBe(true);
    expect(autoPublishEnabled({ VERCEL_ENV: "preview" })).toBe(false);
    expect(autoPublishEnabled({})).toBe(false);
    expect(autoPublishEnabled({ AUTO_PUBLISH_CONTENT: "1" })).toBe(true);
    expect(autoPublishEnabled({ VERCEL_ENV: "production", AUTO_PUBLISH_CONTENT: "0" })).toBe(false);
  });

  it("publishes the homepage, the Workout Challenge page and every post, then never again", async () => {
    const site = fakeSite();
    await withEnv({ VERCEL_ENV: "production", AUTO_PUBLISH_CONTENT: undefined }, async () => {
      await autoPublishContent(site.payload);
      expect(site.writes).toContain("update pages/home");
      expect(site.writes).toContain("update products/w");
      expect(site.writes.filter((w) => w.startsWith("create posts/"))).toHaveLength(BLOG_POSTS.length);
      expect(site.markers.get(CONTENT_RELEASE_ID)).toHaveProperty("doneAt");

      site.writes.length = 0;
      await autoPublishContent(site.payload); // a later start, or another server
      expect(site.writes).toEqual([]);
    });
  });

  it("does nothing on preview deployments", async () => {
    const site = fakeSite();
    await withEnv({ VERCEL_ENV: "preview", AUTO_PUBLISH_CONTENT: undefined }, () => autoPublishContent(site.payload));
    expect(site.writes).toEqual([]);
    expect(site.markers.size).toBe(0);
  });

  it("tries again on the next start if something fails, without stopping the site", async () => {
    const site = fakeSite({ failOnce: true });
    await withEnv({ VERCEL_ENV: "production", AUTO_PUBLISH_CONTENT: undefined }, async () => {
      await expect(autoPublishContent(site.payload)).resolves.toBeUndefined();
      expect(site.markers.has(CONTENT_RELEASE_ID)).toBe(false);
      await autoPublishContent(site.payload);
      expect(site.markers.get(CONTENT_RELEASE_ID)).toHaveProperty("doneAt");
      expect(site.writes).toContain("update pages/home");
    });
  });
});
