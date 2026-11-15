/* ---------- editable grid: a table on computers, tap-to-open cards on phones ---------- */
const MOBILE = () => window.innerWidth < 760;
const colId = c => c.id || c.k;
const RO = () => !!(typeof CLOUD !== 'undefined' && CLOUD.readOnly);
const dis = () => RO() ? ' disabled' : '';
const CUSTOM_TYPES = [['text', 'Text'], ['num', 'Number'], ['date', 'Date'], ['sel', 'Dropdown'], ['yn', 'Yes / No']];

function colPrefs(key) { return (S.cols && S.cols[key]) || {}; }
function customCols(p) {
  return (p.custom || []).map(x => ({ id: 'x_' + x.id, k: 'x_' + x.id, label: x.label, t: x.t === 'num' || x.t === 'date' ? x.t : x.t === 'sel' || x.t === 'yn' ? 'sel' : 'text', opts: x.t === 'yn' ? YN : (x.opts || []), custom: x, w: 130 }));
}
/** The grid's columns after the user's choices: order, renamed headers, hidden columns and their own extra columns. */
function allCols(key, base) {
  const p = colPrefs(key), cols = base.concat(customCols(p)), order = p.order || [], pos = new Map(cols.map((c, i) => [colId(c), i]));
  const rank = c => { const i = order.indexOf(colId(c)); return i < 0 ? 1000 + pos.get(colId(c)) : i; };
  return cols.slice().sort((a, b) => rank(a) - rank(b)).map(c => (p.labels && p.labels[colId(c)] ? Object.assign({}, c, { label: p.labels[colId(c)], def: c.label }) : c));
}
const visibleCols = (key, base) => { const h = colPrefs(key).hidden || {}; return allCols(key, base).filter(c => !h[colId(c)]); };

function columnEditor(key, base, coll, onDone) {
  const p = copy(colPrefs(key));
  p.hidden = p.hidden || {}; p.labels = p.labels || {}; p.custom = p.custom || [];
  let list = allCols(key, base).map(c => ({ id: colId(c), label: c.label, def: c.def || c.label, custom: c.custom }));
  const m = modal('<h2>Columns</h2><p class="note" style="margin-top:0">Tick to show, type to rename, use the arrows to reorder. Changes apply for everyone on this planner.</p><div class="ce"></div>' +
    '<div class="card" style="margin-top:12px;padding:12px 14px"><b style="font-size:13px">Add your own column</b><div class="row2" style="margin-top:6px;align-items:flex-end"><label class="field">Name<input class="inp" data-n placeholder="e.g. Gift sent"></label><label class="field">Type<select class="sel" data-t>' + CUSTOM_TYPES.map(t => '<option value="' + t[0] + '">' + t[1] + '</option>').join('') + '</select></label><label class="field" data-ow style="display:none;flex:1;min-width:160px">Options (comma separated)<input class="inp" data-o placeholder="Yes, No, Maybe"></label><button class="btn" data-add>+ Add</button></div></div>' +
    '<div class="bar" style="justify-content:space-between;margin-top:14px"><button class="btn ghost" data-reset>Reset to default</button><span><button class="btn" data-x>Cancel</button> <button class="btn pri" data-ok>Save</button></span></div>');
  const box = $('.ce', m);
  const draw = () => {
    box.innerHTML = list.map((c, i) => '<div class="cer" data-i="' + i + '"><input type="checkbox" data-v' + (p.hidden[c.id] ? '' : ' checked') + ' title="Show this column"><input class="inp" data-l value="' + esc(c.label) + '" placeholder="' + esc(c.def) + '"><button class="btn sm ghost" data-up' + (i ? '' : ' disabled') + ' title="Move up">↑</button><button class="btn sm ghost" data-dn' + (i < list.length - 1 ? '' : ' disabled') + ' title="Move down">↓</button>' + (c.custom ? '<button class="btn sm danger" data-del title="Delete this column and its data">🗑</button>' : '<span style="width:34px"></span>') + '</div>').join('');
  };
  draw();
  $('[data-t]', m).onchange = e => { $('[data-ow]', m).style.display = e.target.value === 'sel' ? '' : 'none'; };
  box.addEventListener('change', e => { const r = e.target.closest('.cer'); if (!r) return; const c = list[+r.dataset.i]; if (e.target.hasAttribute('data-v')) { if (e.target.checked) delete p.hidden[c.id]; else p.hidden[c.id] = 1; } if (e.target.hasAttribute('data-l')) c.label = e.target.value.trim() || c.def; });
  box.addEventListener('click', e => {
    const r = e.target.closest('.cer'); if (!r) return; const i = +r.dataset.i;
    if (e.target.hasAttribute('data-up') && i > 0) { list.splice(i - 1, 0, list.splice(i, 1)[0]); draw(); }
    if (e.target.hasAttribute('data-dn') && i < list.length - 1) { list.splice(i + 1, 0, list.splice(i, 1)[0]); draw(); }
    if (e.target.hasAttribute('data-del')) { const c = list[i]; p.custom = p.custom.filter(x => 'x_' + x.id !== c.id); list.splice(i, 1); p.dropped = (p.dropped || []).concat([c.id]); draw(); }
  });
  $('[data-add]', m).onclick = () => {
    const n = $('[data-n]', m).value.trim(); if (!n) { $('[data-n]', m).focus(); return; }
    const t = $('[data-t]', m).value, x = { id: uid().slice(1, 9), label: n.slice(0, 40), t };
    if (t === 'sel') x.opts = $('[data-o]', m).value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 40);
    p.custom.push(x); list.push({ id: 'x_' + x.id, label: x.label, def: x.label, custom: x }); $('[data-n]', m).value = ''; draw();
  };
  $('[data-x]', m).onclick = () => m.remove();
  $('[data-reset]', m).onclick = () => { p.hidden = {}; p.labels = {}; p.order = []; list = allCols(key, base).map(c => ({ id: colId(c), label: c.def || c.label, def: c.def || c.label, custom: c.custom })); draw(); };
  $('[data-ok]', m).onclick = () => {
    p.labels = {}; list.forEach(c => { if (c.label !== c.def) p.labels[c.id] = c.label; });
    p.order = list.map(c => c.id);
    if (list.every(c => p.hidden[c.id])) { toast('Keep at least one column visible'); return; }
    (p.dropped || []).forEach(k => { if (coll) S[coll].forEach(r => { delete r[k]; }); });
    delete p.dropped;
    S.cols = Object.assign({}, S.cols || {}, { [key]: p });
    dirty(); m.remove(); onDone(); toast('Columns saved');
  };
}

function grid(cfg) {
  const coll = cfg.coll, key = cfg.key || coll, base = cfg.cols, mobile = MOBILE(), open = new Set();
  let cols = visibleCols(key, base);
  const root = el('<div class="gw"></div>');
  const tools = el('<div class="gtools"><span class="note" data-count></span><span class="sp"></span>' + (cfg.noCols ? '' : '<button class="btn sm ghost colbtn" data-cols title="Show, hide, rename, reorder or add columns">⚙ Columns</button>') + '</div>');
  const box = mobile ? el('<div class="cards"></div>') : el('<div class="tw"><table class="g"><thead></thead><tbody></tbody></table></div>');
  root.appendChild(tools); root.appendChild(box);
  const thead = mobile ? null : $('thead', box), host = mobile ? box : $('tbody', box);
  const byId = () => { const m = new Map(); S[coll].forEach(r => m.set(r.id, r)); return m; };
  const visible = () => { let r = S[coll]; if (cfg.filter) r = r.filter(cfg.filter); if (cfg.sort) r = r.slice().sort(cfg.sort); return r; };
  const calcHtml = (c, r, i) => { const v = c.calc(r, i); return c.fmt ? c.fmt(v, r) : esc(v == null ? '' : v); };
  const pillCol = () => cols.find(c => c.fmt === statusPill);

  function inner(c, r, i, ci) {
    const v = r[c.k], a = ' data-c="' + ci + '"' + dis();
    switch (c.t) {
      case 'calc': return ['c' + (c.num ? ' num' : ''), calcHtml(c, r, i), 1];
      case 'html': return ['c h', c.html(r), 1];
      case 'sel': case 'rating': {
        let opts = typeof c.opts === 'function' ? c.opts(r) : c.opts;
        if (c.t === 'rating') opts = ['1', '2', '3', '4', '5'];
        const cur = v == null ? '' : String(v);
        if (cur && opts.indexOf(cur) < 0) opts = opts.concat([cur]);
        return ['', '<select' + a + '><option value=""></option>' + opts.map(o => '<option' + (o === cur ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>'];
      }
      case 'num': case 'money': return ['', '<input type="number" step="any" inputmode="decimal"' + a + ' value="' + esc(v == null ? '' : v) + '">'];
      case 'pct': return ['', '<input type="number" step="any" inputmode="decimal"' + a + ' value="' + (v === '' || v == null ? '' : Math.round(num(v) * 10000) / 100) + '" title="Percent">'];
      case 'date': return ['', '<input type="date"' + a + ' value="' + esc(v || '') + '">'];
      case 'time': return ['', '<input type="time"' + a + ' value="' + esc(v || '') + '">'];
      case 'chk': return ['fc', '<input type="checkbox" class="ck"' + a + (v === c.on ? ' checked' : '') + '>'];
      case 'fn': { const x = (r.fn || {})[c.k] || ''; return ['fc', '<button class="yc ' + x + '" data-act="yc" data-fn="' + esc(c.k) + '"' + dis() + ' title="' + esc(c.k) + ': tap to change (Y = invited, C = confirmed, N = declined)">' + x + '</button>']; }
      default: return [c.sticky ? 's' : '', '<input type="text"' + a + ' value="' + esc(v == null ? '' : v) + '"' + (c.list ? ' list="' + c.list + '"' : '') + (c.ph ? ' placeholder="' + esc(c.ph) + '"' : '') + '>'];
    }
  }
  const plain = (c, r, i) => {
    if (c.t === 'calc') { const v = c.calc(r, i); return c.fmt === moneyCell ? moneyCell(v) : v == null ? '' : String(v); }
    if (c.t === 'date') return dshow(r[c.k]);
    if (c.t === 'chk' || c.t === 'fn' || c.t === 'html') return '';
    return r[c.k] == null ? '' : String(r[c.k]);
  };
  const titleCol = () => cols.find(c => c.t === 'text') || cols.find(c => c.t === 'sel' || c.t === 'calc') || cols[0];
  const head = (r, i) => cfg.title ? cfg.title(r) : plain(titleCol(), r, i) || 'New row';
  const sub = (r, i) => cfg.sub ? cfg.sub(r) : cols.filter(c => c !== titleCol() && (c.t !== 'calc' || c.num || c.k === 'dl')).map(c => plain(c, r, i)).filter(Boolean).slice(0, 3).join(' · ');
  const pillHtml = (r, i) => { const pc = pillCol(); return cfg.pill ? cfg.pill(r) : pc ? calcHtml(pc, r, i) : ''; };

  function rowHtml(r, i) {
    if (!mobile) {
      return '<tr data-id="' + r.id + '"><td class="idx">' + (i + 1) + '</td>' + cols.map((c, ci) => { const x = inner(c, r, i, ci); return '<td class="' + x[0] + '"' + (x[2] ? ' data-cc="' + ci + '"' : '') + '>' + x[1] + '</td>'; }).join('') + '<td class="x">' + (cfg.noDel ? '' : '<button data-act="del" title="Delete this row">✕</button>') + '</td></tr>';
    }
    const on = open.has(r.id);
    return '<div class="cr' + (on ? ' on' : '') + '" data-id="' + r.id + '"><div class="ch" data-tog><div class="ct"><b data-head>' + esc(head(r, i)) + '</b><small data-sub>' + esc(sub(r, i)) + '</small></div><span data-pill>' + pillHtml(r, i) + '</span><span class="chev">›</span></div>' +
      (on ? cardBody(r, i) : '') + '</div>';
  }
  const cardBody = (r, i) => '<div class="cb">' + cols.map((c, ci) => { const x = inner(c, r, i, ci); return '<div class="fld ' + x[0] + '"' + (x[2] ? ' data-cc="' + ci + '"' : '') + '><label>' + esc(c.label) + '</label><div class="fv">' + x[1] + '</div></div>'; }).join('') + (cfg.noDel ? '' : '<div class="cfoot"><button class="btn sm danger" data-act="del">Delete</button></div>') + '</div>';

  function build() {
    cols = visibleCols(key, base);
    const rs = visible(), lim = cfg.limit || (mobile ? 150 : 400);
    if (thead) thead.innerHTML = '<tr><th style="width:34px">#</th>' + cols.map(c => '<th class="' + (c.th || '') + (c.custom ? ' cu' : '') + (c.sticky ? ' s' : '') + '" title="' + esc(c.tip || c.label) + '" style="' + (c.w ? 'min-width:' + (c.w + (c.t === 'sel' ? 28 : 0)) + 'px' : '') + '">' + esc(c.label) + '</th>').join('') + '<th></th></tr>';
    const more = rs.length > lim ? '<div class="empty">Showing the first ' + lim + ' of ' + rs.length + '. Use search and filters to narrow down.</div>' : '';
    const none = !rs.length ? '<div class="empty">' + (cfg.empty || 'Nothing here yet.') + '</div>' : '';
    host.innerHTML = rs.slice(0, lim).map(rowHtml).join('') + (mobile ? more + none : (more || none ? '<tr><td colspan="' + (cols.length + 2) + '">' + more + none + '</td></tr>' : ''));
    const total = S[coll].length, ln = typeof limitNote === 'function' ? limitNote(cfg.limitKey || coll, total) : '';
    $('[data-count]', tools).innerHTML = (rs.length === total ? total + ' row' + (total === 1 ? '' : 's') : rs.length + ' of ' + total + ' shown') + (ln ? ' · ' + ln : '');
  }
  function refresh() {
    const m = byId();
    $$('[data-id]', host).forEach((rowEl, i) => {
      const r = m.get(rowEl.dataset.id); if (!r) return;
      $$('[data-cc]', rowEl).forEach(cell => { const c = cols[+cell.dataset.cc]; const target = mobile ? $('.fv', cell) : cell; target.innerHTML = c.t === 'html' ? c.html(r) : calcHtml(c, r, i); });
      if (mobile) { $('[data-head]', rowEl).textContent = head(r, i); $('[data-sub]', rowEl).textContent = sub(r, i); $('[data-pill]', rowEl).innerHTML = pillHtml(r, i); }
    });
  }
  host.addEventListener('change', e => {
    const t = e.target; if (t.dataset.c == null) return;
    const rowEl = t.closest('[data-id]'), r = byId().get(rowEl.dataset.id), c = cols[+t.dataset.c]; if (!r || !c) return;
    let v = t.value;
    if (c.t === 'chk') v = t.checked ? c.on : c.off;
    else if (c.t === 'num' || c.t === 'money' || c.t === 'rating') v = v === '' ? '' : +v;
    else if (c.t === 'pct') v = v === '' ? '' : +v / 100;
    const old = r[c.k]; r[c.k] = v;
    if (cfg.onChange) cfg.onChange(r, c.k, old);
    dirty();
    if (c.full || (cfg.full && cfg.full.indexOf(c.k) >= 0) || cols.some(x => x !== c && x.k === c.k)) build(); else refresh();
    if (cfg.after) cfg.after(); badges();
  });
  host.addEventListener('click', e => {
    const tog = e.target.closest('[data-tog]');
    if (tog) { const rowEl = tog.closest('[data-id]'), id = rowEl.dataset.id, r = byId().get(id); if (open.has(id)) { open.delete(id); rowEl.classList.remove('on'); const b = $('.cb', rowEl); if (b) b.remove(); } else if (r) { open.add(id); rowEl.classList.add('on'); rowEl.insertAdjacentHTML('beforeend', cardBody(r, visible().indexOf(r))); } return; }
    const b = e.target.closest('[data-act]'); if (!b || RO()) return;
    const rowEl = b.closest('[data-id]'); if (!rowEl) return;
    const r = byId().get(rowEl.dataset.id); if (!r) return;
    const act = b.dataset.act;
    if (act === 'del') {
      const idx = S[coll].indexOf(r); S[coll].splice(idx, 1); dirty(); build(); if (cfg.after) cfg.after(); badges();
      toast('Row deleted', 'Undo', () => { S[coll].splice(Math.min(idx, S[coll].length), 0, r); dirty(); build(); if (cfg.after) cfg.after(); badges(); });
    } else if (act === 'yc') {
      const fn = b.dataset.fn; r.fn = r.fn || {};
      const nx = { '': 'Y', Y: 'C', C: 'N', N: '' }[r.fn[fn] || ''];
      if (nx) r.fn[fn] = nx; else delete r.fn[fn];
      b.className = 'yc ' + nx; b.textContent = nx; dirty(); if (cfg.after) cfg.after();
    } else if (cfg.act && cfg.act[act]) {
      cfg.act[act](r, rowEl, e); dirty(); setTimeout(() => { build(); if (cfg.after) cfg.after(); badges(); }, 60);
    }
  });
  tools.addEventListener('click', e => { if (e.target.closest('[data-cols]')) columnEditor(key, base, coll, () => { build(); if (cfg.after) cfg.after(); }); });
  function add(row) {
    if (RO()) return;
    if (typeof canAdd === 'function' && !canAdd(cfg.limitKey || coll)) return;
    const r = Object.assign({ id: uid() }, row || (cfg.blank ? cfg.blank() : {}));
    S[coll].push(r); open.add(r.id); dirty(); build();
    const rowEl = host.querySelector('[data-id="' + r.id + '"]');
    if (rowEl) { rowEl.scrollIntoView({ block: 'center' }); const i = rowEl.querySelector('input:not([type=checkbox]),select'); if (i) i.focus(); }
    if (cfg.after) cfg.after(); badges();
  }
  build();
  return { root, build, refresh, add };
}
