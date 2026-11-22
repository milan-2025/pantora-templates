/* ---------- extras: morning check-in, 10-minute mode, shortcuts, step counter, weekly recap card, journeys,
   retests, thali logging, group goals, family league, voice notes and pledges ---------- */

/* ===== morning check-in: 10 seconds that shape today's workout ===== */
const ENERGY = [['😫', 'Drained'], ['😕', 'Low'], ['😐', 'Okay'], ['🙂', 'Good'], ['🤩', 'Great']];
/** Today's workout size from the check-in: tired or short on sleep → 20% lighter; great and rested → 10% harder. */
function checkinScale(row) {
  if (!row || !row.ci) return 1;
  const sl = num(row.sleep);
  if (row.ci <= 2 || (sl && sl < 5.5)) return 0.8;
  if (row.ci >= 5 && (!sl || sl >= 7)) return 1.1;
  return 1;
}
function checkinPill(row) {
  const k = checkinScale(row);
  return k < 1 ? '<span>😴 lighter today</span>' : k > 1 ? '<span>⚡ a bit harder today</span>' : '';
}
function checkinCard(row) {
  if (row && row.ci) return '';
  const hr = new Date().getHours();
  if (hr >= 15 || (row && (row.w || row.rest))) return '';
  const sl = num(row && row.sleep);
  return `<div class="card ckin"><h3>☀️ Morning check-in<span class="sp"></span><span class="muted tiny">10 seconds</span></h3>
    <label class="f" style="margin-top:0">How long did you sleep?</label><div class="chipsel" id="ck-sl">${[5, 6, 7, 8, 9].map((h) => `<button data-v="${h}" class="${sl === h ? 'on' : ''}">${h === 5 ? '≤5' : h === 9 ? '9+' : h} h</button>`).join('')}</div>
    <label class="f">How’s your energy?</label><div class="moods" id="ck-en">${ENERGY.map(([e, n], i) => `<button data-v="${i + 1}" title="${n}">${e}</button>`).join('')}</div>
    <p class="tiny muted mt">Tired days get a lighter workout. Great days get a little extra.</p></div>`;
}
function bindCheckin() {
  const box = $('.ckin'); if (!box) return;
  let sl = num((dayRow(today()) || {}).sleep) || 0;
  $$('#ck-sl button', box).forEach((b) => (b.onclick = () => { sl = Number(b.dataset.v); $$('#ck-sl button', box).forEach((x) => x.classList.toggle('on', x === b)); }));
  $$('#ck-en button', box).forEach((b) => (b.onclick = () => {
    if (!canLog()) return;
    const ci = Number(b.dataset.v), r = dayRow(today()) || {};
    const patch = { ci, mood: r.mood || ci }; if (sl) patch.sleep = sl;
    setDay(today(), patch); vibrate(20);
    const k = checkinScale(dayRow(today()));
    toast(k < 1 ? '😴 Got it. Today’s workout is 20% lighter. Showing up is what counts.' : k > 1 ? '⚡ Feeling great! Today’s workout is a bit harder.' : '👍 Thanks! Today’s plan stays as it is.');
  }));
}
ACT['do-checkin'] = () => { go('today'); setTimeout(() => { const c = $('.ckin'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' }); else toast('Already checked in today ✓'); }, 250); };

/* ===== "Only 10 minutes?": a short version of today's workout ===== */
function shortSession(sess) {
  const cool = { label: 'Stretch', rounds: 1, rest: 0, items: [s('quad', 30), s('child', 30)] };
  if (sess.kind === 'cardio') {
    const main = sess.blocks.flatMap((b) => b.items).find((it) => it.ex === 'jog') || { ex: 'walk' };
    return { title: '10-minute ' + (main.ex === 'jog' ? 'run' : 'brisk walk'), kind: 'cardio', blocks: [{ label: 'Warm-up', rounds: 1, rest: 0, items: [s('walk', 60)] }, { label: 'Keep going', rounds: 1, rest: 0, items: [s(main.ex, 480)] }, cool] };
  }
  const main = sess.blocks.find((b) => !/warm|cool/i.test(b.label)) || sess.blocks[0];
  const items = main.items.slice(0, 5);
  const roundSecs = items.reduce((a, it) => a + (it.secs || (it.reps || 10) * (((EX[it.ex] && EX[it.ex].t) || 2000) / 1000) + 5) + 15, 0);
  const rounds = clamp(Math.floor(450 / Math.max(60, roundSecs)), 1, 3);
  return { title: '10-minute ' + sess.title.toLowerCase(), kind: sess.kind === 'flow' || sess.kind === 'rest' ? 'flow' : 'circuit', blocks: [{ label: 'Warm-up', rounds: 1, rest: 5, items: [s('march', 45)] }, { label: 'Quick round', rounds, rest: 30, items }, cool] };
}
function quickPlan() {
  const p = todayPlan();
  const base = p ? p.session : homeSession('A', 1, 1);
  const sess = shortSession(base);
  return { n: p ? p.n : 0, phase: p ? p.phase : 0, phaseName: p ? p.phaseName : '', rest: false, test: false, session: sess, mins: estMinutes(sess), quick: 1 };
}
ACT.quick = () => { if (canLog()) startPlayer(quickPlan()); };
ACT['do-quick'] = ACT.quick;
ACT['do-play'] = () => { const p = todayPlan(); if (!canLog()) return; if (p) startPlayer(p); else ACT.quick(); };
ACT['do-water'] = () => { if (!canLog()) return; const v = num((dayRow(today()) || {}).water) + 1; setDay(today(), { water: v }); toast(`💧 ${v} of ${T().water} glasses${v === T().water ? ' · goal hit!' : ''}`); vibrate(15); };

/** Home-screen shortcuts and notification links open /workout#do-<action>. Returns true when it handled one. */
function doHash() {
  const m = (location.hash || '').match(/^#do-([a-z]+)$/);
  if (!m) return false;
  try { history.replaceState(null, '', location.pathname + location.search + '#today'); } catch (e) { /* ignore */ }
  if (!CLOUD.email) return true;
  render();
  const f = ACT['do-' + m[1]]; if (f) setTimeout(() => f(), 150);
  return true;
}

/* ===== step counter: counts steps with the phone's motion sensor while this screen is open ===== */
const PEDO = { on: false, n: 0, last: 0, avg: 9.8, prev: 0, lock: null, h: null };
function pedoStep(e) {
  const a = e.accelerationIncludingGravity; if (!a) return;
  const m = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
  PEDO.avg = PEDO.avg * 0.95 + m * 0.05; // slow average = gravity
  const v = m - PEDO.avg, now = Date.now();
  if (PEDO.prev <= 1.2 && v > 1.2 && now - PEDO.last > 280) { PEDO.n++; PEDO.last = now; const el = $('#pd-n'); if (el) el.textContent = fmt(PEDO.n); }
  PEDO.prev = v;
}
async function pedoStart() {
  try { if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function' && (await DeviceMotionEvent.requestPermission()) !== 'granted') { toast('Allow motion access to count steps.', 'bad'); return false; } } catch (e) { toast('Allow motion access to count steps.', 'bad'); return false; }
  if (!('ondevicemotion' in window)) { toast('This phone can’t count steps in the browser. Type them in from your phone’s health app instead.', 'bad'); return false; }
  PEDO.on = true; PEDO.n = 0; PEDO.last = 0; PEDO.prev = 0;
  window.addEventListener('devicemotion', pedoStep);
  try { if (navigator.wakeLock) PEDO.lock = await navigator.wakeLock.request('screen'); } catch (e) { /* none */ }
  return true;
}
function pedoStop() { PEDO.on = false; window.removeEventListener('devicemotion', pedoStep); try { PEDO.lock && PEDO.lock.release(); } catch (e) { /* none */ } PEDO.lock = null; }
ACT.pedo = async () => {
  if (!canLog()) return;
  sheet(`<div class="c"><span style="font-size:52px">🚶</span><h2>Step counter</h2><p class="muted">Keep this screen open and the phone in your hand or pocket while you walk. Steps are added to today when you stop.</p>
    <div class="pl-timer" id="pd-n">0</div><p class="muted">steps this walk</p><button class="btn big mt" id="pd-go">Start counting</button><button class="link mt" data-close style="display:block;margin:10px auto 0">Close</button>
    <p class="tiny muted mt">Counts only while the app is open. For all-day steps, type in the number from Google Fit or Apple Health.</p></div>`);
  const b = $('#pd-go');
  b.onclick = async () => {
    if (!PEDO.on) { if (await pedoStart()) { b.textContent = 'Stop & add steps'; vibrate(30); } return; }
    pedoStop(); const n = PEDO.n; closeSheet();
    if (n > 0) { const cur = num((dayRow(today()) || {}).steps); setDay(today(), { steps: cur + n }); confetti(50); toast(`👟 +${fmt(n)} steps · ${fmt(cur + n)} today`); }
  };
};
const _closeSheetPedo = closeSheet;
// eslint-disable-next-line no-func-assign
closeSheet = function () { if (PEDO.on && $('#pd-n')) pedoStop(); _closeSheetPedo(); };

/* ===== weekly recap card (an image to share on WhatsApp or Stories) ===== */
function weekNumbers(mon) {
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => dayRow(shift(mon, i)));
  const done = days.filter(isComplete).length, wo = days.filter((x) => x && x.w).length;
  const mins = days.reduce((a, x) => a + num(x && x.mins) + ((x && x.acts) || []).reduce((b, q) => b + num(q.min), 0), 0);
  const steps = days.reduce((a, x) => a + num(x && x.steps), 0);
  const xp = xpAll(); let wxp = 0; for (let i = 0; i < 7; i++) wxp += xp.per[shift(mon, i)] || 0;
  const grade = done >= 6 ? 'A+' : done >= 5 ? 'A' : done >= 3 ? 'B' : done >= 1 ? 'C' : '–';
  return { days, done, wo, mins, steps, wxp, grade, logged: days.filter(isLogged).length };
}
async function recapImage(mon) {
  const w = weekNumbers(mon), si = streakInfo(), name = (S.profile.name || CLOUD.email.split('@')[0]).split(' ')[0];
  const cs = getComputedStyle(document.documentElement), ac = cs.getPropertyValue('--ac').trim() || '#FF5A36', ac2 = cs.getPropertyValue('--ac2').trim() || '#FF8A3D';
  const W = 1080, H = 1920, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  try { await Promise.race([document.fonts.load('800 80px Sora'), new Promise((ok) => setTimeout(ok, 1200))]); } catch (e) { /* use the fallback */ }
  const F = (wt, px) => `${wt} ${px}px Sora, Inter, system-ui, sans-serif`;
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0B1020'); g.addColorStop(0.55, '#141B33'); g.addColorStop(1, ac); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.globalAlpha = 0.18; x.fillStyle = ac2; x.beginPath(); x.arc(W - 120, 260, 360, 0, 7); x.fill(); x.globalAlpha = 1;
  x.fillStyle = '#fff'; x.textAlign = 'left';
  x.font = F(700, 44); x.fillText('🔥 Pandora Workout', 90, 170);
  x.font = F(600, 40); x.fillStyle = 'rgba(255,255,255,.7)'; x.fillText(`${nice(mon)} – ${nice(shift(mon, 6))}`, 90, 250);
  x.fillStyle = '#fff'; x.font = F(800, 92); x.fillText(`${name}’s week`, 90, 380);
  x.font = F(800, 330); x.fillStyle = ac2; x.fillText(w.grade, 80, 720);
  x.fillStyle = '#fff'; x.font = F(700, 52); x.fillText(w.done >= 5 ? 'Outstanding week!' : w.done >= 3 ? 'Solid week.' : w.done ? 'Small wins add up.' : 'Fresh start next week.', 90, 820);
  const stat = (i, big, small) => { const cx = 90 + (i % 2) * 470, cy = 900 + Math.floor(i / 2) * 250; x.fillStyle = 'rgba(255,255,255,.08)'; x.beginPath(); x.roundRect ? x.roundRect(cx, cy, 430, 210, 36) : x.rect(cx, cy, 430, 210); x.fill(); x.fillStyle = '#fff'; x.font = F(800, 86); x.fillText(big, cx + 36, cy + 110); x.font = F(500, 38); x.fillStyle = 'rgba(255,255,255,.7)'; x.fillText(small, cx + 36, cy + 170); };
  stat(0, `${w.done}/7`, 'complete days'); stat(1, String(w.wo), 'workouts'); stat(2, fmt(w.mins), 'minutes moved'); stat(3, `🔥 ${si.cur}`, 'day streak');
  // the week as 7 circles
  const y = 1480; for (let i = 0; i < 7; i++) { const cx = 150 + i * 130, dd = w.days[i]; x.beginPath(); x.arc(cx, y, 50, 0, 7); x.fillStyle = isComplete(dd) ? '#B8F23A' : isLogged(dd) ? 'rgba(184,242,58,.35)' : 'rgba(255,255,255,.1)'; x.fill(); x.fillStyle = isComplete(dd) ? '#122000' : '#fff'; x.font = F(700, 34); x.textAlign = 'center'; x.fillText(WD[(i + 1) % 7].slice(0, 2), cx, y + 12); }
  x.textAlign = 'left'; x.fillStyle = '#fff'; x.font = F(600, 40); x.fillText(`+${fmt(w.wxp)} XP${w.steps ? ' · ' + fmt(w.steps) + ' steps' : ''}`, 90, 1640);
  x.font = F(700, 44); x.fillText('Join me: pandoratemplates.com/workout', 90, 1790);
  if (ME && ME.referral) { x.font = F(500, 34); x.fillStyle = 'rgba(255,255,255,.75)'; x.fillText(`₹${ME.referral.friendOff} off with code ${ME.referral.code}`, 90, 1845); }
  return new Promise((ok) => c.toBlob(ok, 'image/png'));
}
async function recapSheet(mon) {
  mon = mon || monday(shift(today(), -7));
  S.game.recap = mon; onChange({ quiet: true });
  sheet(`<h2>📤 Your week, ready to share</h2><div id="rc-img" class="c"><p class="muted">Making your card…</p></div><div class="row mt"><button class="btn sp" id="rc-share">Share</button><a class="btn ghost" id="rc-dl" download="my-week.png">Save</a></div><p class="tiny muted mt c">Shows your first name, stats and streak. Nothing else.</p>`);
  let blob; try { blob = await recapImage(mon); } catch (e) { blob = null; }
  if (!blob) { const b = $('#rc-img'); if (b) b.innerHTML = '<p class="muted">Couldn’t make the card on this phone.</p>'; return; }
  const url = URL.createObjectURL(blob), w = weekNumbers(mon);
  $('#rc-img').innerHTML = `<img src="${url}" alt="Your week" style="width:min(100%,300px);border-radius:18px;box-shadow:var(--sh)">`;
  $('#rc-dl').href = url;
  $('#rc-share').onclick = async () => {
    const text = `My week on Pandora Workout: ${w.done}/7 complete days, ${w.wo} workouts 💪 ${(ME && ME.referral && ME.referral.link) || 'https://pandoratemplates.com/workout'}`;
    const file = new File([blob], 'my-week.png', { type: 'image/png' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    window.open(wa(text), '_blank', 'noopener');
  };
}
ACT.recap = () => recapSheet();
function recapBanner() {
  const lastMon = monday(shift(today(), -7));
  if (new Date().getDay() !== 1 && new Date().getDay() !== 2) return '';
  if (S.game.recap === lastMon || !weekNumbers(lastMon).logged) return '';
  return `<div class="banner hot"><span class="e">📤</span><div class="sp"><b>Your week in review is ready</b><div class="sm muted">Grade ${weekNumbers(lastMon).grade} · share it with your people</div></div><button class="btn sm" data-act="recap">See it</button></div>`;
}

/* ===== journeys: your kilometres as trips across India ===== */
const JOURNEYS = [
  { e: '🌊', n: 'Marine Drive, end to end', km: 3.6 }, { e: '🌉', n: 'Howrah Bridge → Victoria Memorial', km: 5 }, { e: '🏰', n: 'Charminar → Golconda Fort', km: 11 },
  { e: '🏖', n: 'Marina Beach, end to end', km: 13 }, { e: '🏙', n: 'Delhi → Gurugram', km: 32 }, { e: '⛰', n: 'Mumbai → Lonavala', km: 83 },
  { e: '🐘', n: 'Bengaluru → Mysuru', km: 145 }, { e: '🚂', n: 'Mumbai → Pune', km: 150 }, { e: '🕌', n: 'Delhi → Agra (Taj Mahal)', km: 233 },
  { e: '🏯', n: 'Delhi → Jaipur', km: 280 }, { e: '🌴', n: 'Mumbai → Goa', km: 590 }, { e: '🪔', n: 'Delhi → Varanasi', km: 820 }, { e: '🇮🇳', n: 'Kanyakumari → Kashmir', km: 3700 },
];
const STEP_KM = 0.00075;
function totalKm() { return S.days.reduce((a, d) => a + num(d.steps) * STEP_KM + (d.acts || []).reduce((b, q) => b + num(q.km), 0), 0); }
function journeyCard() {
  const km = totalKm(), doneN = JOURNEYS.filter((j) => km >= j.km).length, next = JOURNEYS[doneN];
  if (doneN > num(S.game.jr)) { const j = JOURNEYS[doneN - 1]; S.game.jr = doneN; setTimeout(() => { onChange({ quiet: true }); if (S.game.jrSeen) { confetti(160); chime(); toast(`${j.e} You’ve covered ${esc(j.n)}!`); } S.game.jrSeen = 1; }, 300); }
  const prevKm = doneN ? JOURNEYS[doneN - 1].km : 0;
  return `<div class="card"><h3>🗺 Your journey<span class="sp"></span><span class="pill">${km.toFixed(1)} km</span></h3>
    ${next ? `<div class="row"><span style="font-size:34px">${next.e}</span><div class="sp"><b>${esc(next.n)}</b><div class="sm muted">${(next.km - km).toFixed(1)} km to go · about ${fmt(Math.ceil((next.km - km) / STEP_KM))} steps</div><div class="bar mt" style="margin-top:8px"><i style="width:${clamp(((km - prevKm) / (next.km - prevKm)) * 100, 2, 100)}%"></i></div></div></div>` : '<p><b>🇮🇳 You’ve walked the length of India!</b></p>'}
    ${doneN ? `<div class="chips mt">${JOURNEYS.slice(0, doneN).reverse().slice(0, 6).map((j) => `<span class="pill ok">${j.e} ${esc(j.n.split(' → ').pop().split(',')[0])}</span>`).join('')}</div>` : ''}
    <p class="tiny muted mt">Counts your steps (about 75 cm each) and the km of walks, runs and rides you log.</p></div>`;
}

/* ===== retests every 2 weeks ===== */
function retestBanner(plan) {
  if (plan && plan.test) return '';
  const last = S.prs.map((p) => p.d).sort().pop();
  if (!last || diff(last, today()) < 14) return '';
  return `<div class="banner warn"><span class="e">📈</span><div class="sp"><b>Retest day</b><div class="sm muted">It’s been ${diff(last, today())} days since your last test. See how much stronger you are.</div></div><button class="btn sm" data-act="tests">Test</button></div>`;
}

/* ===== quick thali ===== */
const THALI = [['🫓', 'Roti / chapati'], ['🍚', 'Rice (cooked)'], ['🥣', 'Dal (tadka)'], ['🥦', 'Mixed veg sabzi'], ['🧀', 'Paneer butter masala'], ['🍗', 'Chicken curry'], ['🥚', 'Egg curry'], ['🥛', 'Curd (dahi)'], ['🥗', 'Green salad'], ['🥤', 'Buttermilk (chaas)'], ['🧈', 'Ghee'], ['🍮', 'Gulab jamun']];
const EXTRA_FOODS = { 'Papad (roasted)': ['Papad (roasted)', '1', 35, 2] };
const foodByName = (n) => FOODS.find((f) => f[0] === n) || EXTRA_FOODS[n];
ACT.thali = () => {
  if (!canLog()) return;
  const d = FOOD_DAY || today(), hr = new Date().getHours(), cnt = {};
  let slot = hr < 11 ? 'b' : hr < 16 ? 'l' : hr < 19 ? 's' : 'd';
  const items = THALI.filter(([, n]) => foodByName(n)).concat([['🫓', 'Papad (roasted)']]);
  sheet(`<h2>🍛 Quick thali</h2><p class="muted">Tap what’s on your plate: one tap per roti or katori.</p><div class="chipsel" id="th-slot">${SLOTS.map(([k, e, n]) => `<button data-v="${k}" class="${slot === k ? 'on' : ''}">${e} ${n}</button>`).join('')}</div>
    <div class="thali mt">${items.map(([e, n], i) => { const f = foodByName(n); return `<div class="th-i" data-i="${i}"><span class="e">${e}</span><b>${esc(n.split(' (')[0].split(' / ')[0])}</b><small>${esc(f[1])}</small><div class="th-c"><button data-m="${i}" aria-label="Less">−</button><em id="th-${i}">0</em><button data-p="${i}" aria-label="More">+</button></div></div>`; }).join('')}</div>
    <div class="row mt"><div class="sp"><b id="th-k">0 kcal</b><div class="sm muted" id="th-p">0 g protein</div></div><button class="btn" id="th-ok" disabled>Add thali</button></div>`);
  $$('#th-slot button').forEach((b) => (b.onclick = () => { slot = b.dataset.v; $$('#th-slot button').forEach((x) => x.classList.toggle('on', x === b)); }));
  const upd = () => {
    let k = 0, p = 0; Object.keys(cnt).forEach((i) => { const f = foodByName(items[i][1]); k += f[2] * cnt[i]; p += f[3] * cnt[i]; $('#th-' + i).textContent = cnt[i]; });
    $('#th-k').textContent = fmt(k) + ' kcal'; $('#th-p').textContent = Math.round(p) + ' g protein'; $('#th-ok').disabled = !k;
  };
  const bump = (i, by) => { cnt[i] = Math.max(0, (cnt[i] || 0) + by); if (!cnt[i]) { delete cnt[i]; $('#th-' + i).textContent = 0; } $$('.th-i')[i].classList.toggle('on', !!cnt[i]); vibrate(8); upd(); };
  $$('.th-i').forEach((el) => { const i = Number(el.dataset.i); el.onclick = (e) => { if (!e.target.closest('button')) bump(i, 1); }; });
  $$('[data-p]').forEach((b) => holdRepeat(b, () => bump(Number(b.dataset.p), 1)));
  $$('[data-m]').forEach((b) => holdRepeat(b, () => bump(Number(b.dataset.m), -1)));
  $('#th-ok').onclick = () => {
    let k = 0, p = 0; const parts = [];
    Object.keys(cnt).forEach((i) => { const f = foodByName(items[i][1]); k += f[2] * cnt[i]; p += f[3] * cnt[i]; parts.push(`${cnt[i]} ${f[0].split(' (')[0].split(' / ')[0].toLowerCase()}`); });
    S.meals.push({ id: uid(), d, slot, n: 'Thali', qty: parts.join(', ').slice(0, 120), kcal: Math.round(k), p: Math.round(p * 10) / 10 });
    onChange(); closeSheet(); toast(`🍛 Thali added · ${fmt(k)} kcal`);
  };
};

/* ===== voice notes (groups and family): record up to 15 seconds ===== */
const VOICE = { rec: null, chunks: [], t0: 0, timer: null, stream: null };
function voiceSupported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder); }
/** Opens the recorder; `send(voice)` posts { id, secs } where the message should go. */
function voiceSheet(toName, send) {
  if (!voiceSupported()) return toast('This browser can’t record audio.', 'bad');
  sheet(`<div class="c"><span style="font-size:52px" id="vr-e">🎤</span><h2>Voice note${toName ? ' to ' + esc(toName) : ''}</h2><p class="muted" id="vr-m">Up to 15 seconds. Say something nice!</p><div class="pl-timer" id="vr-t">0:00</div>
    <button class="btn big mt" id="vr-go">● Record</button><button class="link mt" data-close style="display:block;margin:10px auto 0">Cancel</button></div>`);
  const btn = $('#vr-go');
  const stopAll = () => { clearInterval(VOICE.timer); try { VOICE.stream && VOICE.stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* none */ } };
  btn.onclick = async () => {
    if (VOICE.rec && VOICE.rec.state === 'recording') { VOICE.rec.stop(); return; }
    try { VOICE.stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { return toast('Allow the microphone to record.', 'bad'); }
    VOICE.chunks = []; VOICE.rec = new MediaRecorder(VOICE.stream); VOICE.t0 = Date.now();
    VOICE.rec.ondataavailable = (e) => { if (e.data && e.data.size) VOICE.chunks.push(e.data); };
    VOICE.rec.onstop = async () => {
      stopAll();
      const secs = Math.max(1, Math.min(15, Math.round((Date.now() - VOICE.t0) / 1000)));
      const blob = new Blob(VOICE.chunks, { type: VOICE.rec.mimeType || 'audio/webm' });
      if (!$('#vr-go')) return; // closed
      btn.disabled = true; btn.textContent = 'Sending…'; $('#vr-e').textContent = '📤';
      try {
        const up = await api('voice/sign', { method: 'POST' });
        const fd = new FormData(); Object.entries(up.fields).forEach(([k, v]) => fd.append(k, v)); fd.append('file', blob, 'voice');
        const res = await fetch(up.url, { method: 'POST', body: fd }); if (!res.ok) throw new Error('Upload failed. Try again.');
        await send({ id: up.id, secs }); closeSheet(); toast('🎤 Sent!'); markCheered();
      } catch (e) { toast(esc(e.message || 'Couldn’t send'), 'bad'); btn.disabled = false; btn.textContent = '● Record again'; }
    };
    VOICE.rec.start(); btn.textContent = '■ Stop & send'; $('#vr-e').textContent = '🔴'; vibrate(30);
    VOICE.timer = setInterval(() => { const sec = Math.floor((Date.now() - VOICE.t0) / 1000); const t = $('#vr-t'); if (t) t.textContent = '0:' + pad(sec); else { clearInterval(VOICE.timer); if (VOICE.rec.state === 'recording') { VOICE.chunks = []; VOICE.rec.onstop = stopAll; VOICE.rec.stop(); } } if (sec >= 15 && VOICE.rec.state === 'recording') VOICE.rec.stop(); }, 250);
  };
}
const voiceHtml = (m) => `<button class="vplay" data-act="vplay" data-src="${esc(m.voice || '')}">▶ <span>${m.secs || ''}s</span><i></i></button>`;
let VPLAY = null;
ACT.vplay = (el) => {
  if (!el.dataset.src) return toast('Voice notes need internet.', 'bad');
  if (VPLAY && !VPLAY.paused) { VPLAY.pause(); $$('.vplay.on').forEach((b) => b.classList.remove('on')); if (VPLAY._el === el) return; }
  VPLAY = new Audio(el.dataset.src); VPLAY._el = el; el.classList.add('on');
  VPLAY.onended = () => el.classList.remove('on'); VPLAY.play().catch(() => { el.classList.remove('on'); toast('Couldn’t play that voice note', 'bad'); });
};
ACT.gvoice = (el) => voiceSheet(el.dataset.n || '', (v) => api('groups/post', { method: 'POST', body: { code: GROUP.code, to: el.dataset.to || undefined, voice: v } }).then(() => loadGroup(GROUP.code)));

/* ===== group shared goal ===== */
const GOAL_UNITS = { workouts: ['💪', 'workouts'], minutes: ['⏱', 'minutes'], km: ['🗺', 'km'], steps: ['👟', 'steps'], complete: ['✅', 'complete days'] };
function goalCard(g) {
  const gl = g.goal;
  if (!gl) return g.owner ? `<div class="card"><h3>🎯 Group goal</h3><p class="muted sm">Give the group something to chase together: “500 km by month-end” or “100 workouts in 30 days”.</p><button class="btn" data-act="ggoal">Set a group goal</button></div>` : '';
  const [e, unit] = GOAL_UNITS[gl.kind] || ['🎯', gl.label];
  return `<div class="card"><h3>🎯 ${fmt(gl.target)} ${unit} together<span class="sp"></span>${gl.done ? '<span class="pill ok">🎉 Done!</span>' : `<span class="pill">${plural(gl.daysLeft, 'day')} left</span>`}</h3>
    <div class="row"><span style="font-size:30px">${e}</span><div class="sp"><b style="font-family:var(--fh);font-size:20px">${fmt(gl.total)}</b> <span class="muted">/ ${fmt(gl.target)} ${unit}</span><div class="bar mt" style="margin-top:6px;height:12px"><i style="width:${gl.pct}%;background:linear-gradient(90deg,var(--gold),var(--ac))"></i></div></div></div>
    <div class="mt">${gl.people.filter((p) => p.amount > 0).map((p) => `<span class="pill" style="margin:0 6px 6px 0">${esc(p.name)} · ${fmt(p.amount)}</span>`).join('') || '<span class="muted sm">No one has added to it yet. Be the first!</span>'}</div>
    <p class="tiny muted">${nice(gl.start)} – ${nice(gl.end)}${g.owner ? ' · <button class="link tiny" data-act="ggoal">Change</button>' : ''}</p></div>`;
}
ACT.ggoal = () => {
  const gl = GROUP && GROUP.goal;
  sheet(`<h2>🎯 Group goal</h2><p class="muted">Everyone’s logs add up. The group gets a celebration when you hit it.</p>
    <label class="f">Count</label><select id="gg-k">${Object.entries(GOAL_UNITS).map(([k, [e, n]]) => `<option value="${k}" ${gl && gl.kind === k ? 'selected' : ''}>${e} ${n}</option>`).join('')}</select>
    <div class="grid2"><div><label class="f">Target</label><input id="gg-t" type="number" inputmode="numeric" value="${gl ? gl.target : 100}"></div><div><label class="f">By</label><input id="gg-e" type="date" value="${gl ? gl.end : shift(today(), 29)}" min="${today()}"></div></div>
    <p class="tiny muted">Ideas: 100 workouts in 30 days for 5 people · 500 km by the end of the month · 1,00,000 steps this week.</p>
    <button class="btn big mt" id="gg-ok">Save goal</button>${gl ? '<button class="link mt" id="gg-x" style="display:block;margin:10px auto 0">Remove the goal</button>' : ''}`);
  $('#gg-ok').onclick = async () => { try { await api('groups/goal', { method: 'POST', body: { code: GROUP.code, kind: $('#gg-k').value, target: Number($('#gg-t').value), start: today(), end: $('#gg-e').value } }); closeSheet(); confetti(60); loadGroup(GROUP.code); } catch (e) { toast(esc(e.message), 'bad'); } };
  const x = $('#gg-x'); if (x) x.onclick = async () => { try { await api('groups/goal', { method: 'POST', body: { code: GROUP.code, clear: true } }); closeSheet(); loadGroup(GROUP.code); } catch (e) { toast(esc(e.message), 'bad'); } };
};

/* ===== family league: everyone on one plan ===== */
let FAMILY = null;
TG_TABS.family = function () {
  if (!FAMILY) return '<div class="empty"><span class="e">🏠</span>Loading your family league…</div>';
  if (!FAMILY.on) return `<div class="card c"><span style="font-size:52px">🏠</span><h2>Family league</h2><p class="muted">Add people to your plan and you’ll all be on one weekly scoreboard.</p><a class="btn" href="#together/plan">Add my people</a></div>`;
  const f = FAMILY;
  return `<div class="hero"><h2>🏠 Family league</h2><p class="muted sm">Everyone on your plan, ranked by this week’s XP. Resets every Monday.</p>${f.lastWinner ? `<p class="pill gold">👑 Last week: ${esc(f.lastWinner.name)} (${fmt(f.lastWinner.xp)} XP)</p>` : ''}</div>
    <div class="card ppl"><h3>🏆 This week</h3>${f.people.map((p, i) => `<div class="li"><span class="e">${['🥇', '🥈', '🥉'][i] || initials(p.name)}</span><div class="t"><b>${esc(p.name)}${p.email === CLOUD.email ? ' (you)' : ''}</b><small>🔥 ${p.streak} · Lv ${p.level} · ${p.todayDone ? '✅ done today' : p.workedOut ? '💪 worked out' : '⏳ not yet today'}</small></div><div class="v">${fmt(p.weekXp)}</div>${p.email !== CLOUD.email ? `<button class="btn sm ghost" data-act="fcheer" data-to="${esc(p.email)}" data-n="${esc(p.name)}">${p.todayDone ? '👏' : '👉'}</button>` : ''}</div>`).join('')}</div>
    <div class="card"><h3>💬 Family chat<span class="sp"></span>${voiceSupported() ? '<button class="btn sm ghost" data-act="fvoice">🎤</button>' : ''}</h3><div class="feed">${f.feed.length ? f.feed.slice().reverse().map(msgHtml).join('') : '<p class="muted sm c">Cheer each other on. Even a 👏 helps.</p>'}</div>
      <div class="presets">${PRESET_LIST.map(([k, t]) => `<button data-act="fpre" data-k="${k}">${t}</button>`).join('')}</div></div>`;
};
async function loadFamily() { try { FAMILY = await api('family'); FAMILY._at = Date.now(); if (ROUTE === 'together' && SUB.together === 'family') { const y = window.scrollY; render(); window.scrollTo(0, y); } } catch (e) { /* offline */ } }
const familySend = (body) => api('family/post', { method: 'POST', body }).then(() => { markCheered(); return loadFamily(); }).catch((e) => toast(esc(e.message), 'bad'));
ACT.fpre = (el) => familySend({ preset: el.dataset.k });
ACT.fcheer = (el) => {
  sheet(`<h2>To ${esc(el.dataset.n)}</h2><div class="opts">${PRESET_LIST.slice(0, 7).map(([k, t]) => `<button class="opt" data-k="${k}"><span>${t}</span></button>`).join('')}${voiceSupported() ? '<button class="opt" data-k="voice"><span>🎤 Send a voice note</span></button>' : ''}</div>`);
  $$('.opt[data-k]').forEach((b) => (b.onclick = () => { if (b.dataset.k === 'voice') return voiceSheet(el.dataset.n, (v) => familySend({ to: el.dataset.to, voice: v })); closeSheet(); familySend({ to: el.dataset.to, preset: b.dataset.k }); toast('Sent 🙌'); }));
};
ACT.fvoice = () => voiceSheet('the family', (v) => familySend({ voice: v }));

/* ===== pledge: put money on finishing your challenge ===== */
function pledgeNow() { const p = ME && ME.pledge; return p && p.list ? p.list.find((x) => x.status === 'active') : null; }
function pledgeOffer() {
  const p = ME && ME.pledge, c = CH(), st = chStatus();
  if (!p || !p.on || !c || !st || st.over || pledgeNow()) return null;
  if (p.list.some((x) => x.challengeId === c.id)) return null;
  const start = c.start > today() ? c.start : today(), end = shift(c.start, c.length - 1), days = diff(start, end) + 1;
  return days >= p.minDays ? { days, needed: Math.ceil((days * p.needPercent) / 100) } : null;
}
function pledgeCard(where) {
  const p = ME && ME.pledge; if (!p) return '';
  const now = pledgeNow(), recent = p.list.find((x) => ['won', 'lost', 'refunded', 'donated'].includes(x.status) && diff(x.end, today()) <= 10);
  if (now) {
    const left = Math.max(0, diff(today(), now.end) + 1), canStill = now.counted + left >= now.needed, pct = clamp((now.counted / now.needed) * 100, 0, 100);
    return `<div class="card pledge"><h3>💰 ₹${fmt(now.amount)} on the line<span class="sp"></span><span class="pill ${canStill ? 'gold' : ''}">${now.counted}/${now.needed}</span></h3><div class="bar" style="height:12px"><i style="width:${pct}%;background:linear-gradient(90deg,var(--gold),var(--ok))"></i></div>
      <p class="sm muted mt">${now.counted >= now.needed ? '🏆 Target reached! Keep logging; your refund comes after the last day.' : canStill ? `${now.needed - now.counted} more complete days in the next ${plural(left, 'day')}. Miss it and it goes to ${esc(now.charity)}.` : `Out of reach this time: it goes to ${esc(now.charity)}. Finish strong anyway!`}</p></div>`;
  }
  if (recent && where === 'rewards') return `<div class="card"><h3>💰 Last pledge</h3><p>${recent.status === 'won' || recent.status === 'refunded' ? `🏆 You won! ₹${fmt(recent.amount)} ${recent.status === 'refunded' ? 'has been refunded' : 'is on its way back to you'}.` : `You did ${recent.counted} of ${recent.needed} days. ₹${fmt(recent.amount)} ${recent.status === 'donated' ? 'was given' : 'goes'} to ${esc(recent.charity)}.`}</p></div>`;
  const o = pledgeOffer(); if (!o) return '';
  if (where === 'today' && (chDay() > 3 || S.game.pledgeNo === CH().id)) return '';
  return `<div class="card pledge"><h3>💰 Put money on it?</h3><p class="sm muted">People who stake something are far more likely to finish. Pledge ₹${p.amounts.join(' / ₹')}: complete ${o.needed} of the next ${o.days} days and get it all back. Miss, and it goes to <b>${esc(p.charity)}</b>.</p>
    <div class="row mt"><button class="btn" data-act="pledge">Make a pledge</button>${where === 'today' ? '<button class="link" data-act="pledgeno">Not now</button>' : ''}</div></div>`;
}
ACT.pledgeno = () => { S.game.pledgeNo = CH().id; onChange({ quiet: true }); render(); };
ACT.pledge = () => {
  const p = ME.pledge, o = pledgeOffer(); if (!o) return toast('Start a challenge with at least ' + p.minDays + ' days left first.', 'bad');
  let amt = p.amounts[Math.min(1, p.amounts.length - 1)];
  sheet(`<h2>💰 Make a pledge</h2><p class="muted">Complete <b>${o.needed} of the next ${o.days} days</b> (workout + checkpoints, logged on the day or the next day) and you get every rupee back. Miss it, and it goes to <b>${esc(p.charity)}</b>.</p>
    <label class="f">Amount</label><div class="chipsel" id="pl-a">${p.amounts.map((a) => `<button data-v="${a}" class="${a === amt ? 'on' : ''}">₹${fmt(a)}</button>`).join('')}</div>
    <details class="mt tiny muted"><summary>Terms</summary>${esc(p.terms)}</details>
    <label class="row mt sm"><input type="checkbox" id="pl-ok" style="width:auto"> I understand it can’t be cancelled once paid</label>
    <button class="btn big mt" id="pl-go" disabled>Pledge ₹${fmt(amt)}</button>`);
  $$('#pl-a button').forEach((b) => (b.onclick = () => { amt = Number(b.dataset.v); $$('#pl-a button').forEach((x) => x.classList.toggle('on', x === b)); $('#pl-go').textContent = 'Pledge ₹' + fmt(amt); }));
  $('#pl-ok').onchange = (e) => { $('#pl-go').disabled = !e.target.checked; };
  $('#pl-go').onclick = async () => {
    const b = $('#pl-go'); b.disabled = true; b.textContent = 'Opening…';
    try {
      const ord = await api('pledge', { method: 'POST', body: { amount: amt, challengeId: CH().id } });
      let res = {};
      if (ord.provider === 'razorpay') {
        await loadRazorpay();
        res = await new Promise((ok, bad) => { let done = false; const rz = new window.Razorpay(Object.assign({}, ord.clientData, { order_id: ord.orderId, name: 'Pandora Templates', description: `Workout pledge · ${ord.days} days`, prefill: { email: CLOUD.email, name: S.profile.name || '' }, theme: { color: '#FF5A36' }, handler: (x) => { done = true; ok(x); }, modal: { ondismiss: () => { if (!done) bad(new Error('Payment cancelled.')); } } })); rz.open(); });
      }
      await api('pledge/verify', { method: 'POST', body: res });
      await refreshMe(); closeSheet(); confetti(200); chime();
      sheet(`<div class="celebrate"><span class="e">💰</span><h2>Pledge on!</h2><p class="muted">₹${fmt(amt)} says you finish. ${ord.needed} complete days to win it back. You’ve got this.</p><button class="btn big mt" data-close>Let’s go</button></div>`); render();
    } catch (e) { toast(esc(e.message), 'bad'); b.disabled = false; b.textContent = 'Try again'; }
  };
};
