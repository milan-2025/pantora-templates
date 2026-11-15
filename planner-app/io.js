/* ---------- Excel import / export (same sheet layout as v0.3) ---------- */
// t: s=text n=number d=date t=time p=percent
const SPEC = [
  { coll: 'functions', sheet: 'Functions', hdr: 5, stop: 'name', cols: [['name',2,'s','Function'],['active',3,'s','Active?'],['date',4,'d','Date'],['time',5,'t','Start Time'],['venue',6,'s','Venue'],['dress',7,'s','Dress Code / Theme']] },
  { coll: 'guests', sheet: 'Guests', hdr: 5, stop: 'name', fnCols: [12, 21], cols: [['name',2,'s','Guest Name'],['group',3,'s','Family / Group'],['side',4,'s','Side'],['cat',5,'s','Category'],['age',6,'s','Age Group'],['city',7,'s','City'],['phone',8,'s','Phone'],['diet',9,'s','Diet'],['invited',10,'s','Invite Sent?'],['rsvp',11,'s','RSVP'],['stay',22,'s','Needs Stay?'],['room',23,'s','Room No.'],['transport',24,'s','Needs Transport?'],['travel',25,'s','Travel Details'],['notes',26,'s','Notes']] },
  { coll: 'hotels', sheet: 'Hotels', hdr: 5, stop: 'hotel', cols: [['hotel',1,'s','Hotel / Venue Name'],['type',2,'s','Room Type'],['rooms',3,'n','Rooms Available'],['pax',4,'n','Persons per Room'],['rate',5,'n','Rate per Night']] },
  { coll: 'vehicles', sheet: 'Vehicles', hdr: 5, stop: 'operator', cols: [['operator',1,'s','Operator / Vendor'],['type',2,'s','Vehicle Type'],['count',3,'n','Vehicles Available'],['seats',4,'n','Seats per Vehicle'],['rate',5,'n','Rate per Trip']] },
  { coll: 'roomAlloc', sheet: 'Room Allocation', hdr: 5, stop: 'group', cols: [['group',1,'s','Family / Group'],['hotelType',2,'s','Hotel & Room Type'],['rooms',3,'n','Rooms Booked'],['in',4,'d','Check-in'],['out',5,'d','Check-out']] },
  { coll: 'transAlloc', sheet: 'Transport Allocation', hdr: 5, stop: 'group', cols: [['group',1,'s','Family / Group'],['vehicle',2,'s','Operator & Vehicle'],['count',3,'n','Vehicles Booked'],['arrDate',4,'d','Arrival Date'],['arrTime',5,'t','Arrival Time'],['arrFrom',6,'s','Arrival From'],['depDate',7,'d','Departure Date'],['depTime',8,'t','Departure Time'],['depTo',9,'s','Departure To']] },
  { coll: 'budgetCats', sheet: 'Budget Planner', hdr: 8, stop: 'name', skip: 'TOTAL', cols: [['name',2,'s','Category'],['pct',3,'p','% of Total Budget']] },
  { coll: 'budgetLines', sheet: 'Budget Lines', altSheet: 'Budget Planner', altHdr: 25, hdr: 5, stop: 'line', cols: [['cat',2,'s','Category'],['line',3,'s','Budget Line (Sub-category)'],['pctCat',4,'p','% of Category'],['source',7,'s','Cost Source'],['notes',9,'s','Notes']] },
  { coll: 'vendors', sheet: 'Vendors', hdr: 5, stop: 'vendor', cols: [['line',2,'s','Budget Line'],['vendor',4,'s','Vendor / Company'],['contact',5,'s','Contact Person'],['phone',6,'s','Phone'],['quoted',7,'n','Quoted Price'],['negotiated',8,'n','Negotiated Price'],['rating',10,'n','Rating (1-5)'],['decision',11,'s','Decision'],['contract',12,'s','Contract Signed?'],['notes',13,'s','Notes']] },
  { coll: 'payments', sheet: 'Payments', hdr: 5, stop: 'line', cols: [['line',2,'s','Budget Line'],['payee',3,'s','Payee'],['desc',4,'s','Description'],['due',5,'d','Due Date'],['amount',6,'n','Amount'],['paid',7,'d','Paid Date'],['status',8,'s','Status'],['mode',9,'s','Mode'],['by',10,'s','Paid By'],['notes',11,'s','Notes']] },
  { coll: 'tasks', sheet: 'Tasks', hdr: 5, stop: 'task', cols: [['task',2,'s','Task'],['cat',3,'s','Category'],['fn',4,'s','Related Function'],['who',5,'s','Assigned To'],['priority',7,'s','Priority'],['status',8,'s','Status'],['notes',9,'s','Notes'],['daysBefore',12,'n','Days before wedding']] },
  { coll: 'rituals', sheet: 'Rituals', hdr: 5, stop: 'item', cols: [['fn',2,'s','Function'],['item',3,'s','Ritual / item'],['qty',4,'s','Quantity / notes'],['who',5,'s','Who arranges'],['source',6,'s','Source'],['status',7,'s','Status'],['remarks',8,'s','Remarks']] },
  { coll: 'runsheet', sheet: 'Run Sheet', hdr: 5, stop: 'activity', cols: [['fn',2,'s','Function'],['time',3,'t','Start time'],['activity',4,'s','Activity'],['who',5,'s','Responsible person'],['vendor',6,'s','Vendor / contact'],['loc',7,'s','Location'],['status',8,'s','Status'],['notes',9,'s','Notes']] },
  { coll: 'shagun', sheet: 'Shagun Register', hdr: 5, stop: 'name', cols: [['date',2,'d','Date'],['fn',3,'s','Function'],['dir',4,'s','Direction'],['name',5,'s','Name'],['group',6,'s','Family / Group'],['side',7,'s','Side'],['relation',8,'s','Relation'],['mode',9,'s','Mode'],['amount',10,'n','Amount (Rs)'],['gift',11,'s','Gift / Item details'],['ret',12,'s','Return needed?'],['retStatus',13,'s','Return status'],['thanks',14,'s','Thank-you sent?'],['notes',15,'s','Notes']] },
  { coll: 'milni', sheet: 'Milni List', hdr: 5, stop: 'pair', cols: [['pair',2,'s','Milni pair (relation)'],['bride',3,'s','Bride side (name)'],['groom',4,'s','Groom side (name)'],['gift',5,'s','Gift / item'],['amount',6,'n','Shagun amount (Rs)'],['by',7,'s','Given by'],['done',8,'s','Done?'],['notes',9,'s','Notes']] },
  { coll: 'shopping', sheet: 'Shopping & Outfits', hdr: 5, stop: 'item', cols: [['item',2,'s','Item'],['type',3,'s','Type'],['who',4,'s','For whom'],['fn',5,'s','Function'],['planned',6,'n','Planned cost (Rs)'],['actual',7,'n','Actual cost (Rs)'],['qty',8,'n','Qty'],['status',9,'s','Status'],['shop',10,'s','Shop / Source'],['box',11,'s','Trunk / Box #'],['notes',12,'s','Notes']] }
];

const serial = s => { const d = pd(s); return d ? Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 864e5) : null; };
const fromSerial = n => { const t = new Date(Math.round(n) * 864e5 + Date.UTC(1899, 11, 30)); return t.getUTCFullYear() + '-' + String(t.getUTCMonth() + 1).padStart(2, '0') + '-' + String(t.getUTCDate()).padStart(2, '0'); };
const tSerial = s => { const m = /^(\d{1,2}):(\d\d)/.exec(s || ''); return m ? (+m[1] * 60 + +m[2]) / 1440 : null; };
const fromT = n => { const mins = Math.round(n * 1440) % 1440; return String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0'); };

function cellVal(ws, r, c, t) {
  const a = ws[XLSX.utils.encode_cell({ r: r - 1, c: c - 1 })];
  if (!a || a.v == null || a.v === '') return null;
  let v = a.v;
  if (t === 'd') { if (typeof v === 'number') return fromSerial(v); if (v instanceof Date) return fd(v); return String(v).slice(0, 10); }
  if (t === 't') { if (typeof v === 'number') return fromT(v); return String(v).slice(0, 5); }
  if (t === 'n') return typeof v === 'number' ? v : (isFinite(parseFloat(v)) ? parseFloat(v) : null);
  if (t === 'p') return typeof v === 'number' ? v : (isFinite(parseFloat(v)) ? parseFloat(v) / (String(v).indexOf('%') > 0 ? 100 : 1) : null);
  return typeof v === 'number' ? String(v) : String(v).trim();
}

function readTable(wb, sp) {
  let ws = wb.Sheets[sp.sheet], hdr = sp.hdr;
  if (!ws && sp.altSheet && wb.Sheets[sp.altSheet]) { ws = wb.Sheets[sp.altSheet]; hdr = sp.altHdr; }
  if (!ws) return null;
  const stopCol = sp.cols.find(c => c[0] === sp.stop)[1];
  const rows = [];
  for (let r = hdr + 1; r < hdr + 3000; r++) {
    const sv = cellVal(ws, r, stopCol, 's');
    if (!sv) { if (r > hdr + 1 || true) break; }
    if (sp.skip && sv === sp.skip) continue;
    const row = { id: uid() };
    sp.cols.forEach(c => { const v = cellVal(ws, r, c[1], c[2]); if (v != null) row[c[0]] = v; });
    if (sp.fnCols) {
      row.fn = {};
      for (let c = sp.fnCols[0]; c <= sp.fnCols[1]; c++) {
        const name = cellVal(ws, hdr, c, 's'), v = cellVal(ws, r, c, 's');
        if (name && v && /^[YCN]$/i.test(v)) row.fn[name] = v.toUpperCase();
      }
    }
    rows.push(row);
  }
  return rows;
}

function importWorkbook(buf) {
  const wb = XLSX.read(buf, { type: 'array' });
  const st = copy(S);
  let found = 0;
  const sh = wb.Sheets['Start Here'];
  if (sh) {
    const g = (a, t) => { const c = sh[a]; if (!c || c.v == null || c.v === '') return ''; if (t === 'd') return typeof c.v === 'number' ? fromSerial(c.v) : String(c.v).slice(0, 10); return String(c.v); };
    // Only plain values (not formulas) are read
    st.settings = { bride: g('C6'), groom: g('C7'), date: g('C8', 'd'), city: g('C9'), start: g('C10', 'd') || st.settings.start };
    found++;
  }
  SPEC.forEach(sp => {
    const rows = readTable(wb, sp);
    if (rows) { st[sp.coll] = rows; found++; }
  });
  const bp = wb.Sheets['Budget Planner'];
  if (bp) { const v = cellVal(bp, 4, 3, 'n'); if (v != null) st.totalBudget = v; }
  const ls = wb.Sheets['Lists'];
  if (ls) {
    const team = [];
    for (let c = 1; c < 40; c++) {
      if (cellVal(ls, 3, c, 's') === 'Family Members & Team') { for (let r = 4; r < 120; r++) { const v = cellVal(ls, r, c, 's'); if (v) team.push(v); } }
    }
    if (team.length) st.team = team;
  }
  const ct = wb.Sheets['Catering'];
  if (ct) {
    const a = cellVal(ct, 6, 3, 'n'), b = cellVal(ct, 7, 3, 'n'), c2 = cellVal(ct, 8, 3, 'n');
    if (a != null) st.cat.share = a; if (b != null) st.cat.childPct = b; if (c2 != null) st.cat.buffer = c2;
    for (let r = 12; r < 40; r++) {
      const nm = cellVal(ct, r, 2, 's'); if (!nm) break;
      const meal = cellVal(ct, r, 4, 's'), cost = cellVal(ct, r, 11, 'n');
      if (meal || cost != null) st.cat.perFn[nm] = { meal: meal || 'Dinner', cost: cost || 0 };
    }
  }
  if (!found) throw new Error('This does not look like a Pandora Wedding Planner workbook.');
  st.demo = false;
  return normalize(st);
}

function sheetFrom(rows, hdrRow, spec, extra) {
  const maxc = Math.max.apply(null, spec.map(c => c[1]).concat(extra ? [extra.to] : [0]));
  const aoa = [];
  for (let i = 0; i < hdrRow - 1; i++) aoa.push([]);
  const head = new Array(maxc).fill(null);
  spec.forEach(c => { head[c[1] - 1] = c[3]; });
  if (extra) extra.names.forEach((n, i) => { head[extra.from - 1 + i] = n; });
  aoa.push(head);
  rows.forEach(r => {
    const line = new Array(maxc).fill(null);
    spec.forEach(c => {
      let v = r[c[0]]; if (v === undefined || v === '') return;
      if (c[2] === 'd') v = serial(v); else if (c[2] === 't') v = tSerial(v); else if (c[2] === 'n' || c[2] === 'p') v = num(v);
      line[c[1] - 1] = v;
    });
    if (extra) extra.names.forEach((n, i) => { const v = (r.fn || {})[n]; if (v) line[extra.from - 1 + i] = v; });
    aoa.push(line);
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  spec.forEach(c => {
    for (let i = 0; i < rows.length; i++) {
      const a = ws[XLSX.utils.encode_cell({ r: hdrRow + i, c: c[1] - 1 })];
      if (!a) continue;
      if (c[2] === 'd') a.z = 'dd-mmm-yyyy'; else if (c[2] === 't') a.z = 'hh:mm'; else if (c[2] === 'p') a.z = '0.0%'; else if (c[2] === 'n' && /price|amount|cost|rate|Rs/i.test(c[3])) a.z = '#,##0';
    }
  });
  ws['!cols'] = new Array(maxc).fill({ wch: 20 });
  return ws;
}

function exportWorkbook() {
  const wb = XLSX.utils.book_new();
  const readme = XLSX.utils.aoa_to_sheet([
    ['Pandora Indian Wedding Planner  -  data export'],
    [(S.settings.bride || 'Bride') + ' & ' + (S.settings.groom || 'Groom') + '   |   exported ' + dshow(fd(today()))],
    [],
    ['This file holds your data from the web planner. You can edit it and import it back (Setup & Data > Import).'],
    ['Formulas, charts and live dashboards are in the web planner; this file is your portable copy.']
  ]);
  XLSX.utils.book_append_sheet(wb, readme, 'Start Here');
  const sh = wb.Sheets['Start Here'];
  const put = (a, v, t) => { sh[a] = t === 'd' && v ? { t: 'n', v: serial(v), z: 'dd-mmm-yyyy' } : { t: 's', v: v || '' }; };
  const lab = { B6: "Bride's name", B7: "Groom's name", B8: 'Wedding date', B9: 'Wedding city', B10: 'Planning start date' };
  Object.keys(lab).forEach(k => put(k, lab[k]));
  put('C6', S.settings.bride); put('C7', S.settings.groom); put('C8', S.settings.date, 'd'); put('C9', S.settings.city); put('C10', S.settings.start, 'd');
  sh['!ref'] = 'A1:C10'; sh['!cols'] = [{ wch: 4 }, { wch: 40 }, { wch: 28 }];
  SPEC.forEach(sp => {
    let rows = S[sp.coll];
    if (sp.coll === 'budgetCats') return;
    const ex = sp.fnCols ? { from: sp.fnCols[0], to: sp.fnCols[1], names: FNS().slice(0, 10) } : null;
    XLSX.utils.book_append_sheet(wb, sheetFrom(rows, sp.hdr, sp.cols, ex), sp.sheet);
  });
  // Budget planner: total + categories (+ computed amounts)
  const bs = SPEC.find(s => s.coll === 'budgetCats');
  const bws = sheetFrom(S.budgetCats, bs.hdr, bs.cols, null);
  bws['B4'] = { t: 's', v: 'TOTAL WEDDING BUDGET' }; bws['C4'] = { t: 'n', v: num(S.totalBudget), z: '#,##0' };
  bws['D8'] = { t: 's', v: 'Amount' };
  S.budgetCats.forEach((c, i) => { bws[XLSX.utils.encode_cell({ r: 8 + i, c: 3 })] = { t: 'n', v: Math.round(num(S.totalBudget) * num(c.pct)), z: '#,##0' }; });
  bws['!ref'] = 'A1:D' + (8 + S.budgetCats.length + 1);
  XLSX.utils.book_append_sheet(wb, bws, 'Budget Planner');
  // Catering assumptions
  const cr = [[], [], [], [], [], ['', 'Share of not-replied guests expected to attend', S.cat.share], ['', "Children's plate as % of an adult plate", S.cat.childPct], ['', 'Extra safety buffer on plates', S.cat.buffer], [], [], [ '#', 'Function', 'Date', 'Meal type', 'Invited', 'Confirmed', 'Not replied', 'Children', 'Infants (free)', 'Plates to order', 'Cost per plate (Rs)', 'Est. food cost (Rs)' ]];
  d().fns.forEach((r, i) => cr.push([i + 1, r.f.name, r.f.date ? serial(r.f.date) : null, r.meal, r.inv, r.conf, r.pend, null, null, r.plates, r.costPer, r.food]));
  const cws = XLSX.utils.aoa_to_sheet(cr); cws['!cols'] = new Array(12).fill({ wch: 18 });
  XLSX.utils.book_append_sheet(wb, cws, 'Catering');
  // Lists (team)
  const lr = [[], [], []]; const team = TEAM();
  const lh = new Array(18).fill(null); lh[17] = 'Family Members & Team'; lr[2] = lh;
  team.forEach(t => { const r = new Array(18).fill(null); r[17] = t; lr.push(r); });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lr), 'Lists');
  XLSX.writeFile(wb, 'Pandora_Wedding_Planner_' + (S.settings.bride || 'data').replace(/\W+/g, '') + '.xlsx');
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'Pandora_Wedding_Planner_backup_' + fd(today()) + '.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
