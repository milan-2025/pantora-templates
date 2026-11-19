/**
 * The page behind a run sheet link (/planner/share/<code>): read-only, phone-first, no sign-in.
 * Pure (no database), so it can be tested on its own.
 */
import type { SharedRunSheet } from "./core";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const showDate = (s: string) => {
  const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(s);
  if (!m) return "";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return `${DAY[d.getUTCDay()]}, ${+m[3]} ${MON[+m[2] - 1]} ${m[1]}`;
};
const showTime = (t: string) => {
  const m = /^(\d\d?):(\d\d)/.exec(t);
  if (!m) return t;
  const h = +m[1];
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "am" : "pm"}`;
};
/** Digits to dial with the country code; 10-digit numbers are Indian. Same rule as the planner app. */
export function dialDigits(p: string) {
  const s = p.trim();
  let d = s.replace(/\D/g, "");
  if (!d) return "";
  let plus = s.startsWith("+");
  if (!plus && d.startsWith("00") && d.length > 11) { d = d.slice(2); plus = true; }
  if (!plus) {
    if (d.length === 11 && d[0] === "0") d = d.slice(1);
    if (d.length === 10) d = "91" + d;
  }
  return d.length >= 8 && d.length <= 15 ? d : "";
}

const CSS = `:root{--plum:#3B1F4A;--marigold:#F2A93B;--cream:#FBF5EA;--teal:#1F7A74;--line:#EADFC9;--muted:#7A6F80}
*{box-sizing:border-box}body{margin:0;background:var(--cream);color:#2A2A2A;font:15px/1.5 Poppins,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header{background:var(--plum);color:var(--cream);padding:22px 18px 20px}header small{letter-spacing:.18em;text-transform:uppercase;font-size:11px;opacity:.75}
h1,h2{font-family:"DM Serif Display",Georgia,serif;font-weight:400;margin:0}h1{font-size:30px;line-height:1.15}h2{color:var(--plum);font-size:22px}
main{max-width:760px;margin:0 auto;padding:16px}
.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px 16px;margin-bottom:14px}
.meta{color:var(--muted);font-size:13px;margin:2px 0 8px}
ul{list-style:none;margin:0;padding:0}li{display:flex;gap:12px;padding:9px 0;border-top:1px dashed var(--line)}
li .t{width:74px;flex:none;font-weight:600;color:var(--plum)}li b{font-weight:600}li small{display:block;color:var(--muted);font-size:12.5px}
li.done b{text-decoration:line-through;color:var(--muted);font-weight:500}.ok{color:var(--teal);font-size:12px;font-weight:600}
.c{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px dashed var(--line)}.c div{flex:1;min-width:0}.c small{display:block;color:var(--muted);font-size:12.5px}
.ib{display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:50%;border:1px solid var(--line);background:#fff;text-decoration:none;font-size:18px}
footer{text-align:center;color:var(--muted);font-size:12px;padding:10px 16px 30px}footer a{color:var(--teal)}
.empty{text-align:center;color:var(--muted);padding:30px 10px}`;

const shell = (title: string, body: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
  `<meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#3B1F4A"><meta http-equiv="refresh" content="120"><title>${esc(title)}</title>` +
  `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Poppins:wght@400;600&display=swap" rel="stylesheet">` +
  `<style>${CSS}</style></head><body>${body}<footer>View only · updates as the family edits · made with <a href="/planner">Pandora Wedding Planner</a></footer></body></html>`;

export function runSheetPage(v: SharedRunSheet | null): { status: number; html: string } {
  if (!v) {
    return { status: 404, html: shell("Link not available", `<main><div class="card empty"><h2>This link isn’t available</h2><p>The family may have turned it off or made a new one. Ask them for the latest link.</p></div></main>`) };
  }
  const fns = v.functions.length
    ? v.functions.map((f) =>
        `<section class="card"><h2>${esc(f.name)}</h2><div class="meta">${[showDate(f.date), f.time ? showTime(f.time) : "", f.venue, f.dress ? `Dress: ${f.dress}` : ""].filter(Boolean).map(esc).join(" · ")}</div><ul>` +
        f.items.map((i) => `<li class="${i.done ? "done" : ""}"><span class="t">${esc(i.time ? showTime(i.time) : "–")}</span><div><b>${esc(i.activity || "")}</b>${i.done ? ' <span class="ok">✓ done</span>' : ""}<small>${[i.loc, i.who, i.vendor].filter(Boolean).map(esc).join(" · ")}</small></div></li>`).join("") +
        `</ul></section>`).join("")
    : `<div class="card empty">Nothing on the run sheet yet.</div>`;
  const contacts = v.contacts.length
    ? `<section class="card"><h2>Key contacts</h2>` + v.contacts.map((c) => {
        const d = dialDigits(c.phone);
        return `<div class="c"><div><b>${esc(c.name)}</b><small>${esc([c.role, c.phone].filter(Boolean).join(" · "))}</small></div>` +
          (d ? `<a class="ib" href="tel:+${d}" aria-label="Call ${esc(c.name)}">📞</a><a class="ib" href="https://wa.me/${d}" target="_blank" rel="noopener" aria-label="WhatsApp ${esc(c.name)}">💬</a>` : "") + `</div>`;
      }).join("") + `</section>`
    : "";
  const sub = [showDate(v.date), v.city].filter(Boolean).map(esc).join(" · ");
  return { status: 200, html: shell(`Run sheet · ${v.names}`, `<header><small>Run sheet</small><h1>${esc(v.names)}</h1>${sub ? `<div>${sub}</div>` : ""}</header><main>${contacts}${fns}</main>`) };
}
