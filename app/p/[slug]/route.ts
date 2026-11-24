import { getPayloadClient } from "@/lib/cms/queries";
import { findGallery } from "@/lib/photos/server";
import { galleryHtml } from "@/lib/photos/pages/gallery";
import { htmlResponse, page } from "@/lib/photos/pages/shared";
import { publicUrl } from "@/lib/photos/s3";

export const dynamic = "force-dynamic";

/** /p/<link>: a couple's wedding photo gallery, for guests. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const payload = await getPayloadClient();
  const g = await findGallery(payload, slug);
  if (!g || g.state === "purged") {
    return htmlResponse(page({ title: "Gallery not found", noindex: true, body: `<main class="w" style="padding:80px 20px;text-align:center"><h1 style="font-size:44px">This gallery isn't here</h1><p>Check the link, or <a href="/photos">make your own wedding gallery</a>.</p></main>` }), 404);
  }
  // Link previews on WhatsApp show the cover photo (only when there's no PIN: previews must not leak private photos).
  let cover: string | null = null;
  if (g.cover && !g.pinHash) {
    const c = await payload.findByID({ collection: "photo-items", id: String(g.cover), depth: 0, overrideAccess: true }).catch(() => null);
    const files = (c?.files ?? null) as Record<string, { key: string }> | null;
    const owner = c && (typeof c.gallery === "object" ? c.gallery?.id : c.gallery);
    if (files?.d && String(owner) === String(g.id)) cover = publicUrl(files.d.key);
  }
  const site = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, "");
  const dateText = g.weddingDate ? new Date(g.weddingDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "";
  return htmlResponse(galleryHtml({ slug: g.slug, names: g.names, cover: cover && !cover.startsWith("http") ? site + cover : cover, site, dateText }));
}
