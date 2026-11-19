// Builds the online wedding planner (served at /planner) from planner-app/ into public/planner/index.html.
// Run `npm run build-planner` after editing anything in planner-app/.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";

const src = (f) => readFileSync(new URL(`../planner-app/${f}`, import.meta.url), "utf8");
const seed = src("seed.json").trim();
// Order matters: later files use what earlier ones define.
const js = ["core.js", "io.js", "grid.js", "ui.js", "cloud.js", "landing.js", "views1.js", "contacts.js", "daytools.js", "profiles.js", "tour.js", "views2.js"]
  .map((f) => `/* ===== ${f} ===== */\n${f === "core.js" ? src(f).replace("/*SEED*/null", () => seed) : src(f)}`)
  .join("\n");
const html = src("shell.html").replace("/*CSS*/", () => src("style.css") + "\n" + src("landing.css")).replace("/*APP*/", () => js);
mkdirSync(new URL("../public/planner/", import.meta.url), { recursive: true });
writeFileSync(new URL("../public/planner/index.html", import.meta.url), html);
// The offline worker's version follows the page, so phones pick up each new build.
const version = createHash("sha256").update(html).digest("hex").slice(0, 12);
writeFileSync(new URL("../public/planner/sw.js", import.meta.url), src("sw.js").replace("/*VERSION*/", version));
console.log(`Wrote public/planner/index.html (${Math.round(html.length / 1024)} KB) and sw.js (${version})`);
