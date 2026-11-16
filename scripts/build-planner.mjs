// Builds the online wedding planner (served at /planner) from planner-app/ into public/planner/index.html.
// Run `npm run build-planner` after editing anything in planner-app/.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const src = (f) => readFileSync(new URL(`../planner-app/${f}`, import.meta.url), "utf8");
const seed = src("seed.json").trim();
// Order matters: later files use what earlier ones define.
const js = ["core.js", "io.js", "grid.js", "ui.js", "cloud.js", "landing.js", "views1.js", "views2.js"]
  .map((f) => `/* ===== ${f} ===== */\n${f === "core.js" ? src(f).replace("/*SEED*/null", () => seed) : src(f)}`)
  .join("\n");
const html = src("shell.html").replace("/*CSS*/", () => src("style.css") + "\n" + src("landing.css")).replace("/*APP*/", () => js);
mkdirSync(new URL("../public/planner/", import.meta.url), { recursive: true });
writeFileSync(new URL("../public/planner/index.html", import.meta.url), html);
console.log(`Wrote public/planner/index.html (${Math.round(html.length / 1024)} KB)`);
