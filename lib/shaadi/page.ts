import "server-only";
import { STUDIO_HTML } from "./studioHtml";
import { trackingScript } from "@/lib/tracking";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const site = () => process.env.NEXT_PUBLIC_SITE_URL || "";

/**
 * The invite maker / guest page, with link-preview tags so WhatsApp shows the couple's names.
 * Guest pages (/i/…) start in guest mode with a loader, so guests never glimpse the editor or the sample invite.
 */
export function studioResponse(
  title: string,
  path: string,
  guest = false,
  og: { image?: string | null; description?: string | null } = {},
  /** Only the public invite maker (/shaadi) is a landing page; guests' invites and edit links stay out of search. */
  opts: { indexable?: boolean } = {},
) {
  const description = og.description || "You are invited. Tap to open your invitation.";
  const image = og.image || `${site()}/shaadi/og.jpg`;
  const robots = opts.indexable
    ? `<meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(site() + path)}">`
    : `<meta name="robots" content="noindex">`;
  const tags =
    `<title>${esc(title)}</title>${robots}<meta property="og:type" content="website">` +
    `<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">` +
    `<meta property="og:url" content="${esc(site() + path)}"><meta property="og:image" content="${esc(image)}">` +
    `<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:site_name" content="Pandora Templates">` +
    `<meta name="twitter:card" content="summary_large_image">`;
  let html = STUDIO_HTML.replace(/<title>[^<]*<\/title>/, () => tags);
  if (guest) html = html.replace('<body data-v="ed">', '<body data-v="ed" class="view boot">');
  // The couple's editor reports payments to the Pixel (guests opening an invite are not tracked).
  else html = html.replace("</head>", () => `${trackingScript("invites", { view: false })}</head>`);
  const headers: Record<string, string> = { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" };
  if (!opts.indexable) headers["x-robots-tag"] = "noindex";
  return new Response(html, { headers });
}
