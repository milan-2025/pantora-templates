/* ---------- Me: profile, plan, goals, reminders, theme, Excel import, export ---------- */
const THEMES = [
  { id: 'ember', n: 'Ember', bg: 'linear-gradient(135deg,#0B1020,#FF5A36)', ok: () => true },
  { id: 'day', n: 'Day', bg: 'linear-gradient(135deg,#F4F6FB,#FF5A36)', ok: () => true },
  { id: 'ocean', n: 'Ocean', bg: 'linear-gradient(135deg,#06141B,#22D3EE)', ok: (x) => x.level >= 5, how: 'Reach level 5' },
  { id: 'rose', n: 'Rose', bg: 'linear-gradient(135deg,#150A12,#FF6FB5)', ok: (x) => x.perfectWeeks >= 1, how: 'Have a perfect week' },
  { id: 'gold', n: 'Gold', bg: 'linear-gradient(135deg,#120E05,#FFC53D)', ok: (x) => x.level >= 12 || (ME && ME.gifts.some((g) => g.key === 'total50')), how: '50 complete days or level 12' },
];
function applyTheme() {
  const x = stats(), want = THEMES.find((t) => t.id === S.prefs.theme) || THEMES[0];
  const th = want.ok(x) ? want.id : 'ember';
  if (th === 'ember') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = th;
  store.set('wk_theme', th === 'ember' ? '' : th);
  const m = $('meta[name=theme-color]'); if (m) m.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0B1020';
}

ROUTES.me = function () {
  const a = ME && ME.access, x = stats(), p = S.profile;
  const planLine = !a ? '' : a.kind === 'free' ? (a.status === 'new' ? `Free ${ME.limits.freeDays}-day challenge (starts when you begin)` : a.canLog ? `Free challenge · ${plural(a.daysLeft, 'day')} left` : 'Free challenge ended') : a.kind === 'member' ? `On ${esc(a.ownerEmail.split('@')[0])}’s ${esc(a.plan.name)} plan · until ${niceLong(a.expiresAt)}` : `${esc(a.plan.name)} · ${a.isPaid ? 'until ' + niceLong(a.expiresAt) : 'ended ' + niceLong(a.expiresAt)}`;
  return `<div class="card"><h3>👤 You</h3><div class="grid2"><div><label class="f">Name</label><input id="me-n" value="${esc(p.name)}" maxlength="40"></div><div><label class="f">WhatsApp (optional)</label><input id="me-ph" value="${esc(p.phone || '')}" inputmode="tel" placeholder="98xxxxxxxx"></div></div><p class="tiny muted mt">${esc(CLOUD.email)} · your WhatsApp is only shared with a buddy if you both agree.</p></div>
    <div class="card"><h3>🎟 Plan</h3><p>${planLine}</p>${a && a.kind !== 'member' ? `<button class="btn sm" data-act="upgrade">${a.kind === 'free' ? 'See plans' : a.isPaid ? 'Renew or upgrade' : 'Renew'}</button>` : ''}${ME && ME.bonus && (ME.bonus.days || ME.bonus.seats) ? `<p class="sm muted mt">🎁 Saved for your plan: ${ME.bonus.days ? ME.bonus.days + ' bonus days' : ''}${ME.bonus.days && ME.bonus.seats ? ' and ' : ''}${ME.bonus.seats ? ME.bonus.seats + ' extra friend place' : ''}.</p>` : ''}</div>
    <div class="card"><h3>✅ Daily goals</h3><div class="grid2"><div><label class="f">💧 Water (glasses)</label><input type="number" data-t="water" value="${p.targets.water}"></div><div><label class="f">😴 Sleep (hours)</label><input type="number" step="0.5" data-t="sleep" value="${p.targets.sleep}"></div><div><label class="f">👟 Steps</label><input type="number" step="500" data-t="steps" value="${p.targets.steps}"></div><div><label class="f">🧘 Stretching (min)</label><input type="number" data-t="mob" value="${p.targets.mob}"></div></div>
      <label class="f">Checkpoints for a complete day</label><div class="chipsel">${[3, 4, 5].map((n) => `<button data-act="need" data-v="${n}" class="${p.targets.need === n ? 'on' : ''}">${n} of 5</button>`).join('')}</div></div>
    <div class="card"><h3>🔔 Reminders & sound</h3>
      <div class="setrow"><div class="t"><b>Daily reminder</b><small>${p.reminderHour != null ? `At ${hourLabel(p.reminderHour)}, only if you haven’t logged yet` : 'A nudge if you haven’t logged by your chosen time'}</small></div>${p.reminderHour != null ? `<select id="me-hr" style="width:auto">${hourOpts(p.reminderHour)}</select>` : ''}<label class="switch"><input type="checkbox" id="me-rem" ${p.reminderHour != null ? 'checked' : ''}><span></span></label></div>
      <div class="setrow"><div class="t"><b>Beeps</b><small>Countdown beeps in workouts</small></div><label class="switch"><input type="checkbox" id="me-snd" ${S.prefs.sound ? 'checked' : ''}><span></span></label></div>
      <div class="setrow"><div class="t"><b>Voice coach</b><small>Reads out each move</small></div><label class="switch"><input type="checkbox" id="me-vc" ${S.prefs.voice ? 'checked' : ''}><span></span></label></div></div>
    <div class="card"><h3>🎨 Theme</h3><div class="themes">${THEMES.map((t) => `<button style="background:${t.bg}" class="${(S.prefs.theme || 'ember') === t.id ? 'on' : ''}" data-act="theme" data-v="${t.id}" ${t.ok(x) ? '' : 'disabled'} title="${esc(t.ok(x) ? t.n : t.how)}">${t.ok(x) ? esc(t.n) : ''}</button>`).join('')}</div><p class="tiny muted mt">Unlock more themes by levelling up.</p></div>
    <div class="card"><h3>📦 Your data</h3><div class="setrow"><div class="t"><b>Import from the Excel tracker</b><small>Bought the Workout Challenge sheet? Bring your days, meals, body log and tests in.</small></div><label class="btn sm ghost" for="me-x">Import</label><input type="file" id="me-x" accept=".xlsx,.xls,.csv" hidden></div>
      <div class="setrow"><div class="t"><b>Download everything</b><small>Your full log as a spreadsheet (CSV) or backup file</small></div><button class="btn sm ghost" data-act="exportcsv">CSV</button><button class="btn sm ghost" data-act="exportjson">Backup</button></div></div>
    <div class="card"><h3>💬 Help</h3>${ME && ME.whatsapp ? `<a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/${esc(ME.whatsapp.number)}?text=${encodeURIComponent(ME.whatsapp.message)}">Ask us on WhatsApp</a>` : ''} <button class="btn sm ghost" id="me-install" ${INSTALL.evt ? '' : 'hidden'}>📲 Install the app</button>
      <p class="tiny muted mt">Pandora Workout is a fitness tracker, not medical advice. Check with your doctor before starting a new exercise plan, and stop if anything hurts.</p></div>
    <button class="btn ghost big" data-act="signout">Sign out</button><p class="tiny muted c mt">Pandora Templates · <a href="/">pandoratemplates.com</a></p>`;
};
const hourLabel = (h) => (h % 12 || 12) + (h < 12 ? ' am' : ' pm');
const hourOpts = (sel) => [6, 7, 8, 9, 10, 12, 14, 16, 17, 18, 19, 20, 21].map((h) => `<option value="${h}" ${h === sel ? 'selected' : ''}>${hourLabel(h)}</option>`).join('');
ROUTES.me.after = function () {
  $('#me-n').onchange = (e) => { S.profile.name = e.target.value.trim(); onChange(); };
  $('#me-ph').onchange = (e) => { S.profile.phone = e.target.value.trim(); onChange({ quiet: true }); };
  $$('[data-t]').forEach((i) => (i.onchange = () => { S.profile.targets[i.dataset.t] = num(i.value) || S.profile.targets[i.dataset.t]; onChange(); }));
  $('#me-rem').onchange = async (e) => { if (e.target.checked) { const ok = await enableReminders(19); if (!ok) e.target.checked = false; else toast('Reminders on: 7 pm if you haven’t logged'); } else disableReminders(); };
  const hr = $('#me-hr'); if (hr) hr.onchange = () => enableReminders(Number(hr.value));
  $('#me-snd').onchange = (e) => { S.prefs.sound = e.target.checked; onChange({ quiet: true }); };
  $('#me-vc').onchange = (e) => { S.prefs.voice = e.target.checked; onChange({ quiet: true }); };
  $('#me-x').onchange = (e) => e.target.files[0] && importExcel(e.target.files[0]);
  const ins = $('#me-install'); if (ins) ins.onclick = doInstall;
};
ACT.need = (el) => { S.profile.targets.need = Number(el.dataset.v); onChange(); };
ACT.theme = (el) => { S.prefs.theme = el.dataset.v; onChange(); applyTheme(); };
ACT.signout = () => { sheet(`<h2>Sign out?</h2><p class="muted">Everything is saved to your account.</p><button class="btn big" id="so-ok">Sign out</button>`); $('#so-ok').onclick = () => { closeSheet(); signOut(); }; };

function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
ACT.exportjson = () => download(`pandora-workout-${today()}.json`, JSON.stringify(strip(S), null, 1), 'application/json');
ACT.exportcsv = () => {
  const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const rows = [['Date', 'Workout', 'Rest day', 'Minutes', 'Water', 'Sleep', 'Steps', 'Stretching', 'Mood', 'Weight', 'Complete', 'Activities', 'Note']];
  S.days.slice().sort((a, b) => (a.id < b.id ? -1 : 1)).forEach((r) => rows.push([r.id, r.w ? 'Yes' : '', r.rest ? 'Yes' : '', r.mins || '', r.water || '', r.sleep || '', r.steps || '', r.mob || '', r.mood || '', r.weight || '', isComplete(r) ? 'Yes' : '', (r.acts || []).map((x) => x.t + ' ' + (x.min || '') + 'min').join('; '), r.note || '']));
  rows.push([]); rows.push(['Meals: Date', 'Food', 'Amount', 'Calories', 'Protein']); S.meals.forEach((m) => rows.push([m.d, m.n, m.qty || '', m.kcal, m.p]));
  rows.push([]); rows.push(['Body: Date', 'Weight', 'Waist', 'Chest', 'Hips', 'Arm', 'Thigh', 'Body fat']); S.body.forEach((b) => rows.push([b.d, b.weight || '', b.waist || '', b.chest || '', b.hips || '', b.arm || '', b.thigh || '', b.fat || '']));
  rows.push([]); rows.push(['Tests: Date', 'Test', 'Result']); S.prs.forEach((p) => rows.push([p.d, testInfo(p.test).name, p.v]));
  download(`pandora-workout-${today()}.csv`, '﻿' + rows.map((r) => r.map(q).join(',')).join('\n'), 'text/csv');
};

/* ---------- Excel tracker import ---------- */
function loadXlsx() { return window.XLSX ? Promise.resolve() : new Promise((ok, bad) => { const s = document.createElement('script'); s.src = '/planner/xlsx.mini.min.js'; s.onload = ok; s.onerror = () => bad(new Error('Couldn’t load the Excel reader. Check your connection.')); document.body.appendChild(s); }); }
const normH = (h) => String(h == null ? '' : h).toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();
function xlDate(v) {
  if (v instanceof Date && !isNaN(v)) return dstr(v);
  if (typeof v === 'number' && v > 30000 && v < 80000) return dstr(new Date(Math.round((v - 25569) * 864e5) + new Date().getTimezoneOffset() * 6e4));
  if (typeof v === 'string') { const m = v.trim().match(/^(\d{1,2})[/\-. ](\d{1,2}|[A-Za-z]{3,})[/\-. ](\d{2,4})$/); if (m) { const mo = isNaN(m[2]) ? MONTHS.findIndex((x) => m[2].slice(0, 3).toLowerCase() === x.toLowerCase()) + 1 : Number(m[2]); const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]); if (mo > 0) return `${y}-${pad(mo)}-${pad(Number(m[1]))}`; } const d = new Date(v); if (!isNaN(d)) return dstr(d); }
  return null;
}
const yes = (v) => v === true || v === 1 || /^(y|yes|done|✓|✔|✅|true|x|1)$/i.test(String(v == null ? '' : v).trim());
/** Finds the header row (the first row with a "date" column) and returns rows as objects keyed by matched names. */
function tableOf(rows, want) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const hs = (rows[i] || []).map(normH), di = hs.findIndex((h) => h === 'date' || h.startsWith('date') || h === 'day date');
    if (di < 0) continue;
    const col = {}; Object.entries(want).forEach(([k, keys]) => { const j = hs.findIndex((h) => keys.some((w) => h === w || h.startsWith(w + ' ') || h.includes(w))); if (j >= 0) col[k] = j; }); col.date = di;
    return rows.slice(i + 1).map((r) => { const o = {}; Object.entries(col).forEach(([k, j]) => { o[k] = r[j]; }); return o; }).filter((o) => xlDate(o.date));
  }
  return [];
}
async function importExcel(file) {
  try {
    toast('Reading your file…'); await loadXlsx();
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const sheetBy = (...names) => { const n = wb.SheetNames.find((s) => names.some((x) => s.toLowerCase().includes(x))); return n ? XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null }) : null; };
    const out = { days: {}, meals: [], body: [], prs: [] };
    const daily = sheetBy('daily', 'tracker', 'log') || (wb.SheetNames.length === 1 ? sheetBy(wb.SheetNames[0].toLowerCase()) : null);
    if (daily) tableOf(daily, { w: ['workout done', 'workout', 'exercise'], water: ['water', 'glasses'], sleep: ['sleep'], steps: ['steps'], mob: ['mobility', 'stretch'], mood: ['mood'], weight: ['weight'], mins: ['minutes', 'duration'], note: ['note', 'notes', 'comment'] }).forEach((o) => {
      const d = xlDate(o.date), r = {}; if (yes(o.w) || num(o.w) > 0) r.w = 1; ['water', 'sleep', 'steps', 'mob', 'weight', 'mins'].forEach((k) => { if (num(o[k]) > 0) r[k] = num(o[k]); }); if (num(o.mood) >= 1 && num(o.mood) <= 5) r.mood = Math.round(num(o.mood)); if (o.note) r.note = String(o.note).slice(0, 200);
      if (Object.keys(r).length) out.days[d] = r;
    });
    const meals = sheetBy('meal', 'food', 'diet');
    if (meals) tableOf(meals, { n: ['food', 'meal', 'item', 'dish'], kcal: ['calories', 'kcal', 'cal'], p: ['protein'], slot: ['meal type', 'time'] }).forEach((o) => { if (o.n || num(o.kcal)) out.meals.push({ id: uid(), d: xlDate(o.date), n: String(o.n || 'Meal').slice(0, 60), kcal: Math.round(num(o.kcal)), p: num(o.p), slot: /break/i.test(o.slot) ? 'b' : /lunch/i.test(o.slot) ? 'l' : /dinner/i.test(o.slot) ? 'd' : 's' }); });
    const body = sheetBy('body', 'measure');
    if (body) tableOf(body, { weight: ['weight'], waist: ['waist'], chest: ['chest'], hips: ['hip'], arm: ['arm', 'bicep'], thigh: ['thigh'], fat: ['body fat', 'fat'] }).forEach((o) => { const b = { id: uid(), d: xlDate(o.date) }; let any = 0; ['weight', 'waist', 'chest', 'hips', 'arm', 'thigh', 'fat'].forEach((k) => { if (num(o[k]) > 0) { b[k] = num(o[k]); any++; } }); if (any) out.body.push(b); });
    const pr = sheetBy('pr', 'record', 'test');
    if (pr) tableOf(pr, { test: ['test', 'exercise', 'name'], v: ['result', 'value', 'score', 'reps', 'time'] }).forEach((o) => { if (o.test && o.v != null && o.v !== '') { const name = normH(o.test); let id = null; PROGRAM_IDS.forEach((k) => PROGRAMS[k].tests.forEach((t) => { if (!id && (normH(t.name).includes(name) || name.includes(normH(t.name).split(' ')[0]))) id = t.id; })); out.prs.push({ id: uid(), d: xlDate(o.date), test: id || 'custom:' + String(o.test).slice(0, 30), v: num(o.v) }); } });
    const nDays = Object.keys(out.days).length;
    if (!nDays && !out.meals.length && !out.body.length && !out.prs.length) { toast('Couldn’t find any logs in that file. Use the Pandora Workout Challenge tracker (Daily Tracker, Meal Log, Body Log, PR Tracker sheets).', 'bad'); return; }
    sheet(`<h2>Import from Excel</h2><p class="muted">Found in <b>${esc(file.name)}</b>:</p><div class="li"><span class="e">📅</span><div class="t"><b>${nDays} days</b><small>workouts, water, sleep, steps, mood, weight</small></div></div><div class="li"><span class="e">🍽</span><div class="t"><b>${out.meals.length} meals</b></div></div><div class="li"><span class="e">📏</span><div class="t"><b>${out.body.length} body check-ins</b></div></div><div class="li"><span class="e">📈</span><div class="t"><b>${out.prs.length} test results</b></div></div>
      <p class="sm muted">Days you’ve already logged in the app keep their app values; empty fields are filled from the sheet. Imported days count for your stats and badges, but not for gifts or money-back.</p><button class="btn big" id="ix-ok">Import</button>`);
    $('#ix-ok').onclick = () => {
      Object.entries(out.days).forEach(([d, r]) => { const cur = ensureDay(d); Object.entries(r).forEach(([k, v]) => { if (cur[k] == null || cur[k] === '') cur[k] = v; }); });
      const has = new Set(S.meals.map((m) => m.d + '|' + m.n)); out.meals.forEach((m) => { if (!has.has(m.d + '|' + m.n)) S.meals.push(m); });
      const hb = new Set(S.body.map((b) => b.d)); out.body.forEach((b) => { if (!hb.has(b.d)) S.body.push(b); });
      const hp = new Set(S.prs.map((p) => p.d + '|' + p.test)); out.prs.forEach((p) => { if (!hp.has(p.d + '|' + p.test)) S.prs.push(p); });
      onChange(); closeSheet(); confetti(100); toast(`Imported ${nDays} days 🎉`);
    };
  } catch (e) { toast(esc(e.message || 'Couldn’t read that file'), 'bad'); }
}
