/* ---------- Wedding invite: the invite maker (/shaadi) connected to this planner ----------
 * The planner is the master guest list: each family gets its own invite link showing only its functions,
 * the WhatsApp invite button sends that link, and RSVPs and blessings come back into the guest rows.
 */
var INV = { linked: false, loaded: false }; // var: read by core.js helpers before this file runs
let INV_AT = 0, INV_BUSY = null;
const invCloud = () => CLOUD.on && CLOUD.id && CLOUD.meta && CLOUD.meta.role !== 'support';
const invCanEdit = () => invCloud() && (CLOUD.meta.role === 'owner' || CLOUD.meta.role === 'editor');

function invLoad(force) {
  if (!invCloud()) return Promise.resolve(INV);
  if (!force && Date.now() - INV_AT < 30000) return Promise.resolve(INV);
  if (INV_BUSY) return INV_BUSY;
  INV_BUSY = api('/planners/' + CLOUD.id + '/invite').then(r => {
    const was = JSON.stringify(INV); INV = Object.assign({ loaded: true }, r); INV_AT = Date.now();
    if (JSON.stringify(INV) !== was && (route === 'dash' || route === 'guests')) requestRender();
    return INV;
  }).catch(() => INV).finally(() => { INV_BUSY = null; });
  return INV_BUSY;
}
function invSet(r) { INV = Object.assign({ loaded: true }, r); INV_AT = Date.now(); delete INV.editUrl; requestRender(); }

/** The link a guest's WhatsApp invite carries: their family's personal link (Premium), or the invite's one link. */
function invLink(g) {
  if (!INV.linked || !INV.live) return '';
  return (INV.links && INV.links[gk(g)]) || INV.url || '';
}
const _invGuestVals = guestVals;
guestVals = function (g) { return Object.assign(_invGuestVals(g), { link: invLink(g) }); };

/** Families' replies (kept on the family's first guest by the server). */
function invReplies() {
  const out = [];
  d().groups.forEach((members, k) => { const h = members.find(m => m.ir); if (h) out.push({ k, g: h, ir: h.ir, members }); });
  return out.sort((a, b) => String(b.ir.at || '') < String(a.ir.at || '') ? -1 : 1);
}

/* opening the editor (a tab opened straight away, so pop-up blockers allow it) */
async function invOpen(op) {
  if (!invCanEdit()) { toast('Only the owner or family members who can edit can open the invite editor.'); return; }
  const w = window.open('', '_blank');
  try {
    if (w) w.document.body.innerHTML = '<p style="font-family:sans-serif;padding:24px">Opening your invite…</p>';
    const r = await api('/planners/' + CLOUD.id + '/invite', { method: 'POST', body: { op: op || 'open' } });
    if (w) w.location.href = r.editUrl; else location.href = r.editUrl;
    invSet(r); track('InviteOpen');
  } catch (e) { if (w) w.close(); toast(e.message); }
}

function invConnectModal() {
  const m = modal('<h2>Connect your invite</h2><p>Already made an invite at pandoratemplates.com/shaadi? Paste its <b>private edit link</b> (from the “Your invite is live” email, or the invite editor). It ends with <code>#k=…</code>.</p>' +
    '<textarea class="inp" data-l style="width:100%;min-height:70px" placeholder="https://pandoratemplates.com/i/…/edit#k=…"></textarea>' +
    '<p class="note">The invite’s guests that aren’t in your planner are added to your Guest List, replies so far are matched to families, and from then on this planner keeps the invite’s guest list and functions up to date.</p>' +
    '<div class="bar" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-x>Cancel</button><button class="btn pri" data-go>Connect</button></div>');
  $('[data-x]', m).onclick = () => m.remove();
  $('[data-go]', m).onclick = async e => {
    const b = e.target; b.disabled = true; b.textContent = 'Connecting…';
    try {
      const r = await api('/planners/' + CLOUD.id + '/invite', { method: 'POST', body: { op: 'connect', link: $('[data-l]', m).value.trim() } });
      m.remove(); invSet(r); await poll(true);
      toast('💌 Invite connected' + (r.imported ? ' · ' + r.imported + ' guest' + (r.imported > 1 ? 's' : '') + ' added to your list' : ''));
    } catch (x) { toast(x.message); b.disabled = false; b.textContent = 'Connect'; }
  };
}

/* replies nobody could match (sent from the invite's general link) */
function invReviewModal() {
  const fams = Array.from(d().groups.keys()).sort((a, b) => a.localeCompare(b));
  const m = modal('<h2>New RSVPs to review</h2><p class="note">These came from your invite’s general link, so we couldn’t tell which family sent them. Match each to a family, add it as new guests, or ignore it.</p><div data-rv></div><div class="bar" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-x>Close</button></div>');
  const draw = () => {
    const list = INV.review || [];
    $('[data-rv]', m).innerHTML = list.length ? list.map(r => '<div class="card" style="margin:10px 0;padding:12px 14px" data-id="' + esc(r.id) + '"><b>' + esc(r.name) + '</b> · ' + r.guests + ' ' + (r.guests === 1 ? 'person' : 'people') +
      '<div class="note">' + esc(r.events ? 'Coming to ' + r.events : 'Not coming') + (r.meal ? ' · ' + esc(r.meal) : '') + ' · ' + esc(dshow(String(r.at || '').slice(0, 10))) + '</div>' + (r.message ? '<div class="note" style="font-style:italic">“' + esc(r.message) + '”</div>' : '') +
      '<div class="bar" style="margin-top:8px"><select class="sel" data-f><option value="">Match to a family…</option>' + fams.map(f => '<option>' + esc(f) + '</option>').join('') + '</select><button class="btn sm pri" data-a="match">Match</button><button class="btn sm" data-a="add">Add as new guest</button><button class="btn sm ghost" data-a="ignore">Ignore</button></div></div>').join('') : '<div class="ok-note">All replies are in your Guest List. 🎉</div>';
  };
  draw();
  $('[data-x]', m).onclick = () => m.remove();
  $('[data-rv]', m).onclick = async e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const box = b.closest('[data-id]'), family = $('[data-f]', box).value;
    if (b.dataset.a === 'match' && !family) { toast('Pick the family first'); return; }
    b.disabled = true;
    try {
      const r = await api('/planners/' + CLOUD.id + '/invite', { method: 'POST', body: { op: 'review', rsvp: box.dataset.id, action: b.dataset.a, family } });
      invSet(r); await poll(true); draw();
    } catch (x) { toast(x.message); b.disabled = false; }
  };
}

/* blessings left on the invite → thank-you messages */
function invBlessingsModal() {
  const list = invReplies().filter(x => x.ir.msg);
  const m = modal('<h2>Blessings from your invite</h2>' + (list.length ? list.map((x, i) => '<div class="card" style="margin:10px 0;padding:12px 14px"><b>' + esc(x.k) + '</b>' + (x.ir.name && x.ir.name !== x.k ? ' <span class="note">(' + esc(x.ir.name) + ')</span>' : '') + '<p style="margin:6px 0;font-style:italic">“' + esc(x.ir.msg) + '”</p><div class="bar">' + (x.ir.thanked ? pill('Thanked', 'ok') : '') + '<button class="btn sm' + (x.ir.thanked ? '' : ' pri') + '" data-t="' + i + '">💬 ' + (x.ir.thanked ? 'Thank again' : 'Send thank-you') + '</button><button class="btn sm ghost" data-p="' + esc(x.g.id) + '">Open guest</button></div></div>').join('') : '<div class="empty">No blessings yet.</div>') +
    '<div class="bar" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-x>Close</button></div>');
  $('[data-x]', m).onclick = () => m.remove();
  m.addEventListener('click', e => {
    const p = e.target.closest('[data-p]'); if (p) { m.remove(); openProfile('guest', p.dataset.p); return; }
    const t = e.target.closest('[data-t]'); if (!t) return;
    const x = list[+t.dataset.t], ph = (x.members.find(g => phoneDigits(g.phone)) || {}).phone;
    m.remove();
    msgPicker({ phone: ph, title: 'Thank ' + x.k, choices: [['thanks', 'Thank-you', { name: x.k, gift: '' }, () => { if (!x.ir.thanked && !RO()) { undoRow('guests', x.g, 'Thanked ' + x.k); x.g.ir = Object.assign({}, x.g.ir, { thanked: true }); dirty(); requestRender(); } }]] });
  });
}

/* ---------- cards ---------- */
function invStatusLine() {
  if (!INV.live) return '📝 <b>Draft.</b> Finish the design, then choose a plan in the editor to make it live.';
  if (!INV.premium) return '✅ <b>Live</b> (Basic: one link for everyone). Upgrade to Premium in the editor so each family gets its own link with only its functions, and RSVPs match automatically.';
  return '✅ <b>Live on ' + esc(INV.plan === 'royal' ? 'Royal' : 'Premium') + '.</b> Each family has its own link showing only its functions.';
}
function invCard() {
  if (!invCloud() || (!INV.loaded && !INV.linked)) return null;
  const card = el('<div class="card" id="invc" style="margin-bottom:14px"></div>');
  if (!INV.linked) {
    if (!invCanEdit()) return null;
    const b = INV.bundle || {};
    card.innerHTML = '<h3>💌 Wedding invite <small>new</small></h3><p>Send every family a beautiful digital invite with its own link. Names, date, functions and your guest list are filled in from this planner, and <b>RSVPs and blessings come back here by themselves</b>.</p>' +
      '<div class="bar" style="margin-top:10px"><button class="btn pri" data-inv="create">✨ Make my invite</button><button class="btn" data-inv="connect">I already have an invite</button>' +
      (b.on && CLOUD.meta.role === 'owner' && CLOUD.meta.status !== 'active' ? '<span class="note" style="margin-left:6px">Bundle: Planner Family + Invite Premium for <b>' + inr(b.price) + '</b> <a data-upgrade>See bundle</a></span>' : '') + '</div>';
  } else {
    const o = d(), rep = invReplies(), coming = rep.reduce((a, x) => a + (x.ir.n || 0), 0), bl = rep.filter(x => x.ir.msg), todo = bl.filter(x => !x.ir.thanked).length;
    const sentFam = Array.from(o.groups.values()).filter(ms => ms.some(g => g.invited === 'Yes')).length;
    const checks = rep.filter(x => x.ir.n && x.ir.n !== x.members.length).slice(0, 3);
    const rv = (INV.review || []).length;
    card.innerHTML = '<h3>💌 Wedding invite <small>' + esc(INV.url.replace(/^https?:\/\//, '')) + '</small></h3>' +
      '<div class="grid g4" style="margin:6px 0 10px">' + kpi('Families on the invite', INV.families, o.nGroups + ' in your Guest List') + kpi('Invites sent', sentFam, 'families, from the Guest List', 'm') + kpi('Replied', rep.length, coming + ' people coming', 't') + kpi('Blessings', bl.length, todo ? todo + ' to thank' : 'all thanked', 'c') + '</div>' +
      '<p class="note">' + invStatusLine() + '</p>' +
      (INV.note ? '<div class="banner" style="margin:8px 0"><span>📋 Planner changes waiting in the invite draft: <b>' + esc(INV.note) + '</b>. Open the editor to check them and press <b>Save &amp; publish</b>.</span></div>' : '') +
      (rv ? '<div class="banner" style="margin:8px 0"><span>📨 <b>' + rv + ' new RSVP' + (rv > 1 ? 's' : '') + '</b> from the general link need matching to a family.</span><span class="sp"></span><button class="btn sm pri" data-inv="review">Review</button></div>' : '') +
      (checks.length ? '<p class="note" style="margin-top:6px">Check headcount: ' + checks.map(x => '<a data-pg="' + esc(x.g.id) + '">' + esc(x.k) + '</a> said ' + x.ir.n + ', ' + x.members.length + ' listed').join(' · ') + '</p>' : '') +
      '<div class="bar" style="margin-top:10px">' + (invCanEdit() ? '<button class="btn pri" data-inv="open">✎ Open invite editor</button>' : '') + '<a class="btn" href="' + esc(INV.url) + '" target="_blank" rel="noopener">👁 View invite</a>' + (bl.length ? '<button class="btn" data-inv="bless">🙏 Blessings</button>' : '') + '<button class="btn ghost" data-go="guests">Send invites from the Guest List</button></div>';
  }
  card.onclick = e => {
    const pg = e.target.closest('[data-pg]'); if (pg) { openProfile('guest', pg.dataset.pg); return; }
    const b = e.target.closest('[data-inv]'); if (!b) return;
    const a = b.dataset.inv;
    if (a === 'create') invOpen('create'); else if (a === 'open') invOpen('open'); else if (a === 'connect') invConnectModal(); else if (a === 'review') invReviewModal(); else if (a === 'bless') invBlessingsModal();
  };
  return card;
}
/* the Guest List: a slim banner */
function invBanner() {
  if (!invCloud() || !INV.loaded) return null;
  if (!INV.linked) {
    if (!invCanEdit()) return null;
    return el('<div class="banner noprint" id="invb"><span>💌 <b>Turn this list into invites:</b> a digital wedding invite with a personal link for every family, and RSVPs back in this list automatically.</span><span class="sp"></span><button class="btn sm pri keep" data-inv="create">Make my invite</button><button class="btn sm keep" data-inv="connect">Connect an existing invite</button></div>');
  }
  const rv = (INV.review || []).length;
  return el('<div class="banner noprint" id="invb"><span>💌 <b>Invite connected.</b> ' + (INV.live ? (INV.premium ? 'The 💬 Invite button sends each family its own invite link.' : 'The 💬 Invite button includes your invite link.') : 'Make the invite live in the editor to add its link to WhatsApp invites.') + ' RSVPs fill in the Y/C/N columns by themselves.</span><span class="sp"></span>' +
    (rv ? '<button class="btn sm pri keep" data-inv="review">' + rv + ' RSVP' + (rv > 1 ? 's' : '') + ' to review</button>' : '') + (invCanEdit() ? '<button class="btn sm keep" data-inv="open">Open invite editor</button>' : '') + '</div>');
}
document.addEventListener('click', e => {
  const b = e.target.closest('#invb [data-inv]'); if (!b) return;
  const a = b.dataset.inv;
  if (a === 'create' || a === 'open') invOpen(a); else if (a === 'connect') invConnectModal(); else if (a === 'review') invReviewModal();
});

const _invDash = VIEWS.dash;
VIEWS.dash = function () {
  const v = _invDash(); invLoad();
  const c = invCard(); if (c) v.splice(Math.min(2, v.length), 0, c);
  return v;
};
const _invGuests = VIEWS.guests;
VIEWS.guests = function () {
  const v = _invGuests(); invLoad();
  const b = invBanner(); if (b) v.splice(Math.min(2, v.length), 0, b);
  return v;
};

/** Guest profile: what the family said on the invite. */
function invReplySec(g) {
  const head = d().groups.get(gk(g)), h = head && head.find(m => m.ir);
  if (!h) return '';
  const ir = h.ir;
  return sec('Invite reply', kv([
    ['Reply', ir.n ? ir.n + ' coming' + (ir.n !== (head || []).length ? ' <span class="note">(' + head.length + ' listed)</span>' : '') : 'Not coming'],
    ['Functions', esc((ir.ev || []).join(', '))], ['Meal', esc(ir.meal || '')], ['Replied by', esc(ir.name || '')], ['When', esc(dshow(String(ir.at || '').slice(0, 10)))],
    ['Blessing', ir.msg ? '<i>“' + esc(ir.msg) + '”</i>' + (ir.thanked ? ' ' + pill('Thanked', 'ok') : '') : '']
  ]));
}

/** Plan picker: the Planner + Invite bundle beside the plans (owner only, until the invite is Premium). */
function invBundleCard(owner) {
  const b = INV.bundle;
  if (!b || !b.on || INV.premium) return '';
  return '<div class="plan hot"><span class="pb">Best value</span><h3>Planner + Invite</h3><div class="pp">' + inr(b.price) + '</div><div class="note">Family plan + wedding invite Premium · valid 1 year</div><ul><li>Everything in Family</li><li>Digital wedding invite on Premium</li><li>A personal link for every family</li><li>RSVPs and blessings land in your Guest List</li></ul>' +
    (owner ? '<button class="btn pri wide keep" data-buy="bundle">Choose the bundle</button>' : '') + '</div>';
}

/** After sign-in: connect the invite the person came from (link in the invite editor or the follow-up email: #ik=<link>.<key>). */
function invAfterOpen() {
  let ik = null; try { ik = sessionStorage.getItem('pp_ik'); } catch (e) { /* ignore */ }
  invLoad(true).then(() => {
    if (!ik) return;
    try { sessionStorage.removeItem('pp_ik'); } catch (e) { /* ignore */ }
    if (INV.linked || !invCanEdit()) return;
    const i = ik.lastIndexOf('.'), slug = decodeURIComponent(ik.slice(0, i)), token = ik.slice(i + 1);
    if (!slug || !token) return;
    api('/planners/' + CLOUD.id + '/invite', { method: 'POST', body: { op: 'connect', slug, token } })
      .then(r => { invSet(r); poll(true); toast('💌 Your invite is connected to this planner' + (r.imported ? ' · ' + r.imported + ' guests added' : '')); })
      .catch(e => toast(e.message));
  });
}
(function () {
  const h = location.hash;
  if (h.indexOf('#ik=') === 0) {
    try { sessionStorage.setItem('pp_ik', h.slice(4)); } catch (e) { /* ignore */ }
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
  }
})();
