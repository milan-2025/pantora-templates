/**
 * Publishes the content pack (lib/content/) by itself, exactly once, the first time the live site starts
 * after it is deployed, so nobody has to run `npm run publish-content:apply` by hand.
 *
 * - Runs only where AUTO_PUBLISH_CONTENT=1 is set: the live site on Hostinger (Node.js → Environment variables),
 *   never in local development or tests unless switched on there too. 0 (or unset) switches it off.
 * - A marker document in the `content_releases` collection makes sure it runs once: the first server to
 *   start claims the marker, every later start (and every other server starting at the same time) skips.
 *   After that, edits made in the admin are never overwritten.
 * - If something fails, the marker is released so the next start tries again (the steps are safe to repeat).
 * - Never stops the site from starting: errors are logged, not thrown.
 */
import type { Payload } from "payload";
import { planContent, type ContentPlan } from "./publish";
import { CATEGORIES_RELEASE_ID, planCategoriesRelease } from "./categoriesRelease";

/** The first content pack (homepage, workout page, blog posts); the admin page /api/admin/publish-content runs this one. */
export const CONTENT_RELEASE_ID = "2026-11-homepage-workout-blog";

/**
 * Every content release, oldest first. Each runs once (its own marker); add a new one to the end to publish
 * future content the same way. Each release only changes what still has its old default wording.
 */
export const RELEASES: { id: string; plan: (payload: Payload) => Promise<ContentPlan> }[] = [
  { id: CONTENT_RELEASE_ID, plan: planContent },
  { id: CATEGORIES_RELEASE_ID, plan: planCategoriesRelease },
];

type Marker = { _id: string; startedAt: Date; doneAt?: Date; changes?: string[]; notes?: string[] };

export function autoPublishEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.AUTO_PUBLISH_CONTENT === "1";
}

export async function autoPublishContent(payload: Payload): Promise<void> {
  if (!autoPublishEnabled()) return;
  const db = (payload.db as unknown as { connection?: { db?: { collection: <T extends object>(name: string) => MarkerCollection<T> } } }).connection?.db;
  if (!db) return;
  const markers = db.collection<Marker>("content_releases");
  for (const release of RELEASES) await runRelease(payload, markers, release);
}

async function runRelease(payload: Payload, markers: MarkerCollection<Marker>, release: (typeof RELEASES)[number]): Promise<void> {
  const id = release.id;
  try {
    await markers.insertOne({ _id: id, startedAt: new Date() });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return; // already published (or another server is doing it right now)
    payload.logger.error({ err }, `Content pack "${id}": could not check whether it was already published`);
    return;
  }

  try {
    const plan = await release.plan(payload);
    const res = await plan.apply();
    if (res.failed.length) {
      for (const f of res.failed) payload.logger.error(`Content pack "${id}": ${f.step} failed: ${f.error}`);
      throw new Error(`${res.failed.length} step(s) failed`);
    }
    await markers.updateOne({ _id: id }, { $set: { doneAt: new Date(), changes: plan.changes, notes: plan.notes } });
    payload.logger.info(`Content pack "${id}" published: ${plan.changes.length} change(s).`);
    for (const n of plan.notes) payload.logger.warn(`Content pack "${id}": ${n}`);
  } catch (err) {
    payload.logger.error({ err }, `Content pack "${id}" failed; it will be retried on the next start`);
    await markers.deleteOne({ _id: id }).catch(() => undefined);
  }
}

/** Records a manual publish from the admin page, so the automatic one doesn't run again later. */
export async function markContentPublished(payload: Payload, info: { changes: string[]; notes: string[] }): Promise<void> {
  const db = (payload.db as unknown as { connection?: { db?: { collection: (name: string) => { updateOne: (f: object, u: object, o: object) => Promise<unknown> } } } }).connection?.db;
  await db?.collection("content_releases").updateOne({ _id: CONTENT_RELEASE_ID }, { $set: { startedAt: new Date(), doneAt: new Date(), manual: true, ...info } }, { upsert: true }).catch(() => undefined);
}

type MarkerCollection<T> = {
  insertOne: (doc: T) => Promise<unknown>;
  updateOne: (filter: Partial<T>, update: { $set: Partial<T> }) => Promise<unknown>;
  deleteOne: (filter: Partial<T>) => Promise<unknown>;
};
