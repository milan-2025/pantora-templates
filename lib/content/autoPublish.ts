/**
 * Publishes the content pack (lib/content/) by itself, exactly once, the first time the live site starts
 * after it is deployed, so nobody has to run `npm run publish-content:apply` by hand.
 *
 * - Runs only on the production deployment (Vercel sets VERCEL_ENV=production), never on preview
 *   deployments or local development. Set AUTO_PUBLISH_CONTENT=1 to allow it elsewhere, or 0 to switch it off.
 * - A marker document in the `content_releases` collection makes sure it runs once: the first server to
 *   start claims the marker, every later start (and every other server starting at the same time) skips.
 *   After that, edits made in the admin are never overwritten.
 * - If something fails, the marker is released so the next start tries again (the steps are safe to repeat).
 * - Never stops the site from starting: errors are logged, not thrown.
 */
import type { Payload } from "payload";
import { planContent } from "./publish";

/** Change this id to publish a future content pack once in the same way. */
export const CONTENT_RELEASE_ID = "2026-11-homepage-workout-blog";

type Marker = { _id: string; startedAt: Date; doneAt?: Date; changes?: string[]; notes?: string[] };

export function autoPublishEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (env.AUTO_PUBLISH_CONTENT === "0") return false;
  if (env.AUTO_PUBLISH_CONTENT === "1") return true;
  return env.VERCEL_ENV === "production";
}

export async function autoPublishContent(payload: Payload): Promise<void> {
  if (!autoPublishEnabled()) return;
  const db = (payload.db as unknown as { connection?: { db?: { collection: <T extends object>(name: string) => MarkerCollection<T> } } }).connection?.db;
  if (!db) return;
  const markers = db.collection<Marker>("content_releases");

  try {
    await markers.insertOne({ _id: CONTENT_RELEASE_ID, startedAt: new Date() });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return; // already published (or another server is doing it right now)
    payload.logger.error({ err }, "Content pack: could not check whether it was already published");
    return;
  }

  try {
    const plan = await planContent(payload);
    await plan.apply();
    await markers.updateOne({ _id: CONTENT_RELEASE_ID }, { $set: { doneAt: new Date(), changes: plan.changes, notes: plan.notes } });
    payload.logger.info(`Content pack "${CONTENT_RELEASE_ID}" published: ${plan.changes.length} change(s).`);
    for (const n of plan.notes) payload.logger.warn(`Content pack: ${n}`);
  } catch (err) {
    payload.logger.error({ err }, `Content pack "${CONTENT_RELEASE_ID}" failed; it will be retried on the next start`);
    await markers.deleteOne({ _id: CONTENT_RELEASE_ID }).catch(() => undefined);
  }
}

type MarkerCollection<T> = {
  insertOne: (doc: T) => Promise<unknown>;
  updateOne: (filter: Partial<T>, update: { $set: Partial<T> }) => Promise<unknown>;
  deleteOne: (filter: Partial<T>) => Promise<unknown>;
};
