import { getPayloadClient } from "@/lib/cms/queries";
import { renderProjectPage, unitMix } from "@/lib/crm/publicPage";
import { html, isBot, notFound, refOf, validPub, wsLive } from "@/lib/crm/publicRoute";

// Public, shareable project page: /property/<pub>?ref=<team member or partner id>
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ pub: string }> }) {
  const { pub } = await ctx.params;
  if (!validPub(pub)) return notFound();
  const db = (await getPayloadClient()).db.connection.db as any;
  const proj = await db.collection("crm_projects").findOne({ pub, published: true });
  const w = proj ? await db.collection("crm_workspaces").findOne({ _id: proj.ws }) : null;
  if (!proj || !wsLive(w)) return notFound(); // also offline when the subscription has ended
  const units = await db.collection("crm_units").find({ ws: w._id, project: proj._id, status: "available" }).limit(5000).toArray();
  if (!isBot(req)) db.collection("crm_projects").updateOne({ _id: proj._id }, { $inc: { views: 1 } }).catch(() => {});
  return html(
    renderProjectPage({
      pub, company: w.name, name: proj.name, city: proj.city, locality: proj.locality, type: proj.type, rera: proj.reraNumber,
      about: proj.about, amenities: proj.amenities, cover: proj.cover, phone: proj.contactPhone, mix: unitMix(units), ref: refOf(req),
      images: proj.images, mapUrl: proj.mapUrl, code: proj.code, videos: proj.videos, catalogue: w.catPub,
    }),
  );
}
