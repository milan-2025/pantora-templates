/* ---------- UI toolkit ---------- */
const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
let toastT = null, lastDel = null;
function toast(msg, actionLabel, fn) {
  $$('.toast').forEach(x => x.remove());
  const t = el('<div class="toast">' + esc(msg) + (actionLabel ? ' &nbsp;<a href="#" style="color:#F2A93B;font-weight:600">' + esc(actionLabel) + '</a>' : '') + '</div>');
  if (actionLabel) t.querySelector('a').onclick = e => { e.preventDefault(); fn(); t.remove(); };
  document.body.appendChild(t); clearTimeout(toastT); toastT = setTimeout(() => t.remove(), actionLabel ? 6000 : 2600);
}
function modal(html) {
  const m = el('<div class="mask"><div class="modal">' + html + '</div></div>');
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  document.body.appendChild(m); return m;
}
function ask(title, msg, ok) {
  return new Promise(res => {
    const m = modal('<h2>' + esc(title) + '</h2><p>' + esc(msg) + '</p><div class="bar" style="justify-content:flex-end;margin-top:14px"><button class="btn" data-n>Cancel</button><button class="btn pri" data-y>' + esc(ok || 'Yes, continue') + '</button></div>');
    m.querySelector('[data-n]').onclick = () => { m.remove(); res(false); };
    m.querySelector('[data-y]').onclick = () => { m.remove(); res(true); };
  });
}

/* ---------- column shortcuts ---------- */
const T = (k, label, o) => Object.assign({ k, label, t: 'text' }, o);
const SEL = (k, label, opts, o) => Object.assign({ k, label, t: 'sel', opts }, o);
const NUM = (k, label, o) => Object.assign({ k, label, t: 'num', w: 90 }, o);
const DT = (k, label, o) => Object.assign({ k, label, t: 'date', w: 130 }, o);
const TM = (k, label, o) => Object.assign({ k, label, t: 'time', w: 100 }, o);
const CALC = (id, label, calc, o) => Object.assign({ k: id, label, t: 'calc', calc, th: 'a' }, o);
const YN = ['Yes', 'No'];
const statusPill = s => { const k = { OK: 'ok', Done: 'ok', Paid: 'ok', 'On track': 'ok', Available: 'ok', 'Fully paid': 'ok', Overdue: 'bad', 'Over budget': 'bad', Full: 'bad', 'Over-booked': 'bad', 'Needs more beds': 'bad', 'Needs more seats': 'bad', 'Due soon': 'warn', 'Due this week': 'warn', 'Near limit': 'warn', 'Few left': 'warn', 'Part-paid': 'warn', 'Add dates': 'warn', 'Pick a group': 'warn', 'Pick a room type': 'warn', 'Pick a vehicle': 'warn', 'Unpaid': 'info', 'Upcoming': 'info', 'Not started': '', 'Due this month': 'info' }[s]; return s ? pill(s, k) : ''; };
const moneyCell = v => v == null || v === '' ? '' : inr(v);
const pctCell = v => v == null ? '' : (v > 0 ? '+' : '') + Math.round(v * 100) + '%';

/* ---------- charts ---------- */
function donut(segs, size, center, sub) {
  const R = 52, C = 2 * Math.PI * R, tot = segs.reduce((s, x) => s + x.v, 0) || 1;
  let off = 0;
  const arcs = segs.map(s => { const len = s.v / tot * C, a = '<circle cx="70" cy="70" r="' + R + '" fill="none" stroke="' + s.c + '" stroke-width="18" stroke-dasharray="' + len + ' ' + (C - len) + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 70 70)"/>'; off += len; return a; }).join('');
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 140 140" role="img"><circle cx="70" cy="70" r="' + R + '" fill="none" stroke="#F4EFE6" stroke-width="18"/>' + arcs + '<text x="70" y="70" text-anchor="middle" font-family="DM Serif Display,Georgia,serif" font-size="26" fill="#3B1F4A">' + esc(center) + '</text><text x="70" y="88" text-anchor="middle" font-size="9.5" fill="#7A6F80" font-family="Poppins,system-ui,sans-serif">' + esc(sub || '') + '</text></svg>';
}
const legend = segs => '<div class="legend">' + segs.map(s => '<span><i style="background:' + s.c + '"></i>' + esc(s.l) + ' <b>' + s.v + '</b></span>').join('') + '</div>';
const hbar = (name, parts, max, right) => '<div class="hb"><div class="n" title="' + esc(name) + '">' + esc(name) + '</div><div class="tr">' + parts.map(p => '<i style="width:' + Math.min(100, max ? p.v / max * 100 : 0) + '%;background:' + p.c + (p.top ? ';height:55%;top:22%' : '') + '"></i>').join('') + '</div><div class="v">' + right + '</div></div>';

/* ---------- static tables: stacked cards on phones ---------- */
function stackify(root) {
  $$('table', root).forEach(t => {
    const hs = $$('thead th', t).map(th => th.textContent);
    t.classList.add('st'); const w = t.closest('.tw'); if (w) w.classList.add('stw');
    $$('tbody tr', t).forEach(tr => Array.from(tr.children).forEach((td, i) => td.setAttribute('data-l', hs[i] || '')));
  });
  return root;
}

/* ---------- page chrome ---------- */
const ph = (title, sub, actions) => '<div class="page-h"><div><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div><div class="sp"></div>' + (actions || '') + '</div>';
const kpi = (l, v, s, c) => '<div class="kpi ' + (c || '') + '"><div class="l">' + esc(l) + '</div><div class="v">' + v + '</div><div class="s">' + (s || '&nbsp;') + '</div></div>';
const names = () => (S.settings.bride || S.settings.groom) ? (S.settings.bride || 'Bride') + ' & ' + (S.settings.groom || 'Groom') : 'Your Wedding';
function tabs(list, cur, on) {
  const t = el('<div class="tabs">' + list.map(x => '<button data-t="' + x[0] + '" class="' + (x[0] === cur ? 'on' : '') + '">' + esc(x[1]) + '</button>').join('') + '</div>');
  t.onclick = e => { const b = e.target.closest('button'); if (b) on(b.dataset.t); };
  return t;
}
function filterBar(items) { // items: [{type:'search'|'sel'|'chips', ...}]
  const bar = el('<div class="bar"></div>');
  // On phones, dropdown filters fold away behind a "Filters" button so the list starts sooner.
  const sels = items.filter(it => it.type === 'sel');
  let fold = null;
  if (MOBILE() && sels.length > 1) {
    const active = () => sels.filter(it => it.get()).length;
    const tg = el('<button class="chip ftog" type="button">Filters' + (active() ? ' · ' + active() : '') + ' ▾</button>');
    fold = el('<div class="fold" style="display:none"></div>');
    tg.onclick = () => { fold.style.display = fold.style.display === 'none' ? 'flex' : 'none'; };
    fold._tg = tg; fold._n = active;
  }
  items.forEach(it => {
    if (it.type === 'search') { const i = el('<input class="inp" type="search" data-free placeholder="' + esc(it.ph || 'Search…') + '" style="min-width:200px">'); i.value = it.get(); i.oninput = () => it.set(i.value); bar.appendChild(i); }
    else if (it.type === 'sel') { const s = el('<select class="sel" data-free><option value="">' + esc(it.label) + '</option>' + it.opts.map(o => '<option' + (o === it.get() ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>'); s.onchange = () => { it.set(s.value); if (fold) fold._tg.textContent = 'Filters' + (fold._n() ? ' · ' + fold._n() : '') + ' ▾'; }; (fold || bar).appendChild(s); }
    else if (it.type === 'chips') { it.opts.forEach(o => { const c = el('<button class="chip ' + (it.get() === o ? 'on' : '') + '">' + esc(o) + '</button>'); c.onclick = () => { it.set(o); $$('.chip', bar).forEach(x => { if (it.opts.indexOf(x.textContent) >= 0) x.classList.toggle('on', x.textContent === o); }); }; bar.appendChild(c); }); }
  });
  if (fold) { bar.appendChild(fold._tg); bar.appendChild(fold); }
  return bar;
}
const matchQ = (r, keys, q) => !q || keys.some(k => String(r[k] == null ? '' : r[k]).toLowerCase().indexOf(q.toLowerCase()) >= 0);
const UI = { q: {}, f: {}, tab: {} };

/* ---------- router ---------- */
const NAV = [
  ['Home', [['dash', '🏠', 'Dashboard']]],
  ['Plan', [['tasks', '✅', 'Tasks & Timeline'], ['functions', '🎊', 'Functions'], ['runsheet', '⏰', 'Run Sheet'], ['rituals', '🪔', 'Rituals & Puja']]],
  ['Guests', [['guests', '👥', 'Guest List & RSVP'], ['catering', '🍽️', 'Catering & Plates']]],
  ['Stay & Travel', [['stay', '🏨', 'Hotels & Rooms'], ['transport', '🚐', 'Transport']]],
  ['Money', [['budget', '💰', 'Budget'], ['vendors', '🧾', 'Vendors'], ['payments', '💳', 'Payments']]],
  ['Customs', [['shagun', '🎁', 'Shagun Register'], ['milni', '🤝', 'Milni List'], ['shopping', '🛍️', 'Shopping & Outfits']]],
  ['Share', [['print', '🖨️', 'Family Handout'], ['sharing', '👪', 'Sharing'], ['activity', '🕘', 'Activity & Restore']]],
  ['Account', [['plan', '⭐', 'Plan & Billing'], ['setup', '⚙️', 'Setup & Data'], ['account', '👤', 'Account']]]
];
const VIEWS = {};
let route = 'dash';
function go(r) { route = VIEWS[r] ? r : 'dash'; try { history.replaceState(null, '', '#' + route); } catch (e) { /* ignore */ } renderAll(); window.scrollTo(0, 0); $('.side').classList.remove('open'); }
function badges() {
  const o = d(); const bd = { tasks: o.tOver, payments: o.payOver.length };
  $$('.nav a').forEach(a => { const n = bd[a.dataset.r]; let b = a.querySelector('.bd'); if (n) { if (!b) { b = el('<span class="bd"></span>'); a.appendChild(b); } b.textContent = n; } else if (b) b.remove(); });
}
function renderNav() {
  $('#nav').innerHTML = NAV.map(g => '<div class="nav-h">' + g[0] + '</div>' + g[1].map(i => '<a data-r="' + i[0] + '" class="' + (i[0] === route ? 'on' : '') + '"><span class="ic">' + i[1] + '</span>' + i[2] + '</a>').join('')).join('');
  badges();
}
function renderAll() {
  renderNav(); planChip();
  const m = $('#main'); m.innerHTML = '';
  const dl = $('#dl-groups'); if (dl) dl.innerHTML = GROUPS().map(g => '<option value="' + esc(g) + '">').join('');
  const dv = $('#dl-vendors'); if (dv) dv.innerHTML = Array.from(new Set(S.vendors.map(v => v.vendor).concat(S.hotels.map(h => h.hotel)).concat(S.vehicles.map(v => v.operator)))).filter(Boolean).map(g => '<option value="' + esc(g) + '">').join('');
  const cm = CLOUD.on && CLOUD.meta;
  if (!CLOUD.on && S.demo && route !== 'setup') {
    m.appendChild(el('<div class="banner noprint"><span>🎁 <b>You are looking at sample data</b> (Ananya &amp; Arjun, Jaipur). It stays on this device.</span><span class="sp"></span><button class="btn pri sm keep" data-signin>Start my free trial</button></div>'));
  } else if (cm && cm.status === 'expired') {
    m.appendChild(el('<div class="banner bad noprint"><span>⏳ <b>Your ' + esc(cm.plan.name) + ' plan has ended.</b> Everything is safe and you can still view and export it. ' + (cm.role === 'owner' ? 'Upgrade to keep editing.' : 'Ask ' + esc(cm.owner) + ' to renew.') + '</span><span class="sp"></span>' + (cm.role === 'owner' ? '<button class="btn pri sm keep" data-upgrade>See plans</button>' : '') + '</div>'));
  } else if (cm && cm.status === 'suspended') {
    m.appendChild(el('<div class="banner bad noprint"><span>This planner is paused, so it is view-only. Please contact Pandora Templates.</span></div>'));
  } else if (cm && cm.role === 'viewer') {
    m.appendChild(el('<div class="banner noprint"><span>👁 You have <b>view-only</b> access to this planner, shared by ' + esc(cm.owner) + '.</span></div>'));
  } else if (cm && cm.role === 'support') {
    m.appendChild(el('<div class="banner noprint"><span>🛟 <b>Support view</b> of ' + esc(cm.owner) + '’s planner (read-only).</span></div>'));
  } else if (cm && cm.plan.isTrial && cm.daysLeft != null && cm.daysLeft <= 5 && cm.role === 'owner') {
    m.appendChild(el('<div class="banner noprint"><span>⏳ Your free trial ends in <b>' + cm.daysLeft + ' day' + (cm.daysLeft === 1 ? '' : 's') + '</b>. Upgrade to keep planning without limits.</span><span class="sp"></span><button class="btn pri sm keep" data-upgrade>See plans</button></div>'));
  }
  const v = VIEWS[route](); (Array.isArray(v) ? v : [v]).forEach(x => m.appendChild(typeof x === 'string' ? el('<div>' + x + '</div>') : x));
  if (RO()) $$('input:not([data-free]),select:not([data-free]),textarea:not([data-free])', m).forEach(e => { if (!e.closest('.bar') && e.type !== 'search') e.disabled = true; });
}
let LAST_MOBILE = MOBILE();
window.addEventListener('resize', () => { const mb = MOBILE(); if (mb !== LAST_MOBILE) { LAST_MOBILE = mb; requestRender(); } });
