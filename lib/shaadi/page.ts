import "server-only";
import { STUDIO_HTML } from "./studioHtml";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const site = () => process.env.NEXT_PUBLIC_SITE_URL || "";

/**
 * The invite maker / guest page, with link-preview tags so WhatsApp shows the couple's names.
 * Guest pages (/i/…) start in guest mode with a loader, so guests never glimpse the editor or the sample invite.
 */
export function studioResponse(title: string, path: string, guest = false) {
  const description = "You are invited. Tap to open your invitation.";
  const tags =
    `<title>${esc(title)}</title><meta name="robots" content="noindex"><meta property="og:type" content="website">` +
    `<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">` +
    `<meta property="og:url" content="${esc(site() + path)}"><meta property="og:image" content="${site()}/shaadi/og.jpg">` +
    `<meta name="twitter:card" content="summary_large_image">`;
  let html = STUDIO_HTML.replace(/<title>[^<]*<\/title>/, () => tags);
  if (guest) html = html.replace('<body data-v="ed">', '<body data-v="ed" class="view boot">');
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
}
