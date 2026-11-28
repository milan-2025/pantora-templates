import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import { CONTENT_RELEASE_ID, RELEASES, autoPublishContent, autoPublishEnabled } from "../lib/content/autoPublish";
import { CATEGORIES_RELEASE_ID } from "../lib/content/categoriesRelease";
import { BLOG_RELEASE_ID } from "../lib/content/blogRelease";
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
  const settings: Record<string, unknown> = { navLinks: [{ label: "Blog", url: "/blog" }], tagline: "My own tagline" };
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
    findGlobal: async () => settings,
    updateGlobal: async ({ data }: { data: Record<string, unknown> }) => {
      writes.push("update globals/site-settings");
      Object.assign(settings, data);
      return settings;
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
  it("runs only where AUTO_PUBLISH_CONTENT=1 is set (the live site on Hostinger)", () => {
    expect(autoPublishEnabled({ AUTO_PUBLISH_CONTENT: "1" })).toBe(true);
    expect(autoPublishEnabled({})).toBe(false);
    expect(autoPublishEnabled({ AUTO_PUBLISH_CONTENT: "0" })).toBe(false);
    expect(autoPublishEnabled({ NODE_ENV: "production" })).toBe(false);
  });

  it("publishes the homepage, the Workout Challenge page and every post, then never again", async () => {
    const site = fakeSite();
    await withEnv({ AUTO_PUBLISH_CONTENT: "1" }, async () => {
      await autoPublishContent(site.payload);
      expect(site.writes).toContain("update pages/home");
      expect(site.writes).toContain("update products/w");
      expect(site.writes.filter((w) => w.startsWith("create posts/"))).toHaveLength(BLOG_POSTS.length);
      expect(site.markers.get(CONTENT_RELEASE_ID)).toHaveProperty("doneAt");
      expect(site.markers.get(CATEGORIES_RELEASE_ID)).toHaveProperty("doneAt");
      expect(RELEASES.map((r) => r.id)).toEqual([CONTENT_RELEASE_ID, CATEGORIES_RELEASE_ID, BLOG_RELEASE_ID]);

      site.writes.length = 0;
      await autoPublishContent(site.payload); // a later start, or another server
      expect(site.writes).toEqual([]);
    });
  });

  it("does nothing where it is not switched on", async () => {
    const site = fakeSite();
    await withEnv({ AUTO_PUBLISH_CONTENT: undefined }, () => autoPublishContent(site.payload));
    expect(site.writes).toEqual([]);
    expect(site.markers.size).toBe(0);
  });

  it("tries again on the next start if something fails, without stopping the site", async () => {
    const site = fakeSite({ failOnce: true });
    await withEnv({ AUTO_PUBLISH_CONTENT: "1" }, async () => {
      await expect(autoPublishContent(site.payload)).resolves.toBeUndefined();
      expect(site.markers.has(CONTENT_RELEASE_ID)).toBe(false);
      await autoPublishContent(site.payload);
      expect(site.markers.get(CONTENT_RELEASE_ID)).toHaveProperty("doneAt");
      expect(site.writes).toContain("update pages/home");
    });
  });

  it("still publishes the blog posts when the homepage step fails", async () => {
    const site = fakeSite({ failOnce: true }); // the first write (the homepage) throws
    await withEnv({ AUTO_PUBLISH_CONTENT: "1" }, async () => {
      await autoPublishContent(site.payload);
      expect(site.writes.filter((w) => w.startsWith("create posts/"))).toHaveLength(BLOG_POSTS.length);
      expect(site.markers.has(CONTENT_RELEASE_ID)).toBe(false); // the homepage is retried on the next start
    });
  });
});
