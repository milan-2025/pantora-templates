import { getPayloadClient } from "@/lib/cms/queries";
import { route } from "@/lib/planner/http";
import { getPlans } from "@/lib/planner/server";
import { SAMPLE_TESTIMONIALS } from "@/globals/PlannerLanding";

type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Everything the /planner landing page needs: plans, Pixel ID, WhatsApp button and the testimonials ticked to show. */
export const GET = route(async () => {
  const payload = await getPayloadClient();
  let g = ((await payload.findGlobal({ slug: "planner-landing" as never, depth: 0, overrideAccess: true }).catch(() => null)) ?? {}) as Doc;
  if (!g.seededAt) {
    // First visit: put format examples (hidden) into the admin so the owner can see what to fill in.
    const data = { seededAt: new Date().toISOString(), testimonials: g.testimonials?.length ? g.testimonials : SAMPLE_TESTIMONIALS };
    g = ((await payload.updateGlobal({ slug: "planner-landing" as never, data: data as never, overrideAccess: true }).catch(() => null)) ?? { ...g, ...data }) as Doc;
  }
  const plans = (await getPlans(payload)).filter((p) => p.active || p.isTrial);
  const pixel = String(g.metaPixelId ?? "").replace(/\D/g, "");
  const wa = String(g.whatsappNumber ?? "").replace(/\D/g, "");
  return {
    plans,
    metaPixelId: pixel || null,
    whatsapp: wa ? { number: wa, message: String(g.whatsappMessage ?? "") } : null,
    testimonials: (g.testimonials ?? [])
      .filter((t: Doc) => t.show && t.name && t.quote)
      .map((t: Doc) => ({ name: String(t.name), detail: String(t.detail ?? ""), quote: String(t.quote) })),
  };
});
