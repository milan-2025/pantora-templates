/* ---------- Dashboard ---------- */
VIEWS.dash = function () {
  const o = d(), s = S.settings;
  const hero = el('<div class="hero"><div style="z-index:1"><div style="letter-spacing:.2em;font-size:11px;opacity:.7;text-transform:uppercase">Wedding dashboard</div><h1>' + esc(names()) + '</h1><div class="sub">' + (s.date ? esc(dlong(s.date)) : 'Add your wedding date in Setup') + (s.city ? ' &nbsp;·&nbsp; ' + esc(s.city) : '') + '</div>' +
    (o.mode ? '<div class="sub" style="font-size:12.5px;margin-top:6px;opacity:.75">' + esc(o.mode) + ' timeline · ' + o.avail + ' planning days from ' + dshow(s.start) + '</div>' : '') + '</div>' +
    '<div class="cd"><b>' + (o.daysTo == null ? '–' : Math.abs(o.daysTo)) + '</b><span>' + (o.daysTo == null ? 'set the date' : o.daysTo >= 0 ? 'days to go' : 'days since') + '</span></div></div>');
  const bal = o.committed - o.paid;
  const k = el('<div class="grid g4" style="margin:14px 0">' + [
    kpi('Guests', o.nGuests, o.nGroups + ' families / groups'),
    kpi('Confirmed', o.conf, o.await + ' awaiting · ' + o.decl + ' declined', 't'),
    on('budget') && kpi('Budget committed', o.total ? pct(o.committed, o.total) + '%' : '–', short(o.committed) + ' of ' + short(o.total), 'm'),
    (on('budget') || on('payments')) && kpi('Paid so far', short(o.paid), short(bal) + ' still to pay', 'c'),
    on('tasks') && kpi('Tasks done', S.tasks.length ? pct(o.tDone, S.tasks.length) + '%' : '–', o.tDone + ' of ' + S.tasks.length + (o.tOver ? ' · <b style="color:#E0675A">' + o.tOver + ' overdue</b>' : '')),
    on('stay') && kpi('Rooms booked', o.roomsBooked + ' / ' + o.roomsTotal, o.stayNeedN + ' guests need a stay · ' + short(o.roomCost), 't'),
    on('shagun') && kpi('Shagun received', short(o.shRecv), short(o.shGiven) + ' given', 'm'),
    on('catering') && kpi('Plates to order', o.fns.reduce((a, f) => a + f.plates, 0), short(o.fns.reduce((a, f) => a + f.food, 0)) + ' estimated food', 'c'),
    on('checkin') && o.daysTo != null && o.daysTo <= 3 && kpi('Arrived', o.G.filter(g => g.arr).length, 'of ' + o.G.filter(g => g.rsvp !== 'Declined').length + ' expected', 't')
  ].filter(Boolean).join('') + '</div>');
  /* attention */
  const items = [];
  const add = (c, t, sub, to) => routeOn(to) && items.push('<li data-go="' + to + '"><span class="dot ' + c + '"></span><div><b>' + t + '</b><small>' + sub + '</small></div></li>');
  if (!s.date) add('r', 'Add your wedding date', 'Task deadlines and the countdown depend on it.', 'setup');
  if (!on('daymode') && o.daysTo != null && o.daysTo >= 0 && o.daysTo <= 7) add('g', 'The wedding is ' + (o.daysTo ? 'in ' + o.daysTo + ' day' + (o.daysTo > 1 ? 's' : '') : 'today') + ': try Wedding-day mode', 'A simple phone screen with what’s next and one-tap calls. Switch it on in Features.', 'features');
  if (on('phonecheck')) { const gi = guestIssues(); if (gi.bad.size) add('', gi.bad.size + ' guest phone number' + (gi.bad.size > 1 ? 's look' : ' looks') + ' wrong', 'Fix them so WhatsApp invites reach the right person.', 'guests'); }
  if (!o.total) add('r', 'Set your total budget', 'Everything in Budget is calculated from it.', 'budget');
  if (o.tOver) add('r', o.tOver + ' task' + (o.tOver > 1 ? 's are' : ' is') + ' overdue', 'Open Tasks to catch up.', 'tasks');
  if (o.payOver.length) add('r', o.payOver.length + ' payment' + (o.payOver.length > 1 ? 's' : '') + ' overdue', inr(o.payOver.reduce((a, p) => a + num(p.amount), 0)) + ' to settle.', 'payments');
  if (o.paySoon.length) add('', o.paySoon.length + ' payment' + (o.paySoon.length > 1 ? 's' : '') + ' due in 14 days', inr(o.paySoon.reduce((a, p) => a + num(p.amount), 0)) + ' coming up.', 'payments');
  if (o.nGuests - o.sent > 0) add('', o.nGuests - o.sent + ' invitations not sent yet', 'Send them from the Guest List with one tap on WhatsApp.', 'guests');
  if (o.await > 0 && o.sent) add('', o.await + ' guests have not replied', 'Follow up on RSVPs.', 'guests');
  if (o.stayAwait.length) add('', o.stayAwait.length + ' group' + (o.stayAwait.length > 1 ? 's' : '') + ' need a room', o.stayAwait.slice(0, 3).map(x => x[0]).join(', ') + (o.stayAwait.length > 3 ? '…' : ''), 'stay');
  if (o.trAwait.length) add('', o.trAwait.length + ' group' + (o.trAwait.length > 1 ? 's' : '') + ' need transport', o.trAwait.slice(0, 3).map(x => x[0]).join(', '), 'transport');
  const over = o.cats.filter(x => o.catStatus(x) === 'Over budget');
  if (over.length) add('r', over.length + ' budget categor' + (over.length > 1 ? 'ies are' : 'y is') + ' over plan', over.map(x => x.c.name).slice(0, 2).join(', '), 'budget');
  if (o.noVendorLines.length) add('', o.noVendorLines.length + ' budget line' + (o.noVendorLines.length > 1 ? 's have' : ' has') + ' quotes but no vendor selected', o.noVendorLines.slice(0, 2).map(l => l.line).join(', '), 'vendors');
  if (o.thanksPending) add('g', o.thanksPending + ' thank-you' + (o.thanksPending > 1 ? 's' : '') + ' to send', 'For shagun received.', 'shagun');
  const attn = el('<div class="card" id="attn"><h3>Needs your attention</h3>' + (items.length ? '<ul class="todo">' + items.slice(0, 8).join('') + '</ul>' : '<div class="ok-note">All clear. Nothing urgent right now. 🎉</div>') + '</div>');
  /* budget bars */
  const mx = Math.max.apply(null, o.cats.map(x => Math.max(x.planned, x.committed)).concat([1]));
  const bud = el('<div class="card"><h3>Budget by category <small>planned · committed · paid</small></h3>' + (o.cats.length ? o.cats.map(x => hbar(x.c.name, [{ v: x.planned, c: '#EADFC9' }, { v: x.committed, c: o.catStatus(x) === 'Over budget' ? '#E0675A' : '#1F7A74' }, { v: x.paid, c: '#F2A93B', top: 1 }], mx, short(x.committed) + ' / ' + short(x.planned))).join('') : '<div class="empty">No budget categories yet.</div>') +
    '<div class="legend"><span><i style="background:#EADFC9"></i>Planned</span><span><i style="background:#1F7A74"></i>Committed (selected vendors)</span><span><i style="background:#F2A93B"></i>Paid</span></div></div>');
  const row1 = el('<div class="grid ' + (on('budget') ? 'g32' : 'g2') + '"></div>'); if (on('budget')) row1.appendChild(bud); row1.appendChild(attn);
  /* rsvp donut */
  const rs = [{ v: o.conf, c: '#1F7A74', l: 'Confirmed' }, { v: o.await, c: '#F2A93B', l: 'Awaiting' }, { v: o.decl, c: '#E0675A', l: 'Declined' }];
  const rsvp = el('<div class="card"><h3>RSVP status</h3><div class="donutwrap">' + donut(rs, 150, o.nGuests ? pct(o.conf, o.nGuests) + '%' : '–', 'confirmed') + '<div>' + legend(rs) + '<div class="note" style="margin-top:8px">' + o.sent + ' of ' + o.nGuests + ' invitations sent</div></div></div></div>');
  const fx = Math.max.apply(null, o.fns.map(f => f.inv).concat([1]));
  const fnc = el('<div class="card"><h3>Guests by function</h3>' + (o.fns.length ? o.fns.map(f => hbar(f.f.name, [{ v: f.inv, c: '#EFE6F3' }, { v: f.conf, c: '#1F7A74', top: 1 }], fx, f.conf + ' / ' + f.inv)).join('') : '<div class="empty">No functions.</div>') + '</div>');
  /* upcoming */
  const nextT = !on('tasks') ? [] : S.tasks.filter(t => o.tCalc[t.id].alert !== 'Done' && o.tCalc[t.id].dl).sort((a, b) => o.tCalc[a.id].dl - o.tCalc[b.id].dl).slice(0, 4);
  const nextP = !on('payments') ? [] : S.payments.filter(p => p.status !== 'Paid' && p.due).sort((a, b) => a.due < b.due ? -1 : 1).slice(0, 3);
  const nextF = o.fns.filter(f => f.f.date && pd(f.f.date) >= o.T).sort((a, b) => a.f.date < b.f.date ? -1 : 1).slice(0, 2);
  const up = el('<div class="card"><h3>Coming up</h3><ul class="todo">' +
    nextF.map(f => '<li data-go="functions"><span class="dot g"></span><div><b>' + esc(f.f.name) + '</b><small>' + dshow(f.f.date) + ' · in ' + diff(pd(f.f.date), o.T) + ' days' + (f.f.venue ? ' · ' + esc(f.f.venue) : '') + '</small></div></li>').join('') +
    nextT.map(t => '<li data-go="tasks"><span class="dot"></span><div><b>' + esc(t.task) + '</b><small>Due ' + dshow(fd(o.tCalc[t.id].dl)) + (t.who ? ' · ' + esc(t.who) : '') + '</small></div></li>').join('') +
    nextP.map(p => '<li data-go="payments"><span class="dot r"></span><div><b>' + esc(p.payee || p.line) + ' · ' + inr(p.amount) + '</b><small>' + esc(p.desc || 'Payment') + ' due ' + dshow(p.due) + '</small></div></li>').join('') +
    '</ul></div>');
  const row2 = el('<div class="grid g3" style="margin-top:14px"></div>'); [rsvp, on('functions') ? fnc : null, up].filter(Boolean).forEach(x => row2.appendChild(x));
  if (on('daymode')) { const b = el('<button class="btn pri" data-go="today" style="margin-top:12px">☀️ Open Wedding-day mode</button>'); const sub = hero.querySelector('div'); if (sub) sub.appendChild(b); }
  const gap = el('<div style="height:14px"></div>');
  return [hero, k, row1, row2];
};

/* ---------- Tasks ---------- */
VIEWS.tasks = function () {
  UI.f.t = UI.f.t || { st: 'Open', who: '', cat: '', q: '' };
  const f = UI.f.t, kp = el('<div class="grid g4" style="margin-bottom:12px"></div>');
  const upd = () => {
    const o = d(); kp.innerHTML = kpi('Tasks', S.tasks.length, o.tDone + ' done') + kpi('Progress', pct(o.tDone, S.tasks.length) + '%', 'complete', 't') + kpi('Overdue', o.tOver, 'need action now', 'c') + kpi('Due in 7 days', o.tSoon, 'coming up soon', 'm');
    work.innerHTML = '<b style="font-size:12px;color:#7A6F80">OPEN TASKS BY PERSON &nbsp;</b>' + TEAM().map(p => { const n = S.tasks.filter(t => t.who === p && t.status !== 'Done').length; return n ? '<button class="chip' + (f.who === p ? ' on' : '') + '" data-who="' + esc(p) + '">' + esc(p) + ' · ' + n + '</button>' : ''; }).join(' ');
  };
  const work = el('<div class="bar"></div>');
  work.onclick = e => { const b = e.target.closest('[data-who]'); if (!b) return; f.who = f.who === b.dataset.who ? '' : b.dataset.who; whoSel.value = f.who; g.build(); upd(); };
  let whoSel;
  const g = grid({
    coll: 'tasks', after: upd, empty: 'No tasks match these filters.', limit: 300,
    blank: () => ({ task: '', cat: 'Other', who: '', priority: 'Medium', status: 'Not Started', daysBefore: 30 }),
    filter: t => { const c = d().tCalc[t.id]; return (!f.st || f.st === 'All' || (f.st === 'Open' && t.status !== 'Done') || (f.st === 'Done' && t.status === 'Done') || (f.st === 'Overdue' && c.alert === 'Overdue') || (f.st === 'Due soon' && c.alert === 'Due soon')) && (!f.who || t.who === f.who) && (!f.cat || t.cat === f.cat) && matchQ(t, ['task', 'notes', 'who', 'cat'], f.q); },
    sort: (a, b) => { const o = d(); return ((o.tCalc[a.id].dl || 0) - (o.tCalc[b.id].dl || 0)) || 0; },
    cols: [
      { id: 'done', k: 'status', t: 'chk', label: '✓', on: 'Done', off: 'Not Started', w: 34, tip: 'Mark done' },
      T('task', 'Task', { w: 340 }), SEL('cat', 'Category', () => L('Task Category'), { w: 150 }), SEL('fn', 'Function', FNS, { w: 130 }), SEL('who', 'Assigned to', TEAM, { w: 150 }),
      CALC('dl', 'Deadline', (r) => { const c = d().tCalc[r.id]; return c.dl ? dshow(fd(c.dl)) : ''; }),
      SEL('priority', 'Priority', () => L('Priority'), { w: 90 }), SEL('status', 'Status', () => L('Task Status'), { w: 120 }),
      CALC('left', 'Days left', r => { const c = d().tCalc[r.id]; return c.left == null || c.alert === 'Done' ? '' : c.left; }, { num: 1 }),
      CALC('alert', 'Alert', r => d().tCalc[r.id].alert, { fmt: statusPill }),
      NUM('daysBefore', 'Days before wedding', { tip: 'How many days before the wedding this should be done (negative = after the wedding). Deadlines adjust automatically to your planning window.', w: 110 }),
      T('notes', 'Notes', { w: 200 })
    ]
  });
  const bar = filterBar([
    { type: 'search', ph: 'Search tasks…', get: () => f.q, set: v => { f.q = v; g.build(); } },
    { type: 'chips', opts: ['Open', 'Overdue', 'Due soon', 'Done', 'All'], get: () => f.st, set: v => { f.st = v; g.build(); } },
    { type: 'sel', label: 'All categories', opts: L('Task Category'), get: () => f.cat, set: v => { f.cat = v; g.build(); } }
  ]);
  whoSel = el('<select class="sel"><option value="">Everyone</option>' + TEAM().map(p => '<option' + (p === f.who ? ' selected' : '') + '>' + esc(p) + '</option>').join('') + '</select>');
  whoSel.onchange = () => { f.who = whoSel.value; g.build(); upd(); };
  bar.appendChild(whoSel);
  const add = el('<button class="btn pri">+ Add task</button>'); add.onclick = () => { f.st = 'All'; g.add(); };
  const head = el('<div>' + ph('Tasks & Timeline', 'About ' + S.tasks.length + ' tasks with deadlines that adjust automatically to your wedding date and planning start. Tick them off as you go.') + '</div>');
  head.querySelector('.page-h').appendChild(add);
  upd();
  return [head.firstChild, kp, work, bar, g.root];
};

/* ---------- Functions ---------- */
VIEWS.functions = function () {
  const strip = el('<div class="grid g4" style="margin-bottom:14px"></div>');
  const g = grid({
    coll: 'functions', empty: 'Add your first function.', after: () => { upd(); },
    blank: () => ({ name: '', active: 'Yes' }),
    cols: [T('name', 'Function', { w: 160 }), SEL('active', 'Active?', YN, { w: 80 }), DT('date', 'Date'), TM('time', 'Start time'), T('venue', 'Venue', { w: 220 }), T('dress', 'Dress code / theme', { w: 180 }),
      CALC('inv', 'Invited', r => (d().fns.find(x => x.f.id === r.id) || {}).inv, { num: 1 }), CALC('cf', 'Confirmed', r => (d().fns.find(x => x.f.id === r.id) || {}).conf, { num: 1 }),
      CALC('pn', 'Pending', r => (d().fns.find(x => x.f.id === r.id) || {}).pend, { num: 1 }), CALC('dc', 'Declined', r => (d().fns.find(x => x.f.id === r.id) || {}).decl, { num: 1 })]
  });
  function upd() {
    const o = d();
    strip.innerHTML = o.fns.filter(f => f.f.date).sort((a, b) => a.f.date < b.f.date ? -1 : 1).slice(0, 8).map(f => { const n = diff(pd(f.f.date), o.T); return kpi(f.f.name, dshow(f.f.date).replace(/ \d{4}$/, ''), (n >= 0 ? 'in ' + n + ' days' : Math.abs(n) + ' days ago') + (f.f.time ? ' · ' + f.f.time : ''), n < 0 ? '' : 'm'); }).join('') || '<div class="note">Add dates to see your function timeline here.</div>';
  }
  upd();
  const add = el('<button class="btn pri">+ Add function</button>'); add.onclick = () => g.add();
  const head = el('<div>' + ph('Functions', 'Roka to Vidaai: rename, switch off or schedule each function. Guest counts update from the Guest List.') + '</div>'); head.querySelector('.page-h').appendChild(add);
  return [head.firstChild, strip, g.root];
};

/* ---------- Run sheet / Rituals ---------- */
function byFnView(opts, extra) {
  UI.f[opts.key] = UI.f[opts.key] || { fn: '' };
  const f = UI.f[opts.key];
  const sortFn = (a, b) => { const fa = S.functions.find(x => x.name === a.fn), fb = S.functions.find(x => x.name === b.fn); const da = (fa && fa.date) || '9', db = (fb && fb.date) || '9'; return da < db ? -1 : da > db ? 1 : (a.time || '') < (b.time || '') ? -1 : 1; };
  const kp = el('<div class="note" style="margin:0 0 10px"></div>');
  const upd = () => { kp.innerHTML = opts.summary(); };
  const g = grid({ coll: opts.coll, cols: opts.cols, after: upd, blank: () => Object.assign(opts.blank(), f.fn ? { fn: f.fn } : {}), sort: opts.sort ? sortFn : null, filter: r => (!f.fn || r.fn === f.fn) && matchQ(r, opts.keys, f.q), empty: opts.empty });
  const bar = filterBar([{ type: 'search', get: () => f.q || '', set: v => { f.q = v; g.build(); } }, { type: 'sel', label: 'All functions', opts: FNS(), get: () => f.fn, set: v => { f.fn = v; g.build(); } }]);
  const add = el('<button class="btn pri">+ Add</button>'); add.onclick = () => g.add();
  const head = el('<div>' + ph(opts.title, opts.sub) + '</div>'); head.querySelector('.page-h').appendChild(add);
  upd(); const v = [head.firstChild, kp, bar, g.root]; if (extra) extra(v); return v;
}
VIEWS.runsheet = () => byFnView({
  key: 'rs', coll: 'runsheet', title: 'Run Sheet', sub: 'The day-of plan: who does what, when, and where. Share it with your planner and family.', sort: true, keys: ['activity', 'who', 'vendor', 'loc', 'notes'], empty: 'No activities yet. Add the first one.',
  summary: () => { const n = S.runsheet.length, dn = S.runsheet.filter(x => x.status === 'Done').length; return '<b>' + n + '</b> activities · <b>' + dn + '</b> done'; },
  blank: () => ({ time: '', activity: '', status: 'Pending' }),
  cols: [SEL('fn', 'Function', FNS, { w: 140 }), TM('time', 'Start'), T('activity', 'Activity', { w: 320 }), SEL('who', 'Responsible', TEAM, { w: 150, full: 1 }), T('vendor', 'Vendor / contact', { w: 150, list: 'dl-vendors', full: 1, prof: r => { const v = vendorByName(r.vendor) || (phoneOf(r.vendor) || {}).kind === 'vendor' && phoneOf(r.vendor).row; return v ? 'vendor:' + v.id : null; } }), T('loc', 'Location', { w: 140 }), SEL('status', 'Status', () => L('Run Sheet Status'), { w: 100 }), T('notes', 'Notes', { w: 180 }),
    { k: 'calls', label: 'Call', t: 'html', th: 'a', html: r => (whoBtns(r.who) + whoBtns(r.vendor)) || '<span class="note" title="Add phone numbers in Contacts, Vendors, Hotels or Transport">–</span>' }]
}, v => {
  if (!on('sharelink')) return;
  const b = el('<button class="btn">🔗 Share link</button>');
  b.onclick = () => { const c = shareCard(); if (!c) return; const m = modal(''); const box = $('.modal', m); box.appendChild(c); c.style.margin = '0'; c.style.border = '0'; c.style.padding = '0'; box.appendChild(el('<div class="bar" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-x>Close</button></div>')); $('[data-x]', m).onclick = () => m.remove(); };
  v[0].insertBefore(b, v[0].lastChild);
});
VIEWS.rituals = () => byFnView({
  key: 'rt', coll: 'rituals', title: 'Rituals & Puja Checklist', sub: 'A starter list of items for each function. Edit freely: every family does things a little differently.', keys: ['item', 'qty', 'who', 'source', 'remarks'], empty: 'No items.', sort: true,
  summary: () => { const n = S.rituals.length, r = S.rituals.filter(x => x.status === 'Ready' || x.status === 'Packed').length; return '<b>' + n + '</b> items · <b>' + r + '</b> ready or packed (' + pct(r, n) + '%)'; },
  blank: () => ({ item: '', status: 'To arrange' }),
  cols: [SEL('fn', 'Function', FNS, { w: 140 }), T('item', 'Ritual / item', { w: 300 }), T('qty', 'Quantity / notes', { w: 170 }), SEL('who', 'Who arranges', TEAM, { w: 150 }), T('source', 'Source', { w: 120 }), SEL('status', 'Status', () => L('Ritual Status'), { w: 110 }), T('remarks', 'Remarks', { w: 160 })]
});

/* ---------- Guests ---------- */
function waLink(g) {
  if (!phoneDigits(g.phone)) return '';
  return waHref(g.phone, fillMsg(msgText('invite'), guestVals(g)));
}
/** Messages that make sense for this guest, most useful first. */
function guestChoices(r, after) {
  const inv = ['invite', 'Invitation', guestVals(r), () => { if (r.invited !== 'Yes') { undoRow('guests', r, 'Marked invite sent to ' + (r.name || 'a guest')); r.invited = 'Yes'; dirty(); after(); } }];
  const rem = r.rsvp !== 'Confirmed' && r.rsvp !== 'Declined' ? ['remind', 'RSVP reminder', guestVals(r)] : null;
  const stay = r.stay === 'Yes' || r.transport === 'Yes' || S.roomAlloc.some(a => a.group === gk(r)) || S.transAlloc.some(a => a.group === gk(r)) ? ['stay', 'Stay & pickup', guestVals(r)] : null;
  return (r.invited === 'Yes' ? [rem, stay, inv] : [inv, rem, stay]).concat([['', 'Blank', '']]);
}
VIEWS.guests = function () {
  UI.f.g = UI.f.g || { q: '', side: '', rsvp: '', inv: '', fn: '', stay: '' };
  const f = UI.f.g, kp = el('<div class="grid g4" style="margin-bottom:12px"></div>');
  const chk = el('<div></div>');
  let ISS = { dup: new Set(), bad: new Set() };
  const issues = () => {
    if (!on('phonecheck')) { chk.innerHTML = ''; f.chk = ''; return; }
    ISS = guestIssues();
    const n1 = ISS.dup.size, n2 = ISS.bad.size;
    chk.innerHTML = n1 || n2 || f.chk ? '<div class="banner noprint"><span>☎️ ' + [n1 ? '<b>' + n1 + '</b> guests may be entered twice (same name, or a number shared by two families)' : '', n2 ? '<b>' + n2 + '</b> phone number' + (n2 > 1 ? 's look' : ' looks') + ' wrong' : ''].filter(Boolean).join(' · ') + (!n1 && !n2 ? 'All fixed. ✔' : '') + '</span><span class="sp"></span>' +
      (n1 ? '<button class="btn sm' + (f.chk === 'dup' ? ' dark' : '') + '" data-chk="dup">' + (f.chk === 'dup' ? 'Show all guests' : 'Show possible duplicates') + '</button>' : '') + (n2 ? ' <button class="btn sm' + (f.chk === 'bad' ? ' dark' : '') + '" data-chk="bad">' + (f.chk === 'bad' ? 'Show all guests' : 'Show wrong numbers') + '</button>' : '') + (f.chk && !n1 && !n2 ? '<button class="btn sm" data-chk="">Show all guests</button>' : '') + '</div>' : '';
  };
  issues();
  chk.onclick = e => { const b = e.target.closest('[data-chk]'); if (!b) return; f.chk = f.chk === b.dataset.chk ? '' : b.dataset.chk; issues(); g.build(); };
  const upd = () => { issues(); const o = d(); kp.innerHTML = kpi('Guests', o.nGuests, o.nGroups + ' families / groups') + kpi('Invites sent', o.sent, o.nGuests - o.sent + ' to send', 'm') + kpi('Confirmed', o.conf, o.await + ' awaiting', 't') + kpi('Declined', o.decl, 'regrets', 'c'); };
  const fcols = S.functions.filter(x => x.name && x.active !== 'No').map(x => ({ id: 'fn:' + x.name, k: x.name, label: x.name.slice(0, 4), tip: x.name, t: 'fn', th: 'f', w: 34 }));
  const g = grid({
    coll: 'guests', after: upd, limit: 300, empty: 'No guests yet. Add your first guest, or import your list from Excel in Setup & Data.',
    blank: () => ({ name: '', group: '', side: f.side || '', cat: 'Family', age: 'Adult', invited: 'No', rsvp: 'Pending', stay: 'No', transport: 'No', fn: {} }),
    full: ['group'],
    filter: r => (!f.chk || ISS[f.chk].has(r.id)) && matchQ(r, ['name', 'group', 'city', 'phone', 'notes'], f.q) && (!f.side || r.side === f.side) && (!f.rsvp || r.rsvp === f.rsvp) && (!f.inv || (f.inv === 'Not sent' ? r.invited !== 'Yes' : r.invited === 'Yes')) && (!f.fn || (r.fn || {})[f.fn]) && (!f.stay || (f.stay === 'Needs stay' ? r.stay === 'Yes' : r.transport === 'Yes')),
    act: { wa: r => { r.invited = 'Yes'; }, msg: r => { msgPicker({ phone: r.phone, title: 'Message ' + (r.name || 'guest'), choices: guestChoices(r, () => { g.build(); upd(); }) }); return false; } },
    quick: r => r.phone, quickWa: false, prof: 'guest',
    cols: [T('name', 'Guest name', { w: 190, sticky: true, prof: 'guest' }), T('group', 'Family / group', { w: 140, list: 'dl-groups' }), SEL('side', 'Side', () => L('Side'), { w: 100 }), SEL('cat', 'Category', () => L('Guest Category'), { w: 100 }), SEL('age', 'Age', () => L('Age Group'), { w: 80 }), T('city', 'City', { w: 100 }), TEL('phone', 'Phone', { wa: false }), SEL('diet', 'Diet', () => L('Diet'), { w: 130 }),
      { k: 'wa', label: 'WhatsApp', t: 'html', th: 'a', html: r => { const l = waLink(r); if (r.invited === 'Yes' && on('templates')) return '<button data-act="msg" class="btn sm">💬 Message</button>'; return l ? '<a data-act="wa" href="' + esc(l) + '" target="_blank" rel="noopener" class="btn sm" style="text-decoration:none;display:inline-block">💬 Invite</a>' : phoneDigits(r.phone) ? '<span class="note">check number</span>' : '<span class="note">add phone</span>'; } },
      SEL('invited', 'Sent?', YN, { w: 70 }), SEL('rsvp', 'RSVP', () => L('RSVP'), { w: 100 })]
      .concat(fcols).concat([SEL('stay', 'Stay?', YN, { w: 70 }), T('room', 'Room', { w: 70 }), SEL('transport', 'Transport?', YN, { w: 90 }), T('travel', 'Travel details', { w: 170 }), T('notes', 'Notes', { w: 170 })])
  });
  const bar = filterBar([
    { type: 'search', ph: 'Search name, family, city, phone…', get: () => f.q, set: v => { f.q = v; g.build(); } },
    { type: 'sel', label: 'Both sides', opts: L('Side'), get: () => f.side, set: v => { f.side = v; g.build(); } },
    { type: 'sel', label: 'Any RSVP', opts: L('RSVP'), get: () => f.rsvp, set: v => { f.rsvp = v; g.build(); } },
    { type: 'sel', label: 'Invite: any', opts: ['Sent', 'Not sent'], get: () => f.inv, set: v => { f.inv = v; g.build(); } },
    { type: 'sel', label: 'Any function', opts: FNS(), get: () => f.fn, set: v => { f.fn = v; g.build(); } },
    { type: 'sel', label: 'Stay / travel', opts: ['Needs stay', 'Needs transport'], get: () => f.stay, set: v => { f.stay = v; g.build(); } }
  ]);
  const add = el('<button class="btn pri">+ Add guest</button>'); add.onclick = () => g.add();
  const msgBtn = el('<button class="btn">✎ ' + (on('templates') ? 'Messages' : 'Invite message') + '</button>');
  msgBtn.onclick = () => { UI.tab.msg = 'invite'; go('setup'); setTimeout(() => { const t = $('#msgbox'); if (t) { t.scrollIntoView({ block: 'center' }); t.focus(); } }, 50); };
  const head = el('<div>' + ph('Guest List & RSVP', 'One row per person. Tap <b>Y</b> under a function to invite, again for <b>C</b> (confirmed) or <b>N</b> (declined). The WhatsApp button sends your invite message and marks it as sent' + (on('templates') ? '; after that it offers reminders and stay details' : '') + '.') + '</div>');
  head.querySelector('.page-h').appendChild(msgBtn); head.querySelector('.page-h').appendChild(add);
  upd();
  return [head.firstChild, kp, chk, bar, g.root];
};

/* ---------- Catering ---------- */
VIEWS.catering = function () {
  const c = S.cat, wrap = el('<div></div>');
  const draw = () => {
    const o = d(), tot = o.fns.reduce((a, f) => a + f.plates, 0), cost = o.fns.reduce((a, f) => a + f.food, 0);
    const sel = UI.tab.cd || '';
    const dietAgg = {}; o.fns.filter(f => !sel || f.f.name === sel).forEach(f => Object.keys(f.diet).forEach(k => { dietAgg[k] = Math.max(dietAgg[k] || 0, 0) + f.diet[k]; }));
    const dm = Math.max.apply(null, Object.values(dietAgg).concat([1]));
    wrap.innerHTML = '<div class="grid g4" style="margin-bottom:12px">' + kpi('Plates to order', tot, 'across ' + o.fns.length + ' functions', 'm') + kpi('Estimated food cost', short(cost), 'at your per-plate rates', 'c') + kpi('Confirmed guests', o.conf, o.await + ' not replied', 't') + kpi('Buffer', Math.round(num(c.buffer) * 100) + '%', 'extra on every count') + '</div>' +
      '<div class="card" style="margin-bottom:14px"><h3>Assumptions</h3><div class="row2">' +
      '<label class="field">Share of “not replied” guests expected to attend (%)<input class="inp" type="number" data-a="share" value="' + Math.round(num(c.share) * 100) + '"></label>' +
      '<label class="field">Child plate as % of an adult plate<input class="inp" type="number" data-a="childPct" value="' + Math.round(num(c.childPct) * 100) + '"></label>' +
      '<label class="field">Extra safety buffer (%)<input class="inp" type="number" data-a="buffer" value="' + Math.round(num(c.buffer) * 100) + '"></label></div><div class="note" style="margin-top:8px">Infants are never counted. Meal type “No meal” sets plates to 0.</div></div>' +
      '<div class="tw"><table class="g"><thead><tr><th>#</th><th>Function</th><th>Date</th><th>Meal type</th><th class="a">Invited</th><th class="a">Confirmed</th><th class="a">Not replied</th><th>Cost / plate (₹)</th><th class="a">Plates to order</th><th class="a">Est. food cost</th></tr></thead><tbody>' +
      o.fns.map((r, i) => '<tr><td class="idx">' + (i + 1) + '</td><td class="c">' + esc(r.f.name) + '</td><td class="c">' + dshow(r.f.date) + '</td><td><select data-m="' + esc(r.f.name) + '">' + L('Meal Type').map(m => '<option' + (m === r.meal ? ' selected' : '') + '>' + m + '</option>').join('') + '</select></td><td class="c num">' + r.inv + '</td><td class="c num">' + r.conf + '</td><td class="c num">' + r.pend + '</td><td><input type="number" data-p="' + esc(r.f.name) + '" value="' + r.costPer + '"></td><td class="c num"><b>' + r.plates + '</b></td><td class="c num">' + inr(r.food) + '</td></tr>').join('') +
      '<tr><td></td><td class="c"><b>Total</b></td><td class="c"></td><td class="c"></td><td class="c"></td><td class="c"></td><td class="c"></td><td class="c"></td><td class="c num"><b>' + tot + '</b></td><td class="c num"><b>' + inr(cost) + '</b></td></tr></tbody></table></div>' +
      '<div class="card" style="margin-top:14px"><h3>Diet split <small>expected guests</small></h3><div class="bar"><select class="sel" data-ds><option value="">All functions (peak)</option>' + o.fns.map(f => '<option' + (f.f.name === sel ? ' selected' : '') + '>' + esc(f.f.name) + '</option>').join('') + '</select></div>' +
      (Object.keys(dietAgg).length ? Object.keys(dietAgg).map(k => hbar(k, [{ v: dietAgg[k], c: '#1F7A74' }], dm, dietAgg[k])).join('') : '<div class="empty">Invite guests to a function to see the diet split.</div>') + '</div>';
    stackify(wrap);
    if (RO()) $$('input,select', wrap).forEach(x => { if (!x.hasAttribute('data-ds')) x.disabled = true; });
  };
  wrap.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.a) { c[t.dataset.a] = num(t.value) / 100; }
    else if (t.dataset.m) { c.perFn[t.dataset.m] = Object.assign({ cost: 0 }, c.perFn[t.dataset.m], { meal: t.value }); }
    else if (t.dataset.p) { c.perFn[t.dataset.p] = Object.assign({ meal: 'Dinner' }, c.perFn[t.dataset.p], { cost: num(t.value) }); }
    else if (t.hasAttribute('data-ds')) { UI.tab.cd = t.value; }
    dirty(); draw();
  });
  draw();
  return [el('<div>' + ph('Catering & Plates', 'Plates are estimated per function from confirmed and expected guests, with a safety buffer.') + '</div>').firstChild, wrap];
};
