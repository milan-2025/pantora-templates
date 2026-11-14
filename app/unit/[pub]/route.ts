import { getPayloadClient } from "@/lib/cms/queries";
import { renderUnitPage } from "@/lib/crm/publicPage";
import { html, isBot, notFound, refOf, validPub, wsLive } from "@/lib/crm/publicRoute";

// Public, shareable page for ONE unit: /unit/<unit pub>?ref=<sharer>. Only for units of published projects.
// Never shows who holds or booked the unit, and never its private documents.
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ pub: string }> }) {
  const { pub } = await ctx.params;
  if (!validPub(pub)) return notFound("This unit link is not valid.");
  const db = (await getPayloadClient()).db.connection.db as any;
  const unit = await db.collection("crm_units").findOne({ pub });
  const proj = unit ? await db.collection("crm_projects").findOne({ _id: unit.project, ws: unit.ws, published: true }) : null;
  const w = proj ? await db.collection("crm_workspaces").findOne({ _id: proj.ws }) : null;
  if (!unit || !proj || !wsLive(w)) return notFound();
  if (!isBot(req)) db.collection("crm_units").updateOne({ _id: unit._id }, { $inc: { views: 1 } }).catch(() => {});
  return html(
    renderUnitPage({
      company: w.name, projectPub: proj.pub, unitPub: unit.pub, projectName: proj.name, propCode: proj.code, code: unit.code,
      no: unit.no, tower: unit.tower, floor: unit.floor, bhk: unit.bhk, area: unit.area, price: unit.price, status: unit.status,
      city: proj.city, locality: proj.locality, type: proj.type, rera: proj.reraNumber, cover: proj.cover, images: proj.images,
      videos: [...(unit.videos || []), ...(proj.videos || [])], mapUrl: proj.mapUrl, phone: proj.contactPhone, ref: refOf(req),
      amenities: proj.amenities, catalogue: w.catPub,
    }),
  );
}
