/* ---------- Together: groups, a random buddy, friends & family on your plan, messages ---------- */
let GROUP = null, BUDDY = null;
const PRESET_LIST = [['go', '💪 You got this!'], ['fire', '🔥 Keep that streak alive!'], ['proud', '🎉 So proud of you!'], ['done', '✅ Done with mine. Your turn!'], ['where', '👀 Haven’t seen your workout today…'], ['water', '💧 Drink some water!'], ['together', '🤝 Let’s do it together tomorrow'], ['rest', '😴 Rest day for me today'], ['tired', '😮‍💨 Tough one today, but I showed up'], ['clean', '🥗 Eating clean today']];
const wa = (text) => 'https://wa.me/?text=' + encodeURIComponent(text);
const initials = (n) => esc((n || '?').trim()[0] || '?').toUpperCase();

ROUTES.together = function (args) {
  const tab = args[0] || SUB.together || (ME && ME.groups.length ? 'groups' : 'groups'); SUB.together = tab;
  const tabs = [['groups', 'Groups'], ...(ME && ME.family ? [['family', '🏠 Family']] : []), ['buddy', 'Buddy'], ['plan', 'My plan’s people'], ['inbox', 'Messages' + (unread() ? ` (${unread()})` : '')]];
  return `<div class="tabs">${tabs.map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-act="ttab" data-v="${k}">${n}</button>`).join('')}</div>` + (TG_TABS[tab] || TG_TABS.groups)(args.slice(1));
};
ROUTES.together.after = function (args) {
  const tab = args[0] || SUB.together;
  const stale = (x) => !x || Date.now() - (x._at || 0) > 20000;
  if (tab === 'groups' && args[1] && (stale(GROUP) || GROUP.code !== args[1])) loadGroup(args[1]);
  if (tab === 'buddy' && ME && ME.buddy.status === 'matched' && stale(BUDDY)) loadBuddy();
  if (tab === 'inbox') markInboxSeen();
  if (tab === 'family' && (!FAMILY || Date.now() - (FAMILY._at || 0) > 20000)) { if (FAMILY) FAMILY._at = Date.now(); loadFamily(); }
  const f = $('#gp-f'); if (f) f.onsubmit = (e) => { e.preventDefault(); const t = $('#gp-t').value.trim(); if (t) groupSend({ text: t }); };
};
ACT.ttab = (el) => go('together/' + el.dataset.v);
const TG_TABS = {};

/* ----- groups ----- */
TG_TABS.groups = function (rest) {
  if (rest[0]) return groupScreen(rest[0]);
  const gs = (ME && ME.groups) || [];
  return `<div class="card"><h3>👥 Your groups</h3>${gs.length ? gs.map((g) => `<a class="li" href="#together/groups/${g.code}" style="text-decoration:none;color:inherit"><span class="e">${g.mode === 'together' && g.program && PROGRAMS[g.program] ? PROGRAMS[g.program].emoji : '👥'}</span><div class="t"><b>${esc(g.name)}</b><small>${g.people} ${g.people === 1 ? 'person' : 'people'} · ${g.mode === 'together' ? 'Same challenge together' : 'Logging together'}</small></div><span class="muted">›</span></a>`).join('') : '<p class="muted">Work out with friends, family or your office gang. See each other’s streaks, cheer, nudge, and win the week.</p>'}
    <div class="row mt"><button class="btn" data-act="gnew">+ Start a group</button><button class="btn ghost" data-act="gjoin">Join with a link</button></div></div>
    <p class="tiny muted c">Up to ${(ME && ME.limits.groupMax) || 10} people in a group. Anyone can join with the link, even on the free challenge.</p>`;
};
function groupScreen(code) {
  if (!GROUP || GROUP.code !== code) return `<div class="empty"><span class="e">👥</span>Loading the group…</div>`;
  const g = GROUP, mine = g.people.find((p) => p.email === CLOUD.email);
  return `<a href="#together/groups" class="link">‹ All groups</a><div class="hero mt"><h2>${esc(g.name)}</h2><p class="muted sm">${g.mode === 'together' && PROGRAMS[g.program] ? `${PROGRAMS[g.program].emoji} ${esc(PROGRAMS[g.program].name)} · ${g.length} days from ${nice(g.start)}` : 'Everyone on their own plan, logging together'}</p>
      <div class="row"><a class="btn sm" target="_blank" rel="noopener" href="${wa(`Join my workout group "${g.name}" on Pandora Workout 💪 ${g.link}`)}">Invite on WhatsApp</a><button class="btn sm ghost" data-act="gcopy">Copy link</button></div>
      ${g.mode === 'together' && CH() && CH().groupCode !== g.code ? `<button class="link mt" data-act="gfollow">Follow this group’s challenge</button>` : ''}</div>
    ${goalCard(g)}
    <div class="card ppl"><h3>🏆 This week<span class="sp"></span><span class="tiny muted">by XP</span></h3>${g.people.map((p, i) => `<div class="li"><span class="e">${['🥇', '🥈', '🥉'][i] || initials(p.name)}</span><div class="t"><b>${esc(p.name)}${p.email === CLOUD.email ? ' (you)' : ''}</b><small>🔥 ${p.streak} · Lv ${p.level}${p.day ? ' · day ' + p.day : ''} · ${p.todayDone ? '✅ done today' : p.workedOut ? '💪 worked out' : p.todayLogged ? '📝 logging' : '⏳ not yet today'}</small></div><div class="v">${fmt(p.weekXp)}</div>${p.email !== CLOUD.email ? `<button class="btn sm ghost" data-act="gcheer" data-to="${esc(p.email)}" data-n="${esc(p.name)}">${p.todayDone ? '👏' : '👉'}</button>` : ''}</div>`).join('')}</div>
    <div class="card"><h3>💬 Group chat<span class="sp"></span>${voiceSupported() ? '<button class="btn sm ghost" data-act="gvoice" aria-label="Voice note">🎤</button>' : ''}</h3><div class="feed" id="gp-feed">${g.feed.length ? g.feed.slice().reverse().map(msgHtml).join('') : '<p class="muted sm c">Say hi to get things going.</p>'}</div>
      <div class="presets">${PRESET_LIST.map(([k, t]) => `<button data-act="gpre" data-k="${k}">${t}</button>`).join('')}</div>
      <form class="row" id="gp-f"><input id="gp-t" maxlength="160" placeholder="Message the group"><button class="btn">Send</button></form></div>
    <button class="link" data-act="gleave">Leave this group</button>${mine ? '' : ''}`;
}
const msgHtml = (m) => m.kind === 'event' ? `<div class="msg ev"><b>${esc(m.from)}</b> ${esc(m.text)}</div>` : `<div class="msg ${m.fromMe ? 'me' : ''}"><small>${m.fromMe ? 'You' : esc(m.from)}${m.to ? ' → ' + (m.toMe ? 'you' : esc(m.to)) : ''} · ${ago(m.at)}</small>${m.kind === 'voice' ? voiceHtml(m) : esc(m.text)}</div>`;
async function loadGroup(code) {
  try { GROUP = await api('groups/view?code=' + encodeURIComponent(code)); GROUP._at = Date.now(); if (ROUTE === 'together') { const y = window.scrollY; render(); window.scrollTo(0, y); const f = $('#gp-feed'); if (f) f.scrollTop = f.scrollHeight; } }
  catch (e) { toast(esc(e.message), 'bad'); if (e.status === 403 || e.status === 404) go('together/groups'); }
}
function markCheered() { const r = ensureDay(today()); if (!r.cheered) { r.cheered = 1; onChange({ quiet: true }); } }
async function groupSend(body) {
  try { await api('groups/post', { method: 'POST', body: Object.assign({ code: GROUP.code }, body) }); if (body.kind === 'cheer' || body.kind === 'nudge' || body.preset) markCheered(); await loadGroup(GROUP.code); }
  catch (e) { toast(esc(e.message), 'bad'); }
}
ACT.gpre = (el) => groupSend({ preset: el.dataset.k });
ACT.gcheer = (el) => {
  sheet(`<h2>To ${esc(el.dataset.n)}</h2><div class="opts">${PRESET_LIST.slice(0, 7).map(([k, t]) => `<button class="opt" data-k="${k}"><span>${t}</span></button>`).join('')}${voiceSupported() ? '<button class="opt" data-k="voice"><span>🎤 Send a voice note</span></button>' : ''}</div>`);
  $$('.opt[data-k]').forEach((b) => (b.onclick = () => { if (b.dataset.k === 'voice') return ACT.gvoice({ dataset: { to: el.dataset.to, n: el.dataset.n } }); closeSheet(); groupSend({ to: el.dataset.to, kind: b.dataset.k === 'where' ? 'nudge' : 'cheer', preset: b.dataset.k }); toast('Sent 🙌'); }));
};
ACT.gcopy = () => { try { navigator.clipboard.writeText(GROUP.link); toast('Link copied'); } catch (e) { toast(GROUP.link); } };
ACT.gleave = () => { sheet(`<h2>Leave “${esc(GROUP.name)}”?</h2><button class="btn big" id="gl-ok">Leave</button>`); $('#gl-ok').onclick = async () => { try { await api('groups/leave', { method: 'POST', body: { code: GROUP.code } }); if (CH() && CH().groupCode === GROUP.code) { S.challenge.groupCode = null; onChange({ quiet: true }); } GROUP = null; await refreshMe(); closeSheet(); go('together/groups'); } catch (e) { toast(esc(e.message), 'bad'); } }; };
ACT.gfollow = () => { const g = GROUP; if (!PROGRAMS[g.program]) return; setupWizard({ program: g.program, length: g.length, start: g.start < today() ? g.start : g.start, groupCode: g.code }); };
ACT.gnew = () => {
  sheet(`<h2>Start a group</h2><label class="f">Group name</label><input id="gn-n" maxlength="50" placeholder="e.g. Sharma family fit squad">
    <label class="f">How do you want to do it?</label><div class="opts"><button class="opt on" data-m="together"><span class="e">🤝</span><span><b>Same challenge together</b><small>Everyone follows the same plan from the same day</small></span></button><button class="opt" data-m="log"><span class="e">📝</span><span><b>Just log together</b><small>Everyone on their own plan; share streaks and cheers</small></span></button></div>
    <div id="gn-ch"><label class="f">Challenge</label><select id="gn-p">${PROGRAM_IDS.map((id) => `<option value="${id}" ${CH() && CH().program === id ? 'selected' : ''}>${PROGRAMS[id].emoji} ${esc(PROGRAMS[id].name)}</option>`).join('')}</select>
    <div class="grid2"><div><label class="f">Days</label><select id="gn-l">${lengthsOf(CH() ? CH().program : 'home').map((n) => `<option ${n === 30 ? 'selected' : ''}>${n}</option>`).join('')}</select></div><div><label class="f">Start</label><input id="gn-s" type="date" value="${monday(shift(today(), 7))}"></div></div></div>
    <button class="btn big mt" id="gn-ok">Create & get the invite link</button>`);
  let mode = 'together';
  $('#gn-p').onchange = () => { const l = lengthsOf($('#gn-p').value), d = PROGRAMS[$('#gn-p').value].def; $('#gn-l').innerHTML = l.map((n) => `<option ${n === (d || 30) ? 'selected' : ''}>${n}</option>`).join(''); };
  $$('.opt[data-m]').forEach((b) => (b.onclick = () => { mode = b.dataset.m; $$('.opt[data-m]').forEach((x) => x.classList.toggle('on', x === b)); $('#gn-ch').hidden = mode !== 'together'; }));
  $('#gn-ok').onclick = async () => {
    try {
      const r = await api('groups', { method: 'POST', body: { name: $('#gn-n').value, mode, program: $('#gn-p').value, length: Number($('#gn-l').value), start: $('#gn-s').value } });
      const o = { program: $('#gn-p').value, length: Number($('#gn-l').value), start: $('#gn-s').value, groupCode: r.code };
      await refreshMe(); closeSheet(); go('together/groups/' + r.code);
      if (mode === 'together') setTimeout(() => setupWizard(o), 300);
    } catch (e) { toast(esc(e.message), 'bad'); }
  };
};
ACT.gjoin = () => { sheet(`<h2>Join a group</h2><p class="muted">Paste the link a friend sent you.</p><input id="gj" placeholder="pandoratemplates.com/workout?join=…"><button class="btn big mt" id="gj-ok">Join</button>`); $('#gj-ok').onclick = () => { const m = $('#gj').value.match(/join=([a-z0-9]+)/i) || $('#gj').value.trim().match(/^([a-z0-9]{6,12})$/i); if (!m) return toast('That link doesn’t look right', 'bad'); closeSheet(); joinFlow(m[1].toLowerCase()); }; };
async function joinFlow(code) {
  try {
    const g = await api('groups/preview?code=' + encodeURIComponent(code));
    sheet(`<div class="c"><span style="font-size:52px">👥</span><h2>${esc(g.name)}</h2><p class="muted">${esc(g.by)} invited you · ${g.people} ${g.people === 1 ? 'person' : 'people'} so far</p>${g.mode === 'together' && PROGRAMS[g.program] ? `<p class="pill hot">${PROGRAMS[g.program].emoji} ${esc(PROGRAMS[g.program].name)} · ${g.length} days from ${nice(g.start)}</p>` : '<p class="pill">Logging together, everyone on their own plan</p>'}</div><button class="btn big mt" id="jf-ok">Join the group</button>`);
    $('#jf-ok').onclick = async () => {
      try {
        await api('groups/join', { method: 'POST', body: { code } }); store.del('wk_join'); await refreshMe(); closeSheet(); confetti(80);
        go('together/groups/' + code);
        if (g.mode === 'together' && PROGRAMS[g.program] && (!CH() || CH().program !== g.program)) setTimeout(() => setupWizard({ program: g.program, length: g.length, start: g.start, groupCode: code }), 300);
        else if (CH() && g.mode === 'together') { S.challenge.groupCode = code; onChange({ quiet: true }); }
      } catch (e) { toast(esc(e.message), 'bad'); }
    };
  } catch (e) { store.del('wk_join'); toast(esc(e.message), 'bad'); }
}

/* ----- random accountability buddy ----- */
TG_TABS.buddy = function () {
  const b = ME ? ME.buddy : { status: 'none', on: true };
  if (!b.on) return '<div class="empty"><span class="e">🤝</span>Buddy matching is paused right now.</div>';
  if (b.status === 'waiting') return `<div class="card c"><span style="font-size:52px">🔎</span><h2>Finding your buddy…</h2><p class="muted">We’ll match you with the next person who asks. You’ll get a notification.</p><button class="link" data-act="bcancel">Stop looking</button></div>`;
  if (b.status === 'matched') return BUDDY ? buddyScreen() : `<div class="empty"><span class="e">🤝</span>Loading your buddy…</div>`;
  const paid = ME && ME.access && ME.access.isPaid;
  return `<div class="card"><h2>🤝 Get a random accountability buddy</h2><p class="muted">We pair you with another member you don’t know. You see each other’s streak and today’s tick, and send cheers and nudges. No phone numbers unless you both choose to swap them after ${(ME && ME.limits.waAfterDays) || 7} days.</p>
    <ul class="muted sm"><li>Only first names are shown</li><li>Messages are quick presets, so it stays friendly</li><li>End it any time; report anything odd</li></ul>
    ${paid ? '<button class="btn big" data-act="brequest">Find me a buddy</button>' : '<button class="btn big" data-act="upgrade">Comes with a plan</button><p class="tiny muted c mt">Also free for friends and family on someone’s plan.</p>'}</div>`;
};
function buddyScreen() {
  const b = BUDDY, w = b.wa;
  return `<div class="hero"><div class="row"><div class="avatar" style="width:56px;height:56px;font-size:22px">${initials(b.buddy.name)}</div><div class="sp"><h2 style="margin:0">${esc(b.buddy.name)}</h2><div class="sm muted">Your buddy for ${plural(b.days, 'day')}${b.buddy.program && PROGRAMS[b.buddy.program] ? ' · ' + PROGRAMS[b.buddy.program].emoji + ' ' + esc(PROGRAMS[b.buddy.program].name) : ''}</div></div></div>
    <div class="grid2 mt"><div class="stat"><b>🔥 ${b.buddy.streak}</b><small>their streak</small></div><div class="stat"><b>${b.buddy.todayDone ? '✅' : b.buddy.workedOut ? '💪' : '⏳'}</b><small>${b.buddy.todayDone ? 'done today' : b.buddy.workedOut ? 'worked out' : 'not yet today'}</small></div></div></div>
    <div class="card"><h3>💬 Send something</h3><div class="presets" style="flex-wrap:wrap">${PRESET_LIST.map(([k, t]) => `<button data-act="bsend" data-k="${k}">${t}</button>`).join('')}</div><div class="feed mt">${b.feed.length ? b.feed.slice().reverse().map(msgHtml).join('') : '<p class="muted sm c">Say hi with a cheer!</p>'}</div></div>
    <div class="card"><h3>📱 WhatsApp</h3>${w.number ? `<p>You both agreed. <a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/${esc(w.number)}">Message ${esc(b.buddy.name)} on WhatsApp</a></p>` : !w.canAsk ? `<p class="muted sm">After ${w.after} days together you can choose to swap numbers. ${w.after - b.days} to go.</p>` : `<p class="muted sm">${w.mine ? 'You said yes. Waiting for ' + esc(b.buddy.name) + '.' : w.theirs ? esc(b.buddy.name) + ' is happy to swap numbers.' : 'Want to swap WhatsApp numbers? Only shown if you both say yes.'}</p>${w.mine ? '<button class="btn sm ghost" data-act="bshare" data-on="0">Take back</button>' : `${w.myNumberSet ? '' : '<input id="b-ph" placeholder="Your WhatsApp number" inputmode="tel" class="mb">'}<button class="btn sm" data-act="bshare" data-on="1">Yes, share my number</button>`}`}</div>
    <div class="row"><button class="link" data-act="bend">End buddy</button><span class="sp"></span><button class="link" data-act="breport" style="color:var(--bad)">Report</button></div>`;
}
async function loadBuddy() { try { BUDDY = await api('buddy'); BUDDY._at = Date.now(); if (BUDDY.status !== 'matched') { await refreshMe(); } if (ROUTE === 'together') render(); } catch (e) { /* offline */ } }
ACT.brequest = async () => { try { const r = await api('buddy/request', { method: 'POST' }); await refreshMe(); if (r.status === 'matched') { confetti(120); toast('You’ve got a buddy! 🤝'); loadBuddy(); } render(); } catch (e) { if (e.status === 402) upgradeSheet(e.message); else toast(esc(e.message), 'bad'); } };
ACT.bcancel = async () => { await api('buddy/action', { method: 'POST', body: { action: 'cancel' } }).catch(() => null); await refreshMe(); render(); };
ACT.bsend = async (el) => { try { await api('buddy/action', { method: 'POST', body: { action: 'send', preset: el.dataset.k } }); markCheered(); toast('Sent 🙌'); loadBuddy(); } catch (e) { toast(esc(e.message), 'bad'); } };
ACT.bshare = async (el) => { try { await api('buddy/action', { method: 'POST', body: { action: 'share', on: el.dataset.on === '1', phone: $('#b-ph') ? $('#b-ph').value : undefined } }); loadBuddy(); } catch (e) { toast(esc(e.message), 'bad'); } };
const endBuddy = (action) => { sheet(`<h2>${action === 'report' ? 'Report and end' : 'End this buddy?'}</h2><p class="muted">${action === 'report' ? 'We’ll end the match and won’t pair you again. Our team will review.' : 'You won’t be matched with them again. You can ask for a new buddy.'}</p><button class="btn big" id="be-ok">${action === 'report' ? 'Report' : 'End'}</button>`); $('#be-ok').onclick = async () => { await api('buddy/action', { method: 'POST', body: { action } }).catch(() => null); BUDDY = null; await refreshMe(); closeSheet(); render(); }; };
ACT.bend = () => endBuddy('end'); ACT.breport = () => endBuddy('report');

/* ----- friends & family on my plan ----- */
TG_TABS.plan = function () {
  const a = ME && ME.access; if (!a) return '';
  if (a.kind === 'member') return `<div class="card c"><span style="font-size:52px">🎟</span><h2>You’re on ${esc(a.ownerEmail.split('@')[0])}’s plan</h2><p class="muted">Everything is unlocked for you until ${niceLong(a.expiresAt)}. Say thanks with a cheer!</p></div>`;
  if (a.kind !== 'owner' || !a.isPaid) return `<div class="card"><h2>🎟 One plan, the whole family</h2><p class="muted">Buy once and add friends or family for free: 3 people on Basic, 7 on Pro. Each person gets their own challenge, log and streak.</p><button class="btn big" data-act="upgrade">See plans</button></div>`;
  const left = a.seats - a.members.length;
  return `<div class="card"><h3>🎟 People on your plan<span class="sp"></span><span class="pill">${a.members.length}/${a.seats}</span></h3><p class="muted sm">They sign in with their own email and use everything free until ${niceLong(a.expiresAt)}.</p>
    ${a.members.map((m) => `<div class="li ppl"><span class="e">${initials(m.name || m.email)}</span><div class="t"><b>${esc(m.name || m.email.split('@')[0])}</b><small>${esc(m.email)}</small></div><button class="link" data-act="mremove" data-e="${esc(m.email)}">Remove</button></div>`).join('')}
    ${left > 0 ? `<label class="f">Add someone (${left} place${left === 1 ? '' : 's'} left)</label><div class="grid2"><input id="m-n" placeholder="Name" maxlength="40"><input id="m-e" type="email" placeholder="Their email"></div><button class="btn mt" data-act="madd">Add & email them</button>` : `<p class="sm muted mt">All places used. Upgrade to Pro, or earn more places with milestones and referrals.</p>`}</div>
    <p class="tiny muted c">Friends on your plan can’t claim the money-back promise; it’s for you as the buyer.</p>`;
};
ACT.madd = async () => { try { await api('members', { method: 'POST', body: { email: $('#m-e').value, name: $('#m-n').value } }); await refreshMe(); render(); toast('Added. We emailed them.'); } catch (e) { if (e.status === 402) upgradeSheet(e.message); else toast(esc(e.message), 'bad'); } };
ACT.mremove = async (el) => { try { await api('members', { method: 'DELETE', body: { email: el.dataset.e } }); await refreshMe(); render(); } catch (e) { toast(esc(e.message), 'bad'); } };

/* ----- messages ----- */
TG_TABS.inbox = function () {
  if (!INBOX.items.length) return '<div class="empty"><span class="e">📭</span>Cheers and nudges from your groups and buddy show up here.</div>';
  return `<div class="card">${INBOX.items.map((m) => `<div class="li"><span class="e">${m.kind === 'nudge' ? '👉' : m.kind === 'event' ? '👋' : m.kind === 'cheer' ? '👏' : m.kind === 'voice' ? '🎤' : m.kind === 'alert' ? '🔥' : '💬'}</span><div class="t"><b>${esc(m.from)}</b><small>${esc(m.text)}</small></div><span class="tiny muted">${ago(m.at)}</span></div>`).join('')}</div>`;
};
