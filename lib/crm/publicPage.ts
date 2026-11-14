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

export type PageData = {
  pub: string; company: string; name: string; city?: string; locality?: string; type?: string; rera?: string; about?: string;
  amenities?: string[]; cover?: string; phone?: string; mix: ReturnType<typeof unitMix>; ref?: string; url?: string;
  images?: string[]; mapUrl?: string; code?: string;
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
  const phone10 = cleanPhone10(d.phone);
  const desc = (d.about || `${d.name}${where ? " in " + where : ""}. Check availability and request a callback.`).replace(/\s+/g, " ").slice(0, 155);
  const total = d.mix.reduce((a, m) => a + m.count, 0);
  const ref = /^[a-f0-9]{8,40}$/.test(d.ref || "") ? d.ref! : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${E(d.name)}${where ? " · " + E(where) : ""}</title><meta name="description" content="${E(desc)}">
<meta property="og:title" content="${E(d.name)}"><meta property="og:description" content="${E(desc)}">${cover ? `<meta property="og:image" content="${E(cover)}">` : ""}<meta property="og:type" content="website">
<style>:root{--bg:#f6f7f9;--card:#fff;--tx:#14181f;--mut:#667085;--bd:#e4e7ec;--ac:#1d4ed8;color-scheme:light dark}
@media(prefers-color-scheme:dark){:root{--bg:#0e1116;--card:#171c23;--tx:#eceef2;--mut:#98a2b3;--bd:#29303a;--ac:#6ea0ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.hero{min-height:220px;background:${cover ? `linear-gradient(transparent 30%,rgba(0,0,0,.65)),url('${E(cover)}') center/cover` : "linear-gradient(135deg,#1e3a8a,#0e7490)"};display:flex;align-items:flex-end;color:#fff}
.w{max-width:760px;margin:0 auto;padding:16px}.hero .w{width:100%;padding-top:80px}h1{margin:0;font-size:26px}.sub{opacity:.9}
.card{background:var(--card);border:1px solid var(--bd);border-radius:14px;padding:14px;margin:12px 0}h2{font-size:17px;margin:0 0 8px}
.chips{display:flex;flex-wrap:wrap;gap:6px}.chip{border:1px solid var(--bd);border-radius:99px;padding:3px 11px;font-size:14px}
.price{font-size:22px;font-weight:700;color:var(--ac)}table{width:100%;border-collapse:collapse}td,th{padding:8px 4px;border-bottom:1px solid var(--bd);text-align:left;font-size:15px}th{color:var(--mut);font-weight:600;font-size:13px}
label{display:block;font-size:14px;color:var(--mut);margin:10px 0 3px}input,textarea{width:100%;font:inherit;color:var(--tx);background:var(--bg);border:1px solid var(--bd);border-radius:10px;padding:11px}
button,.btn{font:inherit;font-weight:600;border:0;border-radius:10px;padding:12px 16px;background:var(--ac);color:#fff;cursor:pointer;text-decoration:none;display:inline-block;text-align:center}
.btn.o{background:transparent;color:var(--ac);border:1px solid var(--ac)}.row{display:flex;gap:8px;flex-wrap:wrap}.row>*{flex:1}.hp{position:absolute;left:-9999px}.ok{color:#16a34a;font-weight:600}.er{color:#dc2626}
.f{color:var(--mut);font-size:13px;text-align:center;padding:12px 0 32px}
.gal{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:4px}.gal a{flex:0 0 auto;scroll-snap-align:start}.gal img{display:block;height:180px;width:auto;max-width:82vw;border-radius:10px;object-fit:cover;background:var(--bd)}
.loc{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}</style></head><body>
<div class="hero"><div class="w"><h1>${E(d.name)}</h1><div class="sub">${E(where)}${d.type ? (where ? " · " : "") + E(d.type) : ""}${code ? " · Property ID " + E(code) : ""}</div></div></div>
<div class="w">
${startsAt !== null ? `<div class="card"><div class="mut" style="color:var(--mut);font-size:13px">Starting from</div><div class="price">${E(formatPrice(startsAt))}</div>${d.rera ? `<div style="color:var(--mut);font-size:13px;margin-top:4px">RERA: ${E(d.rera)}</div>` : ""}</div>` : d.rera ? `<div class="card" style="color:var(--mut)">RERA: ${E(d.rera)}</div>` : ""}
${imgs.length ? `<div class="card"><h2>Photos</h2><div class="gal">${imgs.map((u, i) => `<a href="${E(u)}" target="_blank" rel="noopener"><img src="${E(u)}" alt="${E(d.name)} photo ${i + 1}" loading="lazy" decoding="async"></a>`).join("")}</div></div>` : ""}
${map || where ? `<div class="card loc"><div><h2 style="margin:0">Location</h2><div style="color:var(--mut)">${E(where || d.name)}</div></div>${map ? `<a class="btn o" href="${E(map)}" target="_blank" rel="noopener">📍 View on Google Maps</a>` : ""}</div>` : ""}
${d.about ? `<div class="card"><h2>About</h2><div style="white-space:pre-line">${E(d.about)}</div></div>` : ""}
${d.amenities?.length ? `<div class="card"><h2>Amenities</h2><div class="chips">${d.amenities.map((a) => `<span class="chip">${E(a)}</span>`).join("")}</div></div>` : ""}
${total ? `<div class="card"><h2>Available now</h2><table><tr><th>Type</th><th>Units</th><th>Price</th></tr>${d.mix.map((m) => `<tr><td>${E(m.bhk)}</td><td>${m.count}</td><td>${m.from === null ? "On request" : m.from === m.to ? E(formatPrice(m.from)) : E(formatPrice(m.from)) + " – " + E(formatPrice(m.to!))}</td></tr>`).join("")}</table></div>` : ""}
<div class="card" id="enq"><h2>Request a callback</h2>
<form id="f" novalidate><input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
<label for="n">Your name</label><input id="n" name="name" autocomplete="name" maxlength="80" required>
<label for="p">Mobile number</label><input id="p" name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="16" required>
<label for="m">Message (optional)</label><textarea id="m" name="message" rows="2" maxlength="500" placeholder="e.g. 2BHK, budget, preferred time"></textarea>
<div class="row" style="margin-top:12px"><button type="submit" id="b">Request callback</button>${phone10 ? `<a class="btn o" href="tel:+91${phone10}">Call now</a><a class="btn o" target="_blank" rel="noopener" href="https://wa.me/91${phone10}?text=${encodeURIComponent("Hi, I am interested in " + d.name)}">WhatsApp</a>` : ""}</div>
<div id="s" role="status" style="margin-top:10px"></div></form></div>
<div class="f">Listed by ${E(d.company)}</div></div>
<script>(function(){var f=document.getElementById("f"),s=document.getElementById("s"),b=document.getElementById("b");
f.addEventListener("submit",function(e){e.preventDefault();s.className="";s.textContent="";b.disabled=true;
fetch("/CRM/api.php?r=enquiry",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pub:${JSON.stringify(d.pub)},ref:${JSON.stringify(ref)},name:document.getElementById("n").value,phone:document.getElementById("p").value,message:document.getElementById("m").value,website:f.querySelector(".hp").value})})
.then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j}})}).then(function(x){if(x.ok){f.reset();s.className="ok";s.textContent="Thank you! We will call you shortly."}else{s.className="er";s.textContent=x.j.error||"Something went wrong. Please try again."}})
.catch(function(){s.className="er";s.textContent="Could not send. Please check your connection and try again."}).then(function(){b.disabled=false})})})();</script>
</body></html>`;
}
