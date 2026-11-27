import "server-only";
import { trackingScript } from "@/lib/tracking";
import type { PhotoPlan } from "@/lib/photos/core";
import { esc, inr, jsonScript, page } from "@/lib/photos/pages/shared";

const FAQ: [string, string][] = [
  ["Do guests need an app?", "No. Guests open a link (or scan the QR code at the venue) and see every photo in their browser. No app, no sign-up."],
  ["Will my photos lose quality?", "Guests see sharp, fast-loading copies sized for phones and laptops. On the Royal plan, the full-size camera originals are kept for download too."],
  ["Can I keep it private?", "Yes. Add a PIN and only people who know it can open the gallery. Nobody can find your photos by searching."],
  ["Can guests add their own photos?", "On Premium and Royal, guests can send their photos to the gallery. They appear only after you approve them."],
  ["What happens when my plan ends?", "We email you two weeks before. You can renew for another year in one tap. If you don't, we keep the photos safe for a while longer and then delete them for good."],
  ["Can my photographer upload the photos?", "Yes. Share your private dashboard link with your photographer and they can upload straight into your albums."],
];

/** /photos: the landing page, with sign-up and sign-in. */
export function landingHtml(o: { plans: PhotoPlan[]; banner: string; renewalPrice: number; site: string; source: string }) {
  const paid = o.plans.filter((p) => p.id !== "free");
  const free = o.plans.find((p) => p.id === "free")!;
  const cards = o.plans
    .map(
      (p) => `<section class="plan${p.badge ? " pick" : ""}">
  <h3>${esc(p.name)}</h3>${p.badge ? `<p class="badge">${esc(p.badge)}</p>` : ""}
  <p class="price">${p.id === "free" ? "Free" : inr(p.price)}<small>${p.id === "free" ? ` for ${p.freeDays} days` : " one time"}</small></p>
  <p class="tag">${esc(p.tagline)}</p>
  <ul>${p.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
</section>`,
    )
    .join("");
  const title = "Wedding Photo Sharing: one link for every wedding photo and video | Pandora Templates";
  const description = `Share all your wedding photos and videos with family in one beautiful link. Albums for every function, QR code for the venue, guest uploads. Start free, plans from ${inr(Math.min(...paid.map((p) => p.price)))}.`;
  const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };

  const body = `
${o.banner ? `<div class="banner">${esc(o.banner)}</div>` : ""}
<header class="w top"><a class="logo" href="/"><img src="/icon.svg" alt="" width="30" height="30">Pandora Templates</a>
<nav><a href="#how" class="hide-s">How it works</a><a href="#plans" class="hide-s">Plans</a><button class="btn btn-g btn-s" id="signinBtn" type="button">Sign in</button></nav></header>
<main>
<section class="w hero">
 <div>
  <p class="kicker">Wedding photo sharing</p>
  <h1>Every wedding photo, in one beautiful link</h1>
  <p class="lead">Haldi to vidaai, sorted into albums. Send one link on WhatsApp or put a QR code at the venue, and the whole family sees every photo and video. No app, no Google Drive mess.</p>
  <div class="ctas"><a class="btn btn-p" href="#start">Create my gallery, free</a><a class="btn btn-g" href="#plans">See plans</a></div>
  <p class="small">Free for ${free.freeDays} days with up to ${free.maxPhotos} photos. No card needed.</p>
 </div>
 <div class="mock" aria-hidden="true">
  <div class="mock-top"><b>Aditi & Kabir</b><span>12 Feb 2027</span></div>
  <div class="mock-tabs"><span class="on">Haldi</span><span>Sangeet</span><span>Wedding</span><span>Reception</span></div>
  <div class="mock-grid">${Array.from({ length: 9 }, (_, i) => `<i style="--h:${[120, 90, 140, 100, 130, 85, 110, 95, 125][i]}px;--c:${["#e8a317", "#c9503c", "#7a1424", "#f0c98a", "#2f5d4a", "#d98c5f", "#b8456a", "#e8b54a", "#8a3b2f"][i]}"></i>`).join("")}</div>
 </div>
</section>

<section id="how" class="band"><div class="w">
 <h2>How it works</h2>
 <ol class="steps">
  <li><b>1. Create your gallery</b><span>Type your names. Your gallery link is ready in seconds.</span></li>
  <li><b>2. Add photos and videos</b><span>Drag in hundreds at once from your phone or laptop, or hand the dashboard link to your photographer.</span></li>
  <li><b>3. Share one link</b><span>WhatsApp it to the family group, or print the QR code on table cards at the reception.</span></li>
 </ol>
</div></section>

<section class="w feats">
 <div><h3>Albums for every function</h3><p>Haldi, Mehendi, Sangeet, Wedding, Reception, or name your own.</p></div>
 <div><h3>Fast on every phone</h3><p>Photos are resized for quick loading, even on slow networks at the venue.</p></div>
 <div><h3>Private with a PIN</h3><p>Only people with the link and PIN can see your photos.</p></div>
 <div><h3>Guests add theirs</h3><p>Collect the candid shots from cousins' phones. You approve before anyone sees them.</p></div>
 <div><h3>Wedding film too</h3><p>Upload your highlight video and full film with Premium and Royal.</p></div>
 <div><h3>Download any photo</h3><p>Guests save the photos they love. Royal keeps full-size originals.</p></div>
</section>

<section id="plans" class="band"><div class="w">
 <h2>Plans</h2><p class="small">One-time payment, prices include GST. Keep it online longer for ${inr(o.renewalPrice)} a year.</p>
 <div class="plans">${cards}</div>
</div></section>

<section id="start" class="w start">
 <div class="card start-card">
  <h2>Create your gallery</h2>
  <p class="hint">Start free. Upgrade any time from your dashboard.</p>
  <form id="createForm" novalidate>
   <div class="field"><label for="cNames">Your names</label><input id="cNames" autocomplete="off" placeholder="Aditi & Kabir" maxlength="80" required></div>
   <div class="field"><label for="cEmail">Email</label><input id="cEmail" type="email" autocomplete="email" placeholder="you@example.com" required><p class="hint">We send your private dashboard link here.</p></div>
   <div class="row"><div class="field sp"><label for="cDate">Wedding date (optional)</label><input id="cDate" type="date"></div><div class="field sp"><label for="cPhone">Phone (optional)</label><input id="cPhone" type="tel" autocomplete="tel" placeholder="98765 43210"></div></div>
   <p class="err" id="cErr"></p>
   <button class="btn btn-p" id="cGo" type="submit">Create my gallery</button>
  </form>
 </div>
</section>

<section class="w faq"><h2>Questions</h2>${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</section>
</main>
<footer class="w foot"><p>Also from Pandora Templates: <a href="/shaadi">Wedding invite maker</a> · <a href="/planner">Online wedding planner</a></p></footer>

<dialog id="signin"><div class="dlg">
 <h3>Open your gallery</h3>
 <div id="s1"><p class="hint">Type the email you used. We'll send you a 6-digit code.</p>
  <div class="field"><input id="sEmail" type="email" autocomplete="email" placeholder="you@example.com"></div>
  <p class="err" id="sErr"></p><div class="row"><button class="btn btn-p" id="sSend" type="button">Send code</button><button class="btn btn-x" type="button" data-close>Cancel</button></div></div>
 <div id="s2" hidden><p class="hint">Check your email for the code.</p>
  <div class="field"><input id="sCode" inputmode="numeric" maxlength="6" placeholder="123456" autocomplete="one-time-code"></div>
  <p class="err" id="sErr2"></p><div class="row"><button class="btn btn-p" id="sVerify" type="button">Open</button><button class="btn btn-x" type="button" data-close>Cancel</button></div></div>
 <div id="s3" hidden><p class="hint">Your galleries:</p><div id="sList"></div></div>
</div></dialog>`;

  const css = `
.banner{background:var(--marigold);text-align:center;padding:8px 16px;font-weight:500}
.top{display:flex;align-items:center;justify-content:space-between;padding:18px 20px}
.logo{display:flex;align-items:center;gap:10px;color:var(--ink);text-decoration:none;font-weight:700}
.top nav{display:flex;gap:20px;align-items:center}.top nav a{color:var(--ink);text-decoration:none;font-weight:500}
@media (max-width:720px){.hide-s{display:none}}
.hero{display:grid;grid-template-columns:1.05fr .95fr;gap:44px;align-items:center;padding-top:28px;padding-bottom:70px}
.kicker{color:var(--sindoor);font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:14px}
.hero h1{font-size:clamp(44px,6.2vw,80px)}
.lead{font-size:20px;color:var(--mut);margin:20px 0 28px;max-width:32em}
.ctas{display:flex;gap:12px;flex-wrap:wrap}.small{font-size:15px;color:var(--mut);margin-top:14px}
@media (max-width:900px){.hero{grid-template-columns:1fr}}
.mock{background:#fff;border:1px solid var(--line);border-radius:28px;padding:18px;box-shadow:0 30px 60px -30px #7a142455;transform:rotate(1.5deg)}
.mock-top{display:flex;justify-content:space-between;align-items:baseline;font-family:"Cormorant Garamond",serif;font-size:26px;padding:4px 6px 10px}.mock-top span{font:15px Mukta,sans-serif;color:var(--mut)}
.mock-tabs{display:flex;gap:8px;margin-bottom:12px;overflow:hidden}.mock-tabs span{padding:4px 12px;border-radius:999px;background:var(--paper);font-size:14px;white-space:nowrap}.mock-tabs .on{background:var(--sindoor);color:#fff}
.mock-grid{columns:3;column-gap:8px}.mock-grid i{display:block;height:var(--h);background:linear-gradient(160deg,var(--c),#0002);border-radius:10px;margin-bottom:8px;break-inside:avoid}
.band{background:var(--card);border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:64px 0}
h2{font-size:clamp(34px,4.4vw,50px);margin-bottom:16px}
.steps{list-style:none;padding:0;margin:24px 0 0;display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.steps li{background:#fff;border:1px solid var(--line);border-radius:20px;padding:22px}.steps b{display:block;font-size:20px;margin-bottom:6px}.steps span{color:var(--mut)}
@media (max-width:820px){.steps{grid-template-columns:1fr}}
.feats{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;padding:64px 20px}.feats h3{font-size:26px;margin-bottom:6px}.feats p{color:var(--mut)}
@media (max-width:820px){.feats{grid-template-columns:1fr 1fr}}@media (max-width:520px){.feats{grid-template-columns:1fr}}
.plans{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:24px}
@media (max-width:1000px){.plans{grid-template-columns:1fr 1fr}}@media (max-width:560px){.plans{grid-template-columns:1fr}}
.plan{background:#fff;border:1.5px solid var(--line);border-radius:22px;padding:22px;position:relative}
.plan.pick{border-color:var(--sindoor);box-shadow:0 18px 40px -24px #7a1424aa}
.plan h3{font-size:30px}.badge{position:absolute;top:18px;right:18px;background:var(--marigold);border-radius:999px;padding:2px 10px;font-size:13px;font-weight:700}
.price{font-size:32px;font-weight:700;margin:8px 0 2px}.price small{font-size:15px;font-weight:400;color:var(--mut)}
.tag{color:var(--mut);font-size:15px}.plan ul{padding-left:18px;margin:10px 0 0;font-size:15.5px}.plan li{margin-bottom:6px}
.start{padding:64px 20px}.start-card{max-width:560px;margin:0 auto;padding:30px}
.faq{max-width:800px;padding:20px 20px 60px}.faq details{border-bottom:1px solid var(--line);padding:14px 0}.faq summary{cursor:pointer;font-weight:600;font-size:18px}.faq p{margin:10px 0 0;color:var(--mut)}
.foot{padding:20px;color:var(--mut);border-top:1px solid var(--line)}
.gl{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid var(--line)}
`;

  const js = `
var SOURCE=${jsonScript(o.source)};
document.querySelectorAll("[data-close]").forEach(function(b){b.onclick=function(){b.closest("dialog").close()}});
$("createForm").onsubmit=function(e){e.preventDefault();var btn=$("cGo");$("cErr").textContent="";btn.disabled=true;btn.textContent="Creating…";
 api("create",{body:{names:$("cNames").value,email:$("cEmail").value,weddingDate:$("cDate").value||null,phone:$("cPhone").value,source:SOURCE}})
 .then(function(r){lsSet("pt-photos:"+r.slug,r.token);if(window.ptTrack)ptTrack("CompleteRegistration",{currency:"INR"});setTimeout(function(){location.href="/p/"+r.slug+"/manage#k="+r.token},350)})
 .catch(function(err){$("cErr").textContent=err.message;btn.disabled=false;btn.textContent="Create my gallery"})};
$("signinBtn").onclick=function(){$("s1").hidden=false;$("s2").hidden=true;$("s3").hidden=true;$("signin").showModal();$("sEmail").focus()};
$("sSend").onclick=function(){$("sErr").textContent="";api("auth/start",{body:{email:$("sEmail").value}}).then(function(r){$("s1").hidden=true;$("s2").hidden=false;if(r.devCode)$("sCode").value=r.devCode;$("sCode").focus()}).catch(function(e){$("sErr").textContent=e.message})};
$("sVerify").onclick=function(){$("sErr2").textContent="";api("auth/verify",{body:{email:$("sEmail").value,code:$("sCode").value}}).then(function(r){
 if(!r.galleries.length){$("sErr2").textContent="No gallery found for this email.";return}
 r.galleries.forEach(function(g){lsSet("pt-photos:"+g.slug,g.token)});
 if(r.galleries.length===1){location.href="/p/"+r.galleries[0].slug+"/manage";return}
 $("s2").hidden=true;$("s3").hidden=false;$("sList").innerHTML=r.galleries.map(function(g){return '<div class="gl"><b>'+esc(g.names)+'</b><a class="btn btn-p btn-s" href="/p/'+encodeURIComponent(g.slug)+'/manage">Open</a></div>'}).join("")
}).catch(function(e){$("sErr2").textContent=e.message})};
`;

  return page({
    title,
    description,
    canonical: `${o.site}/photos`,
    ogImage: `${o.site}/shaadi/og.jpg`,
    head: `<script type="application/ld+json">${jsonScript(faqLd)}</script>${trackingScript("photos")}`,
    body,
    css,
    js,
  });
}
