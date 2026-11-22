// Builds the workout app (served at /workout) from workout-app/ into public/workout/index.html and public/workout-sw.js.
// Run `npm run build-workout` after editing anything in workout-app/.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";

const src = (f) => readFileSync(new URL(`../workout-app/${f}`, import.meta.url), "utf8");
const LOGO = `<svg width="36" height="36" viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="wkg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8A3D"/><stop offset="1" stop-color="#FF3D5A"/></linearGradient></defs><rect x="1" y="1" width="38" height="38" rx="12" fill="url(#wkg)"/><path d="M21.5 7.5c1.2 5.4-6.5 7.6-6.5 15.2a6.8 6.8 0 0 0 13.6 0c0-3.4-2-5.6-2-5.6.1 2.3-1 3.6-2.3 3.6 1.2-5.6-1-10.2-2.8-13.2z" fill="#fff"/></svg>`;
// Order matters: later files use what earlier ones define.
const files = ["programs.js", "foods.js", "core.js", "cloud.js", "today.js", "player.js", "progress.js", "food.js", "social.js", "rewards.js", "me.js", "extras.js", "landing.js", "main.js"];
const js = `const LOGO = ${JSON.stringify(LOGO)};\n` + files.map((f) => `/* ===== ${f} ===== */\n${src(f)}`).join("\n");
const html = src("shell.html")
  .replace("/*CSS*/", () => src("style.css") + "\n" + src("landing.css"))
  .replace("/*LOGO*/", () => LOGO)
  .replace("/*APP*/", () => js);
mkdirSync(new URL("../public/workout/", import.meta.url), { recursive: true });
writeFileSync(new URL("../public/workout/index.html", import.meta.url), html);
// The worker's version follows the page, so phones pick up each new build. Served from the site root (/workout-sw.js)
// so it may control /workout itself (Hostinger doesn't send the Service-Worker-Allowed header).
const version = createHash("sha256").update(html).digest("hex").slice(0, 12);
writeFileSync(new URL("../public/workout-sw.js", import.meta.url), src("sw.js").replace("/*VERSION*/", version));
console.log(`Wrote public/workout/index.html (${Math.round(html.length / 1024)} KB) and workout-sw.js (${version})`);
