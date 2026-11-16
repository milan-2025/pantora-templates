/* ---------- accounts, cloud sync, plans, sharing and activity ---------- */
const CLOUD = { on: false, id: null, meta: null, rev: 0, base: null, readOnly: false, email: null, list: [], status: 'local', inflight: false, pushT: null, pollT: null, forceReplace: false, offline: false, pendingRender: false };
const TOKEN_KEY = 'pp_token';
const store = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return MEM[k] || null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { MEM[k] = v; } },
  del: k => { try { localStorage.removeItem(k); } catch (e) { delete MEM[k]; } }
};
const token = () => { try { return sessionStorage.getItem('pp_support') || store.get(TOKEN_KEY); } catch (e) { return store.get(TOKEN_KEY); } };

class ApiError extends Error { constructor(msg, status, data) { super(msg); this.status = status; this.data = data || {}; } }
async function api(path, opts) {
  opts = opts || {};
  let res;
  try {
    res = await fetch('/api/planner' + path, { method: opts.method || 'GET', headers: Object.assign({ 'content-type': 'application/json' }, token() ? { authorization: 'Bearer ' + token() } : {}), body: opts.body ? JSON.stringify(opts.body) : undefined, cache: 'no-store' });
  } catch (e) { throw new ApiError('You seem to be offline.', 0); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Something went wrong (' + res.status + ')', res.status, data);
  return data;
}

/* ---------- diffing (what changed since the last save) ---------- */
const TOPK = ['settings', 'totalBudget', 'cat', 'team', 'msg', 'lists', 'cols'];
function diffOps(base, cur) {
  if (!base || CLOUD.forceReplace) return [{ replace: stripLocal(cur) }];
  const ops = [];
  COLLS.forEach(c => {
    const b = new Map((base[c] || []).map(r => [r.id, JSON.stringify(r)])), seen = new Set();
    (cur[c] || []).forEach(r => { seen.add(r.id); const j = JSON.stringify(r); if (b.get(r.id) !== j) ops.push({ c, id: r.id, r: JSON.parse(j) }); });
    b.forEach((_, id) => { if (!seen.has(id)) ops.push({ c, id, r: null }); });
  });
  TOPK.forEach(k => { if (JSON.stringify(base[k]) !== JSON.stringify(cur[k])) ops.push({ k, v: cur[k] === undefined ? null : copy(cur[k]) }); });
  return ops;
}
function applyOpsJs(state, ops) {
  let s = Object.assign({}, state);
  ops.forEach(op => {
    if (op.replace) { s = copy(op.replace); return; }
    if (op.k) { s[op.k] = op.v; return; }
    const rows = (s[op.c] || []).slice(), i = rows.findIndex(r => r.id === op.id);
    if (op.r === null) { if (i >= 0) rows.splice(i, 1); } else if (i >= 0) rows[i] = op.r; else rows.push(op.r);
    s[op.c] = rows;
  });
  return s;
}
const stripLocal = st => { const o = {}; COLLS.concat(TOPK).forEach(k => { if (st[k] !== undefined) o[k] = st[k]; }); return copy(o); };

const NOUN = { functions: ['function', 'functions'], guests: ['guest', 'guests'], hotels: ['hotel room type', 'hotel room types'], vehicles: ['vehicle', 'vehicles'], roomAlloc: ['room allocation', 'room allocations'], transAlloc: ['transport allocation', 'transport allocations'], budgetCats: ['budget category', 'budget categories'], budgetLines: ['budget line', 'budget lines'], vendors: ['vendor quote', 'vendor quotes'], payments: ['payment', 'payments'], tasks: ['task', 'tasks'], rituals: ['ritual item', 'ritual items'], runsheet: ['run sheet activity', 'run sheet activities'], shagun: ['shagun entry', 'shagun entries'], milni: ['milni pair', 'milni pairs'], shopping: ['shopping item', 'shopping items'], settings: ['wedding details'], totalBudget: ['total budget'], cat: ['catering settings'], team: ['family & team list'], msg: ['invite message'], lists: ['dropdown options'], cols: ['columns'] };
const rowName = r => r && (r.name || r.task || r.vendor || r.item || r.line || r.activity || r.payee || r.pair || r.group || r.hotel || r.operator || '');
function summarize(ops, base) {
  if (ops.some(o => o.replace)) return CLOUD.replaceNote || 'Replaced the whole planner';
  const parts = [], g = {};
  ops.forEach(o => {
    const key = o.k || o.c, kind = o.k ? 'u' : o.r === null ? 'd' : (base[o.c] || []).some(r => r.id === o.id) ? 'u' : 'a';
    (g[key + kind] = g[key + kind] || { key, kind, rows: [] }).rows.push(o.r || (base[o.c] || []).find(r => r.id === o.id));
  });
  Object.values(g).forEach(x => {
    const n = NOUN[x.key] || [x.key, x.key], verb = { a: 'Added', u: 'Updated', d: 'Deleted' }[x.kind];
    if (!NOUN[x.key] || n.length === 1) { parts.push('Updated ' + n[0]); return; }
    const one = x.rows.length === 1 && rowName(x.rows[0]);
    parts.push(verb + ' ' + (one ? n[0] + ' “' + String(one).slice(0, 40) + '”' : x.rows.length + ' ' + n[x.rows.length === 1 ? 0 : 1]));
  });
  return parts.join(' · ').slice(0, 280);
}

/* ---------- saving & syncing ---------- */
function cacheKey() { return 'pp_cache_' + CLOUD.id; }
function saveCache() { if (!CLOUD.on) return; try { store.set(cacheKey(), JSON.stringify({ rev: CLOUD.rev, base: CLOUD.base, state: stripLocal(S), forceReplace: CLOUD.forceReplace })); } catch (e) { /* storage full: cloud still has it */ } }
function schedulePush() { if (!CLOUD.on || CLOUD.readOnly) return; clearTimeout(CLOUD.pushT); setSync('pending'); CLOUD.pushT = setTimeout(push, 900); }

async function push() {
  if (!CLOUD.on || CLOUD.inflight) { if (CLOUD.on) CLOUD.pushT = setTimeout(push, 600); return; }
  const snap = stripLocal(S), ops = diffOps(CLOUD.base, snap);
  if (!ops.length) { setSync('saved'); return; }
  CLOUD.inflight = true; setSync('saving');
  const summary = summarize(ops, CLOUD.base || {});
  try {
    const r = await api('/planners/' + CLOUD.id, { method: 'PUT', body: { ops, summary } });
    CLOUD.base = snap; CLOUD.forceReplace = false; CLOUD.replaceNote = null; CLOUD.offline = false;
    if (r.rev) CLOUD.myRevs.add(r.rev);
    saveCache(); setSync('saved');
    poll(true);
  } catch (e) {
    if (e.status === 402 || e.status === 403) {
      // Plan limit, plan ended or view-only: put back what's saved and explain.
      S = normalize(copy(CLOUD.base || {})); D = null; saveCache(); renderAll();
      if (e.data && (e.data.reason === 'limit' || e.data.reason === 'expired' || e.data.reason === 'collaborators')) upgradeModal(e.message); else toast(e.message);
      poll(true);
    } else if (e.status === 0 || e.status >= 500 || e.status === 429 || e.status === 409) {
      CLOUD.offline = e.status === 0; setSync(e.status === 0 ? 'offline' : 'retry');
      CLOUD.pushT = setTimeout(push, e.status === 0 ? 8000 : 3000);
    } else if (e.status === 401) { signOut(true); } else { toast(e.message); setSync('error'); }
  } finally { CLOUD.inflight = false; }
}

async function poll(quick) {
  if (!CLOUD.on || CLOUD.inflight) return;
  try {
    const r = await api('/planners/' + CLOUD.id + '?since=' + CLOUD.rev);
    const wasRO = CLOUD.readOnly;
    applyMeta(r.meta);
    let changed = false;
    if (r.state !== undefined || (r.changes && r.changes.length)) {
      const pending = diffOps(CLOUD.base, stripLocal(S)).filter(o => !o.replace);
      let base = r.state !== undefined ? stripLocal(normalize(copy(r.state || {}))) : CLOUD.base;
      (r.changes || []).forEach(ch => { base = applyOpsJs(base, ch.ops); if (!CLOUD.myRevs.has(ch.rev)) changed = true; });
      if (r.state !== undefined) changed = true;
      CLOUD.base = base;
      if (changed && !CLOUD.forceReplace) { S = normalize(applyOpsJs(copy(base), pending)); D = null; }
    }
    CLOUD.rev = r.rev; CLOUD.offline = false;
    saveCache();
    if (changed || wasRO !== CLOUD.readOnly) requestRender(); else { badges(); planChip(); }
    if (!CLOUD.inflight && !CLOUD.pushT) setSync(CLOUD.readOnly ? 'ro' : 'saved');
  } catch (e) {
    if (e.status === 401) signOut(true);
    else if (e.status === 403) { toast(e.message); CLOUD.on = false; await startCloud(); }
    else if (e.status === 0) setSync('offline');
  }
}
function requestRender() {
  const a = document.activeElement;
  if (a && a.closest && a.closest('#main') && /INPUT|SELECT|TEXTAREA/.test(a.tagName) && !a.closest('.bar')) { CLOUD.pendingRender = true; return; }
  const y = window.scrollY; renderAll(); window.scrollTo(0, y);
}
document.addEventListener('focusout', () => { if (CLOUD.pendingRender) setTimeout(() => { if (CLOUD.pendingRender) { CLOUD.pendingRender = false; requestRender(); } }, 300); });
function startPolling() {
  clearInterval(CLOUD.pollT);
  CLOUD.pollT = setInterval(() => { if (document.visibilityState === 'visible') poll(); }, 7000);
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && CLOUD.on) poll(); });
window.addEventListener('online', () => { if (CLOUD.on) { poll(); schedulePush(); } });

function applyMeta(m) {
  if (!m) return;
  CLOUD.meta = m;
  CLOUD.readOnly = !m.canWrite;
  document.body.classList.toggle('ro', CLOUD.readOnly);
}

/* ---------- plan limits in the app ---------- */
const LIMIT_LABEL = { guests: 'guests', vendors: 'vendor quotes', payments: 'payments', tasks: 'tasks', functions: 'functions', hotels: 'hotel room types', vehicles: 'vehicles', shopping: 'shopping items', shagun: 'shagun entries', runsheet: 'run sheet activities', rituals: 'ritual items', milni: 'milni pairs' };
const limitOf = k => CLOUD.on && CLOUD.meta && CLOUD.meta.limits ? CLOUD.meta.limits[k] : null;
function limitNote(k, n) { const l = limitOf(k); return l == null ? '' : '<b>' + n + ' / ' + l + '</b> on your ' + esc(CLOUD.meta.plan.name) + ' plan'; }
function canAdd(k) {
  const l = limitOf(k); if (l == null) return true;
  const n = k === 'guests' ? S.guests.filter(g => g.name || g.group).length : (S[k] || []).length;
  if (n < l) return true;
  upgradeModal('Your ' + CLOUD.meta.plan.name + ' plan allows ' + l + ' ' + (LIMIT_LABEL[k] || k) + '. Upgrade to add more.');
  return false;
}

/* ---------- sync status + plan chip in the sidebar ---------- */
function setSync(s) {
  CLOUD.status = s;
  const t = { local: '💾 Saved on this device', pending: '✎ Unsaved changes', saving: '⟳ Saving…', saved: '☁ Saved to cloud', offline: '⚠ Offline: will sync when back', retry: '⟳ Retrying…', error: '⚠ Not saved', ro: '👁 View only' }[s] || '';
  const e = $('#sync'); if (e) { e.textContent = t; e.className = 'sync ' + s; }
  const mm = $('#sync-m'); if (mm) { mm.textContent = t.split(' ')[0]; mm.title = t; mm.className = 'sync ' + s; }
}
function planChip() {
  const e = $('#planchip'); if (!e) return;
  if (!CLOUD.on) { e.innerHTML = '<a data-go="account" class="pc">Sign in to save to the cloud ›</a>'; return; }
  const m = CLOUD.meta; if (!m) { e.innerHTML = ''; return; }
  const left = m.daysLeft != null ? m.daysLeft + ' day' + (m.daysLeft === 1 ? '' : 's') + ' left' : '';
  const st = m.status === 'expired' ? '<b style="color:#E0675A">Plan ended</b>' : m.status === 'suspended' ? '<b style="color:#E0675A">Paused</b>' : left;
  e.innerHTML = '<a data-go="plan" class="pc"><b>' + esc(m.plan.name) + '</b> · ' + st + (m.role !== 'owner' ? ' · ' + (m.role === 'viewer' ? 'view only' : m.role === 'support' ? 'support view' : 'shared with you') : '') + (m.role === 'owner' && (m.plan.isTrial || m.status === 'expired') ? ' <span class="up">Upgrade</span>' : '') + '</a>';
}

/* ---------- screens before the planner opens (sign in, pick, start trial) ---------- */
function gate(html) {
  document.body.classList.add('gated');
  const g = $('#gate'); g.innerHTML = '<div class="gcard"><div class="gbrand">' + $('.brand').innerHTML + '</div>' + html + '</div>'; g.style.display = 'flex';
  return g;
}
function ungate() { document.body.classList.remove('gated'); $('#gate').style.display = 'none'; $('#gate').innerHTML = ''; }

function signInScreen(msg, fromLanding) {
  const g = gate((fromLanding ? '<button class="gx" data-gx aria-label="Close">×</button>' : '') + '<h1>Plan your wedding,<br>together.</h1><p class="note">Guests, budget, vendors, stay, rituals and more, saved to the cloud and shared with family. Start with a free trial.</p>' + (msg ? '<div class="banner">' + esc(msg) + '</div>' : '') +
    '<form data-f1><label class="field">Your email<input class="inp" type="email" name="email" autocomplete="email" required placeholder="you@example.com"></label><button class="btn pri wide">Send me a sign-in code</button></form>' +
    '<form data-f2 style="display:none"><p class="note">We sent a 6-digit code to <b data-em></b>. It may take a minute; check spam too.</p><label class="field">Code<input class="inp code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required placeholder="••••••"></label><button class="btn pri wide">Sign in</button><button type="button" class="btn ghost wide" data-back>Use a different email</button></form>' +
    '<div class="or"><span>or</span></div><button class="btn wide" data-demo>Explore the sample planner first</button><p class="note" style="font-size:11.5px;margin-top:10px">The sample stays on this device. No sign-up needed.</p>');
  const f1 = $('[data-f1]', g), f2 = $('[data-f2]', g);
  let email = '';
  f1.onsubmit = async e => {
    e.preventDefault(); const b = $('button', f1); b.disabled = true; b.textContent = 'Sending…';
    try { const r = await api('/auth/start', { method: 'POST', body: { email: f1.email.value } }); email = r.email; track('Lead'); $('[data-em]', g).textContent = email; f1.style.display = 'none'; f2.style.display = ''; if (r.devCode) f2.code.value = r.devCode; f2.code.focus(); }
    catch (err) { toast(err.message); } finally { b.disabled = false; b.textContent = 'Send me a sign-in code'; }
  };
  f2.onsubmit = async e => {
    e.preventDefault(); const b = $('button', f2); b.disabled = true;
    try { const r = await api('/auth/verify', { method: 'POST', body: { email, code: f2.code.value } }); store.set(TOKEN_KEY, r.token); await startCloud(); }
    catch (err) { toast(err.message); } finally { b.disabled = false; }
  };
  $('[data-back]', g).onclick = () => { f2.style.display = 'none'; f1.style.display = ''; };
  const gx = $('[data-gx]', g); if (gx) gx.onclick = () => ungate();
  if (fromLanding) setTimeout(() => { try { f1.email.focus(); } catch (e) { /* ignore */ } }, 50);
  $('[data-demo]', g).onclick = () => startLocal();
}

function pickScreen(list) {
  const g = gate('<h1>Your planners</h1><p class="note">Signed in as <b>' + esc(CLOUD.email) + '</b></p><div class="plist">' + list.map(p => '<button class="pitem" data-id="' + esc(p.id) + '"><b>' + esc(p.names) + '</b><small>' + esc(p.role === 'owner' ? 'Yours' : p.role === 'viewer' ? 'Shared with you · view only' : 'Shared with you') + ' · ' + esc(p.plan || '') + (p.status === 'expired' ? ' · plan ended' : '') + '</small></button>').join('') + '</div>' +
    (list.some(p => p.role === 'owner') ? '' : '<button class="btn wide" data-new>+ Start my own planner (free trial)</button>') + '<button class="btn ghost wide" data-out>Sign out</button>');
  $$('.pitem', g).forEach(b => b.onclick = () => openPlanner(b.dataset.id));
  const n = $('[data-new]', g); if (n) n.onclick = () => trialScreen();
  $('[data-out]', g).onclick = () => signOut();
}

function trialScreen() {
  let local = null; try { local = JSON.parse(store.get(KEY) || 'null'); } catch (e) { local = null; }
  const hasLocal = local && !local.demo && (local.guests || []).length;
  const g = gate('<h1>Start your free trial</h1><p class="note">Signed in as <b>' + esc(CLOUD.email) + '</b>. Your planner is saved to your account, so it works on every device.</p><div class="plist">' +
    '<button class="pitem" data-s="fresh"><b>✨ Start a fresh plan</b><small>Ready-made task timeline, budget split and ritual checklist</small></button>' +
    (hasLocal ? '<button class="pitem" data-s="local"><b>💾 Bring my plan from this device</b><small>' + local.guests.length + ' guests, ' + (local.vendors || []).length + ' vendors already entered here</small></button>' : '') +
    '<label class="pitem" style="cursor:pointer"><b>⬆ Import my Pandora Excel</b><small>Your filled-in Indian Wedding Planner workbook (.xlsx)</small><input type="file" accept=".xlsx,.json" hidden data-file></label>' +
    '<button class="pitem" data-s="demo"><b>🎁 Start with the sample data</b><small>Ananya &amp; Arjun’s example, to edit into your own</small></button></div><button class="btn ghost wide" data-out>Sign out</button>');
  const create = async st => {
    $$('.pitem', g).forEach(b => { b.style.opacity = .5; b.style.pointerEvents = 'none'; });
    try { const r = await api('/planners', { method: 'POST', body: { state: stripLocal(st), source: lpSource() } }); track('StartTrial', { value: 0, currency: 'INR' }); await openPlanner(r.meta.id, r); }
    catch (err) { toast(err.message); $$('.pitem', g).forEach(b => { b.style.opacity = ''; b.style.pointerEvents = ''; }); if (err.data && err.data.reason === 'limit') toast(err.message); }
  };
  $$('[data-s]', g).forEach(b => b.onclick = () => { const s = b.dataset.s; const st = s === 'fresh' ? freshState() : s === 'demo' ? demoState() : normalize(local); st.demo = false;
    const lpDate = store.get('pp_lp_date'); if (s === 'fresh' && lpDate && st.settings && !st.settings.date) st.settings.date = lpDate; // date picked on the landing page
    create(st); });
  $('[data-file]', g).onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const st = /\.json$/i.test(f.name) ? normalize(JSON.parse(await f.text())) : importWorkbook(await f.arrayBuffer()); create(st); } catch (err) { toast('Could not read that file: ' + err.message); } };
  $('[data-out]', g).onclick = () => signOut();
}

/* ---------- starting up ---------- */
async function openPlanner(id, preload) {
  try {
    const r = preload || await api('/planners/' + id);
    CLOUD.on = true; CLOUD.id = id; CLOUD.myRevs = new Set();
    applyMeta(r.meta);
    store.set('pp_last', id);
    let cache = null; try { cache = JSON.parse(store.get('pp_cache_' + id) || 'null'); } catch (e) { cache = null; }
    if (cache && cache.rev === r.rev && cache.base) { CLOUD.base = cache.base; S = normalize(cache.state); CLOUD.forceReplace = !!cache.forceReplace; }
    else if (r.state) { CLOUD.base = stripLocal(normalize(copy(r.state))); S = normalize(copy(r.state)); }
    else { CLOUD.base = null; S = freshState(); }
    S.demo = false; CLOUD.rev = r.rev || 0; D = null;
    hideLanding(); ungate(); renderAll(); setSync(CLOUD.readOnly ? 'ro' : 'saved'); startPolling();
    if (!CLOUD.readOnly && diffOps(CLOUD.base, stripLocal(S)).length) schedulePush();
  } catch (e) {
    if (e.status === 401) return signOut(true);
    if (e.status === 0) return startLocal('Couldn’t reach the server. Showing what’s saved on this device.');
    toast(e.message); store.del('pp_last'); startCloud(true);
  }
}

async function startCloud(noAuto) {
  try {
    const me = await api('/me');
    CLOUD.email = me.email; CLOUD.list = me.planners || [];
    if (me.support) return openPlanner(CLOUD.list[0].id);
    const last = store.get('pp_last');
    if (!noAuto && last && CLOUD.list.some(p => p.id === last)) return openPlanner(last);
    if (CLOUD.list.length === 1 && !noAuto) return openPlanner(CLOUD.list[0].id);
    if (CLOUD.list.length) return pickScreen(CLOUD.list);
    return trialScreen();
  } catch (e) {
    if (e.status === 401) return signOut(true);
    return startLocal(e.status === 0 ? null : e.message);
  }
}

function startLocal(msg) {
  clearInterval(CLOUD.pollT); CLOUD.on = false; CLOUD.readOnly = false; document.body.classList.remove('ro');
  S = load(); D = null; hideLanding(); ungate(); renderAll(); setSync('local');
  if (msg) toast(msg);
}

function signOut(expired) {
  clearInterval(CLOUD.pollT); clearTimeout(CLOUD.pushT);
  if (CLOUD.on && CLOUD.id) store.del('pp_cache_' + CLOUD.id);
  store.del(TOKEN_KEY); store.del('pp_last'); try { sessionStorage.removeItem('pp_support'); } catch (e) { /* ignore */ }
  CLOUD.on = false; CLOUD.meta = null; CLOUD.readOnly = false; document.body.classList.remove('ro');
  signInScreen(expired ? 'Please sign in again.' : '');
}

async function cloudBoot() {
  const h = location.hash;
  if (h.indexOf('#support=') === 0) { try { sessionStorage.setItem('pp_support', h.slice(9)); } catch (e) { /* ignore */ } try { history.replaceState(null, '', '#dash'); } catch (e) { /* ignore */ } }
  if (location.protocol === 'file:') return startLocal();
  if (token()) return startCloud();
  // Server reachable? If not (offline / preview), just open the local planner.
  try { await api('/plans'); } catch (e) { if (e.status === 0 || e.status === 404) return startLocal(); }
  // First visit: the landing page. Links in emails can use /planner#signin to go straight to sign-in.
  if (h === '#signin') { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ } return signInScreen(); }
  landingScreen();
}

/* ---------- upgrade ---------- */
let RZP_LOADING = null;
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  RZP_LOADING = RZP_LOADING || new Promise((ok, bad) => { const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = ok; s.onerror = () => { RZP_LOADING = null; bad(new Error('Couldn’t load the payment window. Check your connection.')); }; document.body.appendChild(s); });
  return RZP_LOADING;
}
async function upgradeModal(reason) {
  if (!CLOUD.on) { go('account'); return; }
  const m = modal('<h2>Choose your plan</h2>' + (reason ? '<div class="banner">' + esc(reason) + '</div>' : '') + '<div class="plans"><div class="empty">Loading plans…</div></div>');
  let plans = [];
  try { plans = (await api('/plans')).plans.filter(p => !p.isTrial); } catch (e) { $('.plans', m).innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; return; }
  const owner = CLOUD.meta.role === 'owner', cur = CLOUD.meta.plan;
  $('.plans', m).innerHTML = plans.map(p => '<div class="plan' + (p.badge ? ' hot' : '') + '">' + (p.badge ? '<span class="pb">' + esc(p.badge) + '</span>' : '') + '<h3>' + esc(p.name) + '</h3><div class="pp">' + inr(p.price) + '</div><div class="note">' + esc(p.tagline) + ' · valid ' + (p.durationDays % 365 === 0 ? (p.durationDays / 365) + ' year' + (p.durationDays > 365 ? 's' : '') : p.durationDays + ' days') + '</div><ul>' + p.features.map(f => '<li>' + esc(f) + '</li>').join('') + '</ul>' +
    (owner ? '<button class="btn pri wide keep" data-buy="' + esc(p.id) + '">' + (cur.id === p.id && CLOUD.meta.status !== 'expired' ? 'Renew' : 'Choose ' + esc(p.name)) + '</button>' : '') + '</div>').join('');
  $('.plans', m).insertAdjacentHTML('afterend', owner ? '<div class="row2" style="margin-top:12px;align-items:flex-end"><label class="field">Promo code (optional)<input class="inp" data-coupon style="text-transform:uppercase"></label></div>' : '<p class="note">Only the planner’s owner (' + esc(CLOUD.meta.owner) + ') can upgrade. Ask them to open Plan &amp; billing.</p>');
  $$('[data-buy]', m).forEach(b => b.onclick = async () => {
    b.disabled = true; const label = b.textContent; b.textContent = 'Opening payment…';
    try {
      const coupon = ($('[data-coupon]', m) || {}).value || '';
      const o = await api('/planners/' + CLOUD.id + '/checkout', { method: 'POST', body: { plan: b.dataset.buy, coupon } });
      let res = {};
      if (o.provider === 'razorpay') {
        await loadRazorpay();
        res = await new Promise((ok, bad) => {
          let done = false;
          const r = new window.Razorpay(Object.assign({}, o.clientData, { order_id: o.orderId, name: 'Pandora Templates', description: 'Wedding planner plan', prefill: { email: CLOUD.meta.owner }, theme: { color: '#3B1F4A' }, handler: x => { done = true; ok(x); }, modal: { ondismiss: () => { if (!done) bad(new Error('Payment cancelled. You can try again any time.')); } } }));
          r.open();
        });
      }
      await api('/planners/' + CLOUD.id + '/verify', { method: 'POST', body: res });
      m.remove(); track('Purchase', { value: o.total || 0, currency: 'INR' }); await poll(true); renderAll(); toast('🎉 Your plan is active. Thank you!');
    } catch (e) { toast(e.message); b.disabled = false; b.textContent = label; }
  });
}

/* ---------- account pages ---------- */
const needCloud = (title, what) => [el('<div>' + ph(title, '') + '</div>').firstChild, el('<div class="card"><h3>Sign in to use ' + esc(what) + '</h3><p>Your planner is only on this device right now. Sign in (free trial, no card needed) to save it to the cloud, use it on your phone and invite family.</p><button class="btn pri" data-signin>Sign in or start free trial</button></div>')];
document.addEventListener('click', e => { if (e.target.closest('[data-signin]')) signInScreen(); if (e.target.closest('[data-upgrade]')) upgradeModal(); });
const fdt = s => { const d = new Date(s); return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); };
const ago = s => { const m = Math.round((Date.now() - new Date(s).getTime()) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };

VIEWS.plan = function () {
  if (!CLOUD.on) return needCloud('Plan & billing', 'plans');
  const m = CLOUD.meta, o = m.counts || {}, lim = m.limits || {};
  const rows = Object.keys(LIMIT_LABEL).map(k => { const l = lim[k], n = k === 'guests' ? d().nGuests : (S[k] || []).length; return '<div class="hb"><div class="n">' + esc(LIMIT_LABEL[k].replace(/^./, c => c.toUpperCase())) + '</div><div class="tr"><i style="width:' + (l == null ? 4 : Math.min(100, l ? n / l * 100 : 100)) + '%;background:' + (l != null && n >= l ? '#E0675A' : '#1F7A74') + '"></i></div><div class="v">' + n + ' / ' + (l == null ? '∞' : l) + '</div></div>'; }).join('');
  const st = m.status === 'expired' ? pill('Ended', 'bad') : m.status === 'suspended' ? pill('Paused', 'bad') : m.status === 'trial' ? pill('Free trial', 'warn') : pill('Active', 'ok');
  return [el('<div>' + ph('Plan & billing', 'Your plan, what it includes and how much of it you are using.') + '</div>').firstChild,
    el('<div class="grid g3" style="margin-bottom:14px">' + kpi('Plan', esc(m.plan.name), st) + kpi('Valid until', m.expiresAt ? fdt(m.expiresAt) : '–', m.daysLeft != null ? m.daysLeft + ' days left' : '', 'm') + kpi('Family members', (m.collaborators || []).length + ' / ' + m.plan.collaborators, 'can be invited', 't') + '</div>'),
    el('<div class="grid g2"><div class="card"><h3>Usage</h3>' + rows + '</div><div class="card"><h3>' + (m.plan.isTrial ? 'Keep everything after your trial' : 'Change or renew') + '</h3><p>' + (m.plan.isTrial ? 'Your trial ends ' + (m.expiresAt ? 'on <b>' + fdt(m.expiresAt) + '</b>' : 'soon') + '. Upgrade any time: everything you have entered stays as it is.' : 'Upgrade for more guests and family members, or renew early to add another year.') + '</p>' + (m.role === 'owner' ? '<button class="btn pri keep" data-upgrade>See plans</button>' : '<p class="note">Only the owner (' + esc(m.owner) + ') can change the plan.</p>') + '<p class="note" style="margin-top:14px">When a plan ends, the planner stays readable and exportable; editing resumes as soon as you renew.</p></div></div>')];
};

VIEWS.sharing = function () {
  if (!CLOUD.on) return needCloud('Sharing', 'sharing');
  const m = CLOUD.meta, owner = m.role === 'owner', list = m.collaborators || [], max = m.plan.collaborators;
  const wrap = el('<div></div>');
  const draw = () => {
    const ls = CLOUD.meta.collaborators || [];
    wrap.innerHTML = '<div class="card"><h3>People on this planner <small>' + (owner ? ls.length + ' of ' + max + ' invites used' : '') + '</small></h3><ul class="todo"><li><span class="dot g"></span><div><b>' + esc(m.owner) + '</b><small>Owner</small></div></li>' +
      ls.map(c => '<li><span class="dot"></span><div style="flex:1"><b>' + esc(c.email) + '</b><small>' + (c.role === 'viewer' ? 'View only' : 'Can edit') + '</small></div>' + (owner ? '<button class="btn sm danger keep" data-rm="' + esc(c.email) + '">Remove</button>' : '') + '</li>').join('') + '</ul>' +
      (!owner ? '<p class="note">' + (m.role === 'support' ? 'Support view.' : 'You were invited by ' + esc(m.owner) + '.') + '</p>' + (m.role !== 'support' ? '<button class="btn danger keep" data-leave>Leave this planner</button>' : '') : '') + '</div>' +
      (owner ? '<div class="card" style="margin-top:14px"><h3>Invite a family member</h3>' + (max === 0 ? '<p>Planning together comes with a paid plan. Family members sign in with their own email and see changes live.</p><button class="btn pri keep" data-upgrade>See plans</button>' :
        '<p class="note" style="margin-top:0">They get an email and sign in with their own address. “View only” is good for elders who just want to look.</p><form class="row2" style="align-items:flex-end" data-inv><label class="field" style="flex:2;min-width:200px">Email<input class="inp" type="email" name="email" required data-free></label><label class="field">Access<select class="sel" name="role" data-free><option value="editor">Can edit</option><option value="viewer">View only</option></select></label><button class="btn pri keep">Send invite</button></form>') + '</div>' : '');
    const f = $('[data-inv]', wrap);
    if (f) f.onsubmit = async e => { e.preventDefault(); try { const r = await api('/planners/' + CLOUD.id + '/collaborators', { method: 'POST', body: { email: f.email.value, role: f.role.value } }); CLOUD.meta.collaborators = r.collaborators; toast('Invite sent to ' + f.email.value); draw(); } catch (err) { if (err.status === 402) upgradeModal(err.message); else toast(err.message); } };
    $$('[data-rm]', wrap).forEach(b => b.onclick = async () => { if (!(await ask('Remove ' + b.dataset.rm + '?', 'They will lose access to this planner straight away.', 'Remove'))) return; try { const r = await api('/planners/' + CLOUD.id + '/collaborators', { method: 'DELETE', body: { email: b.dataset.rm } }); CLOUD.meta.collaborators = r.collaborators; draw(); } catch (err) { toast(err.message); } });
    const lv = $('[data-leave]', wrap); if (lv) lv.onclick = async () => { if (!(await ask('Leave this planner?', 'You will need a new invite from the owner to come back.', 'Leave'))) return; try { await api('/planners/' + CLOUD.id + '/collaborators', { method: 'DELETE', body: { email: CLOUD.email } }); store.del('pp_last'); startCloud(true); } catch (err) { toast(err.message); } };
  };
  draw();
  return [el('<div>' + ph('Sharing', 'Plan together: everyone sees the same planner, and changes appear on every phone within seconds.') + '</div>').firstChild, wrap];
};

VIEWS.activity = function () {
  if (!CLOUD.on) return needCloud('Activity', 'the activity log');
  const box = el('<div class="card"><div class="empty">Loading…</div></div>');
  api('/planners/' + CLOUD.id + '/history').then(r => {
    const items = r.items || [];
    box.innerHTML = '<h3>Recent changes <small>restore points are kept automatically every 30 minutes of editing</small></h3>' + (items.length ? '<ul class="todo act">' + items.map(x => '<li><span class="dot ' + (x.restorable ? 'g' : '') + '"></span><div style="flex:1;min-width:0"><b>' + esc(x.summary || 'Changes') + '</b><small>' + esc(x.by && x.by.indexOf('support:') === 0 ? 'Pandora support' : x.by || '') + ' · ' + ago(x.at) + '</small></div>' + (x.restorable && !CLOUD.readOnly ? '<button class="btn sm keep" data-rs="' + esc(x.id) + '" data-at="' + esc(x.at) + '">Restore to before this</button>' : '') + '</li>').join('') + '</ul>' : '<div class="empty">No changes yet.</div>');
    $$('[data-rs]', box).forEach(b => b.onclick = async () => {
      if (!(await ask('Restore the planner?', 'Everything goes back to how it was just before this change (' + ago(b.dataset.at) + '). Changes made after it are undone for everyone. The restore itself is saved here too, so you can undo it.', 'Restore'))) return;
      try { if (CLOUD.pushT || CLOUD.inflight) await push(); await api('/planners/' + CLOUD.id + '/history', { method: 'POST', body: { restore: b.dataset.rs } }); await poll(true); toast('Restored ✔'); go('activity'); } catch (e) { toast(e.message); }
    });
  }).catch(e => { box.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
  return [el('<div>' + ph('Activity', 'Who changed what, and when. Made a mistake? Restore the planner to an earlier point.') + '</div>').firstChild, box];
};

VIEWS.account = function () {
  if (!CLOUD.on) return [el('<div>' + ph('Account', '') + '</div>').firstChild, el('<div class="card"><h3>Save your planner to the cloud</h3><p>Right now everything is saved only on this device. Sign in with your email to start a free trial: your planner syncs to every device and you can invite family.</p><button class="btn pri" data-signin>Sign in or start free trial</button></div>')];
  const c = el('<div class="card"><h3>Signed in</h3><p><b>' + esc(CLOUD.email || 'Support view') + '</b></p><div class="bar">' + (CLOUD.list.length > 1 ? '<button class="btn keep" data-switch>Switch planner</button>' : '') + '<button class="btn keep" data-out>Sign out</button></div></div>');
  const sw = $('[data-switch]', c); if (sw) sw.onclick = () => { clearInterval(CLOUD.pollT); CLOUD.on = false; pickScreen(CLOUD.list); };
  $('[data-out]', c).onclick = () => signOut();
  return [el('<div>' + ph('Account', '') + '</div>').firstChild, c];
};
