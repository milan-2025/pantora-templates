/* ---------- account, sync with the server, offline copy ---------- */
let ME = null; // what the server says about this person: plan, gifts, groups, buddy, money-back, referral
const CLOUD = { email: null, rev: 0, base: null, pushT: null, pollT: null, inflight: false, offline: false, status: 'saved' };
const tok = () => store.get('wk_token');

class ApiError extends Error { constructor(m, status, data) { super(m); this.status = status; this.data = data || {}; } }
async function api(path, opts) {
  opts = opts || {};
  let res;
  try {
    res = await fetch('/api/workout/' + path, { method: opts.method || 'GET', headers: Object.assign({ 'content-type': 'application/json' }, tok() ? { authorization: 'Bearer ' + tok() } : {}), body: opts.body ? JSON.stringify(opts.body) : undefined, cache: 'no-store' });
  } catch (e) { throw new ApiError('You seem to be offline.', 0); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Something went wrong (' + res.status + ')', res.status, data);
  return data;
}

/* ----- the device copy ----- */
const cacheKey = () => 'wk_cache_' + CLOUD.email;
function saveCache() { if (!CLOUD.email) return; try { store.set(cacheKey(), JSON.stringify({ rev: CLOUD.rev, base: CLOUD.base, state: S, me: ME })); } catch (e) { /* storage full */ } }
function loadCache() { try { return JSON.parse(store.get(cacheKey()) || 'null'); } catch (e) { return null; } }

/* ----- changes → server ----- */
function diffOps(base, cur) {
  if (!base) return [{ replace: strip(cur) }];
  const ops = [];
  COLLS.forEach((c) => {
    const b = new Map((base[c] || []).map((r) => [r.id, JSON.stringify(r)])), seen = new Set();
    (cur[c] || []).forEach((r) => { seen.add(r.id); const j = JSON.stringify(r); if (b.get(r.id) !== j) ops.push({ c, id: r.id, r: JSON.parse(j) }); });
    b.forEach((_, id) => { if (!seen.has(id)) ops.push({ c, id, r: null }); });
  });
  TOPS.forEach((k) => { if (JSON.stringify(base[k]) !== JSON.stringify(cur[k])) ops.push({ k, v: cur[k] === undefined ? null : copy(cur[k]) }); });
  return ops;
}
function applyOpsJs(state, ops) {
  let s = Object.assign({}, state);
  ops.forEach((op) => {
    if (op.replace) { s = copy(op.replace); return; }
    if (op.k) { s[op.k] = op.v; return; }
    const rows = (s[op.c] || []).slice(), i = rows.findIndex((r) => r.id === op.id);
    if (op.r === null) { if (i >= 0) rows.splice(i, 1); } else if (i >= 0) rows[i] = op.r; else rows.push(op.r);
    s[op.c] = rows;
  });
  return s;
}
const strip = (st) => { const o = {}; COLLS.concat(TOPS).forEach((k) => { if (st[k] !== undefined) o[k] = st[k]; }); return copy(o); };

/** Every edit calls this: quests tick themselves, the device copy is saved, the server gets it shortly. */
function onChange(opts) {
  syncQuests(today());
  saveCache();
  schedulePush();
  if (!(opts && opts.quiet)) requestRender();
}
function schedulePush() { if (!CLOUD.email) return; clearTimeout(CLOUD.pushT); setSync('pending'); CLOUD.pushT = setTimeout(push, 700); }
async function push() {
  CLOUD.pushT = null;
  if (CLOUD.inflight) { CLOUD.pushT = setTimeout(push, 500); return; }
  const snap = strip(S), ops = diffOps(CLOUD.base, snap);
  if (!ops.length) { setSync('saved'); return; }
  CLOUD.inflight = true; setSync('saving');
  try {
    const r = await api('state', { method: 'PUT', body: { ops } });
    CLOUD.base = snap; CLOUD.rev = r.rev; CLOUD.offline = false; saveCache(); setSync('saved');
    if (r.gifts && r.gifts.length) { await refreshMe(); celebrateGifts(r.gifts); }
  } catch (e) {
    if (e.status === 402) { S = normalize(copy(CLOUD.base || {})); saveCache(); requestRender(); upgradeSheet(e.message); }
    else if (e.status === 401) signOut(true);
    else if (e.status === 0 || e.status >= 500 || e.status === 429 || e.status === 409) { CLOUD.offline = e.status === 0; setSync(e.status === 0 ? 'offline' : 'retry'); CLOUD.pushT = setTimeout(push, e.status === 0 ? 8000 : 3000); }
    else { toast(esc(e.message), 'bad'); setSync('error'); }
  } finally { CLOUD.inflight = false; }
}
async function poll() {
  if (!CLOUD.email || CLOUD.inflight || CLOUD.pushT) return;
  try {
    const r = await api('state?since=' + CLOUD.rev);
    if (r.state !== undefined) {
      const pending = diffOps(CLOUD.base, strip(S)).filter((o) => !o.replace);
      CLOUD.base = strip(normalize(copy(r.state || {})));
      S = normalize(applyOpsJs(copy(CLOUD.base), pending));
      CLOUD.rev = r.rev; saveCache(); requestRender();
    }
    CLOUD.offline = false; if (!CLOUD.pushT) setSync('saved');
  } catch (e) { if (e.status === 401) signOut(true); else if (e.status === 0) setSync('offline'); }
}
function setSync(s) {
  CLOUD.status = s;
  const el = $('#sync'); if (!el) return;
  const map = { saved: ['✓', 'Saved'], pending: ['•', 'Saving…'], saving: ['↻', 'Saving…'], offline: ['☁︎', 'Offline · saved on this phone'], retry: ['↻', 'Retrying…'], error: ['!', 'Not saved'] };
  const m = map[s] || map.saved; el.className = 'sync ' + s; el.title = m[1]; el.innerHTML = `<span>${m[0]}</span><em>${m[1]}</em>`;
}

async function refreshMe() {
  try { ME = await api('me'); saveCache(); applyTheme(); renderNavBadges(); return ME; } catch (e) { if (e.status === 401) signOut(true); return ME; }
}

/* ----- sign in (email + 6-digit code) ----- */
function gate(mode) {
  const ref = store.get('wk_ref') || '';
  sheet(`<div class="gate">
    <div class="g-logo">${LOGO}</div>
    <h2>${mode === 'login' ? 'Welcome back' : 'Start your free challenge'}</h2>
    <p class="muted">${mode === 'login' ? 'We’ll email you a code. No password.' : `${(LANDING && LANDING.freeDays) || 14} days free, no card needed. We’ll email you a code to sign in.`}</p>
    ${ref ? `<p class="pill ok">🎁 Friend’s referral applied</p>` : ''}
    <form id="g1"><input type="email" id="gm" placeholder="you@email.com" autocomplete="email" required><button class="btn big">Email me a code</button></form>
    <form id="g2" hidden><p class="muted">Code sent to <b id="gm2"></b> (check spam too)</p><input id="gc" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6-digit code" required><button class="btn big">Sign in</button><button type="button" class="link" id="gback">Use another email</button></form>
    <p class="tiny muted">By continuing you agree to our <a href="/terms" target="_blank">terms</a>. This app is for fitness tracking, not medical advice.</p>
  </div>`);
  $('#g1').onsubmit = async (e) => {
    e.preventDefault(); const b = e.target.querySelector('button'); b.disabled = true; b.textContent = 'Sending…';
    try { const r = await api('auth/start', { method: 'POST', body: { email: $('#gm').value } }); $('#g1').hidden = true; $('#g2').hidden = false; $('#gm2').textContent = r.email; $('#gc').focus(); if (r.devCode) $('#gc').value = r.devCode; }
    catch (err) { toast(esc(err.message), 'bad'); } finally { b.disabled = false; b.textContent = 'Email me a code'; }
  };
  $('#gback').onclick = () => { $('#g1').hidden = false; $('#g2').hidden = true; };
  $('#g2').onsubmit = async (e) => {
    e.preventDefault(); const b = e.target.querySelector('button'); b.disabled = true; b.textContent = 'Checking…';
    try {
      const r = await api('auth/verify', { method: 'POST', body: { email: $('#gm2').textContent, code: $('#gc').value, ref: store.get('wk_ref') || '', source: store.get('wk_src') || '' } });
      store.set('wk_token', r.token); store.set('wk_email', r.email); closeSheet(); await startApp(r.email);
    } catch (err) { toast(esc(err.message), 'bad'); b.disabled = false; b.textContent = 'Sign in'; }
  };
  setTimeout(() => $('#gm') && $('#gm').focus(), 200);
}

async function startApp(email) {
  CLOUD.email = email;
  document.documentElement.classList.remove('boot-out'); document.documentElement.classList.add('boot-app');
  const c = loadCache();
  if (c) { S = normalize(c.state); CLOUD.base = c.base; CLOUD.rev = c.rev || 0; ME = c.me || null; showApp(); }
  try {
    const [me, st] = await Promise.all([api('me'), api('state?since=-1')]);
    ME = me;
    const pending = c ? diffOps(CLOUD.base, strip(S)).filter((o) => !o.replace) : [];
    CLOUD.base = strip(normalize(copy(st.state || {}))); CLOUD.rev = st.rev;
    S = normalize(applyOpsJs(copy(CLOUD.base), pending));
    saveCache(); showApp(); if (pending.length) schedulePush();
  } catch (e) {
    if (e.status === 401) return signOut(true);
    if (!c) { document.documentElement.classList.add('boot-out'); toast('You’re offline. Open the app once with internet to set it up.', 'bad'); return; }
    CLOUD.offline = true; setSync('offline');
  }
  clearInterval(CLOUD.pollT); CLOUD.pollT = setInterval(() => { if (!document.hidden) { poll(); pollInbox(); } }, 30000);
  setTimeout(refreshMeEvery, 120000);
  afterStart();
}
function refreshMeEvery() { if (!document.hidden) refreshMe(); setTimeout(refreshMeEvery, 120000); }
document.addEventListener('visibilitychange', () => { if (!document.hidden && CLOUD.email) { poll(); pollInbox(); } });
window.addEventListener('online', () => { if (CLOUD.email) { schedulePush(); refreshMe(); } });

function signOut(expired) {
  if (CLOUD.email) store.del(cacheKey());
  store.del('wk_token'); store.del('wk_email'); clearInterval(CLOUD.pollT);
  CLOUD.email = null; ME = null; S = normalize({});
  try { caches.delete('wk-auth'); } catch (e) { /* none */ }
  document.documentElement.classList.remove('boot-app'); document.documentElement.classList.add('boot-out');
  showLanding(); if (expired) toast('Please sign in again.');
}

/* ----- inbox: cheers, nudges and group messages ----- */
let INBOX = { items: [], seen: store.get('wk_inbox_seen') || '' };
async function pollInbox() {
  if (!CLOUD.email) return;
  try {
    const r = await api('inbox?since=' + encodeURIComponent(new Date(Date.now() - 7 * 864e5).toISOString()));
    const fresh = r.items.filter((x) => x.at > (INBOX.seen || '') && !INBOX.items.some((y) => y.id === x.id));
    INBOX.items = r.items;
    if (fresh.length && INBOX.loaded) fresh.slice(0, 2).forEach((x) => toast(`<b>${esc(x.from)}</b> ${esc(x.text)}`, 'cheer'));
    INBOX.loaded = true; renderNavBadges();
  } catch (e) { /* offline */ }
}
const unread = () => INBOX.items.filter((x) => x.at > (INBOX.seen || '')).length;
function markInboxSeen() { if (INBOX.items[0]) { INBOX.seen = INBOX.items[0].at; store.set('wk_inbox_seen', INBOX.seen); renderNavBadges(); } }

/* ----- reminders (web push) ----- */
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
async function enableReminders(hour) {
  if (!pushSupported()) { toast(/iPhone|iPad/.test(navigator.userAgent) ? 'On iPhone: tap Share → Add to Home Screen, open the app from there, then turn on reminders.' : 'This browser can’t show reminders.', 'bad'); return false; }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { toast('Notifications are blocked. Allow them in your browser settings.', 'bad'); return false; }
  try {
    const reg = await navigator.serviceWorker.ready;
    const key = Uint8Array.from(atob(ME.vapid.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((ME.vapid.length + 3) % 4)), (c) => c.charCodeAt(0));
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
    await api('push', { method: 'POST', body: { sub: { endpoint: sub.endpoint }, hour } });
    await saveAuthForWorker();
    S.profile.reminderHour = hour; onChange();
    return true;
  } catch (e) { toast(esc(e.message || 'Couldn’t turn on reminders'), 'bad'); return false; }
}
async function disableReminders() {
  try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch (e) { /* none */ }
  try { await api('push', { method: 'POST', body: { sub: null } }); } catch (e) { /* offline */ }
  S.profile.reminderHour = null; onChange();
}
/** The offline worker reads the sign-in token from here to fetch what a push is about. */
async function saveAuthForWorker() { try { const c = await caches.open('wk-auth'); await c.put('/__wk_token', new Response(tok() || '')); } catch (e) { /* none */ } }

/* ----- payments ----- */
let RZP = null;
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  RZP = RZP || new Promise((ok, bad) => { const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = ok; s.onerror = () => { RZP = null; bad(new Error('Couldn’t load the payment window. Check your connection.')); }; document.body.appendChild(s); });
  return RZP;
}
async function buy(planId, coupon) {
  const o = await api('checkout', { method: 'POST', body: { plan: planId, coupon, ref: store.get('wk_ref') || ME.refCodeUsed || '' } });
  let res = {};
  if (o.provider === 'razorpay') {
    await loadRazorpay();
    res = await new Promise((ok, bad) => {
      let done = false;
      const r = new window.Razorpay(Object.assign({}, o.clientData, { order_id: o.orderId, name: 'Pandora Templates', description: 'Pandora Workout – 1 year', prefill: { email: CLOUD.email, name: S.profile.name || '' }, theme: { color: '#FF5A36' }, handler: (x) => { done = true; ok(x); }, modal: { ondismiss: () => { if (!done) bad(new Error('Payment cancelled. You can try again any time.')); } } }));
      r.open();
    });
  }
  const v = await api('checkout/verify', { method: 'POST', body: res });
  store.del('wk_ref');
  await refreshMe();
  return v;
}
