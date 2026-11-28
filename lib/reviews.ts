/** Which app pages can show reviews from the admin (Content → Reviews). Client-safe: no server imports. */
export const REVIEW_PRODUCTS = [
  { key: "invites", label: "Wedding Invite Maker (/shaadi)" },
  { key: "photos", label: "Wedding Photo Sharing (/photos)" },
  { key: "workout", label: "Pandora Workout (/workout)" },
  { key: "hostbook", label: "HostBook (/hostbook)" },
  { key: "crm", label: "LeadFlow CRM" },
] as const;
export type ReviewProduct = (typeof REVIEW_PRODUCTS)[number]["key"];
export type Review = { name: string; detail: string; quote: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The reviews section as plain HTML (for pages written as HTML strings); empty when there are no reviews. */
export function reviewsHtml(list: Review[], heading: string, cls = "") {
  if (!list.length) return "";
  return `<section class="pt-reviews ${cls}"><h2>${esc(heading)}</h2><div class="pt-rv-grid">${list
    .map((r) => `<figure class="pt-rv"><blockquote>“${esc(r.quote)}”</blockquote><figcaption><b>${esc(r.name)}</b>${r.detail ? `<span>${esc(r.detail)}</span>` : ""}</figcaption></figure>`)
    .join("")}</div></section>`;
}

/** Styles for reviewsHtml, using the page's own colours through CSS variables with fallbacks. */
export const REVIEWS_CSS = `.pt-reviews{max-width:1080px;margin:0 auto;padding:56px 20px}.pt-reviews h2{text-align:center;margin:0 0 24px}
.pt-rv-grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}.pt-rv{margin:0;background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:18px;padding:20px}
.pt-rv blockquote{margin:0 0 12px;line-height:1.55}.pt-rv figcaption b{display:block}.pt-rv figcaption span{font-size:.85em;opacity:.65}`;
