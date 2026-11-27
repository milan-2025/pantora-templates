import { getPayloadClient } from "@/lib/cms/queries";
import { route } from "@/lib/planner/http";
import { getPlans } from "@/lib/planner/server";
import { bundleInfo } from "@/lib/invitePlanner";
import { getPlanConfig } from "@/lib/invites";
import { SAMPLE_TESTIMONIALS } from "@/globals/PlannerLanding";

type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Everything the /planner landing page needs: plans, WhatsApp button and the testimonials ticked to show (the Pixel comes from Site settings, via /pt-track.js). */
export const GET = route(async () => {
  const payload = await getPayloadClient();
  let g = ((await payload.findGlobal({ slug: "planner-landing" as never, depth: 0, overrideAccess: true }).catch(() => null)) ?? {}) as Doc;
  if (!g.seededAt) {
    // First visit: put format examples (hidden) into the admin so the owner can see what to fill in.
    const data = { seededAt: new Date().toISOString(), testimonials: g.testimonials?.length ? g.testimonials : SAMPLE_TESTIMONIALS };
    g = ((await payload.updateGlobal({ slug: "planner-landing" as never, data: data as never, overrideAccess: true }).catch(() => null)) ?? { ...g, ...data }) as Doc;
  }
  const plans = (await getPlans(payload)).filter((p) => p.active || p.isTrial);
  const wa = String(g.whatsappNumber ?? "").replace(/\D/g, "");
  const bundle = await bundleInfo(payload);
  // The invite's own Premium price, so the page can show what the bundle saves.
  const premium = (await getPlanConfig(payload).catch(() => null))?.plans.find((p) => p.id === "premium");
  return {
    plans,
    bundle: { on: bundle.on, price: bundle.price, invitePremium: Number(premium?.price) || null },
    offerText: String(g.offerText ?? "").trim() || null,
    whatsapp: wa ? { number: wa, message: String(g.whatsappMessage ?? "") } : null,
    testimonials: (g.testimonials ?? [])
      .filter((t: Doc) => t.show && t.name && t.quote)
      .map((t: Doc) => ({ name: String(t.name), detail: String(t.detail ?? ""), quote: String(t.quote) })),
  };
});
