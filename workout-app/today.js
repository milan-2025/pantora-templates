/* ---------- router and the Today screen ---------- */
const ROUTES = {};
let ROUTE = 'today', SUB = {};
let RENDER_T = null;
function requestRender() { clearTimeout(RENDER_T); RENDER_T = setTimeout(() => { const a = document.activeElement; if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.closest('#main')) { RENDER_T = setTimeout(requestRender, 600); return; } render(); }, 30); }
function go(r) { if (location.hash !== '#' + r) location.hash = r; else render(); }
window.addEventListener('hashchange', () => { if (!KEEP_SHEET) closeSheet(); KEEP_SHEET = false; render(); window.scrollTo(0, 0); });
let KEEP_SHEET = false;
function render() {
  if (!CLOUD.email) return;
  const h = (location.hash || '#today').slice(1).split('/');
  ROUTE = ROUTES[h[0]] ? h[0] : 'today';
  $$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.r === ROUTE));
  header();
  const main = $('#main');
  main.innerHTML = ROUTES[ROUTE](h.slice(1));
  main.classList.remove('fade-in'); void main.offsetWidth; main.classList.add('fade-in');
  if (ROUTES[ROUTE].after) ROUTES[ROUTE].after(h.slice(1));
  animateFigures();
  checkLevelUp();
}
function header() {
  const name = S.profile.name || (CLOUD.email || '').split('@')[0];
  const hr = new Date().getHours();
  $('#hi-sm').textContent = hr < 5 ? 'Up late' : hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  $('#hi').textContent = name.split(' ')[0] || 'there';
  const lv = levelOf(xpAll().total);
  $('#avatar').innerHTML = esc((name[0] || '?').toUpperCase()) + `<i>${lv.level}</i>`;
}
function renderNavBadges() {
  const n = unread(); const b = $('#bell-n'); if (b) { b.hidden = !n; b.textContent = n; }
  const tg = $('#nav-tg'); if (tg) tg.hidden = !n;
  const rw = $('#nav-rw'); if (rw) rw.hidden = !newBadges().length && !(ME && ME.moneyBack && ME.moneyBack.reached && !ME.moneyBack.claim);
}
const newBadges = () => { const x = stats(); return BADGES.filter((b) => b.ok(x) && !S.game.seen.includes(b.id)); };

/* ---------- level-ups ---------- */
function checkLevelUp() {
  const lv = levelOf(xpAll().total).level;
  if (lv > (S.game.level || 1)) {
    S.game.level = lv; onChange({ quiet: true });
    setTimeout(() => { confetti(160); chime(); sheet(`<div class="celebrate"><span class="e">🆙</span><h2>Level ${lv}!</h2><p class="muted">You’re now <b>${esc(LEVELS[Math.min(lv, LEVELS.length) - 1])}</b>. Keep stacking days.</p>${lv === 5 ? '<p class="pill gold">🎨 Ocean theme unlocked (Me → Theme)</p>' : ''}<button class="btn big mt" data-close>Let’s go</button></div>`); }, 400);
  }
}

/* ---------- Today ---------- */
ROUTES.today = function () {
  const t = today(), r = dayRow(t) || { id: t }, st = chStatus(), plan = todayPlan(), si = streakInfo(), xp = xpAll(), lv = levelOf(xp.total);
  let h = '';
  h += accessBanner();
  const fz = freezeOffer();
  if (fz) h += `<div class="banner ice"><span class="e">🧊</span><div class="sp"><b>Save your ${fz.streak}-day streak?</b><div class="sm muted">You missed ${nice(fz.day, true)}. Use a streak freeze (${freezes().left} left).</div></div><button class="btn sm" data-act="freeze" data-d="${fz.day}">Use</button></div>`;
  if (comeback() && plan && !r.w) h += `<div class="banner hot"><span class="e">🔁</span><div><b>Welcome back!</b><div class="sm muted">Comeback mode: today’s workout is 30% lighter. Just show up.</div></div></div>`;

  // hero: challenge progress, streak and level
  if (!CH()) {
    h += `<div class="hero"><div class="chips"><span class="flame ${si.cur ? 'hot' : 'cold'}"><span class="f">🔥</span>${si.cur}</span><span class="pill gold">Lv ${lv.level} · ${esc(lv.name)}</span></div>
      <h2 style="margin-top:12px">Pick your challenge</h2><p class="muted">14 to 100 days. A plan for every day, guided workouts, and gifts for showing up.</p>
      <button class="btn big" data-act="setup">Choose a challenge</button><button class="link mt" data-act="justlog">Or just log today’s activity</button></div>`;
  } else if (st.before) {
    h += `<div class="hero"><span class="pill hot">${PROGRAMS[CH().program].emoji} ${esc(PROGRAMS[CH().program].name)}</span><h2 style="margin-top:12px">Starts ${nice(CH().start, true)}</h2><p class="muted">${diff(t, CH().start)} day${diff(t, CH().start) === 1 ? '' : 's'} to go. Do the day-1 tests then, so you can see how far you come.</p><button class="btn ghost sm" data-act="startnow">Start today instead</button></div>`;
  } else if (st.over) {
    h += finishedCard();
  } else {
    const p = PROGRAMS[CH().program];
    h += `<div class="hero"><div class="prog"><div class="ring" style="--p:${Math.round((st.n / st.len) * 100)}"><div><b>${st.n}</b><small>of ${st.len}</small></div></div>
      <div class="sp"><div class="chips" style="margin-bottom:8px"><span class="flame ${si.cur ? 'hot' : 'cold'}"><span class="f">🔥</span>${si.cur} day${si.cur === 1 ? '' : 's'}</span><span class="pill">🧊 ${freezes().left}</span></div>
      <b style="font-family:var(--fh);font-size:17px">${p.emoji} ${esc(p.name)}</b><div class="sm muted">${plan ? esc(plan.phaseName) + ' phase' : ''}${CH().groupCode ? ' · with your group' : ''}</div></div></div>
      <div class="row mt sm"><span class="pill gold">Lv ${lv.level}</span><div class="xpbar sp"><i style="width:${lv.pct}%"></i></div><span class="muted tiny">${fmt(xp.total - lv.from)}/${fmt(lv.to - lv.from)} XP</span></div></div>`;
  }

  // today's workout
  if (plan) h += workoutCard(plan, r);
  else if (!CH() || st.over) h += `<div class="card"><h3>🏃 Today’s activity</h3>${actsList(r)}<div class="row mt"><button class="btn sm" data-act="activity">+ Add activity</button>${r.w ? '<span class="pill ok">✓ Workout logged</span>' : `<button class="btn sm ghost" data-act="wdone">Mark a workout done</button>`}</div></div>`;

  // checkpoints
  const cp = checkpoints(r), need = T().need;
  h += `<div class="card"><h3>✅ Today’s checkpoints<span class="sp"></span><span class="pill ${isComplete(r) ? 'ok' : ''}">${cp}/5</span></h3><div class="cps">
    ${cpTile('workout', r.w || r.rest ? '✓' : '—', r.rest ? 'Rest day' : 'Workout', r.w || r.rest, '💪')}
    ${cpTile('water', num(r.water), `of ${T().water} glasses`, num(r.water) >= T().water, '💧')}
    ${cpTile('sleep', num(r.sleep) || '—', `of ${T().sleep} h sleep`, num(r.sleep) >= T().sleep, '😴')}
    ${cpTile('steps', r.steps ? (num(r.steps) >= 1000 ? (num(r.steps) / 1000).toFixed(1) + 'k' : r.steps) : '—', `of ${T().steps >= 1000 ? T().steps / 1000 + 'k' : T().steps} steps`, num(r.steps) >= T().steps, '👟')}
    ${cpTile('mob', num(r.mob), `of ${T().mob} min stretch`, num(r.mob) >= T().mob, '🧘')}
  </div><div class="cp-need">${isComplete(r) ? '<b style="color:var(--ok)">Complete day! 🎉</b> Your streak is safe.' : `Workout + ${need - 1} more = a complete day. <span class="sp"></span>${need - cp > 0 ? need - cp + ' to go' : ''}`}</div></div>`;

  // quests
  const qs = questsFor(t), qd = r.q || [];
  const chestOpen = num(r.bx) > 0, allDone = qd.length >= 3;
  h += `<div class="card"><h3>🎯 Daily quests<span class="sp"></span><span class="muted tiny">+${XP.quest} XP each</span></h3>${qs.map((q) => `<div class="q ${qd.includes(q.id) ? 'done' : ''}" ${q.id === 'mood' || q.id === 'weigh' || q.id === 'note' ? `data-act="q-${q.id}"` : ''}><div class="ck">${qd.includes(q.id) ? '✓' : ''}</div><span>${esc(q.t())}</span><em>+${XP.quest}</em></div>`).join('')}
    <div class="chest ${allDone && !chestOpen ? 'ready' : ''}" data-act="chest"><span class="e">${chestOpen ? '🪙' : '🎁'}</span><div class="sp"><b>${chestOpen ? `Chest opened: +${r.bx} XP` : allDone ? 'Tap to open your chest!' : 'Daily chest'}</b><div class="sm muted">${chestOpen ? 'Come back tomorrow for another one.' : 'Finish all 3 quests to open it.'}</div></div></div></div>`;

  // how you feel
  h += `<div class="card"><h3>🙂 How do you feel?</h3><div class="moods">${['😫', '😕', '😐', '🙂', '🤩'].map((m, i) => `<button data-act="mood" data-v="${i + 1}" class="${num(r.mood) === i + 1 ? 'on' : ''}">${m}</button>`).join('')}</div>
    <div class="grid2 mt"><div><label class="f">Weight (kg)</label><input type="number" inputmode="decimal" step="0.1" id="t-weight" value="${r.weight || ''}" placeholder="${lastWeight() || 'e.g. 72.5'}"></div><div><label class="f">Note</label><input id="t-note" value="${esc(r.note || '')}" placeholder="One line about today" maxlength="200"></div></div></div>`;

  // this week
  h += `<div class="card"><h3>📅 This week<span class="sp"></span><a href="#progress/map" class="sm">Full map →</a></h3>${weekStrip()}</div>`;
  if (ME && ME.access && ME.access.kind !== 'free' && !ME.groups.length && ME.buddy.status === 'none') h += `<div class="banner"><span class="e">🤝</span><div class="sp"><b>People who work out with a friend stick with it longer.</b><div class="sm muted">Start a group or get a random buddy.</div></div><a class="btn sm" href="#together">Find one</a></div>`;
  return h;
};
ROUTES.today.after = function () {
  const t = today();
  const w = $('#t-weight'); if (w) w.onchange = () => { setDay(t, { weight: w.value ? Number(w.value) : null }); };
  const n = $('#t-note'); if (n) n.onchange = () => { setDay(t, { note: n.value.trim() || null }); };
};

function cpTile(k, v, label, done, e) { return `<div class="cp ${done ? 'done' : ''}" data-act="cp" data-k="${k}"><span class="e">${e}</span><b>${v}</b><small>${label}</small></div>`; }
function lastWeight() { const r = S.days.filter((x) => num(x.weight) > 0).sort((a, b) => (a.id < b.id ? 1 : -1))[0]; return r ? r.weight : ''; }
function weekStrip(ref) {
  const m = monday(ref || today()), t = today(), from = CH() ? CH().start : (S.days.map((r) => r.id).sort()[0] || t);
  return `<div class="week">${[0, 1, 2, 3, 4, 5, 6].map((i) => { const d = shift(m, i), r = dayRow(d); const cls = isComplete(r) ? 'c' : r && r.fz ? 'z' : isLogged(r) ? 'l' : d < t && d >= from ? 'm' : ''; return `<div>${WD[(i + 1) % 7].slice(0, 2)}<i class="${cls} ${d === t ? 't' : ''}">${r && r.fz ? '🧊' : new Date(d + 'T12:00:00').getDate()}</i></div>`; }).join('')}</div>`;
}
function actsList(r) {
  const a = r.acts || []; if (!a.length) return '<p class="muted sm">Gym, a run, a game of badminton, a dance class… log anything you did.</p>';
  return a.map((x, i) => `<div class="li"><span class="e">${(ACTS.find((q) => q.id === x.t) || ACTS[ACTS.length - 1]).e}</span><div class="t"><b>${esc((ACTS.find((q) => q.id === x.t) || {}).n || x.t)}</b><small>${x.min ? x.min + ' min' : ''}${x.km ? ' · ' + x.km + ' km' : ''}${x.note ? ' · ' + esc(x.note) : ''}</small></div><button class="link" data-act="delact" data-i="${i}">Remove</button></div>`).join('');
}
const ACTS = [{ id: 'gym', e: '🏋️', n: 'Gym / weights' }, { id: 'run', e: '🏃', n: 'Run' }, { id: 'walk', e: '🚶', n: 'Walk' }, { id: 'cycle', e: '🚴', n: 'Cycling' }, { id: 'yoga', e: '🧘', n: 'Yoga class' }, { id: 'sport', e: '🏸', n: 'Sport' }, { id: 'swim', e: '🏊', n: 'Swim' }, { id: 'dance', e: '💃', n: 'Dance / Zumba' }, { id: 'hike', e: '🥾', n: 'Hike / trek' }, { id: 'other', e: '✨', n: 'Something else' }];

function workoutCard(plan, r) {
  const sess = plan.session, first = sess.blocks.find((b) => b.label !== 'Warm-up') || sess.blocks[0];
  const items = []; sess.blocks.forEach((b) => b.items.forEach((it) => { if (!items.some((x) => x.ex === it.ex && x.fast === it.fast)) items.push(it); }));
  const done = r.w || r.rest;
  return `<div class="card ${done ? '' : 'pulse'}"><div class="wo">${figureSvg(first.items[0].ex)}<div class="sp"><span class="pill ${plan.test ? 'gold' : 'hot'}">${plan.test ? '📈 Test day' : plan.rest ? '🌿 Recovery day' : 'Day ' + plan.n}</span><h3 style="margin-top:8px">${esc(sess.title)}</h3><div class="meta"><span>⏱ ~${plan.mins} min</span><span>${sess.blocks.reduce((a, b) => a + b.items.length * b.rounds, 0)} moves</span>${CH().adj && CH().adj !== 1 ? `<span>${CH().adj > 1 ? '⬆️ harder' : '⬇️ easier'}</span>` : ''}</div></div></div>
    <div class="exs">${items.map((it) => `<div class="ex" data-act="exinfo" data-ex="${it.ex}">${figureSvg(it.ex)}<b>${esc(EX[it.ex].n)}</b><small>${it.reps ? it.reps + ' reps' : fmtDur(it.secs)}${it.fast ? ' fast' : ''}</small></div>`).join('')}</div>
    ${done ? `<div class="row mt"><span class="pill ok">✓ ${r.rest && !r.w ? 'Rest day done' : 'Done' + (r.mins ? ' · ' + r.mins + ' min' : '')}</span><span class="sp"></span><button class="link" data-act="undo-w">Undo</button><button class="btn sm ghost" data-act="play">Do it again</button></div>`
      : `<button class="btn big mt" data-act="play">▶ ${plan.rest ? 'Start the flow' : 'Start workout'}</button><div class="row mt" style="justify-content:center;gap:18px">${plan.rest ? '<button class="link" data-act="restdone">Just mark rest day done</button>' : '<button class="link" data-act="wdone">I did my own workout</button>'}<button class="link" data-act="adjust">Easier / harder</button></div>`}
    ${plan.test ? `<div class="banner warn mt" style="margin-bottom:0"><span class="e">📈</span><div class="sp"><b>Test yourself today</b><div class="sm muted">${PROGRAMS[CH().program].tests.map((x) => esc(x.name)).join(' · ')}</div></div><button class="btn sm" data-act="tests">Log tests</button></div>` : ''}</div>`;
}

function finishedCard() {
  const c = CH(), from = c.start, to = shift(c.start, c.length - 1);
  const days = S.days.filter((r) => r.id >= from && r.id <= to), done = days.filter(isComplete).length, wos = days.filter((r) => r.w).length;
  return `<div class="hero c"><div class="celebrate"><span class="e">🎓</span></div><h2>Challenge complete!</h2><p class="muted">${esc(PROGRAMS[c.program].name)} · ${c.length} days</p>
    <div class="grid3 mt"><div class="stat"><b>${done}</b><small>complete days</small></div><div class="stat"><b>${wos}</b><small>workouts</small></div><div class="stat"><b>${Math.round((done / c.length) * 100)}%</b><small>score</small></div></div>
    <button class="btn big mt" data-act="nextch">Start my next challenge</button><button class="link mt" data-act="lifetime">Keep logging without a challenge</button></div>`;
}

function accessBanner() {
  if (!ME || !ME.access) return '';
  const a = ME.access;
  if (!a.canLog) return `<div class="banner warn"><span class="e">⏳</span><div class="sp"><b>${a.kind === 'free' ? 'Your free challenge has ended' : 'Your plan has ended'}</b><div class="sm muted">Everything you logged is safe. ${a.kind === 'free' ? 'Pick a plan to keep going.' : 'Renew to keep logging.'}</div></div><button class="btn sm" data-act="upgrade">${a.kind === 'free' ? 'See plans' : 'Renew'}</button></div>`;
  if (a.kind === 'free' && a.status === 'active' && a.daysLeft != null && a.daysLeft <= 5) return `<div class="banner hot"><span class="e">🎁</span><div class="sp"><b>${plural(a.daysLeft, 'day')} left in your free challenge</b><div class="sm muted">Keep your streak going all year${ME.plans[0] ? ' from ₹' + fmt(ME.plans[0].price) : ''}.</div></div><button class="btn sm" data-act="upgrade">Plans</button></div>`;
  if (a.kind !== 'free' && a.daysLeft != null && a.daysLeft <= 14 && a.kind === 'owner') return `<div class="banner warn"><span class="e">⏳</span><div class="sp"><b>Your plan ends in ${plural(a.daysLeft, 'day')}</b><div class="sm muted">Renew now and the new year starts when this one ends.</div></div><button class="btn sm" data-act="upgrade">Renew</button></div>`;
  return '';
}

/* ---------- actions (one listener for the whole app) ---------- */
const ACT = {};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const f = ACT[el.dataset.act]; if (f) { e.preventDefault(); f(el, e); }
});
const canLog = () => { if (ME && ME.access && !ME.access.canLog) { upgradeSheet(); return false; } return true; };

ACT.setup = () => setupWizard();
ACT.nextch = () => { archiveChallenge('finished'); setupWizard({ next: true }); };
ACT.lifetime = () => { archiveChallenge('finished'); S.challenge = null; onChange(); toast('Lifetime mode: log anything, any day.'); };
ACT.justlog = () => activitySheet();
ACT.startnow = () => { S.challenge.start = today(); onChange(); };
ACT.activity = () => { if (canLog()) activitySheet(); };
ACT.delact = (el) => { const r = dayRow(today()); r.acts.splice(Number(el.dataset.i), 1); if (!r.acts.length) delete r.acts; onChange(); };
ACT.play = () => { if (canLog()) startPlayer(todayPlan()); };
ACT.wdone = () => { if (!canLog()) return; sheet(`<h2>Log your own workout</h2><p class="muted">Did something else today? It still counts.</p><label class="f">What</label><div class="chipsel" id="wd-t">${ACTS.map((a, i) => `<button data-v="${a.id}" class="${i ? '' : 'on'}">${a.e} ${a.n}</button>`).join('')}</div><label class="f">Minutes</label><input id="wd-m" type="number" inputmode="numeric" value="30"><button class="btn big mt" id="wd-ok">Save</button>`);
  $$('#wd-t button').forEach((b) => (b.onclick = () => { $$('#wd-t button').forEach((x) => x.classList.toggle('on', x === b)); }));
  $('#wd-ok').onclick = () => { const t = today(), r = ensureDay(t), mins = num($('#wd-m').value); r.acts = (r.acts || []).concat([{ t: $('#wd-t .on').dataset.v, min: mins }]); finishWorkout({ mins, own: true }); closeSheet(); }; };
ACT.restdone = () => { if (!canLog()) return; setDay(today(), { rest: 1, mob: Math.max(num((dayRow(today()) || {}).mob), T().mob) }); celebrateSmall('🌿', 'Rest day done', 'Recovery is part of the plan.'); };
ACT['undo-w'] = () => { const r = dayRow(today()); delete r.w; delete r.rest; delete r.wt; delete r.mins; onChange(); };
ACT.adjust = () => sheet(`<h2>Make it fit you</h2><p class="muted">Changes reps and times for the rest of this challenge. You can change it again any time.</p><div class="opts">
  ${[[0.8, '🐢', 'Easier', 'Fewer reps, shorter holds'], [1, '👌', 'Just right', 'The plan as written'], [1.2, '🔥', 'Harder', 'More reps, longer holds']].map(([v, e, n, d]) => `<button class="opt ${Math.abs((CH().adj || 1) - v) < 0.05 ? 'on' : ''}" data-act="setadj" data-v="${v}"><span class="e">${e}</span><span><b>${n}</b><small>${d}</small></span></button>`).join('')}</div>`);
ACT.setadj = (el) => { S.challenge.adj = Number(el.dataset.v); onChange(); closeSheet(); toast('Plan updated'); };
ACT.exinfo = (el) => exerciseSheet(el.dataset.ex);
ACT.freeze = (el) => { setDay(el.dataset.d, { fz: 1 }); confetti(60); toast('🧊 Streak saved!'); };
ACT.mood = (el) => { if (!canLog()) return; setDay(today(), { mood: Number(el.dataset.v) }); };
ACT['q-mood'] = () => { const m = $('.moods'); if (m) m.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
ACT['q-weigh'] = () => { const w = $('#t-weight'); if (w) { w.scrollIntoView({ behavior: 'smooth', block: 'center' }); w.focus(); } };
ACT['q-note'] = () => { const w = $('#t-note'); if (w) { w.scrollIntoView({ behavior: 'smooth', block: 'center' }); w.focus(); } };
ACT.chest = () => {
  const t = today(), r = dayRow(t);
  if (!r || (r.q || []).length < 3 || num(r.bx) > 0) { if (!(r && num(r.bx) > 0)) toast('Finish all 3 quests to open the chest'); return; }
  const xp = chestXp(t); r.bx = xp; onChange(); confetti(120); chime(); vibrate([30, 40, 60]);
  sheet(`<div class="celebrate"><span class="e">🪙</span><h2>+${xp} XP</h2><p class="muted">Chest opened. A new one waits tomorrow.</p><button class="btn big mt" data-close>Nice!</button></div>`);
};
ACT.cp = (el) => { if (!canLog()) return; checkpointSheet(el.dataset.k); };
ACT.tests = () => testsSheet();
ACT.upgrade = () => upgradeSheet();

/* + / − buttons: tap for one step, keep pressing to count fast (speeds up the longer you hold). */
function holdRepeat(btn, step) {
  let t = null, n = 0;
  const stop = () => { clearTimeout(t); t = null; };
  const tick = () => { step(); n++; vibrate(5); t = setTimeout(tick, n < 6 ? 160 : n < 20 ? 80 : 40); };
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); stop(); n = 0; step(); vibrate(8); t = setTimeout(tick, 400); try { btn.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => btn.addEventListener(ev, stop));
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); step(); } });
}

function checkpointSheet(k) {
  const t = today(), r = dayRow(t) || {};
  if (k === 'workout') {
    const plan = todayPlan();
    if (r.w || r.rest) { sheet(`<h2>Workout done ✓</h2><p class="muted">${r.mins ? r.mins + ' minutes' : ''}</p><button class="btn ghost big" data-act="undo-w" data-close>Undo</button>`); return; }
    if (plan) { startPlayer(plan); return; }
    ACT.wdone(); return;
  }
  const cfg = { water: { n: 'Water', u: 'glasses', step: 1, max: 30, e: '💧' }, sleep: { n: 'Sleep last night', u: 'hours', step: 0.5, max: 14, e: '😴' }, mob: { n: 'Stretching / mobility', u: 'minutes', step: 5, max: 120, e: '🧘' }, steps: { n: 'Steps', u: 'steps', step: 500, max: 60000, e: '👟' } }[k];
  let v = num(r[k]);
  if (k === 'water') { setDay(t, { water: v + 1 }); toast(`💧 ${v + 1} of ${T().water} glasses${v + 1 === T().water ? ' · goal hit!' : ''}`); vibrate(15); return; }
  sheet(`<h2>${cfg.e} ${cfg.n}</h2><div class="stepper"><button id="st-m">−</button><b id="st-v">${k === 'steps' ? fmt(v) : v}</b><button id="st-p">+</button></div><p class="c muted">${cfg.u} · goal ${k === 'steps' ? fmt(T()[k]) : T()[k]}</p>${k === 'steps' ? '<input id="st-in" type="number" inputmode="numeric" placeholder="Or type the number from your phone">' : ''}<button class="btn big mt" id="st-ok">Save</button>`);
  const show = () => { $('#st-v').textContent = k === 'steps' ? fmt(v) : v; };
  holdRepeat($('#st-m'), () => { v = Math.max(0, v - cfg.step); show(); }); holdRepeat($('#st-p'), () => { v = Math.min(cfg.max, v + cfg.step); show(); });
  if ($('#st-in')) $('#st-in').oninput = (e) => { v = num(e.target.value); show(); };
  $('#st-ok').onclick = () => { setDay(t, { [k]: v || null }); closeSheet(); };
}

function activitySheet(day) {
  const d = day || today();
  sheet(`<h2>Add an activity</h2><div class="chipsel" id="ac-t">${ACTS.map((a, i) => `<button data-v="${a.id}" class="${i ? '' : 'on'}">${a.e} ${a.n}</button>`).join('')}</div>
    <div class="grid2"><div><label class="f">Minutes</label><input id="ac-m" type="number" inputmode="numeric" value="30"></div><div><label class="f">Distance (km, optional)</label><input id="ac-k" type="number" inputmode="decimal" step="0.1"></div></div>
    <label class="f">Note (optional)</label><input id="ac-n" maxlength="80" placeholder="e.g. Leg day, 5x5 squats 60 kg">
    <label class="row mt"><input type="checkbox" id="ac-w" checked style="width:auto"> Count it as my workout for the day</label><button class="btn big mt" id="ac-ok">Save</button>`);
  $$('#ac-t button').forEach((b) => (b.onclick = () => $$('#ac-t button').forEach((x) => x.classList.toggle('on', x === b))));
  $('#ac-ok').onclick = () => {
    const r = ensureDay(d), a = { t: $('#ac-t .on').dataset.v, min: num($('#ac-m').value) };
    if (num($('#ac-k').value)) a.km = num($('#ac-k').value); if ($('#ac-n').value.trim()) a.note = $('#ac-n').value.trim();
    r.acts = (r.acts || []).concat([a]);
    if ($('#ac-w').checked && !r.w) { closeSheet(); if (d === today()) finishWorkout({ mins: a.min, own: true }); else { r.w = 1; onChange(); } return; }
    onChange(); closeSheet();
  };
}

function exerciseSheet(id) {
  const e = EX[id];
  sheet(`<div class="c">${figureSvg(id).replace('class="fig"', 'class="fig" style="width:220px;height:220px"')}<h2>${esc(e.n)}</h2></div><ul>${e.cues.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
    ${e.easier || e.harder ? `<div class="row wrap">${e.easier ? `<button class="btn sm ghost" data-act="exinfo" data-ex="${e.easier}">Easier: ${esc(EX[e.easier].n)}</button>` : ''}${e.harder ? `<button class="btn sm ghost" data-act="exinfo" data-ex="${e.harder}">Harder: ${esc(EX[e.harder].n)}</button>` : ''}</div>` : ''}`);
}

/** Workout finished (player or own): marks the day, then asks how it felt. */
function finishWorkout(o) {
  const t = today(), r = ensureDay(t), before = xpAll().total, wasComplete = isComplete(r);
  const now = new Date();
  r.w = 1; r.wt = pad(now.getHours()) + ':' + pad(now.getMinutes()); if (!o.own) r.mins = num(r.mins) + Math.round(o.mins || 0); // own workouts carry their minutes in the activity
  if (o.rest) r.rest = 1;
  onChange();
  const gained = xpAll().total - before, si = streakInfo();
  confetti(); chime(); vibrate([40, 60, 40]);
  sheet(`<div class="celebrate"><span class="e">${o.rest ? '🌿' : '🏆'}</span><h2>${o.rest ? 'Flow done!' : 'Workout done!'}</h2>
    <p class="muted">+${gained} XP${si.cur ? ` · 🔥 ${si.cur}-day streak` : ''}${!wasComplete && isComplete(r) ? ' · complete day!' : ''}</p>
    ${o.own ? '' : `<p><b>How did it feel?</b></p><div class="opts" style="grid-template-columns:1fr 1fr 1fr">${[['easy', '😌', 'Too easy'], ['ok', '💪', 'Just right'], ['hard', '🥵', 'Too hard']].map(([v, e, n]) => `<button class="opt" style="flex-direction:column;justify-content:center" data-act="rpe" data-v="${v}"><span style="font-size:28px">${e}</span><b>${n}</b></button>`).join('')}</div>`}
    ${isComplete(r) ? '' : `<p class="sm muted mt">Tick ${T().need - checkpoints(r)} more checkpoint${T().need - checkpoints(r) === 1 ? '' : 's'} (water, sleep, steps, stretching) for a complete day.</p>`}
    <button class="btn big mt" data-close>Done</button></div>`);
}
/** Two "too easy" in a row nudges the plan up 10%; one "too hard" eases it 10%. */
ACT.rpe = (el) => {
  const v = el.dataset.v, r = ensureDay(today()); r.rpe = v;
  const c = S.challenge;
  if (c) {
    const prev = S.days.filter((x) => x.id < today() && x.rpe).sort((a, b) => (a.id < b.id ? 1 : -1))[0];
    if (v === 'hard') { c.adj = Math.max(0.7, Math.round(((c.adj || 1) - 0.1) * 10) / 10); toast('Got it: the next workouts will be a bit easier.'); }
    else if (v === 'easy' && prev && prev.rpe === 'easy') { c.adj = Math.min(1.4, Math.round(((c.adj || 1) + 0.1) * 10) / 10); toast('Levelling up: the next workouts get a bit harder 🔥'); }
  }
  onChange(); closeSheet();
};
function celebrateSmall(e, title, sub) { confetti(70); chime(); sheet(`<div class="celebrate"><span class="e">${e}</span><h2>${esc(title)}</h2><p class="muted">${esc(sub)}</p><button class="btn big mt" data-close>Done</button></div>`); }
function celebrateGifts(gifts) {
  confetti(220); chime(); vibrate([60, 60, 120]);
  const g = gifts[0];
  const what = { days: `${g.amount} free days added`, freeze: `${g.amount || 1} extra streak freeze`, coupon: 'A coupon for you', badge: 'A new badge', seat: `${g.amount || 1} more friend can join your plan` }[g.reward] || '';
  sheet(`<div class="celebrate"><span class="e">🎁</span><h2>Gift unlocked!</h2><p><b>${esc(g.title)}</b></p><p class="muted">${esc(g.note || what)}</p>${g.code ? `<p class="pill gold" style="font-size:16px">Code: <b>${esc(g.code)}</b></p>` : ''}${gifts.length > 1 ? `<p class="sm muted">+${gifts.length - 1} more gift${gifts.length > 2 ? 's' : ''} in Rewards</p>` : ''}<a class="btn big mt" href="#rewards" data-close>See my rewards</a></div>`);
}

/* ---------- picking a challenge ---------- */
function setupWizard(o) {
  o = o || {};
  const free = ME && ME.access && ME.access.kind === 'free';
  const st = { program: (CH() && CH().program) || 'home', length: free ? (ME.limits.freeDays || 14) : 30, start: today() };
  const step1 = () => {
    sheet(`<h2>${o.next ? 'Your next challenge' : 'Pick your challenge'}</h2><p class="muted">You can switch later. Each one has a plan for every day.</p><div class="opts">${PROGRAM_IDS.map((id) => { const p = PROGRAMS[id]; return `<button class="opt ${st.program === id ? 'on' : ''}" data-p="${id}"><span class="e">${p.emoji}</span><span><b>${esc(p.name)}</b><small>${esc(p.level)} · ${esc(p.gear)}<br>${esc(p.blurb)}</small></span></button>`; }).join('')}</div><button class="btn big mt" id="w-n">Next</button>`, { full: false });
    $$('.opt[data-p]').forEach((b) => (b.onclick = () => { st.program = b.dataset.p; $$('.opt[data-p]').forEach((x) => x.classList.toggle('on', x === b)); }));
    $('#w-n').onclick = step2;
  };
  const step2 = () => {
    const mon = monday(shift(today(), 7));
    sheet(`<h2>How long?</h2>${free ? `<p class="muted">Your free challenge is ${st.length} days. Plans unlock 14 to 100 days and unlimited challenges.</p>` : '<p class="muted">The plan stretches into four phases: Foundation, Build, Strengthen, Peak.</p>'}
      <div class="chipsel" id="w-len">${LENGTHS.map((n) => `<button data-v="${n}" class="${st.length === n ? 'on' : ''}" ${free && n !== st.length ? 'disabled style="opacity:.4"' : ''}>${n} days</button>`).join('')}</div>
      <label class="f">Start</label><div class="chipsel" id="w-st"><button data-v="${today()}" class="on">Today</button><button data-v="${shift(today(), 1)}">Tomorrow</button><button data-v="${mon}">Monday ${nice(mon)}</button></div>
      <div class="row mt"><button class="btn ghost" id="w-b">Back</button><button class="btn sp" id="w-n">Next</button></div>`);
    $$('#w-len button').forEach((b) => (b.onclick = () => { if (b.disabled) return; st.length = Number(b.dataset.v); $$('#w-len button').forEach((x) => x.classList.toggle('on', x === b)); }));
    $$('#w-st button').forEach((b) => (b.onclick = () => { st.start = b.dataset.v; $$('#w-st button').forEach((x) => x.classList.toggle('on', x === b)); }));
    $('#w-b').onclick = step1; $('#w-n').onclick = step3;
  };
  const step3 = () => {
    const t = T();
    sheet(`<h2>Your daily goals</h2><p class="muted">The 5 checkpoints. A day is complete when you do the workout and hit enough of them.</p>
      ${S.profile.name ? '' : '<label class="f">Your name</label><input id="w-name" placeholder="What should we call you?" maxlength="40">'}
      <div class="grid2"><div><label class="f">💧 Water (glasses)</label><input id="w-wa" type="number" value="${t.water}"></div><div><label class="f">😴 Sleep (hours)</label><input id="w-sl" type="number" step="0.5" value="${t.sleep}"></div>
      <div><label class="f">👟 Steps</label><input id="w-stp" type="number" step="500" value="${t.steps}"></div><div><label class="f">🧘 Stretching (min)</label><input id="w-mo" type="number" value="${t.mob}"></div></div>
      <label class="f">Checkpoints needed for a complete day</label><div class="chipsel" id="w-need">${[3, 4, 5].map((n) => `<button data-v="${n}" class="${t.need === n ? 'on' : ''}">${n} of 5</button>`).join('')}</div>
      <div class="row mt"><button class="btn ghost" id="w-b">Back</button><button class="btn sp" id="w-go">Start my challenge 🚀</button></div>`);
    let need = t.need;
    $$('#w-need button').forEach((b) => (b.onclick = () => { need = Number(b.dataset.v); $$('#w-need button').forEach((x) => x.classList.toggle('on', x === b)); }));
    $('#w-b').onclick = step2;
    $('#w-go').onclick = () => {
      if ($('#w-name') && $('#w-name').value.trim()) S.profile.name = $('#w-name').value.trim();
      S.profile.targets = { water: clamp(num($('#w-wa').value) || 8, 1, 30), sleep: clamp(num($('#w-sl').value) || 7, 1, 14), steps: clamp(num($('#w-stp').value) || 8000, 500, 50000), mob: clamp(num($('#w-mo').value) || 10, 1, 120), need };
      if (CH() && !o.next) archiveChallenge('stopped');
      S.challenge = { id: uid(), program: st.program, length: st.length, start: st.start, adj: 1, groupCode: o.groupCode || null };
      onChange(); closeSheet(); confetti(); go('today');
      setTimeout(() => toast(st.start === today() ? 'Day 1! Start with the tests, then today’s workout.' : `See you on ${nice(st.start, true)}!`), 600);
    };
  };
  if (o.program) { st.program = o.program; if (o.length && !free) st.length = o.length; if (o.start) st.start = o.start; step3(); } else step1();
}
function archiveChallenge(status) {
  const c = CH(); if (!c) return;
  const to = shift(c.start, c.length - 1), days = S.days.filter((r) => r.id >= c.start && r.id <= to);
  S.challenges.push({ id: c.id || uid(), program: c.program, length: c.length, start: c.start, end: status === 'finished' ? to : today(), status, complete: days.filter(isComplete).length, workouts: days.filter((r) => r.w).length });
}
