/* ---------- guest and vendor details: tap a name anywhere to see everything about them ---------- */
const lc = s => String(s == null ? '' : s).trim().toLowerCase();
const vendorByName = n => { const k = lc(n); if (!k) return null; const vs = S.vendors.filter(v => lc(v.vendor) === k || lc(v.contact) === k); return vs.find(v => v.decision === 'Selected') || vs[0] || null; };
const guestByName = n => { const k = lc(n); return k ? S.guests.find(g => lc(g.name) === k) || null : null; };
/** A name that opens the guest's or vendor's details. */
const profLink = (kind, id, text) => id ? '<a class="lnk" data-prof="' + kind + ':' + id + '" role="button" tabindex="0">' + esc(text == null || text === '' ? '(no name)' : text) + '</a>' : esc(text || '');
const vendorLink = name => { const v = vendorByName(name); return v ? profLink('vendor', v.id, name) : esc(name || ''); };

document.addEventListener('click', e => { const p = e.target.closest('[data-prof]'); if (!p) return; e.preventDefault(); const i = p.dataset.prof.indexOf(':'); openProfile(p.dataset.prof.slice(0, i), p.dataset.prof.slice(i + 1)); });
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches && e.target.matches('a[data-prof]')) e.target.click(); });

let PROF = null; // { kind, id, el }
function closeProfile() { if (PROF) { PROF.el.remove(); PROF = null; document.body.classList.remove('drawer-open'); } }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && PROF && !$('.mask')) closeProfile(); });

function openProfile(kind, id) {
  const row = (kind === 'guest' ? S.guests : S.vendors).find(r => r.id === id);
  if (!row) { toast('That ' + kind + ' was deleted.'); return; }
  if (!PROF) {
    const el = document.createElement('div');
    el.className = 'drawer-wrap';
    el.innerHTML = '<div class="drawer-bg" data-x></div><aside class="drawer" role="dialog" aria-modal="true"><button class="dx" data-x aria-label="Close">✕</button><div class="dbody"></div></aside>';
    document.body.appendChild(el); document.body.classList.add('drawer-open');
    el.addEventListener('click', ev => { if (ev.target.closest('[data-x]')) closeProfile(); });
    el.addEventListener('change', ev => profileChange(ev));
    el.addEventListener('click', ev => profileAction(ev));
    PROF = { el };
  }
  PROF.kind = kind; PROF.id = id;
  drawProfile();
  $('.drawer', PROF.el).scrollTop = 0;
}
function drawProfile() {
  if (!PROF) return;
  const rows = PROF.kind === 'guest' ? S.guests : S.vendors, r = rows.find(x => x.id === PROF.id);
  if (!r) { closeProfile(); return; }
  $('.dbody', PROF.el).innerHTML = PROF.kind === 'guest' ? guestProfile(r) : vendorProfile(r);
  if (RO()) $$('.dbody select, .dbody [data-pa]', PROF.el).forEach(x => { if (!x.hasAttribute('data-ro-ok')) x.disabled = true; });
}
// Keep an open panel in step with edits made elsewhere (other devices, the grid behind it).
const _renderAll = renderAll;
renderAll = function () { _renderAll(); if (PROF) drawProfile(); };

const sec = (title, body, extra) => body ? '<section class="ps"><h3>' + title + (extra ? ' <small>' + extra + '</small>' : '') + '</h3>' + body + '</section>' : '';
const kv = pairs => '<dl class="kv">' + pairs.filter(p => p[1] !== '' && p[1] != null && p[1] !== false).map(p => '<dt>' + esc(p[0]) + '</dt><dd>' + p[1] + '</dd>').join('') + '</dl>';
const contactBlock = (phone, name, extra) => phoneDigits(phone)
  ? '<div class="pcall"><span class="pnum">' + esc(phone) + (phoneOk(phone) ? '' : ' <span class="pwarn" title="This number looks wrong">⚠</span>') + '</span>' + (phoneOk(phone) ? '<a class="btn pri sm" href="' + telHref(phone) + '">📞 Call</a><a class="btn sm" target="_blank" rel="noopener" href="' + esc(waHref(phone, '')) + '">💬 WhatsApp</a>' : '') + (extra || '') + '</div>'
  : '<p class="note">No phone number yet.' + (extra ? '</p><div class="pcall">' + extra + '</div>' : '</p>');

/* ----- guest ----- */
function guestProfile(g) {
  const o = d(), grp = gk(g), fam = o.G.filter(x => gk(x) === grp && x.id !== g.id);
  const rsvpPill = pill(g.rsvp || 'Pending', g.rsvp === 'Confirmed' ? 'ok' : g.rsvp === 'Declined' ? 'bad' : 'warn');
  const head = '<div class="ph"><div class="av">' + esc((g.name || '?').trim().charAt(0).toUpperCase()) + '</div><div><h2>' + esc(g.name || '(no name)') + '</h2><div class="note">' + [g.group && g.group !== g.name ? g.group : '', g.side, g.cat, g.age && g.age !== 'Adult' ? g.age : '', g.city].filter(Boolean).map(esc).join(' · ') + '</div><div class="pills">' + rsvpPill + ' ' + pill(g.invited === 'Yes' ? 'Invite sent' : 'Not invited yet', g.invited === 'Yes' ? 'info' : '') + (g.arr && on('checkin') ? ' ' + pill('Arrived ' + String(g.arr).slice(11), 'ok') : '') + '</div></div></div>';
  const msgBtn = '<button class="btn sm" data-pa="gmsg" data-ro-ok>💬 ' + (g.invited === 'Yes' && on('templates') ? 'Send a message' : 'Send invite') + '</button>';
  const contact = sec('Contact', contactBlock(g.phone, g.name, msgBtn));
  const quick = '<div class="pq"><label>RSVP <select class="sel" data-pf="rsvp">' + L('RSVP').map(x => '<option' + (x === g.rsvp ? ' selected' : '') + '>' + esc(x) + '</option>').join('') + '</select></label><label>Invite sent <select class="sel" data-pf="invited">' + YN.map(x => '<option' + (x === g.invited ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></label>' + (on('checkin') ? '<button class="btn sm" data-pa="arr">' + (g.arr ? 'Undo arrival' : '🛬 Mark arrived') + '</button>' : '') + '</div>';
  // functions
  const fns = S.functions.filter(f => f.name && f.active !== 'No').slice().sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : 1);
  const fnRows = fns.map(f => { const s = fnState(g, f.name); return '<tr class="' + (s ? '' : 'muted') + '"><td><b>' + esc(f.name) + '</b><small>' + [dshow(f.date), f.time, f.venue].filter(Boolean).map(esc).join(' · ') + '</small></td><td>' + (s ? pill(s === 'Confirmed' ? 'Coming' : s === 'Declined' ? 'Not coming' : 'Invited', s === 'Confirmed' ? 'ok' : s === 'Declined' ? 'bad' : 'warn') : '<span class="note">Not invited</span>') + '</td></tr>'; }).join('');
  const nInv = fns.filter(f => fnState(g, f.name)).length;
  const events = sec('Functions', fns.length ? '<table class="pt">' + fnRows + '</table>' : '', nInv + ' of ' + fns.length + ' invited');
  // stay
  let stay = '';
  if (on('stay')) {
    const ra = S.roomAlloc.find(a => a.group === grp), h = ra && S.hotels.find(x => o.hotelKey(x) === ra.hotelType);
    stay = sec('Stay', ra ? kv([['Hotel', h ? esc(h.hotel) + (h.phone ? ' ' + telBtns(h.phone, { name: h.hotel }) : '') : esc(ra.hotelType || 'Not picked')], ['Room', esc([h && h.type, g.room ? 'room ' + g.room : ''].filter(Boolean).join(', '))], ['Check-in', esc(dshow(ra.in))], ['Check-out', esc(dshow(ra.out))], ['Rooms for the family', esc(ra.rooms || '')]])
      : g.stay === 'Yes' ? '<p class="note">Needs a stay, not given a room yet. <a data-pa="go-stay">Allocate a room</a></p>' : '<p class="note">No stay needed.</p>');
  }
  // transport
  let tr = '';
  if (on('transport')) {
    const ta = S.transAlloc.find(a => a.group === grp), v = ta && S.vehicles.find(x => o.vehKey(x) === ta.vehicle);
    tr = sec('Transport', ta ? kv([['Vehicle', v ? esc(v.type + ' · ' + v.operator) + (v.phone ? ' ' + telBtns(v.phone, { name: v.operator }) : '') : esc(ta.vehicle || 'Not picked')], ['Arrival', esc([dshow(ta.arrDate), ta.arrTime, ta.arrFrom].filter(Boolean).join(' · '))], ['Departure', esc([dshow(ta.depDate), ta.depTime, ta.depTo].filter(Boolean).join(' · '))], ['Flight / train', esc(g.travel || '')]])
      : g.transport === 'Yes' ? '<p class="note">Needs transport, not arranged yet. <a data-pa="go-tr">Arrange a pickup</a>' + (g.travel ? '<br>Travel: ' + esc(g.travel) : '') + '</p>' : '<p class="note">No pickup needed.' + (g.travel ? ' Travel: ' + esc(g.travel) : '') + '</p>');
  }
  const more = sec('Other details', kv([['Diet', esc(g.diet || '')], ['Notes', esc(g.notes || '')]].concat(customCols(colPrefs('guests')).map(c => [c.label, esc(g[c.k] == null ? '' : g[c.k])]))));
  const famS = sec('Family / group', fam.length ? '<ul class="plist2">' + fam.map(x => '<li>' + profLink('guest', x.id, x.name || x.group) + '<small>' + [x.age && x.age !== 'Adult' ? x.age : '', x.rsvp].filter(Boolean).map(esc).join(' · ') + '</small>' + (phoneDigits(x.phone) ? telBtns(x.phone, { name: x.name }) : '') + '</li>').join('') + '</ul>' : '', grp + ' · ' + (fam.length + 1) + ' people');
  const sh = on('shagun') ? S.shagun.filter(x => lc(x.name) === lc(g.name) || (g.group && lc(x.group) === lc(g.group) && !x.name)) : [];
  const shS = sec('Shagun & gifts', sh.length ? '<table class="pt">' + sh.map(x => '<tr><td><b>' + esc(x.dir || '') + '</b><small>' + [x.fn, dshow(x.date), x.gift].filter(Boolean).map(esc).join(' · ') + '</small></td><td class="num">' + (x.amount ? inr(x.amount) : '') + '</td></tr>').join('') + '</table>' : '');
  return head + quick + contact + events + (typeof invReplySec === 'function' ? invReplySec(g) : '') + stay + tr + famS + shS + more +
    '<div class="pfoot"><button class="btn" data-pa="edit-guest" data-ro-ok>✎ Edit in Guest List</button></div>';
}

/* ----- vendor ----- */
function vendorPayments(v) { const k = lc(v.vendor), c = lc(v.contact); return S.payments.filter(p => { const n = lc(p.payee); return n && (n === k || (c && n === c)); }); }
function vendorDuties(v) {
  const names = [v.vendor, v.contact].map(lc).filter(Boolean);
  const hit = s => { const t = lc(s); return t && names.some(n => t === n || t.indexOf(n) >= 0); };
  const rs = on('runsheet') ? S.runsheet.filter(r => hit(r.vendor) || hit(r.activity) || (v.decision === 'Selected' && (phoneOf(r.vendor) || {}).row === v)) : [];
  const ts = on('tasks') ? S.tasks.filter(t => hit(t.task) || hit(t.notes)) : [];
  return { rs, ts };
}
function vendorProfile(v) {
  const o = d(), c = o.vCalc[v.id] || {}, eff = c.eff || 0, pays = vendorPayments(v).slice().sort((a, b) => (a.due || '9') < (b.due || '9') ? -1 : 1);
  const paid = pays.filter(p => p.status === 'Paid').reduce((a, p) => a + num(p.amount), 0);
  const sched = pays.filter(p => p.status !== 'Paid').reduce((a, p) => a + num(p.amount), 0);
  const sel = v.decision === 'Selected', left = eff - paid;
  const head = '<div class="ph"><div class="av v">🧾</div><div><h2>' + esc(v.vendor || '(no name)') + '</h2><div class="note">' + [v.line, (S.budgetLines.find(l => l.line === v.line) || {}).cat].filter(Boolean).map(esc).join(' · ') + '</div><div class="pills">' + pill(v.decision || 'Considering', sel ? 'ok' : v.decision === 'Rejected' ? 'bad' : 'info') + (num(v.rating) ? ' <span class="stars">' + '★'.repeat(num(v.rating)) + '<span>' + '★'.repeat(5 - num(v.rating)) + '</span></span>' : '') + (v.contract === 'Yes' ? ' ' + pill('Contract signed', 'ok') : '') + (c.low ? ' ' + pill('Lowest quote', 'info') : '') + '</div></div></div>';
  const noteBtn = on('templates') && on('payments') ? '<button class="btn sm" data-pa="vnote" data-ro-ok>💬 Payment note</button>' : '';
  const contact = sec('Contact', (v.contact ? '<p style="margin:0 0 6px"><b>' + esc(v.contact) + '</b></p>' : '') + contactBlock(v.phone, v.vendor, noteBtn));
  const money = sec('Money', '<div class="pmoney">' +
    '<div><span>Quoted</span><b>' + (num(v.quoted) ? inr(v.quoted) : '–') + '</b></div>' +
    '<div><span>Negotiated</span><b>' + (num(v.negotiated) ? inr(v.negotiated) : '–') + '</b></div>' +
    '<div><span>Paid</span><b class="ok">' + inr(paid) + '</b></div>' +
    '<div><span>' + (sel ? 'Left to pay' : 'Price') + '</span><b class="' + (sel && left > 0 ? 'due' : '') + '">' + (sel ? inr(Math.max(0, left)) : eff ? inr(eff) : '–') + '</b></div></div>' +
    (sel && eff ? '<div class="pbar"><i style="width:' + Math.min(100, pct(paid, eff)) + '%"></i></div><p class="note">' + pct(paid, eff) + '% paid' + (sched ? ' · ' + inr(sched) + ' scheduled in Payments' : '') + (left - sched > 0 && sched ? ' · ' + inr(left - sched) + ' not scheduled yet' : '') + (left < 0 ? ' · ' + inr(-left) + ' paid over the agreed price' : '') + '</p>' : '') +
    (c.vsAvg != null || c.vsPlan != null ? '<p class="note">' + [c.vsAvg != null ? pctCell(c.vsAvg) + ' vs the average quote' : '', c.vsPlan != null ? pctCell(c.vsPlan) + ' vs your budget for this line' : ''].filter(Boolean).join(' · ') + '</p>' : ''));
  const payS = on('payments') ? sec('Payments', (pays.length ? '<table class="pt">' + pays.map(p => { const pc = o.payCalc[p.id] || {}; return '<tr><td><b>' + esc(p.desc || 'Payment') + '</b><small>' + (p.status === 'Paid' ? 'Paid ' + esc(dshow(p.paid)) + (p.mode ? ' · ' + esc(p.mode) : '') : p.due ? 'Due ' + esc(dshow(p.due)) : 'No due date') + '</small></td><td class="num">' + inr(p.amount) + '</td><td>' + statusPill(pc.st) + '</td>' + (p.status !== 'Paid' ? '<td><button class="btn sm" data-pa="paid" data-pid="' + p.id + '">Mark paid</button></td>' : '<td></td>') + '</tr>'; }).join('') + '</table>' : '<p class="note">No payments recorded for this vendor.</p>') + '<button class="btn sm" data-pa="addpay">+ Add a payment</button>', pays.length ? pays.length + ' payment' + (pays.length > 1 ? 's' : '') : '') : '';
  const du = vendorDuties(v);
  const duties = sec('Responsibilities', (v.notes ? '<p class="pinc"><b>What’s included:</b> ' + esc(v.notes) + '</p>' : '') +
    (du.rs.length ? '<h4>On the run sheet</h4><ul class="plist2">' + du.rs.map(r => '<li><span><b>' + esc(r.activity || '') + '</b><small>' + [r.fn, r.time ? hm12(r.time) : '', r.loc, r.who ? 'with ' + r.who : ''].filter(Boolean).map(esc).join(' · ') + '</small></span>' + (r.status === 'Done' ? pill('Done', 'ok') : '') + '</li>').join('') + '</ul>' : '') +
    (du.ts.length ? '<h4>Tasks</h4><ul class="plist2">' + du.ts.map(t => '<li><span><b>' + esc(t.task) + '</b><small>' + [t.who, o.tCalc[t.id] && o.tCalc[t.id].dl ? 'due ' + dshow(fd(o.tCalc[t.id].dl)) : ''].filter(Boolean).map(esc).join(' · ') + '</small></span>' + statusPill(t.status === 'Done' ? 'Done' : (o.tCalc[t.id] || {}).alert) + '</li>').join('') + '</ul>' : '') +
    (!v.notes && !du.rs.length && !du.ts.length ? '<p class="note">Nothing yet. Write what’s included in the vendor’s notes, and use their name in the Run Sheet’s “Vendor” column.</p>' : ''));
  const alts = S.vendors.filter(x => x.id !== v.id && x.line && x.line === v.line);
  const altS = sec('Other quotes for ' + esc(v.line || 'this job'), alts.length ? '<ul class="plist2">' + alts.map(x => { const xc = o.vCalc[x.id] || {}; return '<li>' + profLink('vendor', x.id, x.vendor) + '<small>' + [xc.eff ? inr(xc.eff) : '', x.decision].filter(Boolean).map(esc).join(' · ') + '</small></li>'; }).join('') + '</ul>' : '');
  const pick = sel ? '<button class="btn" data-pa="unsel">Unselect</button>' : '<button class="btn pri" data-pa="sel">✓ Select this vendor</button>';
  return head + contact + money + payS + duties + altS + '<div class="pfoot">' + pick + ' <button class="btn" data-pa="edit-vendor" data-ro-ok>✎ Edit in Vendors</button></div>';
}

/* ----- actions inside the panel ----- */
function profileChange(e) {
  const f = e.target.dataset.pf; if (!f || RO() || !PROF) return;
  const g = S.guests.find(x => x.id === PROF.id); if (!g) return;
  undoRow('guests', g, 'Changed ' + f + ' of “' + (g.name || '') + '”'); g[f] = e.target.value; dirty(); renderAllKeep();
}
const renderAllKeep = () => { const y = window.scrollY; renderAll(); window.scrollTo(0, y); };
function profileAction(e) {
  const b = e.target.closest('[data-pa]'); if (!b || !PROF) return;
  const a = b.dataset.pa, isG = PROF.kind === 'guest', r = (isG ? S.guests : S.vendors).find(x => x.id === PROF.id); if (!r) return;
  if (a === 'edit-guest') { closeProfile(); jumpTo({ route: 'guests', coll: 'guests', id: r.id, q: r.name }); return; }
  if (a === 'edit-vendor') { closeProfile(); jumpTo({ route: 'vendors', coll: 'vendors', id: r.id, tab: 'list' }); return; }
  if (a === 'go-stay') { closeProfile(); UI.tab.stay = 'alloc'; go('stay'); return; }
  if (a === 'go-tr') { closeProfile(); UI.tab.trans = 'alloc'; go('transport'); return; }
  if (a === 'gmsg') { msgPicker({ phone: r.phone, title: 'Message ' + (r.name || 'guest'), choices: on('templates') ? guestChoices(r, renderAllKeep) : [['invite', 'Invitation', guestVals(r), () => { if (r.invited !== 'Yes' && !RO()) { undoRow('guests', r); r.invited = 'Yes'; dirty(); renderAllKeep(); } }]] }); return; }
  if (a === 'vnote') { const p = vendorPayments(r).find(x => x.status !== 'Paid') || vendorPayments(r)[0] || { payee: r.vendor, desc: 'payment' }; msgPicker({ phone: r.phone, title: 'Message ' + (r.vendor || 'vendor'), choices: [['pay', 'Payment note', payVals(p)], ['', 'Blank', '']] }); return; }
  if (RO()) return;
  if (a === 'arr') { undoRow('guests', r, (r.arr ? 'Un-checked ' : 'Checked in ') + (r.name || '')); r.arr = r.arr ? '' : fd(today()) + ' ' + nowHM(); }
  else if (a === 'sel' || a === 'unsel') { undoFn((a === 'sel' ? 'Selected ' : 'Unselected ') + (r.vendor || 'vendor'), (() => { const was = S.vendors.filter(x => x.line === r.line).map(x => [x.id, x.decision]); return () => was.forEach(w => { const x = S.vendors.find(y => y.id === w[0]); if (x) x.decision = w[1]; }); })()); if (a === 'sel') S.vendors.forEach(x => { if (x.line === r.line && x.decision === 'Selected') x.decision = 'Considering'; }); r.decision = a === 'sel' ? 'Selected' : 'Considering'; }
  else if (a === 'paid') { const p = S.payments.find(x => x.id === b.dataset.pid); if (!p) return; undoRow('payments', p, 'Marked paid: ' + (p.payee || '')); p.status = 'Paid'; p.paid = fd(today()); }
  else if (a === 'addpay') { if (!canAdd('payments')) return; const p = { id: uid(), line: r.line || '', payee: r.vendor || '', desc: 'Advance', amount: '', status: 'Pending', mode: 'Bank Transfer', by: 'Bride Family' }; S.payments.push(p); UNDO.push({ coll: 'payments', id: p.id, row: null, label: 'Added a payment', add: true }); dirty(); closeProfile(); UI.f.p = { st: 'All', line: '', q: '' }; jumpTo({ route: 'payments', coll: 'payments', id: p.id }); return; }
  else return;
  dirty(); renderAllKeep();
}
