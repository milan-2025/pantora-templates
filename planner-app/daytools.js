/* ---------- Features: switch pages and tools on or off for this planner ---------- */
function setFeature(k, v) {
  if (RO()) return;
  S.features = Object.assign({}, S.features || {}, { [k]: !!v });
  if (k === 'sharelink' && !v && CLOUD.on && CLOUD.meta && CLOUD.meta.shareToken) shareLink(false).catch(() => null);
  dirty();
}
VIEWS.features = function () {
  const wrap = el('<div></div>');
  const groups = Array.from(new Set(FEATURES.map(f => f.g)));
  const draw = () => {
    const n = FEATURES.filter(f => on(f.k)).length;
    wrap.innerHTML = '<div class="card" style="margin-bottom:14px"><h3>Keep it simple</h3><p style="margin-top:0">Switch off what your wedding doesn’t need and the menu gets shorter. Switching a page off only hides it: nothing is deleted, and switching it back on brings everything back. ' + (CLOUD.on ? 'Changes apply for everyone on this planner.' : '') + '</p><div class="bar"><button class="btn" data-pre="simple">✨ Just the essentials</button><button class="btn" data-pre="std">↺ Standard</button><button class="btn" data-pre="all">Everything</button><span class="note">' + n + ' of ' + FEATURES.length + ' on</span></div></div>' +
      '<div class="grid g2 feats">' + groups.map(g => '<div class="card"><h3>' + esc(g) + '</h3>' + FEATURES.filter(f => f.g === g).map(f =>
        '<label class="feat"><span class="ic">' + f.icon + '</span><span class="ft"><b>' + esc(f.label) + (f.def ? '' : ' <span class="pill info">Off by default</span>') + '</b><small>' + esc(f.desc) + '</small></span><span class="sw"><input type="checkbox" data-f="' + f.k + '"' + (on(f.k) ? ' checked' : '') + dis() + '><i></i></span></label>').join('') + '</div>').join('') + '</div>';
    wrap.appendChild(installCard());
    const sl = shareCard(); if (sl) wrap.insertBefore(sl, $('.feats', wrap).nextSibling);
  };
  wrap.addEventListener('change', e => { const k = e.target.dataset.f; if (!k) return; setFeature(k, e.target.checked); renderNav(); draw(); toast(FEAT[k].label + (e.target.checked ? ' switched on' : ' switched off')); });
  wrap.addEventListener('click', async e => {
    const p = e.target.closest('[data-pre]'); if (!p || RO()) return;
    const pre = p.dataset.pre, msg = { simple: 'Keep the essentials (guests, tasks, functions, budget, vendors, payments, contacts, handout) and hide the rest?', std: 'Go back to the standard set: every page on, wedding-day tools off?', all: 'Switch everything on, including the wedding-day tools?' }[pre];
    if (!(await ask('Change features?', msg + ' Nothing is deleted.', 'Yes, change'))) return;
    const f = {}; FEATURES.forEach(x => { f[x.k] = pre === 'all' ? true : pre === 'simple' ? !!x.simple : !!x.def; });
    if (!f.sharelink && CLOUD.on && CLOUD.meta && CLOUD.meta.shareToken) shareLink(false).catch(() => null);
    S.features = f; dirty(); renderNav(); draw(); toast('Features updated');
  });
  draw();
  return [el('<div>' + ph('Features', 'Choose which pages and tools this planner uses. Fewer switched on means less to think about.') + '</div>').firstChild, wrap];
};

/* ---------- install as an app, and work offline ---------- */
let INSTALL = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); INSTALL = e; const b = $('#install'); if (b) b.hidden = false; });
window.addEventListener('appinstalled', () => { INSTALL = null; const b = $('#install'); if (b) b.hidden = true; toast('Installed. Open it from your home screen.'); });
const standalone = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } };
const iOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
async function installApp() {
  if (INSTALL) { INSTALL.prompt(); const r = await INSTALL.userChoice.catch(() => null); if (r && r.outcome === 'accepted') INSTALL = null; const b = $('#install'); if (b) b.hidden = !INSTALL; return; }
  const m = modal('<h2>Add the planner to your home screen</h2>' + (iOS() ? '<ol style="line-height:1.9;padding-left:20px"><li>Open this page in <b>Safari</b>.</li><li>Tap the <b>Share</b> button (square with an arrow).</li><li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li></ol>' : '<ol style="line-height:1.9;padding-left:20px"><li>Open this page in <b>Chrome</b>.</li><li>Tap the <b>⋮</b> menu.</li><li>Choose <b>Install app</b> or <b>Add to Home screen</b>.</li></ol>') + '<p class="note">It opens like an app, and what you’ve already opened works without internet.</p><div class="bar" style="justify-content:flex-end"><button class="btn pri" data-ok>Got it</button></div>');
  $('[data-ok]', m).onclick = () => m.remove();
}
function installCard() {
  const c = el('<div class="card" style="margin-top:14px"><h3>📲 On your phone, even offline</h3><p style="margin-top:0">' + (standalone() ? 'You’re using the installed app. ' : 'Add the planner to your home screen and it opens like an app. ') +
    'Once your planner has opened on a phone, it opens there without internet too: you can look things up and make changes, and they sync by themselves when the connection is back.</p>' + (standalone() ? '' : '<button class="btn pri" data-inst>📲 Install the app</button>') + '</div>');
  const b = $('[data-inst]', c); if (b) b.onclick = installApp;
  return c;
}
function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  navigator.serviceWorker.register('/planner/sw.js', { scope: '/planner' }).catch(() => null);
}
document.addEventListener('click', e => {
  if (e.target.closest('#install')) installApp();
  if (e.target.closest('#srch,#srch-m')) searchModal();
  if (e.target.closest('#undo,#undo-m')) undo();
});

/* ---------- share the run sheet by link ---------- */
const shareUrl = t => location.origin + '/planner/share/' + t;
async function shareLink(onOff) {
  const r = await api('/planners/' + CLOUD.id + '/share', { method: 'POST', body: { on: onOff } });
  CLOUD.meta.shareToken = r.shareToken || null; saveCache(); return r.shareToken;
}
function shareCard() {
  if (!on('sharelink') || !on('runsheet')) return null;
  const c = el('<div class="card" style="margin-top:14px"></div>');
  const draw = () => {
    if (!CLOUD.on) { c.innerHTML = '<h3>🔗 Run sheet link</h3><p>Sign in to make a link: the planner has to be saved to the cloud first.</p><button class="btn pri" data-signin>Sign in or start free trial</button>'; return; }
    const t = CLOUD.meta && CLOUD.meta.shareToken, canEdit = !RO();
    c.innerHTML = '<h3>🔗 Run sheet link</h3>' + (t ? '<p style="margin-top:0">Anyone with this link sees the run sheet and your ⭐ starred contacts (view only, no sign-in). It updates as you edit.</p><div class="row2" style="align-items:center"><input class="inp" readonly value="' + esc(shareUrl(t)) + '" style="flex:1;min-width:220px" data-free><button class="btn" data-copy>Copy</button><a class="btn" target="_blank" rel="noopener" href="' + esc(waHref('', 'Run sheet for ' + names() + ': ' + shareUrl(t))) + '">💬 Send on WhatsApp</a><a class="btn ghost" target="_blank" rel="noopener" href="' + esc(shareUrl(t)) + '">Open</a></div>' + (canEdit ? '<div class="bar" style="margin-top:10px"><button class="btn sm danger" data-off>Turn the link off</button><button class="btn sm ghost" data-new>Make a new link</button><span class="note">A new link stops the old one working.</span></div>' : '')
      : '<p style="margin-top:0">Make a view-only link for your event coordinator, caterer or decorator. They see the run sheet and your ⭐ starred contacts, nothing else: no guest list, no money.</p>' + (canEdit ? '<button class="btn pri" data-mk>Make the link</button>' : '<p class="note">Ask the owner or an editor to make the link.</p>'));
  };
  c.addEventListener('click', async e => {
    try {
      if (e.target.closest('[data-mk]')) { await shareLink(true); draw(); }
      else if (e.target.closest('[data-off]')) { if (await ask('Turn the link off?', 'Anyone who has it will no longer be able to open the run sheet.', 'Turn off')) { await shareLink(false); draw(); } }
      else if (e.target.closest('[data-new]')) { if (await ask('Make a new link?', 'The old link stops working. Send the new one to the people who need it.', 'Make new link')) { await shareLink(false); await shareLink(true); draw(); } }
      else if (e.target.closest('[data-copy]')) { const i = $('input', c); try { await navigator.clipboard.writeText(i.value); } catch (err) { i.select(); document.execCommand('copy'); } toast('Link copied'); }
    } catch (err) { toast(err.message); }
  });
  draw();
  return c;
}

/* ---------- Wedding-day mode ---------- */
const nowHM = () => { const t = new Date(); return String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0'); };
const hm12 = t => { const m = /^(\d\d?):(\d\d)/.exec(t || ''); if (!m) return t || ''; const h = +m[1]; return (h % 12 || 12) + ':' + m[2] + (h < 12 ? ' am' : ' pm'); };
/** The function to show: today's (the one that has started most recently), else the next one, else the last one. */
function dayFn() {
  const fns = S.functions.filter(f => f.name && f.active !== 'No').slice().sort((a, b) => ((a.date || '9') + (a.time || '')) < ((b.date || '9') + (b.time || '')) ? -1 : 1);
  if (UI.dayFn && fns.some(f => f.name === UI.dayFn)) return { fns, cur: fns.find(f => f.name === UI.dayFn) };
  const t = fd(today()), now = nowHM(), todays = fns.filter(f => f.date === t);
  const cur = todays.filter(f => !f.time || f.time <= now).pop() || todays[0] || fns.find(f => f.date && f.date > t) || fns.filter(f => f.date).pop() || fns[0];
  return { fns, cur };
}
VIEWS.today = function () {
  const wrap = el('<div class="day"></div>');
  const draw = () => {
    const o = d(), x = dayFn(), f = x.cur, t = fd(today());
    if (!f) { wrap.innerHTML = '<div class="empty">Add your functions with dates first (Functions page).</div>'; return; }
    const when = f.date === t ? 'Today' : f.date ? dlong(f.date) : 'Date not set';
    const items = on('runsheet') ? S.runsheet.filter(r => r.fn === f.name).sort((a, b) => (a.time || '99') < (b.time || '99') ? -1 : 1) : [];
    const next = items.find(r => r.status !== 'Done');
    const done = items.filter(r => r.status === 'Done').length;
    const people = new Set(items.map(r => r.who).concat(items.map(r => r.vendor)).filter(Boolean));
    const star = directory(false).filter(c => c.row.star === 'Yes');
    const involved = Array.from(people).map(n => { const h = phoneOf(n); return h && !star.some(c => c.row === h.row) ? { kind: h.kind, coll: { person: 'people', vendor: 'vendors', hotel: 'hotels', vehicle: 'vehicles', guest: 'guests' }[h.kind], row: h.row, name: h.name, sub: 'In today’s run sheet as ' + n, phone: h.phone } : null; }).filter(Boolean)
      .filter((c, i, a) => a.findIndex(y => y.row === c.row) === i);
    const venue = f.venue ? '<a class="btn sm" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(f.venue + (S.settings.city ? ', ' + S.settings.city : '')) + '">📍 Directions</a>' : '';
    const arr = on('checkin') ? (() => { const exp = o.G.filter(g => g.rsvp !== 'Declined'), a = exp.filter(g => g.arr).length; return '<div class="card"><h3>🛬 Arrivals</h3><div class="big">' + a + ' <small>of ' + exp.length + ' arrived</small></div><button class="btn pri" data-go="checkin">Open check-in</button></div>'; })() : '';
    wrap.innerHTML = '<div class="bar fnchips">' + x.fns.map(z => '<button class="chip' + (z === f ? ' on' : '') + '" data-fn="' + esc(z.name) + '">' + esc(z.name) + (z.date ? ' · ' + esc(dshow(z.date).replace(/ \d{4}$/, '')) : '') + '</button>').join('') + '</div>' +
      '<div class="hero dayh"><div style="z-index:1"><div class="sub" style="opacity:.75;text-transform:uppercase;letter-spacing:.16em;font-size:11px">' + esc(when) + (f.time ? ' · ' + esc(hm12(f.time)) : '') + '</div><h1>' + esc(f.name) + '</h1><div class="sub">' + esc(f.venue || 'Add the venue in Functions') + (f.dress ? ' · ' + esc(f.dress) : '') + '</div><div class="bar" style="margin-top:10px">' + venue + '</div></div>' +
      (items.length ? '<div class="cd"><b>' + done + '/' + items.length + '</b><span>done</span></div>' : '') + '</div>' +
      (next ? '<div class="card nextup"><div class="note" style="text-transform:uppercase;letter-spacing:.12em;font-size:11px">Next up' + (next.time ? ' · ' + esc(hm12(next.time)) : '') + '</div><h2>' + esc(next.activity || '(no activity)') + '</h2><div class="note">' + [next.loc, next.who ? 'Responsible: ' + next.who : '', next.vendor ? 'With: ' + next.vendor : ''].filter(Boolean).map(esc).join(' · ') + '</div><div class="bar" style="margin-top:8px">' + (next.who ? '<span class="whob">' + esc(next.who) + ' ' + whoBtns(next.who) + '</span>' : '') + (next.vendor ? '<span class="whob">' + esc(next.vendor) + ' ' + whoBtns(next.vendor) + '</span>' : '') + '<button class="btn pri" data-done="' + next.id + '"' + dis() + '>✓ Mark done</button></div></div>' : items.length ? '<div class="ok-note card">Everything on the run sheet for ' + esc(f.name) + ' is done. 🎉</div>' : '') +
      '<div class="grid g32" style="margin-top:14px"><div class="card"><h3>Run sheet <small>' + esc(f.name) + '</small></h3>' + (!on('runsheet') ? '<p class="note">The Run Sheet is switched off in Features.</p>' : items.length ? '<ul class="tl">' + items.map(r => '<li class="' + (r.status === 'Done' ? 'dn' : r === next ? 'nx' : '') + '" data-id="' + r.id + '"><button class="tick" data-tick="' + r.id + '" title="Done / not done"' + dis() + '>' + (r.status === 'Done' ? '✓' : '') + '</button><div><b>' + (r.time ? esc(hm12(r.time)) + ' · ' : '') + esc(r.activity || '') + '</b><small>' + [r.loc, r.who, r.vendor].filter(Boolean).map(esc).join(' · ') + '</small></div><span>' + (r.who ? whoBtns(r.who) : '') + (r.vendor ? whoBtns(r.vendor) : '') + '</span></li>').join('') + '</ul>' : '<p class="note">Nothing planned for this function yet.</p><button class="btn" data-go="runsheet">Add to the run sheet</button>') + '</div>' +
      '<div><div class="card"><h3>Key contacts</h3>' + (star.length || involved.length ? star.map(c => contactRow(c)).join('') + involved.map(c => contactRow(c)).join('') : '<p class="note">Star the people and vendors you’ll need today in <a data-go="contacts">Contacts</a>, and they show up here.</p>') + '</div>' + arr + '</div></div>';
    contactsBindOnce();
  };
  let bound = false;
  const contactsBindOnce = () => { if (bound) return; bound = true; contactsBind(wrap, draw); };
  wrap.addEventListener('click', e => {
    const c = e.target.closest('[data-fn]'); if (c) { UI.dayFn = c.dataset.fn; draw(); return; }
    const t = e.target.closest('[data-tick],[data-done]'); if (!t || RO()) return;
    const r = S.runsheet.find(x => x.id === (t.dataset.tick || t.dataset.done)); if (!r) return;
    undoRow('runsheet', r, (r.status === 'Done' ? 'Un-ticked ' : 'Ticked ') + '“' + String(r.activity || '').slice(0, 30) + '”');
    r.status = r.status === 'Done' ? 'Pending' : 'Done'; dirty(); draw();
  });
  draw();
  return [el('<div>' + ph('Wedding Day', 'What’s happening now and next, and one tap to call anyone involved. Works without internet too.') + '</div>').firstChild, wrap];
};

/* ---------- Guest arrival check-in ---------- */
VIEWS.checkin = function () {
  UI.f.ci = UI.f.ci || { q: '', st: 'To arrive', side: '' };
  const f = UI.f.ci, wrap = el('<div></div>'), list = el('<div class="cil"></div>'), kp = el('<div class="grid g3" style="margin-bottom:12px"></div>');
  const bar = filterBar([
    { type: 'search', ph: 'Search name, family, city…', get: () => f.q, set: v => { f.q = v; draw(); } },
    { type: 'chips', opts: ['To arrive', 'Arrived', 'All'], get: () => f.st, set: v => { f.st = v; draw(); } },
    { type: 'sel', label: 'Both sides', opts: L('Side'), get: () => f.side, set: v => { f.side = v; draw(); } }
  ]);
  const stayOf = grp => { const a = S.roomAlloc.find(x => x.group === grp); if (!a) return ''; const h = S.hotels.find(x => d().hotelKey(x) === a.hotelType); return h ? '🏨 ' + h.hotel : ''; };
  function draw() {
    const o = d(), exp = o.G.filter(g => g.rsvp !== 'Declined'), arrived = exp.filter(g => g.arr).length;
    kp.innerHTML = kpi('Arrived', arrived, 'of ' + exp.length + ' expected', 't') + kpi('Still to come', exp.length - arrived, pct(arrived, exp.length) + '% here', 'm') + kpi('Families here', Array.from(o.groups.values()).filter(gs => gs.some(g => g.arr)).length, 'of ' + o.groups.size, 'c');
    const q = f.q.trim().toLowerCase();
    const fams = Array.from(o.groups.entries()).map(e => [e[0], e[1].filter(g => g.rsvp !== 'Declined' && (!f.side || g.side === f.side))]).filter(e => e[1].length)
      .filter(e => !q || e[0].toLowerCase().indexOf(q) >= 0 || e[1].some(g => [g.name, g.city, g.phone].some(v => String(v || '').toLowerCase().indexOf(q) >= 0)))
      .filter(e => f.st === 'All' || (f.st === 'Arrived' ? e[1].some(g => g.arr) : e[1].some(g => !g.arr)));
    list.innerHTML = fams.length ? fams.slice(0, 250).map(e => {
      const gs = e[1], a = gs.filter(g => g.arr).length, ph = (gs.find(g => phoneDigits(g.phone)) || {}).phone;
      return '<div class="card cif' + (a === gs.length ? ' all' : '') + '"><div class="cih"><div><b>' + (gs.length === 1 ? profLink('guest', gs[0].id, e[0]) : esc(e[0])) + '</b><small>' + a + ' of ' + gs.length + ' here' + [gs[0].city, stayOf(e[0])].filter(Boolean).map(x => ' · ' + esc(x)).join('') + '</small></div><span>' + (ph ? telBtns(ph, { name: e[0] }) : '') + '</span>' + (a < gs.length ? '<button class="btn sm pri" data-all="' + esc(e[0]) + '"' + dis() + '>✓ All here</button>' : '') + '</div>' +
        gs.map(g => '<button class="cig' + (g.arr ? ' on' : '') + '" data-g="' + g.id + '"' + dis() + '><span class="tick">' + (g.arr ? '✓' : '') + '</span><span>' + esc(g.name || '(no name)') + (g.age && g.age !== 'Adult' ? ' <small>' + esc(g.age) + '</small>' : '') + '</span>' + (g.arr ? '<small>' + esc(String(g.arr).slice(11) || '') + '</small>' : '') + '</button>').join('') + '</div>';
    }).join('') + (fams.length > 250 ? '<div class="empty">Showing 250 families. Search to find others.</div>' : '') : '<div class="empty">' + (o.G.length ? 'No families match.' : 'Add guests to the Guest List first.') + '</div>';
  }
  const stamp = () => fd(today()) + ' ' + nowHM();
  list.addEventListener('click', e => {
    if (RO() || e.target.closest('a[href]')) return;
    const b = e.target.closest('[data-g]');
    if (b) { const g = S.guests.find(x => x.id === b.dataset.g); if (!g) return; undoRow('guests', g, (g.arr ? 'Un-checked ' : 'Checked in ') + (g.name || 'a guest')); g.arr = g.arr ? '' : stamp(); dirty(); draw(); return; }
    const all = e.target.closest('[data-all]');
    if (all) { const gs = d().groups.get(all.dataset.all) || [], s = stamp(); const row = gs.filter(g => !g.arr && g.rsvp !== 'Declined'), ids = row.map(g => g.id); undoFn('Checked in ' + all.dataset.all, () => S.guests.forEach(g => { if (ids.indexOf(g.id) >= 0) g.arr = ''; })); row.forEach(g => { g.arr = s; }); dirty(); draw(); toast(row.length + ' checked in'); }
  });
  draw();
  wrap.appendChild(kp); wrap.appendChild(bar); wrap.appendChild(list);
  return [el('<div>' + ph('Arrivals', 'Tap a name as each guest arrives. Families still on the way stay at the top, with their number to call.') + '</div>').firstChild, wrap];
};
