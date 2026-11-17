import { getPayloadClient } from "@/lib/cms/queries";
import { renderCataloguePage, unitMix } from "@/lib/crm/publicPage";
import { html, notFound, refOf, validPub, wsLive } from "@/lib/crm/publicRoute";

// Public catalogue of a company's PUBLISHED projects: /catalogue/<company catalogue id>?ref=<sharer>
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ pub: string }> }) {
  const { pub } = await ctx.params;
  if (!validPub(pub)) return notFound("This catalogue link is not valid.");
  const db = (await getPayloadClient()).db.connection.db as any;
  const w = await db.collection("crm_workspaces").findOne({ catPub: pub });
  if (!wsLive(w)) return notFound("This catalogue is not available right now.");
  const ps = await db.collection("crm_projects").find({ ws: w._id, published: true }).toArray();
  if (!ps.length) return notFound("No properties have been published yet.");
  const units = await db.collection("crm_units").find({ ws: w._id, status: "available" }).limit(20000).toArray();
  const num = (c: unknown) => (/^PR-\d{3,}$/.test(String(c || "")) ? Number(String(c).slice(3)) : 1e15);
  ps.sort((a: any, b: any) => num(a.code) - num(b.code) || String(a.name).localeCompare(String(b.name)));
  return html(
    renderCataloguePage({
      company: w.name, ref: refOf(req),
      projects: ps.map((p: any) => ({
        pub: p.pub, name: p.name, code: p.code, city: p.city, locality: p.locality, type: p.type, cover: p.cover, images: p.images,
        mix: unitMix(units.filter((u: any) => u.project === p._id)),
      })),
    }),
  );
}
