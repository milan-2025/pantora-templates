/**
 * Shared pieces for the app landing pages written as HTML strings (invite maker, photo sharing) and for the
 * others through their own markup: a call-to-action bar fixed to the bottom on phones, and Google's
 * SoftwareApplication data with live prices. Client-safe (no server imports).
 */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * A button fixed to the bottom of the screen on phones. It appears once the visitor scrolls past the first screen
 * and hides again while an element marked data-pt-final (the closing call to action) or the footer is in view.
 * It starts after the page has loaded, so it also sees a footer that comes after it in the HTML.
 */
export function stickyCtaHtml(label: string, href: string, colors: { bg: string; fg: string }) {
  return `<div class="pt-sticky" hidden><a href="${esc(href)}">${esc(label)}</a></div>
<style>.pt-sticky{position:fixed;left:0;right:0;bottom:0;z-index:60;padding:10px 14px calc(10px + env(safe-area-inset-bottom));background:rgba(255,255,255,.94);backdrop-filter:blur(8px);border-top:1px solid rgba(0,0,0,.08);transform:translateY(110%);transition:transform .25s}
.pt-sticky.on{transform:none}.pt-sticky a{display:block;text-align:center;padding:14px;border-radius:999px;font-weight:700;text-decoration:none;background:${colors.bg};color:${colors.fg}}
@media(min-width:900px){.pt-sticky{display:none}}</style>
<script>(function(){function go(){var b=document.querySelector(".pt-sticky");if(!b)return;b.hidden=false;var seen=new Set();
try{var io=new IntersectionObserver(function(es){es.forEach(function(e){e.isIntersecting?seen.add(e.target):seen.delete(e.target)});tick()});document.querySelectorAll("[data-pt-final],footer").forEach(function(e){io.observe(e)})}catch(e){}
function tick(){b.classList.toggle("on",scrollY>innerHeight*0.8&&!seen.size)}addEventListener("scroll",tick,{passive:true});tick()}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",go):go()})();</script>`;
}

export type AppOffer = { name: string; price: number; description?: string };

/** schema.org SoftwareApplication with the plans as offers (prices in ₹), so Google can show the price. */
export function appJsonLd(o: { name: string; url: string; description: string; category?: string; offers: AppOffer[] }) {
  const priced = o.offers.filter((x) => Number.isFinite(x.price) && x.price >= 0);
  const prices = priced.map((x) => x.price);
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: o.name,
    url: o.url,
    description: o.description,
    applicationCategory: o.category ?? "LifestyleApplication",
    operatingSystem: "Web, Android, iOS (installable web app)",
    publisher: { "@type": "Organization", name: "Pandora Templates", url: "https://pandoratemplates.com" },
    ...(priced.length
      ? {
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "INR",
            lowPrice: Math.min(...prices),
            highPrice: Math.max(...prices),
            offerCount: priced.length,
            offers: priced.map((x) => ({ "@type": "Offer", name: x.name, price: x.price, priceCurrency: "INR", ...(x.description ? { description: x.description } : {}) })),
          },
        }
      : {}),
  };
}

export const jsonLdScript = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
