import "server-only";
import { trackingScript } from "@/lib/tracking";
import { REVIEWS_CSS, reviewsHtml, type Review } from "@/lib/reviews";
import { stickyCtaHtml } from "@/lib/appPage";
import type { Plan } from "@/lib/invites";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

/** Themes shown on the phone. Colours follow the editor's own themes. */
const THEMES = [
  { id: "rajwada", name: "Rajwada", bg1: "#7a1424", bg2: "#3d0a12", tx: "#fbf0dc", hl: "#e8b54a" },
  { id: "mahal", name: "Mahal", bg1: "#fbd6cf", bg2: "#fdeee0", tx: "#6b2f57", hl: "#b8456a" },
  { id: "nikah", name: "Nikah", bg1: "#0f3b33", bg2: "#082621", tx: "#f3ecd8", hl: "#e0c068" },
  { id: "shahi", name: "Shahi", bg1: "#1fa3a8", bg2: "#07304a", tx: "#f6e7c2", hl: "#f0c04a" },
  { id: "starry", name: "Starry", bg1: "#2a1f4f", bg2: "#0d1433", tx: "#f3ecff", hl: "#f0c04a" },
  { id: "mandir", name: "Mandir", bg1: "#8fd0ea", bg2: "#d8f0c8", tx: "#2f4a3a", hl: "#d6263f" },
];

const FAQ: [string, string][] = [
  ["Do I pay before I start?", "No. Design the whole invite for free and see exactly how guests will see it. You pay only when you want to publish it on your own link."],
  ["How do guests open it?", "It is a link, like pandoratemplates.com/i/aditi-kabir. Send it on WhatsApp, Instagram or SMS. Guests don't need an app or an account."],
  ["Can I change things after sending it?", "Yes. Change a venue, a time or a photo whenever you like. Everyone who opens the link sees the latest version."],
  ["Can some guests see only some functions?", "On Premium and Royal, yes. Keep the Haldi for family only and send everyone else the Sangeet and the wedding."],
  ["Is it in Hindi?", "Every invite can be in Hindi or English, and guests can switch between them."],
  ["Can I use it with the wedding planner?", "Yes. Connect the invite to your Pandora wedding planner and RSVPs land straight in your guest list."],
];

/** The wedding invite maker's landing page (/shaadi). `qs` is the visitor's query string, passed on to the editor links. */
export function landingHtml(opts: { plans: Plan[]; banner: string; months: number; site: string; qs: string; reviews?: Review[] }) {
  const create = "/shaadi/create" + (opts.qs ? "?" + opts.qs : "");
  const t0 = THEMES[0];
  const plans = opts.plans
    .map(
      (p) => `<section class="plan${p.badge ? " plan--pick" : ""}">
  <h3>${esc(p.name)}</h3>${p.badge ? `<p class="badge">${esc(p.badge)}</p>` : ""}
  <p class="price">${inr(p.price)}</p>
  <p class="tag">${esc(p.tagline)}</p>
  <ul>${p.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
</section>`,
    )
    .join("");
  const from = Math.min(...opts.plans.map((p) => p.price));
  const title = "Wedding Invite Maker: digital Indian wedding invitations with RSVP | Pandora Templates";
  const description =
    "Make a beautiful digital wedding invitation online: every function with its date, venue and map, RSVPs, photos and music. Share it on WhatsApp in minutes. Free to design.";
  const ld = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Pandora Wedding Invite Maker",
    url: opts.site + "/shaadi",
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Any",
    offers: { "@type": "AggregateOffer", priceCurrency: "INR", lowPrice: from, highPrice: Math.max(...opts.plans.map((p) => p.price)) },
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(opts.site)}/shaadi">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(opts.site)}/shaadi"><meta property="og:image" content="${esc(opts.site)}/shaadi/og.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:site_name" content="Pandora Templates"><meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#7a1424">
<link rel="icon" href="/icon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Mukta:wght@400;500;700&display=swap">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
<script type="application/ld+json">${JSON.stringify(faqLd).replace(/</g, "\\u003c")}</script>
<style>
:root{--paper:#f7ece8;--card:#fffaf8;--ink:#2b1a1c;--mut:#6f5a58;--line:#e6d3cd;--sindoor:#7a1424;--marigold:#e8a317;--mehndi:#2f5d4a;
 --bg1:${t0.bg1};--bg2:${t0.bg2};--tx:${t0.tx};--hl:${t0.hl}}
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important;animation:none!important}}
body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.6 Mukta,system-ui,sans-serif}
a{color:var(--sindoor)}
:focus-visible{outline:3px solid var(--marigold);outline-offset:3px;border-radius:6px}
.w{max-width:1120px;margin:0 auto;padding:0 22px}
h1,h2,h3{font-family:"Cormorant Garamond",Georgia,serif;font-weight:600;line-height:1.08;margin:0}
h2{font-size:clamp(34px,4.6vw,52px);margin-bottom:18px}
p{margin:0 0 14px}

/* top bar */
.top{display:flex;align-items:center;justify-content:space-between;padding:18px 0}
.logo{display:flex;align-items:center;gap:10px;color:var(--ink);text-decoration:none;font-weight:700}
.logo img{width:30px;height:30px}
.top nav{display:flex;gap:22px;align-items:center}
.top nav a:not(.btn){color:var(--ink);text-decoration:none;font-weight:500}
.top nav a:not(.btn):hover{color:var(--sindoor)}
@media (max-width:720px){.top nav a.hide-s{display:none}}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:50px;padding:0 26px;border-radius:999px;font:600 17px Mukta,sans-serif;text-decoration:none;border:2px solid transparent;cursor:pointer}
.btn-p{background:var(--sindoor);color:#fff}
.btn-p:hover{background:#5e0f1b}
.btn-g{border-color:var(--sindoor);color:var(--sindoor);background:transparent}
.btn-g:hover{background:#7a14240d}
.btn-s{min-height:40px;padding:0 18px;font-size:15px}

/* returning couple */
.back{display:none;background:var(--mehndi);color:#fff}
.back.on{display:block}
.back .w{display:flex;gap:14px;align-items:center;justify-content:space-between;padding-top:10px;padding-bottom:10px;flex-wrap:wrap}
.back a{color:#fff;font-weight:700}

.banner{background:var(--marigold);color:#2b1a1c;text-align:center;padding:8px 16px;font-weight:500}

/* hero */
.hero{display:grid;grid-template-columns:1.05fr .95fr;gap:48px;align-items:center;padding:36px 0 72px}
.hero h1{font-size:clamp(46px,6.6vw,84px);letter-spacing:-.01em}
.hero .lead{font-size:20px;color:var(--mut);max-width:30em;margin:22px 0 30px}
.ctas{display:flex;gap:12px;flex-wrap:wrap}
.small{font-size:15px;color:var(--mut);margin-top:16px}
@media (max-width:900px){.hero{grid-template-columns:1fr;gap:36px;padding-top:12px}}

/* the phone */
.stage{display:flex;flex-direction:column;align-items:center;gap:18px}
.phone{width:300px;max-width:82vw;aspect-ratio:9/18.5;border-radius:44px;padding:11px;background:#1d1416;box-shadow:0 40px 70px -30px #3d0a1288,0 0 0 1px #00000020}
.scr{position:relative;height:100%;border-radius:34px;overflow:hidden;background:linear-gradient(170deg,var(--bg1),var(--bg2));color:var(--tx);text-align:center;padding:46px 20px 18px;transition:background .5s,color .5s;display:flex;flex-direction:column;align-items:center}
.scr::before{content:"";position:absolute;left:50%;top:-110px;width:330px;height:330px;transform:translateX(-50%);border-radius:50%;
 background:repeating-conic-gradient(from 0deg,var(--hl) 0 4deg,transparent 4deg 15deg);opacity:.16;-webkit-mask:radial-gradient(circle,transparent 38%,#000 39%,#000 70%,transparent 71%);mask:radial-gradient(circle,transparent 38%,#000 39%,#000 70%,transparent 71%);transition:background .5s}
.scr>*{position:relative}
.ganesh{font-size:13px;color:var(--hl);letter-spacing:.04em;margin-bottom:8px;transition:color .5s}
.inv{font-size:14px;opacity:.85}
.names{font-family:"Cormorant Garamond",serif;font-size:40px;line-height:1.02;margin:10px 0 6px;font-weight:600}
.names i{display:block;font-size:22px;color:var(--hl);font-style:italic;transition:color .5s}
.date{font-size:14px;border-top:1px solid currentColor;border-bottom:1px solid currentColor;padding:4px 14px;margin:6px 0 14px;opacity:.9}
.fns{width:100%;list-style:none;margin:0;padding:0;text-align:left;font-size:13px}
.fns li{display:flex;justify-content:space-between;gap:8px;padding:7px 4px;border-bottom:1px solid color-mix(in srgb,var(--tx) 22%,transparent)}
.fns b{font-weight:700}
.rsvp{margin-top:auto;width:100%;border-radius:999px;padding:10px;background:var(--hl);color:var(--bg2);font-weight:700;font-size:14px;transition:background .5s,color .5s}
.swatches{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.sw{width:40px;height:40px;border-radius:50%;border:3px solid var(--card);box-shadow:0 0 0 1px var(--line);cursor:pointer;padding:0}
.sw[aria-pressed="true"]{box-shadow:0 0 0 2px var(--sindoor)}
.swlabel{font-size:15px;color:var(--mut);margin:0}

/* steps */
.band{background:var(--card);border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:76px 0}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:36px;list-style:none;padding:0;margin:34px 0 0;counter-reset:s}
.steps li{counter-increment:s}
.steps li::before{content:counter(s);display:block;font-family:"Cormorant Garamond",serif;font-size:64px;line-height:1;color:var(--marigold);font-weight:700;margin-bottom:6px}
.steps h3{font-size:28px;margin-bottom:8px}
.steps p{color:var(--mut)}
@media (max-width:760px){.steps{grid-template-columns:1fr;gap:22px}}

/* features */
.feat{padding:80px 0}
.flist{display:grid;grid-template-columns:1fr 1fr;gap:6px 56px;margin-top:28px}
.flist div{padding:18px 0;border-top:1px solid var(--line)}
.flist h3{font-size:25px;margin-bottom:4px}
.flist p{color:var(--mut);margin:0}
@media (max-width:760px){.flist{grid-template-columns:1fr}}

/* pricing */
.pricing{padding:80px 0;background:var(--sindoor);color:#fbf0dc}
.pricing h2{color:#fff}
.pricing .intro{max-width:36em;opacity:.9}
.plans{display:grid;grid-template-columns:repeat(${Math.max(1, opts.plans.length)},1fr);gap:22px;margin-top:34px;align-items:start}
.plan{border:1px solid #fbf0dc55;border-radius:22px;padding:26px}
.plan--pick{background:#fbf0dc;color:var(--ink);border-color:transparent}
.plan h3{font-size:30px}
.badge{display:inline-block;background:var(--marigold);color:var(--ink);border-radius:999px;padding:0 12px;font-size:14px;font-weight:700;margin:8px 0 0}
.price{font-family:"Cormorant Garamond",serif;font-size:50px;font-weight:700;margin:10px 0 0;line-height:1}
.tag{opacity:.85}
.plan ul{padding-left:20px;margin:12px 0 0}
.plan li{margin:6px 0}
.pricing .after{margin-top:28px}
.pricing .btn-p{background:#fbf0dc;color:var(--sindoor)}
.pricing .btn-p:hover{background:#fff}
@media (max-width:860px){.plans{grid-template-columns:1fr}}

/* faq */
.faq{padding:80px 0}
.faq .w{max-width:780px}
details{border-top:1px solid var(--line);padding:16px 0}
details:last-of-type{border-bottom:1px solid var(--line)}
summary{cursor:pointer;font-weight:700;font-size:19px;list-style:none;display:flex;justify-content:space-between;gap:16px}
summary::-webkit-details-marker{display:none}
summary::after{content:"+";color:var(--sindoor);font-size:24px;line-height:1}
details[open] summary::after{content:"−"}
details p{color:var(--mut);margin:10px 0 0}

.end{padding:20px 0 90px;text-align:center}
.end h2{max-width:14em;margin:0 auto 22px}
footer{border-top:1px solid var(--line);padding:26px 0 40px;font-size:15px;color:var(--mut)}
footer .w{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
footer a{color:var(--mut)}
${REVIEWS_CSS}</style>${trackingScript("invites")}</head>
<body>
<div class="back" id="back"><div class="w"><span id="backtx">You have an invite in progress on this device.</span><a id="backlink" href="${esc(create)}">Continue my invite</a></div></div>
${opts.banner ? `<div class="banner">${esc(opts.banner)}</div>` : ""}
<div class="w">
<header class="top">
  <a class="logo" href="/"><img src="/icon.svg" alt="" width="30" height="30">Pandora Templates</a>
  <nav><a class="hide-s" href="#how">How it works</a><a class="hide-s" href="#prices">Prices</a><a class="btn btn-p btn-s" href="${esc(create)}">Make my invite</a></nav>
</header>

<main>
<section class="hero">
  <div>
    <h1>Your wedding invite, ready for WhatsApp tonight</h1>
    <p class="lead">Every function with its date, venue and map. RSVPs that count themselves. Photos, music and a countdown. One link the whole family can share.</p>
    <div class="ctas"><a class="btn btn-p" href="${esc(create)}">Start designing, free</a><a class="btn btn-g" href="#prices">See prices</a></div>
    <p class="small">Free to design. Pay once to publish, from ${inr(from)}. No app needed for you or your guests.</p>
  </div>
  <div class="stage">
    <div class="phone" aria-label="A sample invite"><div class="scr">
      <div class="ganesh">॥ श्री गणेशाय नमः ॥</div>
      <div class="inv">With the blessings of our families, we invite you to</div>
      <div class="names">Aditi<i>and</i>Kabir</div>
      <div class="date">14 February 2027, Jaipur</div>
      <ul class="fns">
        <li><b>Haldi</b><span>12 Feb, 10 am</span></li>
        <li><b>Mehendi</b><span>12 Feb, 4 pm</span></li>
        <li><b>Sangeet</b><span>13 Feb, 7 pm</span></li>
        <li><b>Pheras</b><span>14 Feb, 8 pm</span></li>
      </ul>
      <div class="rsvp">Will you join us? RSVP</div>
    </div></div>
    <p class="swlabel" id="swname">Theme: ${esc(t0.name)}</p>
    <div class="swatches" role="group" aria-label="Try a theme">
      ${THEMES.map((t, i) => `<button type="button" class="sw" aria-pressed="${i === 0}" aria-label="${esc(t.name)} theme" data-t='${esc(JSON.stringify(t))}' style="background:linear-gradient(135deg,${t.bg1} 50%,${t.hl} 50%)"></button>`).join("")}
    </div>
  </div>
</section>
</main>
</div>

<section class="band" id="how"><div class="w">
  <h2>Three steps to send it</h2>
  <ol class="steps">
    <li><h3>Fill in your details</h3><p>Your names, families and each function with its time and venue. A map pin is added for every place.</p></li>
    <li><h3>Make it yours</h3><p>Pick a theme and colours, add your photos and a song. You see the guest view as you type.</p></li>
    <li><h3>Publish and share</h3><p>Choose your link, pay once and send it on WhatsApp. Print the QR code on your cards too.</p></li>
  </ol>
</div></section>

<section class="feat"><div class="w">
  <h2>Everything guests ask you, answered in the invite</h2>
  <div class="flist">
    <div><h3>Every function, its own page</h3><p>Haldi, Mehendi, Sangeet, Pheras, Reception. Each with time, venue, dress code and directions.</p></div>
    <div><h3>RSVPs without phone calls</h3><p>Guests tap to reply and say how many are coming. You see the headcount for each function.</p></div>
    <div><h3>The right functions for the right guests</h3><p>Send family a link with the Haldi, and friends a link with the Sangeet and the wedding.</p></div>
    <div><h3>Hindi or English</h3><p>Guests read it in the language they prefer, and switch any time.</p></div>
    <div><h3>Change it any time</h3><p>Venue moved? Update it once and everyone who opens the link sees the new one.</p></div>
    <div><h3>A reel for your status</h3><p>On Royal, download a short video invite for Instagram and WhatsApp status.</p></div>
  </div>
</div></section>

<section class="pricing" id="prices"><div class="w">
  <h2>Pay once, when you publish</h2>
  <p class="intro">Design as long as you like for free. Your invite stays live for ${opts.months} months after you publish. Upgrade later and pay only the difference.</p>
  <div class="plans">${plans}</div>
  <div class="after"><a class="btn btn-p" href="${esc(create)}">Start designing, free</a></div>
</div></section>

${reviewsHtml(opts.reviews ?? [], "Couples who sent theirs")}
<section class="faq"><div class="w">
  <h2>Questions couples ask</h2>
  ${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}
</div></section>

<section class="end" data-pt-final><div class="w">
  <h2>Your guests are waiting for the date. Send it to them.</h2>
  <a class="btn btn-p" href="${esc(create)}">Make my invite</a>
</div></section>

${stickyCtaHtml("Make my invite, free", create, { bg: "#7a1424", fg: "#fff" })}
<footer><div class="w">
  <span>Pandora Templates</span>
  <span><a href="/planner">Wedding planner</a>, <a href="/wedding_planner_sheet">Planner spreadsheet</a>, <a href="/stays">Stays</a>, <a href="/contact">Contact</a>, <a href="/refund">Refunds</a></span>
</div></footer>

<script>
(function(){
  var root=document.documentElement,label=document.getElementById("swname"),btns=document.querySelectorAll(".sw");
  btns.forEach(function(b){b.addEventListener("click",function(){
    var t=JSON.parse(b.getAttribute("data-t"));
    ["bg1","bg2","tx","hl"].forEach(function(k){root.style.setProperty("--"+k,t[k])});
    btns.forEach(function(x){x.setAttribute("aria-pressed",x===b?"true":"false")});
    label.textContent="Theme: "+t.name;
  })});
  /* A couple who already started an invite on this device goes straight back to it. */
  try{
    var c=JSON.parse(localStorage.getItem("shaadi")||"{}"),keys=JSON.parse(localStorage.getItem("shaadi.keys")||"{}");
    var slug=c&&c.slug&&c.token?c.slug:Object.keys(keys)[0];
    if(slug){
      document.getElementById("backlink").href="/i/"+encodeURIComponent(slug)+"/edit";
      document.getElementById("back").classList.add("on");
    }
  }catch(e){}
})();
</script>
</body></html>`;
}
