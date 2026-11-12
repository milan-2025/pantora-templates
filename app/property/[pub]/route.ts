import { getPayloadClient } from "@/lib/cms/queries";
import { renderProjectPage, unitMix } from "@/lib/crm/publicPage";

// Public, shareable project page: /property/<pub>?ref=<team member or partner id>
export const dynamic = "force-dynamic";

const html = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": status === 200 ? "public, max-age=0, s-maxage=60, stale-while-revalidate=300" : "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
    },
  });

const notFound = () =>
  html(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Not available</title><body style="font:16px system-ui;text-align:center;padding:64px 16px;color:#444"><h1 style="font-size:20px">This page is not available</h1><p>The project may have been unpublished.</p></body>`, 404);

export async function GET(req: Request, ctx: { params: Promise<{ pub: string }> }) {
  const { pub } = await ctx.params;
  if (!/^[a-f0-9]{10,40}$/.test(pub)) return notFound();
  const db = (await getPayloadClient()).db.connection.db as any;
  const proj = await db.collection("crm_projects").findOne({ pub, published: true });
  const w = proj ? await db.collection("crm_workspaces").findOne({ _id: proj.ws }) : null;
  if (!proj || !w || w.status === "suspended" || w.mode !== "realestate") return notFound();
  const end = w.plan === "trial" ? w.trialEnds : w.validUntil;
  if (w.plan !== "internal" && end && end < Date.now()) return notFound(); // subscription ended: page goes offline
  const units = await db.collection("crm_units").find({ ws: w._id, project: proj._id, status: "available" }).limit(5000).toArray();
  if (!/bot|crawl|spider|preview|facebookexternalhit|whatsapp/i.test(req.headers.get("user-agent") || ""))
    db.collection("crm_projects").updateOne({ _id: proj._id }, { $inc: { views: 1 } }).catch(() => {});
  const ref = new URL(req.url).searchParams.get("ref") || "";
  return html(
    renderProjectPage({
      pub, company: w.name, name: proj.name, city: proj.city, locality: proj.locality, type: proj.type, rera: proj.reraNumber,
      about: proj.about, amenities: proj.amenities, cover: proj.cover, phone: proj.contactPhone, mix: unitMix(units), ref,
    }),
  );
}
