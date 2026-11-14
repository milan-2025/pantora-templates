/** Public project page and enquiry form: pure helpers (HTML rendering, validation). Everything shown is escaped. */

export const escapeHtml = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"'`]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" })[c]!);

/** Only plain https links are allowed for images (no javascript:, data:, http:). */
export function safeHttpsUrl(u: unknown): string {
  const s = String(u ?? "").trim().slice(0, 400);
  try {
    const url = new URL(s);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : "";
  } catch { return ""; }
}

export function parseAmenities(v: unknown): string[] {
  const list = Array.isArray(v) ? v : String(v ?? "").split(/[,\n]/);
  return list.map((x) => String(x).trim().slice(0, 40)).filter(Boolean).slice(0, 24);
}

export function cleanPhone10(v: unknown): string {
  const d = String(v ?? "").replace(/\D/g, "");
  const last10 = d.length > 10 ? d.slice(-10) : d;
  return /^[6-9]\d{9}$/.test(last10) ? last10 : "";
}

export function cleanEnquiry(body: Record<string, unknown>): { ok: true; name: string; phone: string; message: string } | { ok: false; error: string } {
  const name = String(body.name ?? "").trim().slice(0, 80);
  if (!name) return { ok: false, error: "Please enter your name" };
  const phone = cleanPhone10(body.phone);
  if (!phone) return { ok: false, error: "Please enter a valid 10-digit mobile number" };
  return { ok: true, name, phone, message: String(body.message ?? "").trim().slice(0, 500) };
}

export const formatPrice = (n: number): string =>
  n >= 1e7 ? `₹${+(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${+(n / 1e5).toFixed(2)} L` : `₹${Math.round(n).toLocaleString("en-IN")}`;

/** Available units grouped by type (BHK): the public page never shows unit numbers, holds or buyers. */
export function unitMix(units: { status: string; bhk?: string; price?: number | null }[]) {
  const g = new Map<string, { bhk: string; count: number; from: number | null; to: number | null }>();
  for (const u of units) {
    if (u.status !== "available") continue;
    const k = (u.bhk || "").trim() || "Units";
    const e = g.get(k) || { bhk: k, count: 0, from: null, to: null };
    e.count++;
    if (typeof u.price === "number" && u.price > 0) {
      e.from = e.from === null ? u.price : Math.min(e.from, u.price);
      e.to = e.to === null ? u.price : Math.max(e.to, u.price);
    }
    g.set(k, e);
  }
  return [...g.values()].sort((a, b) => a.bhk.localeCompare(b.bhk, undefined, { numeric: true }));
}

// ---------- shared page parts (every value shown is escaped; scripts get JSON with "<" escaped) ----------

const jsStr = (v: unknown) => JSON.stringify(String(v ?? "")).replace(/</g, "\\u003c");
const refOk = (r?: string) => (/^[a-f0-9]{8,40}$/.test(r || "") ? r! : "");
const priceRange = (m: { from: number | null; to: number | null }) =>
  m.from === null ? "On request" : m.from === m.to ? formatPrice(m.from) : formatPrice(m.from) + " – " + formatPrice(m.to!);

function shell(o: { title: string; desc: string; cover: string; body: string; css?: string }) {
  const E = escapeHtml;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${E(o.title)}</title><meta name="description" content="${E(o.desc)}">
<meta property="og:title" content="${E(o.title)}"><meta property="og:description" content="${E(o.desc)}">${o.cover ? `<meta property="og:image" content="${E(o.cover)}">` : ""}<meta property="og:type" content="website">
<style>:root{--bg:#f6f7f9;--card:#fff;--tx:#14181f;--mut:#667085;--bd:#e4e7ec;--ac:#1d4ed8;color-scheme:light dark}
@media(prefers-color-scheme:dark){:root{--bg:#0e1116;--card:#171c23;--tx:#eceef2;--mut:#98a2b3;--bd:#29303a;--ac:#6ea0ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.hero{min-height:220px;background:${o.cover ? `linear-gradient(transparent 30%,rgba(0,0,0,.65)),url('${E(o.cover)}') center/cover` : "linear-gradient(135deg,#1e3a8a,#0e7490)"};display:flex;align-items:flex-end;color:#fff}
.w{max-width:760px;margin:0 auto;padding:16px}.hero .w{width:100%;padding-top:80px}h1{margin:0;font-size:26px}.sub{opacity:.9}
.card{background:var(--card);border:1px solid var(--bd);border-radius:14px;padding:14px;margin:12px 0}h2{font-size:17px;margin:0 0 8px}
.chips{display:flex;flex-wrap:wrap;gap:6px}.chip{border:1px solid var(--bd);border-radius:99px;padding:3px 11px;font-size:14px}
.price{font-size:22px;font-weight:700;color:var(--ac)}table{width:100%;border-collapse:collapse}td,th{padding:8px 4px;border-bottom:1px solid var(--bd);text-align:left;font-size:15px}th{color:var(--mut);font-weight:600;font-size:13px}
label{display:block;font-size:14px;color:var(--mut);margin:10px 0 3px}input,textarea{width:100%;font:inherit;color:var(--tx);background:var(--bg);border:1px solid var(--bd);border-radius:10px;padding:11px}
button,.btn{font:inherit;font-weight:600;border:0;border-radius:10px;padding:12px 16px;background:var(--ac);color:#fff;cursor:pointer;text-decoration:none;display:inline-block;text-align:center}
.btn.o{background:transparent;color:var(--ac);border:1px solid var(--ac)}.row{display:flex;gap:8px;flex-wrap:wrap}.row>*{flex:1}.hp{position:absolute;left:-9999px}.ok{color:#16a34a;font-weight:600}.er{color:#dc2626}
.f{color:var(--mut);font-size:13px;text-align:center;padding:12px 0 32px}.mut{color:var(--mut);font-size:14px}
.gal{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:4px}.gal a{flex:0 0 auto;scroll-snap-align:start}.gal img{display:block;height:180px;width:auto;max-width:82vw;border-radius:10px;object-fit:cover;background:var(--bd)}
.loc{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.vid{position:relative;padding-top:56.25%;border-radius:10px;overflow:hidden;background:#000;margin-bottom:10px}.vid iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}.facts div{border:1px solid var(--bd);border-radius:10px;padding:8px 10px}.facts small{display:block;color:var(--mut);font-size:12px}.facts b{font-size:17px}
.badge{display:inline-block;border-radius:99px;padding:3px 11px;font-size:13px;font-weight:700;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.5)}
.plist{display:grid;gap:12px}.pc{display:grid;grid-template-columns:120px 1fr;gap:12px;align-items:center;background:var(--card);border:1px solid var(--bd);border-radius:14px;padding:10px;color:inherit;text-decoration:none}
.pc img,.pc .ph{width:120px;height:96px;object-fit:cover;border-radius:10px;background:linear-gradient(135deg,#1e3a8a,#0e7490);display:block}.pc h3{margin:0;font-size:17px}
${o.css || ""}</style></head><body>${o.body}</body></html>`;
}

const gallery = (imgs: string[], name: string) =>
  imgs.length ? `<div class="card"><h2>Photos</h2><div class="gal">${imgs.map((u, i) => `<a href="${escapeHtml(u)}" target="_blank" rel="noopener"><img src="${escapeHtml(u)}" alt="${escapeHtml(name)} photo ${i + 1}" loading="lazy" decoding="async"></a>`).join("")}</div></div>` : "";

/** YouTube players (privacy-friendly domain, lazy-loaded). Only valid 11-character ids get through. */
const videos = (ids: string[]) => {
  const ok = ids.filter((id) => /^[A-Za-z0-9_-]{11}$/.test(id)).slice(0, 10);
  return ok.length ? `<div class="card"><h2>Videos</h2>${ok.map((id) => `<div class="vid"><iframe src="https://www.youtube-nocookie.com/embed/${id}?rel=0" title="Video" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`).join("")}</div>` : "";
};

const location = (where: string, map: string, name: string) =>
  map || where ? `<div class="card loc"><div><h2 style="margin:0">Location</h2><div style="color:var(--mut)">${escapeHtml(where || name)}</div></div>${map ? `<a class="btn o" href="${escapeHtml(map)}" target="_blank" rel="noopener">📍 View on Google Maps</a>` : ""}</div>` : "";

/** Callback form. Posts to the CRM, which creates (or updates) a lead for the right company. */
function enquiryForm(o: { pub: string; unit?: string; ref: string; phone: string; about: string; title?: string; placeholder?: string; button?: string }) {
  const phone10 = cleanPhone10(o.phone);
  return `<div class="card" id="enq"><h2>${escapeHtml(o.title || "Request a callback")}</h2>
<form id="f" novalidate><input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
<label for="n">Your name</label><input id="n" name="name" autocomplete="name" maxlength="80" required>
<label for="p">Mobile number</label><input id="p" name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="16" required>
<label for="m">Message (optional)</label><textarea id="m" name="message" rows="2" maxlength="500" placeholder="${escapeHtml(o.placeholder || "e.g. 2BHK, budget, preferred time")}"></textarea>
<div class="row" style="margin-top:12px"><button type="submit" id="b">${escapeHtml(o.button || "Request callback")}</button>${phone10 ? `<a class="btn o" href="tel:+91${phone10}">Call now</a><a class="btn o" target="_blank" rel="noopener" href="https://wa.me/91${phone10}?text=${encodeURIComponent("Hi, I am interested in " + o.about)}">WhatsApp</a>` : ""}</div>
<div id="s" role="status" style="margin-top:10px"></div></form></div>
<script>(function(){var f=document.getElementById("f"),s=document.getElementById("s"),b=document.getElementById("b");
f.addEventListener("submit",function(e){e.preventDefault();s.className="";s.textContent="";b.disabled=true;
fetch("/CRM/api.php?r=enquiry",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pub:${jsStr(o.pub)},unit:${jsStr(o.unit || "")},ref:${jsStr(o.ref)},name:document.getElementById("n").value,phone:document.getElementById("p").value,message:document.getElementById("m").value,website:f.querySelector(".hp").value})})
.then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j}})}).then(function(x){if(x.ok){f.reset();s.className="ok";s.textContent="Thank you! We will call you shortly."}else{s.className="er";s.textContent=x.j.error||"Something went wrong. Please try again."}})
.catch(function(){s.className="er";s.textContent="Could not send. Please check your connection and try again."}).then(function(){b.disabled=false})})})();</script>`;
}

const idsOf = (links?: string[]) => (links || []).map((l) => (/[?&]v=([A-Za-z0-9_-]{11})(?:&|$)/.exec(String(l)) || [])[1] || "").filter(Boolean);

// ---------- project page ----------

export type PageData = {
  pub: string; company: string; name: string; city?: string; locality?: string; type?: string; rera?: string; about?: string;
  amenities?: string[]; cover?: string; phone?: string; mix: ReturnType<typeof unitMix>; ref?: string; url?: string;
  images?: string[]; mapUrl?: string; code?: string; videos?: string[]; catalogue?: string;
};

export function renderProjectPage(d: PageData): string {
  const E = escapeHtml;
  const imgs = (d.images || []).map(safeHttpsUrl).filter(Boolean).slice(0, 12);
  const cover = safeHttpsUrl(d.cover) || imgs[0] || "";
  const map = safeHttpsUrl(d.mapUrl);
  const code = /^PR-\d{3,}$/.test(d.code || "") ? d.code! : "";
  const from = d.mix.map((m) => m.from).filter((x): x is number => x !== null);
  const startsAt = from.length ? Math.min(...from) : null;
  const where = [d.locality, d.city].filter(Boolean).join(", ");
  const desc = (d.about || `${d.name}${where ? " in " + where : ""}. Check availability and request a callback.`).replace(/\s+/g, " ").slice(0, 155);
  const total = d.mix.reduce((a, m) => a + m.count, 0);
  const ref = refOk(d.ref);
  const cat = /^[a-f0-9]{10,40}$/.test(d.catalogue || "") ? d.catalogue! : "";
  const body = `<div class="hero"><div class="w"><h1>${E(d.name)}</h1><div class="sub">${E(where)}${d.type ? (where ? " · " : "") + E(d.type) : ""}${code ? " · Property ID " + E(code) : ""}</div></div></div>
<div class="w">
${startsAt !== null ? `<div class="card"><div class="mut" style="color:var(--mut);font-size:13px">Starting from</div><div class="price">${E(formatPrice(startsAt))}</div>${d.rera ? `<div style="color:var(--mut);font-size:13px;margin-top:4px">RERA: ${E(d.rera)}</div>` : ""}</div>` : d.rera ? `<div class="card" style="color:var(--mut)">RERA: ${E(d.rera)}</div>` : ""}
${gallery(imgs, d.name)}
${videos(idsOf(d.videos))}
${location(where, map, d.name)}
${d.about ? `<div class="card"><h2>About</h2><div style="white-space:pre-line">${E(d.about)}</div></div>` : ""}
${d.amenities?.length ? `<div class="card"><h2>Amenities</h2><div class="chips">${d.amenities.map((a) => `<span class="chip">${E(a)}</span>`).join("")}</div></div>` : ""}
${total ? `<div class="card"><h2>Available now</h2><table><tr><th>Type</th><th>Units</th><th>Price</th></tr>${d.mix.map((m) => `<tr><td>${E(m.bhk)}</td><td>${m.count}</td><td>${E(priceRange(m))}</td></tr>`).join("")}</table></div>` : ""}
${enquiryForm({ pub: d.pub, ref, phone: d.phone || "", about: d.name })}
<div class="f">Listed by ${E(d.company)}${cat ? ` · <a href="/catalogue/${cat}${ref ? "?ref=" + ref : ""}">See all properties</a>` : ""}</div></div>`;
  return shell({ title: `${d.name}${where ? " · " + where : ""}`, desc, cover, body });
}

// ---------- single unit page ----------

export type UnitPageData = {
  company: string; projectPub: string; unitPub: string; projectName: string; propCode?: string; code?: string;
  no: string; tower?: string; floor?: number | null; bhk?: string; area?: number | null; price?: number | null; status: string;
  city?: string; locality?: string; type?: string; rera?: string; cover?: string; images?: string[]; videos?: string[]; mapUrl?: string;
  phone?: string; ref?: string; amenities?: string[]; catalogue?: string;
};

const STATUS_TEXT: Record<string, string> = { available: "Available", soft_hold: "On hold", hard_hold: "On hold", booked: "No longer available", sold: "No longer available" };

export function renderUnitPage(d: UnitPageData): string {
  const E = escapeHtml;
  const imgs = (d.images || []).map(safeHttpsUrl).filter(Boolean).slice(0, 12);
  const cover = safeHttpsUrl(d.cover) || imgs[0] || "";
  const where = [d.locality, d.city].filter(Boolean).join(", ");
  const code = /^PR-\d{3,}-U\d{3,}$/.test(d.code || "") ? d.code! : "";
  const gone = d.status === "booked" || d.status === "sold";
  const ref = refOk(d.ref);
  const label = `${d.bhk ? d.bhk + " · " : ""}Unit ${d.tower ? d.tower + " " : ""}${d.no}`;
  const facts: [string, string][] = [];
  if (!gone && typeof d.price === "number" && d.price > 0) facts.push(["Price", formatPrice(d.price)]);
  if (d.bhk) facts.push(["Type", d.bhk]);
  if (typeof d.area === "number" && d.area > 0) facts.push(["Area", `${d.area.toLocaleString("en-IN")} sq ft`]);
  if (typeof d.floor === "number") facts.push(["Floor", d.floor === 0 ? "Ground" : String(d.floor)]);
  if (d.tower) facts.push(["Tower / block", d.tower]);
  if (code) facts.push(["Unit ID", code]);
  const desc = `${label} at ${d.projectName}${where ? ", " + where : ""}. ${gone ? "This unit is no longer available." : "Check details and request a callback."}`.slice(0, 155);
  const projLink = `/property/${d.projectPub}${ref ? "?ref=" + ref : ""}`;
  const body = `<div class="hero"><div class="w"><span class="badge">${E(STATUS_TEXT[d.status] || "Available")}</span><h1 style="margin-top:6px">${E(label)}</h1><div class="sub">${E(d.projectName)}${where ? " · " + E(where) : ""}</div></div></div>
<div class="w">
${gone ? `<div class="card"><b>This unit has been booked.</b> <span class="mut">Similar units may still be available.</span><div class="row" style="margin-top:10px"><a class="btn" href="${E(projLink)}">See available units</a></div></div>` : ""}
${facts.length ? `<div class="card"><div class="facts">${facts.map(([k, v]) => `<div><small>${E(k)}</small><b>${E(v)}</b></div>`).join("")}</div>${d.rera ? `<div class="mut" style="margin-top:8px">RERA: ${E(d.rera)}</div>` : ""}</div>` : ""}
${gallery(imgs, d.projectName)}
${videos(idsOf(d.videos))}
${location(where, safeHttpsUrl(d.mapUrl), d.projectName)}
${d.amenities?.length ? `<div class="card"><h2>Amenities</h2><div class="chips">${d.amenities.map((a) => `<span class="chip">${E(a)}</span>`).join("")}</div></div>` : ""}
${enquiryForm({ pub: d.projectPub, unit: d.unitPub, ref, phone: d.phone || "", about: `${label} at ${d.projectName}`, title: gone ? "Ask about similar units" : "Ask about this unit", button: gone ? "Request callback" : "Ask about this unit" })}
<div class="f"><a href="${E(projLink)}">About ${E(d.projectName)}</a> · Listed by ${E(d.company)}${/^[a-f0-9]{10,40}$/.test(d.catalogue || "") ? ` · <a href="/catalogue/${d.catalogue}${ref ? "?ref=" + ref : ""}">See all properties</a>` : ""}</div></div>`;
  return shell({ title: `${label} · ${d.projectName}`, desc, cover, body });
}

// ---------- whole catalogue ----------

export type CatalogueData = {
  company: string; ref?: string;
  projects: { pub: string; name: string; code?: string; city?: string; locality?: string; type?: string; cover?: string; images?: string[]; mix: ReturnType<typeof unitMix> }[];
};

export function renderCataloguePage(d: CatalogueData): string {
  const E = escapeHtml;
  const ref = refOk(d.ref);
  const cards = d.projects.map((p) => {
    const img = safeHttpsUrl(p.cover) || (p.images || []).map(safeHttpsUrl).find(Boolean) || "";
    const where = [p.locality, p.city].filter(Boolean).join(", ");
    const from = p.mix.map((m) => m.from).filter((x): x is number => x !== null);
    const avail = p.mix.reduce((a, m) => a + m.count, 0);
    const types = p.mix.filter((m) => m.bhk !== "Units").map((m) => m.bhk).join(", ");
    return `<a class="pc" href="/property/${E(p.pub)}${ref ? "?ref=" + ref : ""}">${img ? `<img src="${E(img)}" alt="" loading="lazy" decoding="async">` : `<span class="ph"></span>`}<div><h3>${E(p.name)}</h3><div class="mut">${E(where)}${p.type ? (where ? " · " : "") + E(p.type) : ""}</div><div class="mut">${avail ? `${avail} available${types ? " · " + E(types) : ""}` : "Enquire for availability"}</div>${from.length ? `<div class="price" style="font-size:17px">From ${E(formatPrice(Math.min(...from)))}</div>` : ""}</div></a>`;
  });
  const cover = d.projects.map((p) => safeHttpsUrl(p.cover) || (p.images || []).map(safeHttpsUrl).find(Boolean) || "").find(Boolean) || "";
  const body = `<div class="hero" style="min-height:160px"><div class="w"><h1>${E(d.company)}</h1><div class="sub">${d.projects.length} propert${d.projects.length === 1 ? "y" : "ies"}</div></div></div>
<div class="w"><div class="plist" style="margin-top:12px">${cards.join("")}</div><div class="f">Tap a property to see photos, prices and to request a callback.</div></div>`;
  return shell({ title: `${d.company} · Properties`, desc: `Browse ${d.projects.length} propert${d.projects.length === 1 ? "y" : "ies"} from ${d.company}.`, cover, body });
}
