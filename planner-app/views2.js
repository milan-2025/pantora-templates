/* ---------- Stay (hotels) ---------- */
function stayDates() {
  const ds = S.functions.filter(f => f.date && f.active !== 'No').map(f => f.date).sort();
  if (!ds.length) return { in: '', out: '' };
  return { in: fd(addDays(pd(ds[0]), -1)), out: fd(addDays(pd(ds[ds.length - 1]), 1)) };
}
function tabHost(key, list, def, draw) {
  const root = el('<div></div>');
  const paint = () => { root.innerHTML = ''; root.appendChild(tabs(list, UI.tab[key] || def, t => { UI.tab[key] = t; paint(); })); const c = draw(UI.tab[key] || def); (Array.isArray(c) ? c : [c]).forEach(x => root.appendChild(x)); };
  paint(); return root;
}
VIEWS.stay = function () {
  const head = el('<div>' + ph('Hotels & Rooms', 'List your hotels and room types, then give each family a room. Guests who need a stay appear automatically.') + '</div>').firstChild;
  const host = tabHost('stay', [['alloc', 'Room allocation'], ['hotels', 'Hotels & inventory'], ['list', 'Rooming list']], 'alloc', tab => {
    if (tab === 'hotels') {
      const g = grid({ coll: 'hotels', empty: 'Add the hotels you are considering and their room types.', full: ['hotel', 'type'], blank: () => ({ hotel: '', type: 'Standard Room', rooms: 1, pax: 2, rate: 0 }),
        cols: [T('hotel', 'Hotel / venue', { w: 200, list: 'dl-vendors' }), SEL('type', 'Room type', () => L('Room Type'), { w: 130 }), NUM('rooms', 'Rooms available'), NUM('pax', 'Persons / room'), NUM('rate', 'Rate / night (₹)', { w: 110 }),
          CALC('bk', 'Rooms booked', r => d().hotelBooked[d().hotelKey(r)] || 0, { num: 1 }), CALC('rem', 'Remaining', r => num(r.rooms) - (d().hotelBooked[d().hotelKey(r)] || 0), { num: 1 }),
          CALC('st', 'Status', r => { const m = num(r.rooms) - (d().hotelBooked[d().hotelKey(r)] || 0); return m < 0 ? 'Over-booked' : m === 0 ? 'Full' : m <= 2 ? 'Few left' : 'Available'; }, { fmt: statusPill })] });
      const add = el('<button class="btn pri" style="margin:12px 0">+ Add hotel / room type</button>'); add.onclick = () => g.add();
      return [g.root, add];
    }
    if (tab === 'list') {
      const al = r => S.roomAlloc.find(a => a.group === gk(r));
      const hh = r => { const a = al(r); return a && S.hotels.find(h => d().hotelKey(h) === a.hotelType); };
      const g = grid({ coll: 'guests', key: 'rooming', noDel: true, filter: r => r.stay === 'Yes', empty: 'No guest needs a stay yet. Mark “Stay?” = Yes on the Guest List.',
        cols: [CALC('n', 'Guest', r => r.name, { th: '' }), CALC('g', 'Family / group', r => gk(r)), CALC('ag', 'Age', r => r.age), CALC('h', 'Hotel', r => (hh(r) || {}).hotel || ''), CALC('rt', 'Room type', r => (hh(r) || {}).type || ''), CALC('ci', 'Check-in', r => (al(r) || {}).in ? dshow(al(r).in) : ''), CALC('co', 'Check-out', r => (al(r) || {}).out ? dshow(al(r).out) : ''), T('room', 'Room no.', { w: 90 }), CALC('s', 'Status', r => al(r) ? 'Allocated' : 'Awaiting', { fmt: v => pill(v, v === 'Allocated' ? 'ok' : 'warn') })] });
      return [el('<p class="note">Fully automatic from the Guest List and Room Allocation. Type the room number once the hotel confirms. To add or remove guests, use the Guest List.</p>'), g.root];
    }
    const kp = el('<div class="grid g4" style="margin-bottom:12px"></div>'), aw = el('<div class="card" style="margin-bottom:12px"></div>');
    const upd = () => {
      const o = d(); kp.innerHTML = kpi('Guests needing a stay', o.stayNeedN, o.stayNeed.size + ' families / groups') + kpi('Groups allocated', S.roomAlloc.length, o.stayAwait.length + ' awaiting', 't') + kpi('Rooms booked', o.roomsBooked + ' / ' + o.roomsTotal, 'across ' + S.hotels.length + ' room types', 'm') + kpi('Est. stay cost', short(o.roomCost), 'rooms × rate × nights', 'c');
      aw.innerHTML = '<h3>To do: allocate these groups <small>' + o.stayAwait.length + ' waiting</small></h3>' + (o.stayAwait.length ? o.stayAwait.map(x => '<button class="chip" data-alloc="' + esc(x[0]) + '">' + esc(x[0]) + ' · ' + x[1] + ' guest' + (x[1] > 1 ? 's' : '') + ' ＋</button>').join(' ') : '<span class="ok-note">Everyone who needs a stay has a room. ✔</span>');
    };
    const g = grid({ coll: 'roomAlloc', after: () => { upd(); }, empty: 'No allocations yet. Pick a group from the to-do panel above.', blank: () => { const dd = stayDates(); return { group: '', hotelType: '', rooms: 1, in: dd.in, out: dd.out }; },
      cols: [SEL('group', 'Family / group', () => Array.from(new Set(Array.from(d().stayNeed.keys()).concat(S.roomAlloc.map(a => a.group)))).sort(), { w: 160 }),
        SEL('hotelType', 'Hotel & room type', () => S.hotels.map(h => d().hotelKey(h)), { w: 240 }), NUM('rooms', 'Rooms'), DT('in', 'Check-in'), DT('out', 'Check-out'),
        CALC('need', 'Guests', r => d().roomCalc[r.id].need, { num: 1 }), CALC('cap', 'Beds', r => d().roomCalc[r.id].cap, { num: 1 }), CALC('n', 'Nights', r => d().roomCalc[r.id].nights, { num: 1 }), CALC('c', 'Est. cost', r => d().roomCalc[r.id].cost, { fmt: moneyCell, num: 1 }), CALC('s', 'Status', r => d().roomCalc[r.id].status, { fmt: statusPill })] });
    aw.addEventListener('click', e => { const b = e.target.closest('[data-alloc]'); if (!b) return; const dd = stayDates(); g.add({ group: b.dataset.alloc, hotelType: '', rooms: 1, in: dd.in, out: dd.out }); });
    upd();
    return [kp, aw, g.root, el('<p class="note">Cost = rooms × nightly rate × nights. It flows into <b>Budget</b> automatically for lines whose cost source is “Hotels”.</p>')];
  });
  return [head, host];
};

/* ---------- Transport ---------- */
VIEWS.transport = function () {
  const head = el('<div>' + ph('Transport', 'Cabs, tempo travellers and buses for airport and station pickups. Guests who need transport appear automatically.') + '</div>').firstChild;
  const host = tabHost('trans', [['alloc', 'Transport allocation'], ['veh', 'Vehicles & inventory'], ['list', 'Pickup list']], 'alloc', tab => {
    if (tab === 'veh') {
      const g = grid({ coll: 'vehicles', empty: 'Add the cab / bus operators you are considering.', full: ['operator', 'type'], blank: () => ({ operator: '', type: 'Sedan / Car', count: 1, seats: 4, rate: 0 }),
        cols: [T('operator', 'Operator / vendor', { w: 200, list: 'dl-vendors' }), SEL('type', 'Vehicle type', () => L('Vehicle Type'), { w: 140 }), NUM('count', 'Vehicles available'), NUM('seats', 'Seats each'), NUM('rate', 'Rate / trip (₹)', { w: 110 }),
          CALC('bk', 'Booked', r => d().vehBooked[d().vehKey(r)] || 0, { num: 1 }), CALC('rem', 'Remaining', r => num(r.count) - (d().vehBooked[d().vehKey(r)] || 0), { num: 1 }),
          CALC('st', 'Status', r => { const m = num(r.count) - (d().vehBooked[d().vehKey(r)] || 0); return m < 0 ? 'Over-booked' : m === 0 ? 'Full' : m <= 1 ? 'Few left' : 'Available'; }, { fmt: statusPill })] });
      const add = el('<button class="btn pri" style="margin:12px 0">+ Add vehicle</button>'); add.onclick = () => g.add();
      return [g.root, add];
    }
    if (tab === 'list') {
      const al = r => S.transAlloc.find(a => a.group === gk(r));
      const g = grid({ coll: 'guests', key: 'pickups', noDel: true, filter: r => r.transport === 'Yes', empty: 'No guest needs transport yet. Mark “Transport?” = Yes on the Guest List.',
        cols: [CALC('n', 'Guest', r => r.name, { th: '' }), CALC('g', 'Family / group', r => gk(r)), CALC('p', 'Phone', r => r.phone || ''), CALC('c', 'City', r => r.city || ''), CALC('v', 'Vehicle', r => (al(r) || {}).vehicle || ''), CALC('a', 'Arrival', r => al(r) ? [al(r).arrDate ? dshow(al(r).arrDate) : '', al(r).arrTime || '', al(r).arrFrom || ''].filter(Boolean).join(' · ') : ''), CALC('dp', 'Departure', r => al(r) ? [al(r).depDate ? dshow(al(r).depDate) : '', al(r).depTime || '', al(r).depTo || ''].filter(Boolean).join(' · ') : ''), T('travel', 'Flight / train', { w: 170 }), CALC('s', 'Status', r => al(r) ? 'Allocated' : 'Awaiting', { fmt: v => pill(v, v === 'Allocated' ? 'ok' : 'warn') })] });
      return [el('<p class="note">Fully automatic. Share this list with your cab operator.</p>'), g.root];
    }
    const kp = el('<div class="grid g4" style="margin-bottom:12px"></div>'), aw = el('<div class="card" style="margin-bottom:12px"></div>');
    const upd = () => {
      const o = d(); kp.innerHTML = kpi('Guests needing transport', o.trNeedN, o.trNeed.size + ' families / groups') + kpi('Groups allocated', S.transAlloc.length, o.trAwait.length + ' awaiting', 't') + kpi('Vehicles booked', S.transAlloc.reduce((a, x) => a + num(x.count), 0), 'of ' + S.vehicles.reduce((a, x) => a + num(x.count), 0) + ' listed', 'm') + kpi('Est. cost', short(o.trCost), 'vehicles × rate × trips', 'c');
      aw.innerHTML = '<h3>To do: allocate these groups <small>' + o.trAwait.length + ' waiting</small></h3>' + (o.trAwait.length ? o.trAwait.map(x => '<button class="chip" data-alloc="' + esc(x[0]) + '">' + esc(x[0]) + ' · ' + x[1] + ' ＋</button>').join(' ') : '<span class="ok-note">All pickups are arranged. ✔</span>');
    };
    const g = grid({ coll: 'transAlloc', after: upd, empty: 'No transport allocated yet.', blank: () => ({ group: '', vehicle: '', count: 1 }),
      cols: [SEL('group', 'Family / group', () => Array.from(new Set(Array.from(d().trNeed.keys()).concat(S.transAlloc.map(a => a.group)))).sort(), { w: 150 }), SEL('vehicle', 'Operator & vehicle', () => S.vehicles.map(v => d().vehKey(v)), { w: 220 }), NUM('count', 'Vehicles'),
        DT('arrDate', 'Arrival date'), TM('arrTime', 'Arrival time'), T('arrFrom', 'Arrival from (airport / station)', { w: 170 }), DT('depDate', 'Departure date'), TM('depTime', 'Dep. time'), T('depTo', 'Departure to', { w: 150 }),
        CALC('need', 'Guests', r => d().trCalc[r.id].need, { num: 1 }), CALC('cap', 'Seats', r => d().trCalc[r.id].cap, { num: 1 }), CALC('tr', 'Trips', r => d().trCalc[r.id].trips, { num: 1 }), CALC('c', 'Est. cost', r => d().trCalc[r.id].cost, { fmt: moneyCell, num: 1 }), CALC('s', 'Status', r => d().trCalc[r.id].status, { fmt: statusPill })] });
    aw.addEventListener('click', e => { const b = e.target.closest('[data-alloc]'); if (b) g.add({ group: b.dataset.alloc, vehicle: '', count: 1 }); });
    upd();
    return [kp, aw, g.root];
  });
  return [head, host];
};

/* ---------- Budget ---------- */
VIEWS.budget = function () {
  const head = el('<div>' + ph('Budget', 'Set your total once. Pandora splits it by category, tracks what you have committed to selected vendors, and what you have actually paid.') + '</div>').firstChild;
  const host = tabHost('bud', [['track', 'Tracker'], ['plan', 'Planner']], 'track', tab => {
    const o = d();
    if (tab === 'plan') {
      const box = el('<div class="card" style="margin-bottom:14px"><div class="row2" style="align-items:flex-end"><label class="field">Total wedding budget (₹)<input class="inp" id="tb" type="number" style="font-size:22px;width:220px" value="' + (S.totalBudget || '') + '"></label><div id="chk" style="padding-bottom:6px"></div></div></div>');
      const chk = () => { const o2 = d(); const ok = Math.abs(o2.pctSum - 1) < 0.0005; $('#chk', box).innerHTML = !S.totalBudget ? pill('Type your total budget', 'warn') : ok ? pill('✔ Category split adds up to 100%', 'ok') : pill('Category split is ' + Math.round(o2.pctSum * 1000) / 10 + '% (should be 100%)', 'bad'); };
      $('#tb', box).onchange = e => { S.totalBudget = num(e.target.value); dirty(); chk(); cg.refresh(); lg.refresh(); };
      const cg = grid({ coll: 'budgetCats', after: chk, blank: () => ({ name: '', pct: 0 }), empty: 'Add budget categories.',
        onChange: (r, k, old) => { if (k === 'name' && old) { S.budgetLines.forEach(l => { if (l.cat === old) l.cat = r.name; }); } },
        cols: [T('name', 'Category', { w: 220 }), { k: 'pct', label: '% of total', t: 'pct', w: 90 }, CALC('amt', 'Amount', r => { const x = d().cats.find(c => c.c.id === r.id); return x ? x.planned : 0; }, { fmt: moneyCell, num: 1 }), CALC('sub', 'Lines add up to', r => { const x = d().cats.find(c => c.c.id === r.id); return x ? Math.round(x.sub * 100) + '%' : ''; }, { num: 1 }), CALC('ok', 'Check', r => { const x = d().cats.find(c => c.c.id === r.id); return !x || !x.lines ? 'No lines' : Math.abs(x.sub - 1) < 0.0005 ? 'OK' : 'Lines ≠ 100%'; }, { fmt: v => pill(v, v === 'OK' ? 'ok' : 'warn') })] });
      const lg = grid({ coll: 'budgetLines', limit: 200, blank: () => ({ cat: '', line: '', pctCat: 0, source: 'Vendors' }), empty: 'Add budget lines under each category.',
        onChange: (r, k, old) => { if (k === 'line' && old) { S.vendors.forEach(v => { if (v.line === old) v.line = r.line; }); S.payments.forEach(p => { if (p.line === old) p.line = r.line; }); } },
        cols: [SEL('cat', 'Category', () => S.budgetCats.map(c => c.name), { w: 200 }), T('line', 'Budget line', { w: 240 }), { k: 'pctCat', label: '% of category', t: 'pct', w: 100 }, CALC('pl', 'Planned amount', r => d().lineCalc[r.id].planned, { fmt: moneyCell, num: 1 }), SEL('source', 'Cost source', () => L('Cost Source'), { w: 110 }), T('notes', 'Notes', { w: 220 })] });
      const a1 = el('<button class="btn pri" style="margin:12px 8px 12px 0">+ Add category</button>'); a1.onclick = () => cg.add();
      const a2 = el('<button class="btn pri" style="margin:12px 0">+ Add budget line</button>'); a2.onclick = () => lg.add();
      chk();
      return [box, el('<h3 style="margin:6px 0 8px">1. Budget by category</h3>'), cg.root, a1, el('<h3 style="margin:6px 0 8px">2. Detailed breakdown <small class="note">sub-lines of each category</small></h3>'), lg.root, a2];
    }
    /* tracker */
    const bal = o.committed - o.paid;
    const kp = el('<div class="grid g4" style="margin-bottom:14px">' + kpi('Total budget', short(o.total), o.total ? 'planned ' + short(o.planned) : 'set it in Planner') + kpi('Committed', short(o.committed), pct(o.committed, o.total) + '% of budget', 'm') + kpi('Paid so far', short(o.paid), pct(o.paid, o.committed) + '% of committed', 't') + kpi('Balance to pay', short(bal), 'committed − paid', 'c') + '</div>');
    const mx = Math.max.apply(null, o.cats.map(x => Math.max(x.planned, x.committed)).concat([1]));
    const tbl = '<div class="tw" style="margin-bottom:14px"><table class="g"><thead><tr><th>Category</th><th>Planned</th><th>Committed</th><th>Paid</th><th>Balance to pay</th><th>Under / (over)</th><th>% committed</th><th>Status</th></tr></thead><tbody>' +
      o.cats.map(x => '<tr><td class="c">' + esc(x.c.name) + '</td><td class="c num">' + inr(x.planned) + '</td><td class="c num">' + inr(x.committed) + '</td><td class="c num">' + inr(x.paid) + '</td><td class="c num">' + inr(x.committed - x.paid) + '</td><td class="c num" style="color:' + (x.planned - x.committed < 0 ? '#E0675A' : 'inherit') + '">' + inr(x.planned - x.committed) + '</td><td class="c num">' + (x.planned ? pct(x.committed, x.planned) + '%' : '') + '</td><td class="c">' + statusPill(o.catStatus(x)) + '</td></tr>').join('') +
      '<tr><td class="c"><b>Total</b></td><td class="c num"><b>' + inr(o.planned) + '</b></td><td class="c num"><b>' + inr(o.committed) + '</b></td><td class="c num"><b>' + inr(o.paid) + '</b></td><td class="c num"><b>' + inr(bal) + '</b></td><td class="c num"><b>' + inr(o.planned - o.committed) + '</b></td><td class="c num"><b>' + (o.planned ? pct(o.committed, o.planned) + '%' : '') + '</b></td><td class="c"></td></tr></tbody></table></div>';
    const bars = '<div class="card"><h3>Planned vs committed vs paid</h3>' + o.cats.map(x => hbar(x.c.name, [{ v: x.planned, c: '#EADFC9' }, { v: x.committed, c: o.catStatus(x) === 'Over budget' ? '#E0675A' : '#1F7A74' }, { v: x.paid, c: '#F2A93B', top: 1 }], mx, short(x.committed) + ' / ' + short(x.planned))).join('') + '<div class="legend"><span><i style="background:#EADFC9"></i>Planned</span><span><i style="background:#1F7A74"></i>Committed</span><span><i style="background:#F2A93B"></i>Paid</span></div></div>';
    const who = ['Bride Family', 'Groom Family', 'Shared'].map(w => ({ w, v: S.payments.filter(p => p.status === 'Paid' && (p.by || '') === w).reduce((a, p) => a + num(p.amount), 0) }));
    const unspec = S.payments.filter(p => p.status === 'Paid' && !p.by).reduce((a, p) => a + num(p.amount), 0);
    if (unspec) who.push({ w: 'Not specified', v: unspec });
    const wm = Math.max.apply(null, who.map(x => x.v).concat([1]));
    const fam = '<div class="card"><h3>Paid so far, by family</h3>' + who.map(x => hbar(x.w, [{ v: x.v, c: x.w === 'Bride Family' ? '#E0675A' : x.w === 'Groom Family' ? '#1F7A74' : '#F2A93B' }], wm, inr(x.v) + ' · ' + pct(x.v, o.paid) + '%')).join('') + '</div>';
    const f = UI.f.bl = UI.f.bl || { cat: '' };
    const lines = el('<div></div>');
    const drawL = () => { lines.innerHTML = '<div class="bar" style="margin-top:14px"><h3 style="margin-right:8px">Budget line detail</h3><select class="sel" data-free><option value="">All categories</option>' + S.budgetCats.map(c => '<option' + (c.name === f.cat ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></div><div class="tw"><table class="g"><thead><tr><th>Category</th><th>Budget line</th><th>Planned</th><th>Committed</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>' +
      S.budgetLines.filter(l => !f.cat || l.cat === f.cat).map(l => { const c = o.lineCalc[l.id]; const st = !c.planned ? '' : !c.committed ? 'Not started' : c.committed > c.planned ? 'Over budget' : 'On track'; return '<tr><td class="c">' + esc(l.cat) + '</td><td class="c">' + esc(l.line) + '</td><td class="c num">' + inr(c.planned) + '</td><td class="c num">' + inr(c.committed) + '</td><td class="c num">' + inr(c.paid) + '</td><td class="c num">' + inr(c.committed - c.paid) + '</td><td class="c">' + statusPill(st) + '</td></tr>'; }).join('') + '</tbody></table></div>'; $('select', lines).onchange = e => { f.cat = e.target.value; drawL(); }; stackify(lines); };
    drawL();
    const two = el('<div class="grid g2" style="margin-bottom:0"></div>'); two.innerHTML = bars + fam;
    return [kp, stackify(el(tbl)), two, lines];
  });
  return [head, host];
};

/* ---------- Vendors ---------- */
VIEWS.vendors = function () {
  const head = el('<div>' + ph('Vendors', 'Log every quote, compare vendors for the same job side by side, and pick one. Your pick flows into Budget as “committed”.') + '</div>').firstChild;
  const host = tabHost('ven', [['list', 'All quotes'], ['cmp', 'Compare']], 'list', tab => {
    if (tab === 'cmp') {
      const f = UI.f.vc = UI.f.vc || { line: '' };
      const lines = Array.from(new Set(S.vendors.map(v => v.line).filter(Boolean)));
      if (!f.line || lines.indexOf(f.line) < 0) f.line = lines[0] || '';
      const box = el('<div></div>');
      const draw = () => {
        const o = d(), vs = S.vendors.filter(v => v.line === f.line);
        const effs = vs.map(v => o.vCalc[v.id].eff).filter(x => x > 0), avg = effs.length ? effs.reduce((a, b) => a + b, 0) / effs.length : 0;
        const bl = S.budgetLines.find(l => l.line === f.line), planned = bl ? o.lineCalc[bl.id].planned : 0, sel = vs.find(v => v.decision === 'Selected');
        box.innerHTML = '<div class="bar"><select class="sel" style="min-width:260px">' + lines.map(l => '<option' + (l === f.line ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select></div>' +
          (vs.length ? '<div class="grid g4" style="margin-bottom:14px">' + kpi('Quotes received', vs.length, bl ? esc(bl.cat) : '') + kpi('Lowest price', effs.length ? short(Math.min.apply(null, effs)) : '–', 'average ' + short(avg), 't') + kpi('Planned budget', short(planned), 'for this line', 'm') + kpi('Selected', sel ? esc(sel.vendor) : 'None yet', sel && planned ? pctCell(o.vCalc[sel.id].eff / planned - 1) + ' vs plan' : 'pick one below', 'c') + '</div>' +
          '<div class="grid g3">' + vs.map(v => { const c = o.vCalc[v.id]; return '<div class="vc ' + (v.decision === 'Selected' ? 'sel' : '') + (c.low ? ' low' : '') + '"><div class="p">' + inr(c.eff) + '</div>' + (num(v.negotiated) && num(v.quoted) ? '<div class="note"><s>' + inr(v.quoted) + '</s> quoted · negotiated</div>' : '<div class="note">quoted price</div>') + '<h3 style="margin:8px 0 2px">' + esc(v.vendor) + '</h3><div class="note">' + esc(v.contact || '') + (v.phone ? ' · <a href="tel:' + esc(v.phone.replace(/\s/g, '')) + '">' + esc(v.phone) + '</a>' : '') + '</div><div style="margin:6px 0">' + '★'.repeat(num(v.rating)) + '<span style="color:#EADFC9">' + '★'.repeat(5 - num(v.rating)) + '</span> ' + pill(v.decision || 'Considering', v.decision === 'Selected' ? 'ok' : v.decision === 'Rejected' ? 'bad' : 'info') + '</div><div class="note" style="min-height:36px">' + esc(v.notes || '') + '</div><div class="note" style="margin:6px 0">' + (c.vsAvg != null ? pctCell(c.vsAvg) + ' vs average' : '') + (c.vsPlan != null ? ' · ' + pctCell(c.vsPlan) + ' vs plan' : '') + '</div>' + (v.decision === 'Selected' ? '<button class="btn sm" data-set="Considering" data-id="' + v.id + '">Unselect</button>' : '<button class="btn pri sm" data-set="Selected" data-id="' + v.id + '">Select this vendor</button> <button class="btn sm ghost" data-set="Rejected" data-id="' + v.id + '">Reject</button>') + '</div>'; }).join('') + '</div>' : '<div class="empty">No quotes for this line yet. Add them in “All quotes”.</div>');
        const s = $('select', box); if (s) s.onchange = () => { f.line = s.value; draw(); };
        $$('[data-set]', box).forEach(b => b.onclick = () => { const v = S.vendors.find(x => x.id === b.dataset.id); if (b.dataset.set === 'Selected') S.vendors.forEach(x => { if (x.line === v.line && x.decision === 'Selected') x.decision = 'Considering'; }); v.decision = b.dataset.set; dirty(); badges(); draw(); });
      };
      draw(); return [box];
    }
    const g = grid({ coll: 'vendors', limit: 300, title: r => r.vendor || 'New quote', sub: r => [r.line, d().vCalc[r.id] && d().vCalc[r.id].eff ? inr(d().vCalc[r.id].eff) : '', r.decision].filter(Boolean).join(' · '), empty: 'No quotes yet. Add your first vendor quote.', blank: () => ({ line: '', vendor: '', decision: 'Considering', contract: 'No' }),
      cols: [SEL('line', 'Budget line', LINES, { w: 190 }), T('vendor', 'Vendor / company', { w: 170 }), T('contact', 'Contact', { w: 110 }), T('phone', 'Phone', { w: 110 }), NUM('quoted', 'Quoted (₹)', { w: 100 }), NUM('negotiated', 'Negotiated (₹)', { w: 100 }), { k: 'rating', label: 'Rating', t: 'rating', w: 60 }, SEL('decision', 'Decision', () => L('Vendor Decision'), { w: 110 }), SEL('contract', 'Contract?', YN, { w: 80 }), T('notes', 'What is included / notes', { w: 220 }),
        CALC('eff', 'Effective price', r => d().vCalc[r.id].eff, { fmt: moneyCell, num: 1 }), CALC('rk', 'Rank', r => d().vCalc[r.id].rank, { num: 1 }), CALC('va', 'vs line avg', r => d().vCalc[r.id].vsAvg, { fmt: pctCell, num: 1 }), CALC('vp', 'vs plan', r => d().vCalc[r.id].vsPlan, { fmt: pctCell, num: 1 }), CALC('pd', 'Paid', r => d().vCalc[r.id].decision === 'x' ? '' : (r.decision === 'Selected' ? d().vCalc[r.id].paid : ''), { fmt: moneyCell, num: 1 }), CALC('bl', 'Balance', r => d().vCalc[r.id].bal, { fmt: moneyCell, num: 1 }), CALC('ps', 'Payment', r => d().vCalc[r.id].st, { fmt: statusPill })] });
    const add = el('<button class="btn pri" style="margin:12px 0">+ Add vendor quote</button>'); add.onclick = () => g.add();
    return [g.root, add];
  });
  return [head, host];
};

/* ---------- Payments ---------- */
VIEWS.payments = function () {
  UI.f.p = UI.f.p || { st: 'Pending', line: '', q: '' };
  const f = UI.f.p, kp = el('<div class="grid g4" style="margin-bottom:12px"></div>');
  const upd = () => { const o = d(); kp.innerHTML = kpi('Scheduled', short(o.payPaid + o.payPending), S.payments.length + ' payments') + kpi('Paid', short(o.payPaid), S.payments.filter(p => p.status === 'Paid').length + ' done', 't') + kpi('Pending', short(o.payPending), S.payments.filter(p => p.status !== 'Paid').length + ' to go', 'm') + kpi('Overdue', o.payOver.length, short(o.payOver.reduce((a, p) => a + num(p.amount), 0)), 'c'); };
  const g = grid({
    coll: 'payments', after: upd, limit: 300, title: r => r.payee || r.line || 'New payment', sub: r => [r.amount ? inr(r.amount) : '', r.desc, r.due ? 'due ' + dshow(r.due) : '', r.status === 'Paid' ? 'paid' : ''].filter(Boolean).join(' · '), empty: 'No payments match. Add advances and instalments as vendors agree them.',
    blank: () => ({ line: f.line, payee: '', desc: 'Advance', amount: '', status: 'Pending', mode: 'Bank Transfer', by: 'Bride Family' }),
    onChange: (r, k) => { if (k === 'status') { if (r.status === 'Paid' && !r.paid) r.paid = fd(today()); if (r.status !== 'Paid') r.paid = ''; } if (k === 'paid' && r.paid && r.status !== 'Paid') r.status = 'Paid'; }, full: ['status', 'paid'],
    sort: (a, b) => (a.due || '9') < (b.due || '9') ? -1 : 1,
    filter: p => { const c = d().payCalc[p.id]; return (!f.st || f.st === 'All' || (f.st === 'Pending' && !c.paid) || (f.st === 'Paid' && c.paid) || (f.st === 'Overdue' && c.st === 'Overdue') || (f.st === 'Due soon' && !c.paid && c.dd != null && c.dd >= 0 && c.dd <= 14)) && (!f.line || p.line === f.line) && matchQ(p, ['payee', 'desc', 'notes', 'line'], f.q); },
    act: { paid: r => { r.status = 'Paid'; r.paid = fd(today()); } },
    cols: [SEL('line', 'Budget line', LINES, { w: 190 }), T('payee', 'Payee', { w: 160, list: 'dl-vendors' }), SEL('desc', 'Type', () => L('Payment Type'), { w: 120 }), DT('due', 'Due date'), NUM('amount', 'Amount (₹)', { w: 110 }), DT('paid', 'Paid on'), SEL('status', 'Status', () => L('Payment Status'), { w: 100 }), SEL('mode', 'Mode', () => L('Payment Mode'), { w: 130 }), SEL('by', 'Paid by', () => L('Paid By'), { w: 120 }), T('notes', 'Notes', { w: 160 }),
      CALC('ds', 'Due status', r => d().payCalc[r.id].st, { fmt: statusPill }), CALC('dd', 'Days to due', r => { const c = d().payCalc[r.id]; return c.paid || c.dd == null ? '' : c.dd; }, { num: 1 }),
      { k: 'mp', label: '', t: 'html', th: 'a', html: r => r.status === 'Paid' ? '' : '<button class="btn sm" data-act="paid">Mark paid</button>' }]
  });
  const bar = filterBar([{ type: 'search', get: () => f.q, set: v => { f.q = v; g.build(); } }, { type: 'chips', opts: ['Pending', 'Overdue', 'Due soon', 'Paid', 'All'], get: () => f.st, set: v => { f.st = v; g.build(); } }, { type: 'sel', label: 'All budget lines', opts: LINES(), get: () => f.line, set: v => { f.line = v; g.build(); } }]);
  const add = el('<button class="btn pri">+ Add payment</button>'); add.onclick = () => { f.st = 'All'; g.add(); };
  const head = el('<div>' + ph('Payments', 'Every advance and instalment, with due dates and alerts. Paid amounts flow into Budget and Vendors automatically.') + '</div>'); head.querySelector('.page-h').appendChild(add);
  upd(); return [head.firstChild, kp, bar, g.root];
};

/* ---------- Shagun / Milni / Shopping ---------- */
VIEWS.shagun = function () {
  UI.f.s = UI.f.s || { q: '', dir: '' };
  const f = UI.f.s, kp = el('<div class="grid g4" style="margin-bottom:12px"></div>'), sm = el('<div class="card" style="margin-top:14px"></div>');
  const upd = () => {
    const o = d(); kp.innerHTML = kpi('Received', short(o.shRecv), S.shagun.filter(x => x.dir === 'Received').length + ' entries', 't') + kpi('Given', short(o.shGiven), S.shagun.filter(x => x.dir === 'Given').length + ' entries', 'c') + kpi('Thank-yous to send', o.thanksPending, 'for gifts received', 'm') + kpi('Returns pending', o.returnsPending, 'len-den to reciprocate');
    const by = FNS().map(n => ({ n, r: S.shagun.filter(x => x.fn === n && x.dir === 'Received').reduce((a, x) => a + num(x.amount), 0), g: S.shagun.filter(x => x.fn === n && x.dir === 'Given').reduce((a, x) => a + num(x.amount), 0) })).filter(x => x.r || x.g);
    const mx = Math.max.apply(null, by.map(x => Math.max(x.r, x.g)).concat([1]));
    sm.innerHTML = '<h3>Totals by function</h3>' + (by.length ? by.map(x => hbar(x.n, [{ v: x.r, c: '#1F7A74' }, { v: x.g, c: '#E0675A', top: 1 }], mx, inr(x.r) + ' in · ' + inr(x.g) + ' out')).join('') + '<div class="legend"><span><i style="background:#1F7A74"></i>Received</span><span><i style="background:#E0675A"></i>Given</span></div>' : '<div class="empty">Record shagun and gifts to see totals here.</div>');
  };
  const g = grid({ coll: 'shagun', after: upd, limit: 300, empty: 'No entries yet. Record each shagun or gift as it comes in.',
    blank: () => ({ date: fd(today()), dir: 'Received', mode: 'Cash', ret: 'No', retStatus: 'Not needed', thanks: 'No' }),
    filter: r => (!f.dir || r.dir === f.dir) && matchQ(r, ['name', 'group', 'relation', 'gift', 'notes'], f.q),
    cols: [DT('date', 'Date'), SEL('fn', 'Function', FNS, { w: 130 }), SEL('dir', 'Direction', () => L('Direction'), { w: 100 }), T('name', 'Name', { w: 150 }), T('group', 'Family / group', { w: 130, list: 'dl-groups' }), SEL('side', 'Side', () => L('Side'), { w: 100 }), T('relation', 'Relation', { w: 100 }), SEL('mode', 'Mode', () => L('Gift Mode'), { w: 110 }), NUM('amount', 'Amount (₹)', { w: 100 }), T('gift', 'Gift / item', { w: 140 }), SEL('ret', 'Return?', YN, { w: 70 }), SEL('retStatus', 'Return status', () => L('Return Status'), { w: 110 }), SEL('thanks', 'Thanked?', YN, { w: 80 }), T('notes', 'Notes', { w: 140 }),
      CALC('act', 'Action', r => r.dir === 'Received' && r.thanks !== 'Yes' ? 'Send thank-you' : r.ret === 'Yes' && r.retStatus !== 'Done' ? 'Return pending' : 'OK', { fmt: v => pill(v, v === 'OK' ? 'ok' : 'warn') })] });
  const bar = filterBar([{ type: 'search', get: () => f.q, set: v => { f.q = v; g.build(); } }, { type: 'sel', label: 'Received & given', opts: ['Received', 'Given'], get: () => f.dir, set: v => { f.dir = v; g.build(); } }]);
  const add = el('<button class="btn pri">+ Add entry</button>'); add.onclick = () => g.add();
  const head = el('<div>' + ph('Shagun & Len-Den Register', 'Record every shagun and gift received or given, so thank-yous and returns are never missed.') + '</div>'); head.querySelector('.page-h').appendChild(add);
  upd(); return [head.firstChild, kp, bar, g.root, sm];
};
VIEWS.milni = function () {
  const kp = el('<div class="note" style="margin-bottom:10px"></div>'), upd = () => { const n = S.milni.length, dn = S.milni.filter(x => x.done === 'Yes').length; kp.innerHTML = '<b>' + n + '</b> milni pairs · <b>' + dn + '</b> done · total shagun planned <b>' + inr(S.milni.reduce((a, x) => a + num(x.amount), 0)) + '</b>'; };
  const g = grid({ coll: 'milni', after: upd, empty: 'No pairs yet.', blank: () => ({ pair: '', done: 'No' }), cols: [T('pair', 'Milni pair (relation)', { w: 260 }), T('bride', 'Bride side (name)', { w: 160 }), T('groom', 'Groom side (name)', { w: 160 }), T('gift', 'Gift / item', { w: 180 }), NUM('amount', 'Shagun (₹)', { w: 100 }), SEL('by', 'Given by', () => L('Paid By'), { w: 120 }), SEL('done', 'Done?', YN, { w: 80 }), T('notes', 'Notes', { w: 160 })] });
  const add = el('<button class="btn pri">+ Add pair</button>'); add.onclick = () => g.add();
  const head = el('<div>' + ph('Milni List', 'Who meets whom at the baraat, with gifts and shagun planned for each pair.') + '</div>'); head.querySelector('.page-h').appendChild(add);
  upd(); return [head.firstChild, kp, g.root];
};
VIEWS.shopping = function () {
  const kp = el('<div class="grid g4" style="margin-bottom:12px"></div>'), sm = el('<div class="card" style="margin-top:14px"></div>');
  const upd = () => {
    const pl = S.shagun ? S.shopping.reduce((a, x) => a + num(x.planned), 0) : 0, ac = S.shopping.reduce((a, x) => a + num(x.actual), 0), bought = S.shopping.filter(x => ['Bought', 'Packed', 'Delivered', 'In alteration'].indexOf(x.status) >= 0).length;
    kp.innerHTML = kpi('Items', S.shopping.length, bought + ' bought / in hand') + kpi('Planned', short(pl), 'total plan', 'm') + kpi('Actual spend', short(ac), 'so far', 't') + kpi('Under / (over)', short(S.shopping.filter(x => num(x.actual)).reduce((a, x) => a + num(x.planned) - num(x.actual), 0)), 'on items bought', 'c');
    const types = L('Shopping Type').map(t => ({ t, n: S.shopping.filter(x => x.type === t).length, p: S.shopping.filter(x => x.type === t).reduce((a, x) => a + num(x.planned), 0), a: S.shopping.filter(x => x.type === t).reduce((a, x) => a + num(x.actual), 0) })).filter(x => x.n);
    const mx = Math.max.apply(null, types.map(x => Math.max(x.p, x.a)).concat([1]));
    sm.innerHTML = '<h3>Summary by type</h3>' + (types.length ? types.map(x => hbar(x.t + ' (' + x.n + ')', [{ v: x.p, c: '#EADFC9' }, { v: x.a, c: '#1F7A74', top: 1 }], mx, short(x.a) + ' / ' + short(x.p))).join('') : '<div class="empty">Add outfits, jewellery and gifts to see a summary.</div>');
  };
  const g = grid({ coll: 'shopping', after: upd, empty: 'No items yet. Add outfits, jewellery, gifts and trousseau.', blank: () => ({ item: '', type: 'Outfit', status: 'To buy', qty: 1 }),
    cols: [T('item', 'Item', { w: 220 }), SEL('type', 'Type', () => L('Shopping Type'), { w: 110 }), SEL('who', 'For whom', TEAM, { w: 150 }), SEL('fn', 'Function', FNS, { w: 130 }), NUM('planned', 'Planned (₹)', { w: 100 }), NUM('actual', 'Actual (₹)', { w: 100 }), NUM('qty', 'Qty', { w: 60 }), SEL('status', 'Status', () => L('Shopping Status'), { w: 120 }), T('shop', 'Shop / source', { w: 140 }), T('box', 'Trunk / box #', { w: 90 }), T('notes', 'Notes', { w: 140 }),
      CALC('ud', 'Under / (over)', r => num(r.actual) ? num(r.planned) - num(r.actual) : '', { fmt: v => v === '' ? '' : '<span style="color:' + (v < 0 ? '#E0675A' : 'inherit') + '">' + inr(v) + '</span>', num: 1 })] });
  const add = el('<button class="btn pri">+ Add item</button>'); add.onclick = () => g.add();
  const head = el('<div>' + ph('Shopping, Outfits & Gifts', 'One row per item: outfits, jewellery, family gifts, trousseau, return gifts and puja items.') + '</div>'); head.querySelector('.page-h').appendChild(add);
  upd(); return [head.firstChild, kp, g.root, sm];
};

/* ---------- Family handout (print) ---------- */
VIEWS.print = function () {
  const o = d(), s = S.settings;
  const fns = S.functions.filter(f => f.name && f.active !== 'No').sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : 1);
  const hotels = Array.from(new Set(S.roomAlloc.map(a => (S.hotels.find(h => o.hotelKey(h) === a.hotelType) || {}).hotel).filter(Boolean)));
  const sel = S.vendors.filter(v => v.decision === 'Selected');
  const sheet = el('<div class="print-sheet"><h1>' + esc(names()) + '</h1><div class="d">' + esc(s.date ? dlong(s.date) : '') + (s.city ? ' · ' + esc(s.city) : '') + '</div>' +
    '<h3>Functions</h3><table><tr><th>Function</th><th>Date</th><th>Time</th><th>Venue</th><th>Dress code / theme</th></tr>' + (fns.map(f => '<tr><td><b>' + esc(f.name) + '</b></td><td>' + esc(dshow(f.date)) + '</td><td>' + esc(f.time || '') + '</td><td>' + esc(f.venue || '') + '</td><td>' + esc(f.dress || '') + '</td></tr>').join('') || '<tr><td colspan="5">Add functions in the Functions page.</td></tr>') + '</table>' +
    (hotels.length ? '<h3>Where to stay</h3><table><tr><th>Hotel</th><th>Room types</th></tr>' + hotels.map(h => '<tr><td><b>' + esc(h) + '</b></td><td>' + esc(S.hotels.filter(x => x.hotel === h).map(x => x.type).join(', ')) + '</td></tr>').join('') + '</table>' : '') +
    (sel.length ? '<h3>Key contacts</h3><table><tr><th>Role</th><th>Vendor</th><th>Contact</th><th>Phone</th></tr>' + sel.map(v => '<tr><td>' + esc(v.line) + '</td><td><b>' + esc(v.vendor) + '</b></td><td>' + esc(v.contact || '') + '</td><td>' + esc(v.phone || '') + '</td></tr>').join('') + '</table>' : '') +
    '<div class="note" style="text-align:center;margin-top:20px">Planned with Pandora Templates · pandoratemplates.com</div></div>');
  const btn = el('<button class="btn pri">🖨️ Print / Save as PDF</button>'); btn.onclick = () => window.print();
  const head = el('<div>' + ph('Family Handout', 'A clean one-page summary to print or save as PDF and share with family: functions, stay and key contacts.') + '</div>'); head.querySelector('.page-h').appendChild(btn);
  return [head.firstChild, sheet];
};

/* ---------- Setup & data ---------- */
function replaced(note) { if (CLOUD.on) { CLOUD.forceReplace = true; CLOUD.replaceNote = note; } dirty(); save(); }
VIEWS.setup = function () {
  const s = S.settings;
  const box = el('<div class="grid g2"></div>');
  const couple = el('<div class="card"><h3>Your wedding</h3><div class="grid g2" style="gap:10px">' +
    ['bride|Bride’s name|text', 'groom|Groom’s name|text', 'date|Wedding date|date', 'city|Wedding city|text', 'start|Planning start date|date'].map(x => { const p = x.split('|'); return '<label class="field">' + p[1] + '<input class="inp" type="' + p[2] + '" data-s="' + p[0] + '" value="' + esc(s[p[0]] || '') + '"></label>'; }).join('') +
    '</div><div class="note" style="margin-top:10px">The planning start date is the day you began. Task deadlines are spread between that day and the wedding.</div></div>');
  couple.addEventListener('change', e => { const k = e.target.dataset.s; if (!k) return; S.settings[k] = e.target.value; if (S.demo) { /* keep demo flag until user chooses */ } dirty(); badges(); });
  const team = el('<div class="card"><h3>Family & team</h3><p class="note" style="margin-top:0">One person per line. These names appear in the “Assigned to” dropdowns.</p><textarea class="inp" id="teambox" style="min-height:150px">' + esc(TEAM().join('\n')) + '</textarea></div>');
  team.querySelector('textarea').onchange = e => { S.team = e.target.value.split('\n').map(x => x.trim()).filter(Boolean); dirty(); toast('Team list saved'); };
  box.appendChild(couple); box.appendChild(team);
  const msg = el('<div class="card" style="margin-top:14px"><h3>WhatsApp invitation message</h3><p class="note" style="margin-top:0">Used by the WhatsApp button on the Guest List. Placeholders: <code>{name}</code> <code>{bride}</code> <code>{groom}</code> <code>{date}</code> <code>{city}</code></p><textarea class="inp" id="msgbox" style="min-height:130px">' + esc(S.msg) + '</textarea></div>');
  msg.querySelector('textarea').onchange = e => { S.msg = e.target.value; dirty(); toast('Message saved'); };
  const data = el('<div class="card" style="margin-top:14px"><h3>Your data</h3><p class="note" style="margin-top:0">Everything is saved automatically in this browser. Export a copy now and then to keep it safe, or to move to another device.</p><div class="bar">' +
    '<button class="btn dark" data-x="xlsx">⬇ Export to Excel</button><button class="btn" data-x="json">⬇ Backup (JSON)</button><label class="btn pri" style="cursor:pointer">⬆ Import Excel or backup<input type="file" id="imp" accept=".xlsx,.xls,.json" style="display:none"></label></div>' +
    '<div class="note">Import reads the <b>Pandora Indian Wedding Planner v0.3</b> Excel (your Guests, Vendors, Payments, Tasks and all other input sheets), or a backup file from here.</div>' +
    '<hr style="border:0;border-top:1px dashed #EADFC9;margin:14px 0"><div class="bar"><button class="btn" data-x="fresh">Start a fresh plan</button><button class="btn ghost" data-x="demo">Reload sample data</button></div></div>');
  data.addEventListener('click', async e => {
    const x = e.target.dataset.x; if (!x) return;
    if (x === 'xlsx') { try { exportWorkbook(); } catch (err) { toast('Export failed: ' + err.message); } }
    else if (x === 'json') exportJSON();
    else if (x === 'fresh') { if (await ask('Start a fresh plan?', 'This clears the guests, vendors, payments and everything else' + (CLOUD.on ? ' for everyone on this planner (a restore point is saved in Activity)' : '') + '. The task timeline, budget categories and ritual checklist stay as your starting template.', 'Start fresh')) { S = freshState(); replaced('Started a fresh plan'); toast('Fresh plan ready. Add your wedding details.'); renderAll(); } }
    else if (x === 'demo') { if (await ask('Reload the sample data?', 'This replaces your current plan with the Ananya & Arjun sample' + (CLOUD.on ? ' for everyone on this planner (a restore point is saved in Activity)' : '. Export a backup first if you want to keep your work') + '.', 'Replace with sample')) { S = demoState(); if (CLOUD.on) S.demo = false; replaced('Loaded the sample data'); renderAll(); } }
  });
  data.querySelector('#imp').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      let next;
      if (/\.json$/i.test(file.name)) next = normalize(JSON.parse(await file.text()));
      else next = importWorkbook(await file.arrayBuffer());
      if (await ask('Import “' + file.name + '”?', 'This replaces what is in the planner now with the file’s data: ' + next.guests.length + ' guests, ' + next.vendors.length + ' vendor quotes, ' + next.payments.length + ' payments, ' + next.tasks.length + ' tasks.', 'Import')) { S = next; S.demo = false; replaced('Imported “' + file.name + '”'); toast('Imported ✔'); renderAll(); }
    } catch (err) { toast('Could not read that file: ' + err.message); }
    e.target.value = '';
  };
  const tips = el('<div class="card" style="margin-top:14px"><h3>Quick start</h3><ol style="margin:0;padding-left:20px;line-height:1.9"><li>Enter your names, wedding date and city above.</li><li>Open <b>Budget → Planner</b> and type your total budget.</li><li>Add your <b>Guests</b>, tap Y under each function they are invited to, and send invites on WhatsApp.</li><li>Add <b>Hotels</b> and <b>Vehicles</b>; allocate families as they say they are coming.</li><li>Log vendor quotes in <b>Vendors</b>, select your pick, and add its payment schedule in <b>Payments</b>.</li><li>Check the <b>Dashboard</b> every few days. It tells you what needs attention.</li></ol></div>');
  const lists = el('<div class="card" style="margin-top:14px"><h3>Dropdown options</h3><p class="note" style="margin-top:0">Change the choices in any dropdown, e.g. add “Gujarati Thali” to Diet. One option per line.</p><div class="row2" style="align-items:flex-start"><select class="sel" data-ln>' + Object.keys(S.lists).filter(k => k !== 'Selected Vendors (auto)').map(k => '<option>' + esc(k) + '</option>').join('') + '</select><textarea class="inp" data-lv style="flex:1;min-width:220px;min-height:150px"></textarea></div></div>');
  const ln = $('[data-ln]', lists), lv = $('[data-lv]', lists);
  ln.setAttribute('data-free', ''); const fill = () => { lv.value = (S.lists[ln.value] || []).join('\n'); }; fill();
  ln.onchange = fill;
  lv.onchange = () => { const v = lv.value.split('\n').map(x => x.trim()).filter(Boolean); if (!v.length) { toast('Keep at least one option'); fill(); return; } S.lists = Object.assign({}, S.lists, { [ln.value]: v }); dirty(); toast('Options saved'); };
  const head = el('<div>' + ph('Setup & Data', 'Your wedding details, family list, invitation message, dropdown options and your data.') + '</div>').firstChild;
  if (CLOUD.on) $('.note', data).innerHTML = 'Everything is saved to your account automatically and syncs to every device you sign in on. Export a copy to keep offline, or to use in Excel.';
  return [head, box, msg, lists, data, tips];
};

/* ---------- boot ---------- */
function boot() {
  S = load();
  $('#nav').addEventListener('click', e => { const a = e.target.closest('a[data-r]'); if (a) go(a.dataset.r); });
  document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) go(g.dataset.go); });
  $('#burger').onclick = () => $('.side').classList.toggle('open');
  window.addEventListener('hashchange', () => { const r = location.hash.slice(1); if (VIEWS[r] && r !== route) { route = r; renderAll(); } });
  const h = location.hash.slice(1); if (VIEWS[h]) route = h;
  window.addEventListener('beforeunload', e => { save(); if (CLOUD.on && (CLOUD.pushT || CLOUD.inflight) && CLOUD.status !== 'saved') { e.preventDefault(); e.returnValue = ''; } });
  cloudBoot();
}
// Small handle for support and automated tests (browser console: PP.state()).
window.PP = { state: () => S, dirty, renderAll, uid, api, upgradeModal, cloud: CLOUD };
boot();
