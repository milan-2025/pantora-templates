import type { Payload } from "payload";
import { mergePlans, type PhotoPlan } from "@/lib/photos/core";
import { DEFAULT_RENEWAL_PRICE } from "@/lib/photos/planDefaults";

export type PhotoPlanConfig = { plans: PhotoPlan[]; banner: string; renewalPrice: number; reminderDays: number };

/** Plans and prices: the admin-editable "Photo gallery plans & prices" global over the built-in defaults. */
export async function getPhotoPlans(payload: Payload): Promise<PhotoPlanConfig> {
  const doc = (await payload.findGlobal({ slug: "photo-plans", depth: 0 }).catch(() => null)) as
    | { banner?: string | null; renewalPrice?: number | null; reminderDays?: number | null; plans?: Record<string, unknown>[] | null }
    | null;
  return {
    plans: mergePlans(doc?.plans),
    banner: doc?.banner?.trim() ?? "",
    renewalPrice: doc?.renewalPrice && doc.renewalPrice > 0 ? Math.round(doc.renewalPrice) : DEFAULT_RENEWAL_PRICE,
    reminderDays: doc?.reminderDays && doc.reminderDays > 0 ? doc.reminderDays : 14,
  };
}

export const planOf = (cfg: PhotoPlanConfig, id?: string | null) => cfg.plans.find((p) => p.id === id) ?? cfg.plans[0];
