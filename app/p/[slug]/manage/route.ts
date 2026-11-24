import { getPayloadClient } from "@/lib/cms/queries";
import { findGallery } from "@/lib/photos/server";
import { manageHtml } from "@/lib/photos/pages/manage";
import { htmlResponse } from "@/lib/photos/pages/shared";

export const dynamic = "force-dynamic";

/** /p/<link>/manage: the couple's dashboard (the private key is in the page address after #, checked by the API). */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = await findGallery(await getPayloadClient(), slug);
  if (!g) return Response.redirect(new URL("/photos", _req.url), 302);
  return htmlResponse(manageHtml({ slug: g.slug, names: g.names }));
}
