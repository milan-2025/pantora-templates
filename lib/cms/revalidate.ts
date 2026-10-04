import { revalidatePath } from "next/cache";
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, GlobalAfterChangeHook } from "payload";

/**
 * Refreshes cached pages after an editor saves in the admin, so changes go live immediately.
 * Silently skipped outside a Next.js request (e.g. the seed script).
 */
function safeRevalidate(paths: string[]) {
  for (const p of paths) {
    try {
      revalidatePath(p);
    } catch {
      // not running inside Next.js (CLI / seed); nothing to revalidate
    }
  }
}

type PathsFor = (doc: Record<string, unknown>) => string[];

export const revalidateAfterChange =
  (paths: PathsFor): CollectionAfterChangeHook =>
  ({ doc, previousDoc, context }) => {
    if (!context.disableRevalidate) {
      safeRevalidate([...paths(doc), ...(previousDoc ? paths(previousDoc) : [])]);
    }
    return doc;
  };

export const revalidateAfterDelete =
  (paths: PathsFor): CollectionAfterDeleteHook =>
  ({ doc, context }) => {
    if (!context.disableRevalidate) safeRevalidate(paths(doc));
    return doc;
  };

/** Site-wide settings appear on every page, so revalidate the whole layout. */
export const revalidateEverything: GlobalAfterChangeHook = ({ doc, context }) => {
  if (!context.disableRevalidate) {
    try {
      revalidatePath("/", "layout");
    } catch {
      // outside Next.js
    }
  }
  return doc;
};

export const slugPaths = (prefix = "") => (doc: Record<string, unknown>) => {
  const slug = doc.slug as string | undefined;
  if (!slug) return [];
  return slug === "home" && !prefix ? ["/"] : [`${prefix}/${slug}`];
};
