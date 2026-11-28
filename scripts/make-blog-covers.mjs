/**
 * Draws the blog cover images (1600×900 JPG) into content/blog-covers/<slug>.jpg, one per post plus one
 * generic cover per category (cover-<category>.jpg) for posts added later in the admin.
 * Each cover is an illustration in the category's colours, built from the site's lucide icons: no text,
 * so it never repeats or contradicts the post title.
 *
 *   node scripts/make-blog-covers.mjs        (needs Playwright's Chromium; fonts are not used)
 *
 * The content release "2026-11-blog-categories" uploads them to Images & videos and sets each post's cover.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.join(root, "content/blog-covers");
mkdirSync(out, { recursive: true });

const C = {
  weddings: { accent: "#A23A2F", tint: "#F8E1DD", soft: "#FBEFEC", second: "#E8A317" },
  "self-improvement": { accent: "#2A6E45", tint: "#DFF0E4", soft: "#EEF7F1", second: "#E8A317" },
  business: { accent: "#3F4BA8", tint: "#E3E6F7", soft: "#F0F2FB", second: "#1F7A74" },
  hospitality: { accent: "#94491F", tint: "#F7E4D8", soft: "#FBF1EA", second: "#1F5F5B" },
};

/** slug → [category, main icon, two side icons, card style] */
const COVERS = {
  "indian-wedding-planning-checklist": ["weddings", "calendar-heart", ["list-checks", "sparkles"], "list"],
  "manage-wedding-guest-list-rsvps": ["weddings", "users", ["mail", "list-checks"], "list"],
  "digital-wedding-invites-vs-printed-cards": ["weddings", "mail", ["smartphone", "sparkles"], "phone"],
  "wedding-invitation-wording-ideas": ["weddings", "scroll-text", ["heart", "mail"], "lines"],
  "track-wedding-vendor-payments": ["weddings", "wallet", ["indian-rupee", "calendar-check"], "bars"],
  "shagun-gift-tracking": ["weddings", "gift", ["indian-rupee", "heart"], "list"],
  "wedding-guest-accommodation-chandigarh-tricity": ["weddings", "bed-double", ["map-pin", "users"], "lines"],
  "meta-ad-leads-follow-up": ["business", "phone-call", ["megaphone", "timer"], "list"],
  "real-estate-lead-management": ["business", "building-2", ["users", "trending-up"], "grid"],
  "how-to-finish-a-workout-challenge": ["self-improvement", "trophy", ["flame", "calendar-check"], "streak"],
  "home-workout-plan-for-beginners": ["self-improvement", "dumbbell", ["house", "timer"], "list"],
  "how-to-build-an-exercise-habit": ["self-improvement", "flame", ["calendar-check", "sparkles"], "streak"],
  "family-fitness-challenge": ["self-improvement", "users", ["trophy", "heart-pulse"], "bars"],
  "walking-to-running-first-5k": ["self-improvement", "footprints", ["timer", "map-pin"], "bars"],
  "track-fitness-progress-without-scale": ["self-improvement", "ruler", ["camera", "chart-column"], "bars"],
  "does-your-business-need-a-crm": ["business", "users", ["list-checks", "message-circle"], "list"],
  "whatsapp-follow-up-message-templates": ["business", "message-circle", ["phone-call", "sparkles"], "phone"],
  "track-which-ads-bring-customers": ["business", "chart-column", ["megaphone", "indian-rupee"], "bars"],
  "real-estate-site-visit-to-booking": ["business", "building-2", ["calendar-check", "handshake"], "grid"],
  "channel-partner-management-real-estate": ["business", "handshake", ["users", "indian-rupee"], "list"],
  "guest-register-id-checks-for-hosts": ["hospitality", "id-card", ["shield-check", "list-checks"], "list"],
  "get-direct-bookings-for-your-homestay": ["hospitality", "globe", ["house", "message-circle"], "phone"],
  "form-c-foreign-guests-guide": ["hospitality", "shield-check", ["globe", "id-card"], "lines"],
  "homestay-profit-per-listing": ["hospitality", "indian-rupee", ["chart-column", "house"], "bars"],
  "homestay-cleaning-checklist": ["hospitality", "spray-can", ["clipboard-check", "bed-double"], "list"],
  "cover-weddings": ["weddings", "calendar-heart", ["heart", "sparkles"], "lines"],
  "cover-self-improvement": ["self-improvement", "dumbbell", ["flame", "trophy"], "streak"],
  "cover-business": ["business", "trending-up", ["users", "phone-call"], "bars"],
  "cover-hospitality": ["hospitality", "house", ["bed-double", "map-pin"], "grid"],
};

async function icon(name, { size, color, stroke = 1.75 }) {
  // Some icon files are aliases that re-export another icon: follow the import to the real one.
  let file = path.join(root, `node_modules/lucide-react/dist/esm/icons/${name}.mjs`);
  let mod = await import(pathToFileURL(file).href);
  for (let i = 0; !mod.__iconData && i < 3; i++) {
    const target = readFileSync(file, "utf8").match(/from '\.\/([\w-]+)\.mjs'/);
    if (!target) throw new Error(`icon ${name} not found`);
    file = path.join(path.dirname(file), `${target[1]}.mjs`);
    mod = await import(pathToFileURL(file).href);
  }
  const inner = mod.__iconData.node.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${v}"`).join(" ")}/>`).join("");
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

/** The inside of the main card: a hint of the app screen the post is about. */
function card(style, c) {
  const line = (w, o = 1) => `<div style="height:16px;width:${w}%;border-radius:8px;background:${c.tint};opacity:${o}"></div>`;
  const tick = (on) => `<div style="width:30px;height:30px;border-radius:10px;flex:none;background:${on ? c.accent : "#fff"};border:3px solid ${on ? c.accent : c.tint}"></div>`;
  if (style === "list")
    return [90, 75, 82, 60].map((w, i) => `<div style="display:flex;gap:18px;align-items:center">${tick(i < 2)}${line(w)}</div>`).join("");
  if (style === "bars")
    return `<div style="display:flex;align-items:flex-end;gap:22px;height:190px">${[45, 70, 55, 90, 75, 100].map((h, i) => `<div style="flex:1;height:${h}%;border-radius:12px 12px 4px 4px;background:${i === 5 ? c.accent : c.tint}"></div>`).join("")}</div>`;
  if (style === "streak")
    return `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:12px">${Array.from({ length: 21 }, (_, i) => `<div style="aspect-ratio:1;border-radius:10px;background:${i < 16 ? c.accent : c.tint};opacity:${i < 16 ? 0.35 + (i / 16) * 0.65 : 1}"></div>`).join("")}</div>`;
  if (style === "grid")
    return `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px">${Array.from({ length: 15 }, (_, i) => `<div style="height:44px;border-radius:10px;background:${[3, 7, 11].includes(i) ? c.second : [1, 5, 9, 12].includes(i) ? c.accent : c.tint};opacity:${[1, 5, 9, 12].includes(i) ? 0.85 : 1}"></div>`).join("")}</div>`;
  if (style === "phone")
    return `<div style="display:grid;gap:16px">${[["l", 70], ["r", 55], ["l", 80], ["r", 45]].map(([s, w]) => `<div style="align-self:${s === "l" ? "start" : "end"};margin-${s === "l" ? "right" : "left"}:auto;width:${w}%;height:40px;border-radius:20px;background:${s === "l" ? c.tint : c.accent};opacity:${s === "l" ? 1 : 0.85}"></div>`).join("")}</div>`;
  return [95, 88, 92, 70, 84].map((w) => line(w)).join("");
}

async function html(slug, [cat, main, side, style]) {
  const c = C[cat];
  const big = await icon(main, { size: 112, color: c.accent });
  const s1 = await icon(side[0], { size: 64, color: "#fff", stroke: 2 });
  const s2 = await icon(side[1], { size: 58, color: c.accent, stroke: 2 });
  return `<!doctype html><html><head><style>
*{box-sizing:border-box}body{margin:0;width:1600px;height:900px;overflow:hidden;background:linear-gradient(135deg,${c.soft} 0%,${c.tint} 100%);position:relative;font-family:system-ui}
.blob{position:absolute;border-radius:50%}
.card{position:absolute;left:520px;top:180px;width:620px;background:#fff;border-radius:48px;box-shadow:0 40px 80px -30px rgba(40,20,30,.35);padding:56px;display:flex;flex-direction:column;gap:30px;transform:rotate(-3deg)}
.tile{width:180px;height:180px;border-radius:44px;background:${c.tint};display:grid;place-items:center}
.f1{position:absolute;left:1060px;top:120px;width:150px;height:150px;border-radius:44px;background:${c.accent};display:grid;place-items:center;box-shadow:0 30px 60px -25px ${c.accent};transform:rotate(8deg)}
.f2{position:absolute;left:390px;top:560px;width:140px;height:140px;border-radius:50%;background:#fff;display:grid;place-items:center;box-shadow:0 30px 60px -25px rgba(40,20,30,.3)}
.dots{position:absolute;display:grid;grid-template-columns:repeat(6,14px);gap:18px}.dots i{width:14px;height:14px;border-radius:50%;background:${c.accent};opacity:.18}
</style></head><body>
<div class="blob" style="width:620px;height:620px;left:-160px;top:-220px;background:${c.accent};opacity:.08"></div>
<div class="blob" style="width:520px;height:520px;right:-140px;bottom:-200px;background:${c.second};opacity:.12"></div>
<div class="blob" style="width:90px;height:90px;left:1290px;top:560px;background:${c.second};opacity:.55"></div>
<div class="blob" style="width:46px;height:46px;left:300px;top:240px;background:${c.accent};opacity:.35"></div>
<div class="dots" style="left:120px;top:560px">${"<i></i>".repeat(24)}</div>
<div class="dots" style="left:1280px;top:200px">${"<i></i>".repeat(18)}</div>
<div class="card"><div class="tile">${big}</div>${card(style, c)}</div>
<div class="f1">${s1}</div><div class="f2">${s2}</div>
</body></html>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
for (const [slug, spec] of Object.entries(COVERS)) {
  await page.setContent(await html(slug, spec));
  await page.screenshot({ path: path.join(out, `${slug}.jpg`), type: "jpeg", quality: 82 });
  process.stdout.write(".");
}
await browser.close();
console.log(`\n${Object.keys(COVERS).length} covers in content/blog-covers/`);
export { COVERS };
