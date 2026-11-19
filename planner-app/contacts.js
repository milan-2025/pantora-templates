/* ---------- phones: tidy, check, call and WhatsApp ---------- */
/** Digits to dial, with country code (91 for Indian numbers typed without one). '' if there is no number. */
function phoneDigits(p) {
  const s = String(p == null ? '' : p).trim(); if (!s) return '';
  let plus = s[0] === '+', d = s.replace(/\D/g, '');
  if (!d) return '';
  if (!plus && d.indexOf('00') === 0 && d.length > 11) { d = d.slice(2); plus = true; }
  if (!plus) { if (d.length === 11 && d[0] === '0') d = d.slice(1); if (d.length === 10) d = '91' + d; }
  return d;
}
/** false when a number is typed but can't be right (too short, too long, or an Indian number that isn't 10 digits). */
function phoneOk(p) {
  const d = phoneDigits(p); if (!d) return true;
  if (d.indexOf('91') === 0 && d.length === 12) return true;
  if (d.indexOf('91') === 0 && !/^\s*\+/.test(String(p))) return false;
  return d.length >= 8 && d.length <= 15;
}
/** "98765 43210" for Indian numbers, "+44 7700900123" style for others; anything doubtful is left as typed. */
function phoneFmt(p) {
  const raw = String(p == null ? '' : p).trim(); if (!raw || !phoneOk(raw)) return raw;
  const d = phoneDigits(raw);
  if (d.indexOf('91') === 0 && d.length === 12) return d.slice(2, 7) + ' ' + d.slice(7);
  return '+' + d;
}
const telHref = p => { const d = phoneDigits(p); return d ? 'tel:+' + d : ''; };
/** WhatsApp link. Without a number, WhatsApp opens with the message and lets you pick the chat. */
const waHref = (p, text) => { const d = phoneDigits(p); return 'https://wa.me/' + (d && phoneOk(p) ? d : '') + (text ? '?text=' + encodeURIComponent(text) : ''); };
/** Small 📞 / 💬 buttons for a number. o.wa=false hides WhatsApp; o.text pre-fills the WhatsApp message. */
function telBtns(p, o) {
  o = o || {};
  if (!phoneDigits(p)) return o.empty || '';
  if (!phoneOk(p)) return '<span class="pwarn" title="This number looks incomplete or wrong. Check it.">⚠</span>';
  return '<span class="cbt">' + (o.call === false ? '' : '<a class="ib" href="' + telHref(p) + '" title="Call ' + esc(o.name || p) + '" aria-label="Call">📞</a>') +
    (o.wa === false ? '' : '<a class="ib wa" href="' + esc(waHref(p, o.text || '')) + '" target="_blank" rel="noopener" title="WhatsApp ' + esc(o.name || p) + '" aria-label="WhatsApp">💬</a>') + '</span>';
}
const TEL = (k, label, o) => Object.assign({ k, label, t: 'tel', w: 150 }, o);

/** The phone number behind a name used anywhere in the planner: family & team, vendors, hotels, transport, guests. */
function phoneOf(name) {
  const n = String(name || '').trim().toLowerCase(); if (!n) return null;
  const hit = (rows, keys, ph, kind) => { for (const r of rows || []) for (const k of keys) if (r[k] && String(r[k]).trim().toLowerCase() === n && phoneDigits(r[ph])) return { phone: r[ph], name: r[k], kind, row: r }; return null; };
  const sel = (S.vendors || []).filter(v => v.decision === 'Selected');
  return hit(S.people, ['name'], 'phone', 'person') || hit(sel, ['vendor', 'contact', 'line'], 'phone', 'vendor') || hit(S.vendors, ['vendor', 'contact'], 'phone', 'vendor') ||
    hit(S.hotels, ['hotel', 'contact'], 'phone', 'hotel') || hit(S.vehicles, ['operator', 'contact'], 'phone', 'vehicle') || hit(S.guests, ['name'], 'phone', 'guest') || roughVendor(n, sel);
}
// "Photographer" in the run sheet finds the booked "Photography" vendor: a shared word start of 5+ letters.
function roughVendor(n, sel) {
  const stems = s => String(s || '').toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 5).map(w => w.slice(0, 5));
  const want = stems(n); if (!want.length) return null;
  const v = sel.find(x => phoneDigits(x.phone) && stems(x.line + ' ' + x.vendor).some(w => want.indexOf(w) >= 0));
  return v ? { phone: v.phone, name: v.vendor, kind: 'vendor', row: v } : null;
}
const whoBtns = (name, o) => { const h = phoneOf(name); return h ? telBtns(h.phone, Object.assign({ name: h.name }, o || {})) : ''; };

/* ---------- WhatsApp messages ---------- */
function guestVals(g) {
  const o = d(), grp = gk(g);
  const ra = S.roomAlloc.find(a => a.group === grp), h = ra && S.hotels.find(x => o.hotelKey(x) === ra.hotelType);
  const ta = S.transAlloc.find(a => a.group === grp), v = ta && S.vehicles.find(x => o.vehKey(x) === ta.vehicle);
  const pick = ta ? ['Pickup' + (ta.arrDate ? ' on ' + dshow(ta.arrDate) : ''), ta.arrTime ? 'at ' + ta.arrTime : '', ta.arrFrom ? 'from ' + ta.arrFrom : '', v ? '(' + v.type + (v.operator ? ', ' + v.operator : '') + (v.phone ? ', ' + v.phone : '') + ')' : ''].filter(Boolean).join(' ') : '';
  return { name: g.name || '', hotel: h ? h.hotel : '', room: h ? (g.room ? ', room ' + g.room : ', ' + h.type) : '', checkin: ra && ra.in ? dshow(ra.in) : '', checkout: ra && ra.out ? dshow(ra.out) : '', pickup: pick };
}
function payVals(p) {
  const paid = p.status === 'Paid', what = (p.desc || 'payment').toLowerCase();
  const amt = p.amount ? inr(p.amount) : '';
  return { vendor: p.payee || '', amount: amt, due: p.due ? dshow(p.due) : '', item: what,
    payment: 'the ' + what + (amt ? ' of ' + amt : '') + (paid ? ' was paid' + (p.paid ? ' on ' + dshow(p.paid) : '') + (p.mode ? ' by ' + p.mode : '') : ' is due' + (p.due ? ' on ' + dshow(p.due) : '')) };
}
/**
 * Pick a message, check or edit it, then open WhatsApp. opts: { phone, title, choices: [[kind, label, vals, onSend]] }.
 * The text is editable here; the template itself is edited in Setup & Data.
 */
function msgPicker(opts) {
  const ch = opts.choices.filter(Boolean);
  const m = modal('<h2>' + esc(opts.title || 'Send on WhatsApp') + '</h2>' + (ch.length > 1 ? '<div class="tabs" data-k>' + ch.map((c, i) => '<button data-i="' + i + '" class="' + (i ? '' : 'on') + '">' + esc(c[1]) + '</button>').join('') + '</div>' : '') +
    '<textarea class="inp" data-t style="width:100%;min-height:190px"></textarea>' + (opts.phone && !phoneOk(opts.phone) ? '<p class="note">⚠ The number looks wrong, so WhatsApp will ask you to pick the chat.</p>' : !phoneDigits(opts.phone) ? '<p class="note">No number saved, so WhatsApp will ask you to pick the chat.</p>' : '') +
    '<div class="bar" style="justify-content:space-between;margin-top:12px"><a class="btn ghost" data-ed>✎ Edit templates</a><span><button class="btn" data-x>Cancel</button> <a class="btn pri" data-go-wa target="_blank" rel="noopener">💬 Open WhatsApp</a></span></div>');
  let cur = 0;
  const t = $('[data-t]', m), goBtn = $('[data-go-wa]', m);
  const upd = () => { goBtn.href = waHref(opts.phone, t.value); };
  const pick = i => { cur = i; const c = ch[i]; t.value = c[2] != null && typeof c[2] === 'string' ? c[2] : fillMsg(msgText(c[0]), c[2]); $$('[data-k] button', m).forEach(b => b.classList.toggle('on', +b.dataset.i === i)); upd(); };
  t.oninput = upd;
  const k = $('[data-k]', m); if (k) k.onclick = e => { const b = e.target.closest('button'); if (b) pick(+b.dataset.i); };
  $('[data-x]', m).onclick = () => m.remove();
  $('[data-ed]', m).onclick = () => { m.remove(); UI.tab.msg = ch[cur][0]; go('setup'); setTimeout(() => { const x = $('#msgbox'); if (x) x.scrollIntoView({ block: 'center' }); }, 60); };
  goBtn.onclick = () => { const c = ch[cur]; if (c[3]) c[3](); setTimeout(() => m.remove(), 50); };
  pick(0);
}

/* ---------- undo ---------- */
const UNDO = [];
/** Remember a row as it was before a change. */
function undoRow(coll, before, label) { if (RO() || !before) return; UNDO.push({ coll, id: before.id, row: copy(before), label: label || 'Edited ' + (rowName(before) || 'a row') }); if (UNDO.length > 40) UNDO.shift(); undoBtn(); }
function undoDel(coll, row, idx) { if (RO()) return null; const e = { coll, id: row.id, row: copy(row), idx, del: true, label: 'Deleted ' + (rowName(row) || 'a row') }; UNDO.push(e); if (UNDO.length > 40) UNDO.shift(); undoBtn(); return e; }
function undo(entry) {
  if (RO()) return;
  const i = entry ? UNDO.indexOf(entry) : UNDO.length - 1; if (i < 0) return;
  const e = UNDO.splice(i, 1)[0], rows = S[e.coll] || []; if (!e.fn && !S[e.coll]) return;
  const at = rows.findIndex(r => r.id === e.id);
  if (e.fn) e.fn();
  else if (e.add) { if (at >= 0) rows.splice(at, 1); }
  else if (e.del) { if (at < 0) rows.splice(Math.min(e.idx, rows.length), 0, copy(e.row)); }
  else if (at >= 0) rows[at] = copy(e.row); else rows.push(copy(e.row));
  dirty(); const y = window.scrollY; renderAll(); window.scrollTo(0, y); toast('Undone: ' + e.label.charAt(0).toLowerCase() + e.label.slice(1));
}
/** Undo for a change to several rows at once: fn puts them back. */
function undoFn(label, fn) { if (RO()) return; UNDO.push({ label, fn }); if (UNDO.length > 40) UNDO.shift(); undoBtn(); }
function undoClear() { UNDO.length = 0; undoBtn(); }
function undoBtn() {
  const last = UNDO[UNDO.length - 1];
  ['#undo', '#undo-m'].forEach(s => { const b = $(s); if (!b) return; b.hidden = !last || RO(); if (last) b.title = 'Undo: ' + last.label + ' (Ctrl+Z)'; });
}
document.addEventListener('keydown', e => {
  const typing = /INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '') || $('.mask');
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !typing && UNDO.length) { e.preventDefault(); undo(); }
  if (S && on('search') && !$('.mask') && (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing))) { e.preventDefault(); searchModal(); }
});

/* ---------- search everything ---------- */
const SEARCH_SRC = [
  ['guests', 'guests', '👥', r => r.name, r => [r.group, r.city, r.phone].filter(Boolean).join(' · '), ['name', 'group', 'city', 'phone', 'notes']],
  ['people', 'contacts', '📇', r => r.name, r => [r.role, r.phone].filter(Boolean).join(' · '), ['name', 'role', 'phone', 'notes'], 'team'],
  ['vendors', 'vendors', '🧾', r => r.vendor, r => [r.line, r.contact, r.phone, r.decision].filter(Boolean).join(' · '), ['vendor', 'contact', 'line', 'phone', 'notes']],
  ['payments', 'payments', '💳', r => (r.payee || r.line) + (r.amount ? ' · ' + inr(r.amount) : ''), r => [r.desc, r.due ? 'due ' + dshow(r.due) : '', r.status].filter(Boolean).join(' · '), ['payee', 'desc', 'line', 'notes']],
  ['tasks', 'tasks', '✅', r => r.task, r => [r.who, r.status].filter(Boolean).join(' · '), ['task', 'who', 'notes']],
  ['functions', 'functions', '🎊', r => r.name, r => [dshow(r.date), r.venue].filter(Boolean).join(' · '), ['name', 'venue', 'dress']],
  ['runsheet', 'runsheet', '⏰', r => r.activity, r => [r.fn, r.time, r.who].filter(Boolean).join(' · '), ['activity', 'who', 'vendor', 'loc', 'notes']],
  ['rituals', 'rituals', '🪔', r => r.item, r => [r.fn, r.who].filter(Boolean).join(' · '), ['item', 'who', 'source', 'remarks']],
  ['hotels', 'stay', '🏨', r => r.hotel + (r.type ? ' · ' + r.type : ''), r => [r.contact, r.phone].filter(Boolean).join(' · '), ['hotel', 'type', 'contact', 'phone'], 'hotels'],
  ['vehicles', 'transport', '🚐', r => r.operator + (r.type ? ' · ' + r.type : ''), r => [r.contact, r.phone].filter(Boolean).join(' · '), ['operator', 'type', 'contact', 'phone'], 'veh'],
  ['shagun', 'shagun', '🎁', r => r.name, r => [r.dir, r.amount ? inr(r.amount) : '', r.fn].filter(Boolean).join(' · '), ['name', 'group', 'relation', 'gift', 'notes']],
  ['shopping', 'shopping', '🛍️', r => r.item, r => [r.type, r.who, r.status].filter(Boolean).join(' · '), ['item', 'who', 'shop', 'notes']],
  ['milni', 'milni', '🤝', r => r.pair, r => [r.bride, r.groom].filter(Boolean).join(' · '), ['pair', 'bride', 'groom']]
];
function searchModal() {
  if (!on('search')) return;
  const m = modal('<input class="inp srch" type="search" data-free placeholder="Search guests, vendors, tasks, payments, contacts…" autocomplete="off"><div class="sres"></div><p class="note" style="margin:8px 0 0">Tip: Ctrl+K or / opens this from anywhere.</p>');
  m.querySelector('.modal').classList.add('wide-m');
  const i = $('input', m), box = $('.sres', m);
  let hits = [], sel = 0;
  const draw = () => {
    const q = i.value.trim().toLowerCase(); hits = [];
    if (q) {
      NAV.forEach(g => g[1].forEach(it => { if (routeOn(it[0]) && it[2].toLowerCase().indexOf(q) >= 0) hits.push({ ic: it[1], t: it[2], s: 'Open page', route: it[0] }); }));
      SEARCH_SRC.forEach(src => {
        if (!routeOn(src[1])) return;
        (S[src[0]] || []).forEach(r => { if (hits.length < 60 && src[5].some(k => r[k] != null && String(r[k]).toLowerCase().indexOf(q) >= 0)) hits.push({ ic: src[2], t: src[3](r) || '(no name)', s: src[4](r), route: src[1], id: r.id, coll: src[0], tab: src[6], q: src[3](r) }); });
      });
    }
    sel = Math.min(sel, Math.max(0, hits.length - 1));
    box.innerHTML = !q ? '' : hits.length ? hits.slice(0, 40).map((h, n) => '<button class="sr' + (n === sel ? ' on' : '') + '" data-n="' + n + '"><span class="ic">' + h.ic + '</span><span><b>' + esc(h.t) + '</b><small>' + esc(h.s || '') + '</small></span></button>').join('') : '<div class="empty">Nothing matches “' + esc(i.value) + '”.</div>';
  };
  const open = h => { m.remove(); if (h.coll === 'guests' || h.coll === 'vendors') openProfile(h.coll === 'guests' ? 'guest' : 'vendor', h.id); else jumpTo(h); };
  i.oninput = () => { sel = 0; draw(); };
  i.onkeydown = e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, Math.min(hits.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1))); draw(); const b = $('.sr.on', box); if (b) b.scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'Enter' && hits[sel]) open(hits[sel]);
    if (e.key === 'Escape') m.remove();
  };
  box.onclick = e => { const b = e.target.closest('[data-n]'); if (b) open(hits[+b.dataset.n]); };
  setTimeout(() => i.focus(), 30);
}
/** Open the page a row lives on, with filters cleared so it shows, and highlight it. */
function jumpTo(h) {
  if (h.coll === 'guests') UI.f.g = { q: h.q || '', side: '', rsvp: '', inv: '', fn: '', stay: '' };
  if (h.coll === 'tasks') UI.f.t = { st: 'All', who: '', cat: '', q: h.q || '' };
  if (h.coll === 'payments') UI.f.p = { st: 'All', line: '', q: '' };
  if (h.coll === 'runsheet') UI.f.rs = { fn: '' };
  if (h.coll === 'rituals') UI.f.rt = { fn: '' };
  if (h.coll === 'shagun') UI.f.s = { q: '', dir: '' };
  if (h.coll === 'vendors') UI.tab.ven = 'list';
  const tk = { people: 'ct', hotels: 'stay', vehicles: 'trans', vendors: 'ven' }[h.coll];
  if (h.tab && tk) UI.tab[tk] = h.tab;
  go(h.route);
  if (!h.id) return;
  setTimeout(() => {
    const r = $('#main [data-id="' + h.id + '"]'); if (!r) return;
    if (r.classList.contains('cr') && !r.classList.contains('on')) { const t = $('[data-tog]', r); if (t) t.click(); }
    r.scrollIntoView({ block: 'center' }); r.classList.add('flash'); setTimeout(() => r.classList.remove('flash'), 2200);
  }, 80);
}

/* ---------- Contacts ---------- */
/** Everyone with a role in the wedding, from every list. Guests only when asked for (there can be hundreds). */
function directory(withGuests) {
  const out = [], o = d();
  (S.people || []).forEach(r => { if (r.name || r.phone) out.push({ kind: 'team', coll: 'people', row: r, name: r.name || '(no name)', sub: r.role || 'Family & team', phone: r.phone }); });
  (S.vendors || []).filter(v => v.vendor || v.contact).forEach(r => out.push({ kind: 'vendor', coll: 'vendors', row: r, name: r.vendor || r.contact, sub: [r.line, r.vendor && r.contact ? r.contact : '', r.decision === 'Selected' ? 'Booked' : r.decision === 'Rejected' ? 'Not chosen' : 'Quote'].filter(Boolean).join(' · '), phone: r.phone, booked: r.decision === 'Selected' }));
  const seen = new Set();
  (S.hotels || []).forEach(r => { if (!r.hotel || seen.has('h' + r.hotel)) return; seen.add('h' + r.hotel); out.push({ kind: 'hotel', coll: 'hotels', row: r, name: r.hotel, sub: ['Hotel', r.contact].filter(Boolean).join(' · '), phone: r.phone, booked: S.roomAlloc.some(a => a.hotelType && a.hotelType.indexOf(r.hotel + ' - ') === 0) }); });
  (S.vehicles || []).forEach(r => { if (!r.operator || seen.has('v' + r.operator)) return; seen.add('v' + r.operator); out.push({ kind: 'vehicle', coll: 'vehicles', row: r, name: r.operator, sub: ['Transport', r.contact].filter(Boolean).join(' · '), phone: r.phone, booked: S.transAlloc.some(a => a.vehicle && a.vehicle.indexOf(r.operator + ' - ') === 0) }); });
  if (withGuests) o.G.forEach(r => out.push({ kind: 'guest', coll: 'guests', row: r, name: r.name || r.group, sub: [r.group, r.city, r.rsvp].filter(Boolean).join(' · '), phone: r.phone }));
  else o.G.filter(r => r.star === 'Yes').forEach(r => out.push({ kind: 'guest', coll: 'guests', row: r, name: r.name || r.group, sub: [r.group, r.city].filter(Boolean).join(' · '), phone: r.phone }));
  return out;
}
const KIND = { team: ['Family & team', 'contacts', 'team'], vendor: ['Vendors', 'vendors'], hotel: ['Hotels', 'stay', 'hotels'], vehicle: ['Transport', 'transport', 'veh'], guest: ['Guests', 'guests'] };
function contactRow(c, opts) {
  opts = opts || {};
  const star = c.row.star === 'Yes';
  return '<div class="ctc" data-id="' + c.row.id + '" data-coll="' + c.coll + '"><button class="star' + (star ? ' on' : '') + '" data-star title="' + (star ? 'Starred: shown first, in Wedding-day mode and on the shared run sheet' : 'Star for wedding day') + '"' + dis() + '>' + (star ? '★' : '☆') + '</button>' +
    '<div class="ctx"><b>' + (c.coll === 'guests' ? profLink('guest', c.row.id, c.name) : c.coll === 'vendors' ? profLink('vendor', c.row.id, c.name) : esc(c.name)) + (c.booked ? ' ' + pill('Booked', 'ok') : '') + '</b><small>' + esc(c.sub || '') + (c.phone ? ' · ' + esc(c.phone) : '') + '</small></div>' +
    (phoneDigits(c.phone) ? telBtns(c.phone, { name: c.name, text: opts.text ? opts.text(c) : '' }) : '<a class="note addno" data-edit>+ add number</a>') + '</div>';
}
function contactsBind(box, redraw) {
  box.addEventListener('click', e => {
    const r = e.target.closest('.ctc'); if (!r) return;
    const row = (S[r.dataset.coll] || []).find(x => x.id === r.dataset.id); if (!row) return;
    if (e.target.closest('[data-star]')) { if (RO()) return; undoRow(r.dataset.coll, row, (row.star === 'Yes' ? 'Unstarred ' : 'Starred ') + (rowName(row) || 'a contact')); row.star = row.star === 'Yes' ? 'No' : 'Yes'; dirty(); redraw(); return; }
    if (e.target.closest('[data-edit]')) {
      const k = { people: ['contacts', 'team', 'ct'], vendors: ['vendors', 'list', 'ven'], hotels: ['stay', 'hotels', 'stay'], vehicles: ['transport', 'veh', 'trans'], guests: ['guests'] }[r.dataset.coll];
      jumpTo({ route: k[0], id: row.id, coll: r.dataset.coll, tab: k[1], q: r.dataset.coll === 'guests' ? row.name : '' });
    }
  });
}
VIEWS.contacts = function () {
  UI.f.ct = UI.f.ct || { q: '', k: '' };
  const f = UI.f.ct;
  const head = el('<div>' + ph('Contacts', 'Everyone you’ll need to call: family & team, vendors, hotels, drivers and guests. Tap ☆ to star the people you’ll need on the wedding day.') + '</div>').firstChild;
  const host = tabHost('ct', [['dir', 'Phone book'], ['team', 'Family & team']], 'dir', tab => {
    if (tab === 'team') {
      const g = grid({ coll: 'people', limit: 300, empty: 'Add family members, friends helping out, your planner and the pandit.', blank: () => ({ name: '', role: '', phone: '', side: '', star: 'No' }), full: ['name'], quick: r => r.phone,
        title: r => r.name || 'New person', sub: r => [r.role, r.phone].filter(Boolean).join(' · '),
        cols: [T('name', 'Name', { w: 170, sticky: true }), T('role', 'Role / relation', { w: 170, ph: 'e.g. Bride’s mama, Pandit ji' }), TEL('phone', 'Phone'), SEL('side', 'Side', () => L('Side'), { w: 110 }), SEL('star', '⭐ Wedding day', YN, { w: 100, tip: 'Starred people show first, in Wedding-day mode and on the shared run sheet' }), T('notes', 'Notes', { w: 200 })] });
      const add = el('<button class="btn pri" style="margin:12px 0">+ Add person</button>'); add.onclick = () => g.add();
      return [el('<p class="note">These names fill the “Assigned to”, “Responsible” and “For whom” dropdowns everywhere in the planner.</p>'), g.root, add];
    }
    const chips = [['', 'All'], ['star', '⭐ Starred'], ['team', 'Family & team'], ['vendor', 'Vendors'], ['hotel', 'Hotels'], ['vehicle', 'Transport'], ['guest', 'Guests']].filter(c => !KIND[c[0]] || !KIND[c[0]][1] || routeOn(KIND[c[0]][1]));
    const bar = el('<div class="bar"><input class="inp" type="search" data-free placeholder="Search name, role, number…" style="min-width:220px"></div>');
    chips.forEach(c => bar.appendChild(el('<button class="chip' + (f.k === c[0] ? ' on' : '') + '" data-k="' + c[0] + '">' + esc(c[1]) + '</button>')));
    const box = el('<div></div>');
    const draw = () => {
      const q = f.q.trim().toLowerCase();
      let list = directory(f.k === 'guest' || !!q).filter(c => !KIND[c.kind][1] || routeOn(KIND[c.kind][1]));
      if (f.k === 'star') list = list.filter(c => c.row.star === 'Yes'); else if (f.k) list = list.filter(c => c.kind === f.k);
      if (q) list = list.filter(c => [c.name, c.sub, c.phone].some(x => String(x || '').toLowerCase().indexOf(q) >= 0));
      const starred = list.filter(c => c.row.star === 'Yes');
      const rest = list.filter(c => c.row.star !== 'Yes').sort((a, b) => (b.booked ? 1 : 0) - (a.booked ? 1 : 0));
      const groups = [];
      if (starred.length) groups.push(['⭐ Starred for the wedding day', starred]);
      Object.keys(KIND).forEach(k => { const xs = rest.filter(c => c.kind === k); if (xs.length) groups.push([KIND[k][0], xs.slice(0, k === 'guest' ? 200 : 500)]); });
      box.innerHTML = groups.length ? groups.map(g => '<div class="card ctg"><h3>' + esc(g[0]) + ' <small>' + g[1].length + '</small></h3>' + g[1].map(c => contactRow(c)).join('') + '</div>').join('') :
        '<div class="empty">' + (q || f.k ? 'No contacts match.' : 'No contacts yet. Add family & team in the next tab, and phone numbers to your vendors, hotels and transport.') + '</div>';
    };
    const si = $('input', bar); si.value = f.q; si.oninput = () => { f.q = si.value; draw(); };
    bar.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b) return; f.k = b.dataset.k; $$('[data-k]', bar).forEach(x => x.classList.toggle('on', x === b)); draw(); });
    contactsBind(box, draw);
    draw();
    return [bar, box];
  });
  return [head, host];
};

/* ---------- phone checks on the guest list ---------- */
/** Guests that may be typed twice (same name) and numbers shared across different families. */
function guestIssues() {
  const G = d().G, byName = new Map(), byPhone = new Map(), dup = new Set(), bad = new Set();
  G.forEach(g => {
    const n = String(g.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (n) { if (byName.has(n)) { dup.add(g.id); dup.add(byName.get(n)); } else byName.set(n, g.id); }
    const p = phoneDigits(g.phone);
    if (p) { if (!phoneOk(g.phone)) bad.add(g.id); const prev = byPhone.get(p); if (prev && gk(prev) !== gk(g) && String(prev.name || '').trim().toLowerCase() !== n) { dup.add(g.id); dup.add(prev.id); } else if (!prev) byPhone.set(p, g); }
  });
  return { dup, bad };
}
