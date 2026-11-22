/* ---------- helpers, state and the game rules (points, levels, streaks, badges, quests) ---------- */
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const copy = (o) => JSON.parse(JSON.stringify(o));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : Number(v) || 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (n) => Math.round(n).toLocaleString('en-IN');
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');
const MEM = {};
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch (e) { return MEM[k] || null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { MEM[k] = v; } },
  del: (k) => { try { localStorage.removeItem(k); } catch (e) { delete MEM[k]; } },
};

/* ----- dates (the phone's own calendar day) ----- */
const pad = (n) => String(n).padStart(2, '0');
const dstr = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = () => dstr(new Date());
const shift = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return dstr(x); };
const diff = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
const monday = (d) => shift(d, -((new Date(d + 'T12:00:00').getDay() + 6) % 7));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const nice = (d, withDay) => { if (!d) return ''; const x = new Date(d + 'T12:00:00'); return (withDay ? WD[x.getDay()] + ', ' : '') + x.getDate() + ' ' + MONTHS[x.getMonth()]; };
const niceLong = (iso) => { if (!iso) return ''; const x = new Date(iso); return x.getDate() + ' ' + MONTHS[x.getMonth()] + ' ' + x.getFullYear(); };
const ago = (iso) => { const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? 'now' : m < 60 ? m + 'm' : m < 1440 ? Math.round(m / 60) + 'h' : Math.round(m / 1440) + 'd'; };

/* ----- state ----- */
let S = {};
const COLLS = ['days', 'meals', 'body', 'prs', 'goals', 'challenges'];
const TOPS = ['profile', 'challenge', 'game', 'prefs'];
function normalize(s) {
  s = s && typeof s === 'object' ? s : {};
  COLLS.forEach((c) => { if (!Array.isArray(s[c])) s[c] = []; });
  s.profile = Object.assign({ name: '', phone: '', targets: { water: 8, sleep: 7, steps: 8000, mob: 10, need: 4 }, reminderHour: null }, s.profile || {});
  s.profile.targets = Object.assign({ water: 8, sleep: 7, steps: 8000, mob: 10, need: 4 }, s.profile.targets || {});
  s.game = Object.assign({ seen: [], level: 1, chests: {} }, s.game || {});
  s.prefs = Object.assign({ sound: true, voice: true, theme: 'ember' }, s.prefs || {});
  if (s.challenge === undefined) s.challenge = null;
  return s;
}
const T = () => S.profile.targets;
const dayRow = (d) => S.days.find((r) => r.id === d);
function ensureDay(d) { let r = dayRow(d); if (!r) { r = { id: d }; S.days.push(r); } return r; }
function setDay(d, patch) { const r = ensureDay(d); Object.assign(r, patch); Object.keys(r).forEach((k) => { if (r[k] === null || r[k] === undefined || r[k] === '') delete r[k]; }); onChange(); return r; }

/* ----- the game rules (kept in step with lib/workout/core.ts on the server) ----- */
const XP = { workout: 50, rest: 20, checkpoint: 10, complete: 30, quest: 15, meal: 5, mealMax: 25, pr: 25, body: 20, streakPerDay: 2, streakMax: 30, chestMax: 50 };
const LEVELS = ['Fresh Start', 'Warming Up', 'Getting Moving', 'Habit Builder', 'Steady', 'Consistent', 'Strong', 'Fired Up', 'Unstoppable', 'Iron Will', 'Athlete', 'Beast Mode', 'Champion', 'Elite', 'Titan', 'Legend', 'Mythic', 'Immortal', 'Hall of Fame', 'GOAT'];
function checkpoints(r) {
  if (!r) return 0; const t = T();
  let n = r.w || r.rest ? 1 : 0;
  if (num(r.water) >= t.water) n++; if (num(r.sleep) >= t.sleep) n++; if (num(r.steps) >= t.steps) n++; if (num(r.mob) >= t.mob) n++;
  return n;
}
const isComplete = (r) => !!(r && (r.w || r.rest) && checkpoints(r) >= T().need);
const isLogged = (r) => !!(r && (r.w || r.rest || num(r.water) > 0 || num(r.sleep) > 0 || num(r.steps) > 0 || num(r.mob) > 0 || r.mood || num(r.weight) > 0));
function dayXp(r) {
  if (!r) return 0;
  let xp = r.w ? XP.workout : r.rest ? XP.rest : 0;
  xp += (checkpoints(r) - (r.w || r.rest ? 1 : 0)) * XP.checkpoint;
  if (isComplete(r)) xp += XP.complete;
  if (Array.isArray(r.q)) xp += Math.min(3, r.q.length) * XP.quest;
  if (num(r.bx) > 0) xp += Math.min(XP.chestMax, Math.round(r.bx));
  return xp;
}
function xpAll() {
  const per = {}; const add = (d, n) => { if (d) per[d] = (per[d] || 0) + n; };
  const days = S.days.slice().sort((a, b) => (a.id < b.id ? -1 : 1));
  let run = 0, prev = '';
  days.forEach((r) => {
    const c = isComplete(r);
    run = c ? (prev && diff(prev, r.id) === 1 ? run + 1 : 1) : r.fz ? run : 0;
    if (c || r.fz) prev = r.id;
    add(r.id, dayXp(r) + (c ? Math.min(run, XP.streakMax) * XP.streakPerDay : 0));
  });
  const meals = {}; S.meals.forEach((m) => { meals[m.d] = (meals[m.d] || 0) + 1; });
  Object.keys(meals).forEach((d) => add(d, Math.min(XP.mealMax, meals[d] * XP.meal)));
  S.prs.forEach((p) => add(p.d, XP.pr)); S.body.forEach((b) => add(b.d, XP.body));
  let total = 0; Object.keys(per).forEach((d) => { total += per[d]; });
  return { total, per };
}
const levelXp = (n) => 50 * (n - 1) * n;
function levelOf(xp) { let n = 1; while (levelXp(n + 1) <= xp) n++; const from = levelXp(n), to = levelXp(n + 1); return { level: n, name: LEVELS[Math.min(n, LEVELS.length) - 1], from, to, pct: Math.round(((xp - from) / (to - from)) * 100) }; }

/* streaks: complete days in a row; a freeze keeps the streak alive without adding to it */
function streakInfo() {
  const done = new Set(S.days.filter(isComplete).map((r) => r.id)), frozen = new Set(S.days.filter((r) => r.fz).map((r) => r.id));
  const t = today();
  let d = done.has(t) ? t : shift(t, -1), cur = 0;
  for (let i = 0; i < 4000; i++) { if (done.has(d)) cur++; else if (!frozen.has(d)) break; d = shift(d, -1); }
  const all = [...new Set([...done, ...frozen])].sort(); let best = 0, run = 0, prev = '';
  all.forEach((x) => { run = prev && diff(prev, x) === 1 ? run : 0; if (done.has(x)) run++; best = Math.max(best, run); prev = x; });
  return { cur, best, total: done.size, todayDone: done.has(t), frozen };
}
/** Streak freezes: one earned per 7 complete days (bank up to 3), plus any won as gifts, minus those used. */
function freezes() {
  const used = S.days.filter((r) => r.fz).length, earned = Math.floor(S.days.filter(isComplete).length / 7) + num(ME && ME.bonus && ME.bonus.freezes);
  return { used, earned, left: clamp(earned - used, 0, 3) };
}
/** If yesterday was missed but the streak before it is worth saving, offer a freeze. */
function freezeOffer() {
  const t = today(), y = shift(t, -1);
  if (isComplete(dayRow(y)) || (dayRow(y) && dayRow(y).fz) || (S.challenge && S.challenge.start > y)) return null;
  const done = new Set(S.days.filter(isComplete).map((r) => r.id)), frozen = new Set(S.days.filter((r) => r.fz).map((r) => r.id));
  let d = shift(y, -1), n = 0; for (let i = 0; i < 4000; i++) { if (done.has(d)) n++; else if (!frozen.has(d)) break; d = shift(d, -1); }
  return n >= 3 && freezes().left > 0 ? { day: y, streak: n } : null;
}

/* ----- the current challenge ----- */
const CH = () => S.challenge;
function chDay(d) { const c = CH(); return c ? diff(c.start, d || today()) + 1 : 0; }
function chStatus() {
  const c = CH(); if (!c) return null;
  const n = chDay(); const len = c.length;
  return { n, len, before: n < 1, over: n > len, pct: clamp(Math.round(((n - 1) / len) * 100), 0, 100) };
}
/** Missed 3+ days in a row recently: today's workout is 30% lighter. */
function comeback() {
  const c = CH(); if (!c) return false;
  const t = today(); if (chDay(t) < 5) return false;
  for (let i = 1; i <= 3; i++) { const r = dayRow(shift(t, -i)); if (isLogged(r) || (r && r.fz)) return false; }
  return true;
}
function todayPlan() { const st = chStatus(); if (!st || st.before || st.over) return null; return planDay(CH(), st.n, (comeback() ? 0.7 : 1) * checkinScale(dayRow(today()))); }

/* ----- daily quests: 3 a day, picked by the date ----- */
const QUESTS = [
  { id: 'water', t: () => `Drink ${T().water} glasses of water`, ok: (r) => num(r.water) >= T().water },
  { id: 'steps', t: () => `Walk ${fmt(T().steps)} steps`, ok: (r) => num(r.steps) >= T().steps },
  { id: 'sleep', t: () => `Sleep ${T().sleep}+ hours`, ok: (r) => num(r.sleep) >= T().sleep },
  { id: 'mob', t: () => `${T().mob} min of stretching`, ok: (r) => num(r.mob) >= T().mob },
  { id: 'meal1', t: () => 'Log a meal', ok: (r, d) => S.meals.some((m) => m.d === d) },
  { id: 'meal2', t: () => 'Log 2 meals with protein', ok: (r, d) => S.meals.filter((m) => m.d === d && num(m.p) >= 5).length >= 2 },
  { id: 'mood', t: () => 'Log how you feel', ok: (r) => !!r.mood },
  { id: 'weigh', t: () => 'Log your weight', ok: (r) => num(r.weight) > 0 },
  { id: 'note', t: () => 'Write one line about today', ok: (r) => !!(r.note && r.note.length > 3) },
  { id: 'early', t: () => 'Work out before 9 am', ok: (r) => r.w && r.wt && r.wt < '09:00' },
  { id: 'cheer', t: () => 'Cheer a friend or your buddy', ok: (r) => !!r.cheered },
  { id: 'extra', t: () => 'Move 10 extra minutes', ok: (r) => (r.acts || []).reduce((a, x) => a + num(x.min), 0) >= 10 || num(r.mins) >= 40 },
];
function questsFor(d) {
  let h = 0; for (const ch of d) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = QUESTS.filter((q) => q.id !== 'cheer' || (ME && (ME.groups.length || ME.buddy.status === 'matched')));
  const out = []; while (out.length < 3 && out.length < pool.length) { const q = pool[h % pool.length]; if (!out.includes(q)) out.push(q); h = (h * 1103515245 + 12345) >>> 0; }
  return out;
}
/** Marks quests done when their condition is met; opening the chest is a separate tap. */
function syncQuests(d) {
  const r = dayRow(d); if (!r) return;
  const done = questsFor(d).filter((q) => q.ok(r, d)).map((q) => q.id);
  const before = (r.q || []).join(',');
  if (done.join(',') !== before) { if (done.length) r.q = done; else delete r.q; return true; }
  return false;
}
const chestXp = (d) => { let h = 7; for (const ch of d) h = (h * 33 + ch.charCodeAt(0)) >>> 0; return 10 + (h % 41); };

/* ----- badges (computed from your log, so they can't be lost) ----- */
const BADGES = [
  { id: 'first', e: '👟', n: 'First step', d: 'Log your first workout', ok: (x) => x.workouts >= 1 },
  { id: 's3', e: '✨', n: 'Spark', d: '3 complete days in a row', ok: (x) => x.best >= 3 },
  { id: 's7', e: '🔥', n: 'On fire', d: '7 days in a row', ok: (x) => x.best >= 7 },
  { id: 's14', e: '⚡', n: 'Charged', d: '14 days in a row', ok: (x) => x.best >= 14 },
  { id: 's30', e: '🌋', n: 'Unstoppable', d: '30 days in a row', ok: (x) => x.best >= 30 },
  { id: 's60', e: '💎', n: 'Diamond habit', d: '60 days in a row', ok: (x) => x.best >= 60 },
  { id: 's100', e: '👑', n: 'Legend', d: '100 days in a row', ok: (x) => x.best >= 100 },
  { id: 's365', e: '🏆', n: 'A whole year', d: '365 days in a row', ok: (x) => x.best >= 365 },
  { id: 'w10', e: '💪', n: 'Ten down', d: '10 workouts', ok: (x) => x.workouts >= 10 },
  { id: 'w50', e: '🦾', n: 'Half century', d: '50 workouts', ok: (x) => x.workouts >= 50 },
  { id: 'w100', e: '🏅', n: 'Centurion', d: '100 workouts', ok: (x) => x.workouts >= 100 },
  { id: 'w250', e: '🚀', n: 'Machine', d: '250 workouts', ok: (x) => x.workouts >= 250 },
  { id: 'perfect', e: '🌟', n: 'Perfect week', d: 'Mon–Sun all complete', ok: (x) => x.perfectWeeks >= 1 },
  { id: 'perfect4', e: '🌠', n: 'Perfect month', d: '4 perfect weeks', ok: (x) => x.perfectWeeks >= 4 },
  { id: 'early', e: '🌅', n: 'Early bird', d: '5 workouts before 7 am', ok: (x) => x.early >= 5 },
  { id: 'night', e: '🦉', n: 'Night owl', d: '5 workouts after 9 pm', ok: (x) => x.late >= 5 },
  { id: 'water', e: '💧', n: 'Hydrated', d: 'Water goal 7 days running', ok: (x) => x.waterRun >= 7 },
  { id: 'sleep', e: '😴', n: 'Well rested', d: 'Sleep goal 7 days running', ok: (x) => x.sleepRun >= 7 },
  { id: 'steps10k', e: '🚶', n: '10K day', d: '10,000 steps in a day', ok: (x) => x.maxSteps >= 10000 },
  { id: 'pr', e: '📈', n: 'Record breaker', d: 'Beat one of your tests', ok: (x) => x.prBeat >= 1 },
  { id: 'meals', e: '🥗', n: 'Food diary', d: 'Meals logged on 7 days', ok: (x) => x.mealDays >= 7 },
  { id: 'body', e: '📏', n: 'Measured up', d: '4 body check-ins', ok: (x) => x.bodyLogs >= 4 },
  { id: 'finish', e: '🎓', n: 'Finisher', d: 'Finish a challenge', ok: (x) => x.finished >= 1 },
  { id: 'finish3', e: '🎖️', n: 'Serial finisher', d: 'Finish 3 challenges', ok: (x) => x.finished >= 3 },
  { id: 'comeback', e: '🔁', n: 'Comeback', d: 'Work out after a 3-day break', ok: (x) => x.comebacks >= 1 },
  { id: 'lvl10', e: '🧱', n: 'Iron will', d: 'Reach level 10', ok: (x) => x.level >= 10 },
];
function stats() {
  const t = T(), days = S.days.slice().sort((a, b) => (a.id < b.id ? -1 : 1));
  const st = streakInfo(), xp = xpAll();
  const x = { workouts: 0, mins: 0, km: 0, early: 0, late: 0, waterRun: 0, sleepRun: 0, maxSteps: 0, perfectWeeks: 0, comebacks: 0, best: st.best, cur: st.cur, complete: st.total, xp: xp.total, level: levelOf(xp.total).level };
  let wr = 0, sr = 0, prev = '', lastW = '';
  days.forEach((r) => {
    if (r.w) { x.workouts++; if (r.wt && r.wt < '07:00') x.early++; if (r.wt && r.wt >= '21:00') x.late++; if (lastW && diff(lastW, r.id) >= 4) x.comebacks++; lastW = r.id; }
    x.mins += num(r.mins) + (r.acts || []).reduce((a, q) => a + num(q.min), 0);
    x.km += (r.acts || []).reduce((a, q) => a + num(q.km), 0);
    const cont = prev && diff(prev, r.id) === 1;
    wr = num(r.water) >= t.water ? (cont ? wr + 1 : 1) : 0; sr = num(r.sleep) >= t.sleep ? (cont ? sr + 1 : 1) : 0;
    x.waterRun = Math.max(x.waterRun, wr); x.sleepRun = Math.max(x.sleepRun, sr); x.maxSteps = Math.max(x.maxSteps, num(r.steps)); prev = r.id;
  });
  const done = new Set(days.filter(isComplete).map((r) => r.id)), mons = new Set([...done].map(monday));
  mons.forEach((m) => { let ok = true; for (let i = 0; i < 7; i++) if (!done.has(shift(m, i))) ok = false; if (ok) x.perfectWeeks++; });
  x.mealDays = new Set(S.meals.map((m) => m.d)).size; x.bodyLogs = S.body.length;
  x.prBeat = 0; const byTest = {}; S.prs.slice().sort((a, b) => (a.d < b.d ? -1 : 1)).forEach((p) => { const up = testUp(p.test); const b = byTest[p.test]; if (b != null && (up ? num(p.v) > b : num(p.v) < b)) x.prBeat++; byTest[p.test] = b == null ? num(p.v) : up ? Math.max(b, num(p.v)) : Math.min(b, num(p.v)); });
  x.finished = S.challenges.filter((c) => c.status === 'finished').length;
  return x;
}
function testUp(id) { for (const k of PROGRAM_IDS) { const t = PROGRAMS[k].tests.find((q) => q.id === id); if (t) return !!t.up; } return true; }
function testInfo(id) { for (const k of PROGRAM_IDS) { const t = PROGRAMS[k].tests.find((q) => q.id === id); if (t) return t; } return { id, name: id, unit: '', up: 1 }; }

/* ----- toasts, sheets, sounds and confetti ----- */
function toast(msg, kind) {
  const t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.innerHTML = msg;
  $('#toasts').appendChild(t); setTimeout(() => t.classList.add('out'), 3200); setTimeout(() => t.remove(), 3700);
}
function sheet(html, opts) {
  opts = opts || {};
  closeSheet();
  const w = document.createElement('div'); w.className = 'sheet-wrap' + (opts.full ? ' full' : ''); w.id = 'sheet';
  w.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${opts.noClose ? '' : '<button class="x" aria-label="Close" data-close>✕</button>'}${html}</div>`;
  document.body.appendChild(w); requestAnimationFrame(() => w.classList.add('in'));
  w.addEventListener('click', (e) => { if ((e.target === w && !opts.noClose) || e.target.closest('[data-close]')) closeSheet(); });
  animateFigures();
  return w;
}
function closeSheet() { const w = $('#sheet'); if (w) { w.remove(); if (typeof SHEET_CLOSED === 'function') SHEET_CLOSED(); } }
let AC = null;
function beep(freq, ms, vol) {
  if (!S.prefs.sound) return;
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const o = AC.createOscillator(), g = AC.createGain(); o.frequency.value = freq || 880; o.type = 'sine'; g.gain.value = vol || 0.15; o.connect(g); g.connect(AC.destination); const t = AC.currentTime; g.gain.setValueAtTime(vol || 0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + (ms || 150) / 1000); o.start(t); o.stop(t + (ms || 150) / 1000); } catch (e) { /* no audio */ }
}
const chime = () => { beep(660, 120); setTimeout(() => beep(880, 120), 120); setTimeout(() => beep(1320, 260), 240); };
/* ----- voice coach: English or Hindi ----- */
const HI = () => S.prefs.lang === 'hi';
const VOICE_LINES = {
  start: { en: (t) => `${t}. Let's go!`, hi: (t) => `${t}. चलो, शुरू करते हैं!` },
  rest: { en: (n, r) => `Rest. Next: ${n}${r ? ', ' + r + ' reps' : ''}.`, hi: (n, r) => `आराम करो. अगला: ${n}${r ? ', ' + r + ' बार' : ''}.` },
  reps: { en: (n, r) => `${n}, ${r} reps`, hi: (n, r) => `${n}, ${r} बार` },
  secs: { en: (n, sec) => `${n}, ${sec >= 60 ? Math.round(sec / 60) + ' minute' + (Math.round(sec / 60) === 1 ? '' : 's') : sec + ' seconds'}`, hi: (n, sec) => `${n}, ${sec >= 60 ? Math.round(sec / 60) + ' मिनट' : sec + ' सेकंड'}` },
  fast: { en: () => 'Go fast!', hi: () => 'तेज़ी से!' },
  side: { en: () => 'Switch sides', hi: () => 'साइड बदलो' },
  left: { en: (m) => `${m} minute${m === 1 ? '' : 's'} left`, hi: (m) => `${m} मिनट बाकी` },
  half: { en: () => 'Halfway there. Keep going!', hi: () => 'आधा हो गया. लगे रहो!' },
  last: { en: () => 'Last one. Give it everything!', hi: () => 'आख़िरी वाला. पूरा ज़ोर लगाओ!' },
  done: { en: () => 'Workout complete. Great job!', hi: () => 'वर्कआउट पूरा! शाबाश!' },
};
const line = (k, ...a) => VOICE_LINES[k][HI() ? 'hi' : 'en'](...a);
let VOICES = [], NO_HI_TOLD = false;
if (window.speechSynthesis) { const load = () => { try { VOICES = speechSynthesis.getVoices(); } catch (e) { VOICES = []; } }; load(); try { speechSynthesis.onvoiceschanged = load; } catch (e) { /* none */ } }
function pickVoice(lang) { const l = lang.toLowerCase(); return VOICES.find((v) => v.lang.toLowerCase().replace('_', '-') === l) || VOICES.find((v) => v.lang.toLowerCase().startsWith(l.slice(0, 2))) || null; }
function say(text) {
  if (!S.prefs.voice || !window.speechSynthesis) return;
  try {
    speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text);
    const lang = HI() ? 'hi-IN' : 'en-IN', v = pickVoice(lang);
    if (HI() && !v && VOICES.length && !NO_HI_TOLD) { NO_HI_TOLD = true; toast('No Hindi voice on this phone. Add one in your phone’s text-to-speech settings.', 'bad'); }
    u.lang = lang; if (v) u.voice = v; u.rate = HI() ? 0.98 : 1.02; speechSynthesis.speak(u);
  } catch (e) { /* no voice */ }
}
function confetti(n) {
  const c = document.createElement('canvas'); c.className = 'confetti'; document.body.appendChild(c);
  const ctx = c.getContext('2d'), W = (c.width = innerWidth), H = (c.height = innerHeight);
  const cols = ['#FF5A36', '#FFC53D', '#C6F432', '#5B8CFF', '#FF6FB5', '#ffffff'];
  const ps = Array.from({ length: n || 140 }, () => ({ x: W / 2 + (Math.random() - 0.5) * 80, y: H * 0.42, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 15 - 5, r: Math.random() * 6 + 3, c: cols[(Math.random() * cols.length) | 0], a: Math.random() * 6, s: Math.random() * 0.3 - 0.15 }));
  let f = 0;
  (function step() { ctx.clearRect(0, 0, W, H); ps.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vy += 0.42; p.vx *= 0.99; p.a += p.s; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6); ctx.restore(); }); if (++f < 150) requestAnimationFrame(step); else c.remove(); })();
}
function vibrate(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* none */ } }
