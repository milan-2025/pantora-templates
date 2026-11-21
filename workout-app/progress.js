/* ---------- Progress: dashboard, challenge map, body, photos, lifetime ---------- */
function barChart(vals, labels, o) {
  o = o || {}; const W = 320, H = 130, pad = 18, max = Math.max(1, ...vals), bw = (W - pad) / vals.length;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${[0.5, 1].map((f) => `<line class="gl" x1="${pad}" x2="${W}" y1="${H - 18 - (H - 30) * f}" y2="${H - 18 - (H - 30) * f}"/>`).join('')}
    ${vals.map((v, i) => { const h = Math.max(((H - 30) * v) / max, v ? 2 : 0); return `${h ? `<rect class="${o.cls || 'bar'}" x="${pad + i * bw + bw * 0.18}" y="${H - 18 - h}" width="${bw * 0.64}" height="${h}" rx="${Math.min(3, h / 2)}"/>` : ''}${labels && (vals.length <= 12 || i % 2 === 0) ? `<text x="${pad + i * bw + bw / 2}" y="${H - 4}" text-anchor="middle">${esc(labels[i])}</text>` : ''}`; }).join('')}
    <text x="0" y="12">${fmt(max)}${o.unit ? ' ' + o.unit : ''}</text></svg>`;
}
function lineChart(pts, o) {
  o = o || {}; if (pts.length < 2) return '<p class="muted sm">Log at least two entries to see a chart.</p>';
  const W = 320, H = 140, px = 30, ys = pts.map((p) => p[1]), lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1;
  const x = (i) => px + (i * (W - px - 8)) / (pts.length - 1), y = (v) => 12 + (H - 34) * (1 - (v - lo) / span);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p[1]).toFixed(1)).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}"><line class="gl" x1="${px}" x2="${W}" y1="${y(hi)}" y2="${y(hi)}"/><line class="gl" x1="${px}" x2="${W}" y1="${y(lo)}" y2="${y(lo)}"/>
    <text x="0" y="${y(hi) + 3}">${hi}</text><text x="0" y="${y(lo) + 3}">${lo}</text><path class="ar" d="${d}L${x(pts.length - 1)} ${H - 22}L${x(0)} ${H - 22}Z"/><path class="ln" d="${d}"/>
    ${pts.map((p, i) => `<circle class="pt" cx="${x(i)}" cy="${y(p[1])}" r="3"/>`).join('')}<text x="${px}" y="${H - 6}">${esc(nice(pts[0][0]))}</text><text x="${W - 8}" y="${H - 6}" text-anchor="end">${esc(nice(pts[pts.length - 1][0]))}</text></svg>`;
}

ROUTES.progress = function (args) {
  const tab = args[0] || SUB.progress || 'dash'; SUB.progress = tab;
  const tabs = [['dash', 'Dashboard'], ['map', 'Challenge map'], ['tests', 'Tests'], ['body', 'Body'], ['photos', 'Photos'], ['life', 'Lifetime']];
  return `<div class="tabs">${tabs.map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-act="ptab" data-v="${k}">${n}</button>`).join('')}</div>` + (PROG_TABS[tab] || PROG_TABS.dash)();
};
ROUTES.progress.after = (args) => { const tab = args[0] || SUB.progress; if (tab === 'photos') loadPhotos(); };
ACT.ptab = (el) => go('progress/' + el.dataset.v);
const PROG_TABS = {};

PROG_TABS.dash = function () {
  const x = stats(), lv = levelOf(x.xp);
  const weeks = [], labels = []; let m = monday(today());
  for (let i = 11; i >= 0; i--) { const s = shift(m, -7 * i); let mins = 0; for (let j = 0; j < 7; j++) { const r = dayRow(shift(s, j)); if (r) mins += num(r.mins) + (r.acts || []).reduce((a, q) => a + num(q.min), 0); } weeks.push(mins); labels.push(new Date(s + 'T12:00:00').getDate() + '/' + (new Date(s + 'T12:00:00').getMonth() + 1)); }
  const w = S.days.filter((r) => num(r.weight) > 0).sort((a, b) => (a.id < b.id ? -1 : 1)).slice(-30).map((r) => [r.id, num(r.weight)]);
  const c7 = []; const cl = []; for (let i = 6; i >= 0; i--) { const d = shift(today(), -i); c7.push(checkpoints(dayRow(d))); cl.push(WD[new Date(d + 'T12:00:00').getDay()].slice(0, 2)); }
  return `<div class="grid2"><div class="stat"><b>${x.complete}</b><small>complete days</small></div><div class="stat"><b>🔥 ${x.cur}</b><small>streak · best ${x.best}</small></div><div class="stat"><b>${x.workouts}</b><small>workouts</small></div><div class="stat"><b>${fmt(x.mins)}</b><small>minutes moved</small></div></div>
    <div class="card mt"><div class="lvl"><div class="n">${lv.level}</div><div class="sp"><b>${esc(lv.name)}</b><div class="xpbar mt" style="margin-top:6px"><i style="width:${lv.pct}%"></i></div><small class="muted">${fmt(x.xp)} XP · ${fmt(lv.to - x.xp)} to level ${lv.level + 1}</small></div></div></div>
    <div class="card"><h3>⏱ Minutes per week</h3>${barChart(weeks, labels, { unit: 'min' })}</div>
    <div class="card"><h3>✅ Checkpoints, last 7 days</h3>${barChart(c7, cl, { cls: 'bar2' })}</div>
    <div class="card"><h3>⚖️ Weight</h3>${lineChart(w)}</div>
    ${weekReport()}`;
};
function weekReport() {
  const m = monday(shift(today(), -7)), days = [0, 1, 2, 3, 4, 5, 6].map((i) => dayRow(shift(m, i)));
  const done = days.filter(isComplete).length, wo = days.filter((r) => r && r.w).length, mins = days.reduce((a, r) => a + num(r && r.mins), 0);
  const water = days.filter((r) => r && num(r.water) >= T().water).length, sleep = days.filter((r) => r && num(r.sleep) >= T().sleep).length;
  const meals = S.meals.filter((q) => q.d >= m && q.d <= shift(m, 6)), kcal = meals.reduce((a, q) => a + num(q.kcal), 0), mealDays = new Set(meals.map((q) => q.d)).size;
  const grade = done >= 6 ? ['A+', 'Outstanding week!'] : done >= 5 ? ['A', 'Strong week.'] : done >= 3 ? ['B', 'Solid. Aim for one more complete day.'] : done >= 1 ? ['C', 'A start. Small wins add up.'] : ['–', 'New week, fresh start.'];
  return `<div class="card"><h3>🗓 Last week’s report<span class="sp"></span><span class="pill gold">${grade[0]}</span></h3><p class="muted sm">${nice(m)} – ${nice(shift(m, 6))} · ${grade[1]}</p>
    <div class="li"><span class="e">✅</span><div class="t"><b>Complete days</b></div><div class="v">${done}/7</div></div><div class="li"><span class="e">💪</span><div class="t"><b>Workouts</b><small>${mins} min</small></div><div class="v">${wo}</div></div>
    <div class="li"><span class="e">💧</span><div class="t"><b>Water goal hit</b></div><div class="v">${water}/7</div></div><div class="li"><span class="e">😴</span><div class="t"><b>Sleep goal hit</b></div><div class="v">${sleep}/7</div></div>
    ${mealDays ? `<div class="li"><span class="e">🍽</span><div class="t"><b>Average calories</b><small>on ${mealDays} day${mealDays === 1 ? '' : 's'} logged</small></div><div class="v">${fmt(kcal / mealDays)}</div></div>` : ''}</div>`;
}

PROG_TABS.map = function () {
  const c = CH(); if (!c) return `<div class="empty"><span class="e">🗺</span>No challenge running.<br><button class="btn mt" data-act="setup">Pick a challenge</button></div>`;
  const t = today(), p = PROGRAMS[c.program];
  let cells = '';
  for (let n = 1; n <= c.length; n++) {
    const d = shift(c.start, n - 1), r = dayRow(d), pl = planDay(c, n);
    const cls = isComplete(r) ? 'c' : r && r.fz ? 'z' : isLogged(r) ? 'l' : d < t ? 'm' : '';
    cells += `<button class="${cls} ${d === t ? 't' : ''} ${pl.rest ? 'r' : ''}" data-act="dayedit" data-d="${d}" title="${nice(d, true)}">${pl.test ? '📈' : n}</button>`;
  }
  const phases = [0, 1, 2, 3].map((ph) => `<span class="pill">${PHASES[ph]}: days ${Math.floor((ph * c.length) / 4) + 1}–${Math.floor(((ph + 1) * c.length) / 4)}</span>`).join('');
  return `<div class="card"><h3>${p.emoji} ${esc(p.name)} · ${c.length} days</h3><p class="sm muted">${nice(c.start)} → ${nice(shift(c.start, c.length - 1))}. Tap a day to see or fix it.</p><div class="map">${cells}</div>
    <div class="row wrap mt tiny"><span class="pill ok">■ complete</span><span class="pill">■ logged</span><span class="pill">🧊 frozen</span><span class="pill">📈 test day</span></div><div class="row wrap mt tiny">${phases}</div>
    <p class="tiny muted mt">Days filled in later still count for your stats, but gifts and money-back only count days logged on the day (or the day after).</p></div>
    <div class="row"><button class="btn ghost sm" data-act="setup">Switch challenge</button><button class="btn ghost sm" data-act="stopch">Stop this challenge</button></div>`;
};
ACT.stopch = () => sheet(`<h2>Stop this challenge?</h2><p class="muted">Your logs stay. It moves to your history.</p><button class="btn big" id="sc-ok">Stop it</button>`) && ($('#sc-ok').onclick = () => { archiveChallenge('stopped'); S.challenge = null; onChange(); closeSheet(); go('today'); });
ACT.dayedit = (el) => dayEditor(el.dataset.d);
function dayEditor(d) {
  const r = dayRow(d) || { id: d }, c = CH(), n = c ? diff(c.start, d) + 1 : 0, pl = c && n >= 1 && n <= c.length ? planDay(c, n) : null;
  sheet(`<h2>${nice(d, true)}</h2>${pl ? `<p class="muted">Day ${n} · ${esc(pl.session.title)} · ${pl.phaseName}</p>` : ''}
    <label class="row"><input type="checkbox" id="de-w" ${r.w ? 'checked' : ''} style="width:auto"> Did the workout</label>${pl && pl.rest ? `<label class="row mt"><input type="checkbox" id="de-r" ${r.rest ? 'checked' : ''} style="width:auto"> Rest day done</label>` : ''}
    <div class="grid2"><div><label class="f">Minutes</label><input id="de-mi" type="number" value="${r.mins || ''}"></div><div><label class="f">Water (glasses)</label><input id="de-wa" type="number" value="${r.water || ''}"></div>
    <div><label class="f">Sleep (h)</label><input id="de-sl" type="number" step="0.5" value="${r.sleep || ''}"></div><div><label class="f">Steps</label><input id="de-st" type="number" value="${r.steps || ''}"></div>
    <div><label class="f">Stretching (min)</label><input id="de-mo" type="number" value="${r.mob || ''}"></div><div><label class="f">Weight (kg)</label><input id="de-kg" type="number" step="0.1" value="${r.weight || ''}"></div></div>
    <label class="f">Note</label><input id="de-n" value="${esc(r.note || '')}"><button class="btn big mt" id="de-ok">Save</button>`);
  $('#de-ok').onclick = () => {
    const v = (id) => ($(id).value === '' ? null : Number($(id).value));
    setDay(d, { w: $('#de-w').checked ? 1 : null, rest: $('#de-r') && $('#de-r').checked ? 1 : null, mins: v('#de-mi'), water: v('#de-wa'), sleep: v('#de-sl'), steps: v('#de-st'), mob: v('#de-mo'), weight: v('#de-kg'), note: $('#de-n').value.trim() || null });
    closeSheet();
  };
}

/* ----- tests / personal records ----- */
PROG_TABS.tests = function () {
  const ids = [...new Set([...(CH() ? PROGRAMS[CH().program].tests.map((t) => t.id) : []), ...S.prs.map((p) => p.test)])];
  if (!ids.length) return `<div class="empty"><span class="e">📈</span>Test yourself on day 1, then retest a third and two-thirds of the way in.<br><button class="btn mt" data-act="tests">Log a test</button></div>`;
  return `<div class="card"><h3>📈 Your tests<span class="sp"></span><button class="btn sm" data-act="tests">+ Log</button></h3>${ids.map((id) => {
    const t = testInfo(id), rows = S.prs.filter((p) => p.test === id).sort((a, b) => (a.d < b.d ? -1 : 1));
    if (!rows.length) return `<div class="li"><span class="e">⏱</span><div class="t"><b>${esc(t.name)}</b><small>Not tested yet</small></div></div>`;
    const first = num(rows[0].v), last = num(rows[rows.length - 1].v), best = t.up ? Math.max(...rows.map((p) => num(p.v))) : Math.min(...rows.map((p) => num(p.v)));
    const ch = first ? Math.round(((last - first) / first) * 100) * (t.up ? 1 : -1) : 0;
    return `<div class="li"><span class="e">${ch > 0 ? '🚀' : '⏱'}</span><div class="t"><b>${esc(t.name)}</b><small>Start ${first} → now ${last} ${esc(t.unit)} · best ${best}</small></div><div class="v" style="color:${ch > 0 ? 'var(--ok)' : 'var(--mu)'}">${rows.length > 1 ? (ch > 0 ? '+' : '') + ch + '%' : '–'}</div></div>`;
  }).join('')}</div>`;
};
function testsSheet() {
  const list = CH() ? PROGRAMS[CH().program].tests : PROGRAMS.home.tests;
  sheet(`<h2>📈 Log your tests</h2><p class="muted">Do each one fresh, with good form. You’ll retest later to see how far you’ve come.</p>
    ${list.map((t) => `<label class="f">${esc(t.name)} (${esc(t.unit)})</label><input type="number" step="any" inputmode="decimal" data-test="${t.id}" placeholder="${esc(t.how)}">`).join('')}
    <button class="btn big mt" id="ts-ok">Save</button>`);
  $('#ts-ok').onclick = () => {
    const d = today(); let n = 0, beat = 0;
    $$('[data-test]').forEach((i) => {
      if (i.value === '') return; const id = i.dataset.test, v = Number(i.value), t = testInfo(id);
      const prev = S.prs.filter((p) => p.test === id).map((p) => num(p.v)); if (prev.length && (t.up ? v > Math.max(...prev) : v < Math.min(...prev))) beat++;
      S.prs = S.prs.filter((p) => !(p.test === id && p.d === d)); S.prs.push({ id: uid(), d, test: id, v }); n++;
    });
    if (!n) { closeSheet(); return; }
    onChange(); closeSheet();
    if (beat) { confetti(150); chime(); sheet(`<div class="celebrate"><span class="e">🚀</span><h2>New personal record${beat > 1 ? 's' : ''}!</h2><p class="muted">You beat ${beat} of your tests. That’s real progress.</p><button class="btn big mt" data-close>Yes!</button></div>`); } else toast('Saved. Retest later to see your progress.');
  };
}

/* ----- body measurements ----- */
PROG_TABS.body = function () {
  const rows = S.body.slice().sort((a, b) => (a.d < b.d ? 1 : -1));
  const f = ['weight', 'waist', 'chest', 'hips', 'arm', 'thigh', 'fat'], L = { weight: 'Weight (kg)', waist: 'Waist (cm)', chest: 'Chest (cm)', hips: 'Hips (cm)', arm: 'Arm (cm)', thigh: 'Thigh (cm)', fat: 'Body fat %' };
  const first = rows[rows.length - 1], last = rows[0];
  return `<div class="card"><h3>📏 Body check-ins<span class="sp"></span><button class="btn sm" data-act="bodyadd">+ Add</button></h3><p class="muted sm">Once a week is plenty: same day, same time, before breakfast.</p>
    ${rows.length > 1 ? `<div class="grid3 mt">${f.filter((k) => num(first[k]) && num(last[k])).slice(0, 6).map((k) => { const dlt = Math.round((num(last[k]) - num(first[k])) * 10) / 10; return `<div class="stat"><b style="font-size:19px">${dlt > 0 ? '+' : ''}${dlt}</b><small>${esc(L[k])}</small></div>`; }).join('')}</div>` : ''}
    ${lineChart(rows.filter((r) => num(r.waist)).slice().reverse().map((r) => [r.d, num(r.waist)]))}
    ${rows.length ? rows.map((r) => `<div class="li"><span class="e">📏</span><div class="t"><b>${nice(r.d, true)}</b><small>${f.filter((k) => r[k]).map((k) => esc(L[k].split(' (')[0]) + ' ' + r[k]).join(' · ')}</small></div><button class="link" data-act="bodydel" data-id="${r.id}">Delete</button></div>`).join('') : '<div class="empty"><span class="e">📏</span>No check-ins yet.</div>'}</div>`;
};
ACT.bodyadd = () => {
  const L = [['weight', 'Weight (kg)'], ['waist', 'Waist (cm)'], ['chest', 'Chest (cm)'], ['hips', 'Hips (cm)'], ['arm', 'Arm (cm)'], ['thigh', 'Thigh (cm)'], ['fat', 'Body fat % (optional)']];
  sheet(`<h2>📏 Body check-in</h2><div class="grid2">${L.map(([k, n]) => `<div><label class="f">${n}</label><input type="number" step="0.1" inputmode="decimal" data-b="${k}"></div>`).join('')}</div><button class="btn big mt" id="bd-ok">Save</button>`);
  $('#bd-ok').onclick = () => { const row = { id: uid(), d: today() }; let any = 0; $$('[data-b]').forEach((i) => { if (i.value !== '') { row[i.dataset.b] = Number(i.value); any++; } }); if (!any) return closeSheet(); S.body.push(row); if (row.weight) ensureDay(today()).weight = row.weight; onChange(); closeSheet(); toast('Check-in saved +' + XP.body + ' XP'); };
};
ACT.bodydel = (el) => { S.body = S.body.filter((r) => r.id !== el.dataset.id); onChange(); };

/* ----- progress photos (private, limited per week) ----- */
let PHOTOS = null;
PROG_TABS.photos = function () {
  if (!PHOTOS) return `<div class="empty"><span class="e">📸</span>Loading your photos…</div>`;
  const q = PHOTOS.quota;
  return `<div class="card"><h3>📸 Progress photos<span class="sp"></span><span class="pill ${q.left ? 'ok' : ''}">${q.used}/${q.allowed} this week</span></h3>
    <p class="muted sm">Private: only you can see them. ${q.allowed === 1 ? 'One photo a week (Pro gives 5).' : `${q.allowed} photos a week.`} Unused photos don’t carry over.</p>
    <div class="row mt"><label class="btn ${q.left ? '' : 'ghost'}" for="ph-in">${q.left ? '📷 Add this week’s photo' : 'New photos open Monday'}</label><input type="file" id="ph-in" accept="image/*" capture="environment" hidden ${q.left ? '' : 'disabled'}>${PHOTOS.photos.length > 1 ? '<button class="btn ghost" data-act="phcmp">⇆ Before / after</button>' : ''}</div></div>
    ${PHOTOS.photos.length ? `<div class="photos">${PHOTOS.photos.map((p) => `<button data-act="phview" data-id="${p.id}"><img src="${esc(p.thumb)}" alt="" loading="lazy"><span>${nice(p.day)}</span></button>`).join('')}</div>` : '<div class="empty"><span class="e">🪞</span>Your first photo is your “before”. Future you will thank you.</div>'}`;
};
async function loadPhotos(force) {
  if (PHOTOS && !force) { bindPhotoInput(); return; }
  try { PHOTOS = await api('photos'); if (ROUTE === 'progress' && SUB.progress === 'photos') render(); } catch (e) { const m = $('#main'); if (m && SUB.progress === 'photos') m.querySelector('.empty') && (m.querySelector('.empty').innerHTML = '<span class="e">📶</span>' + esc(e.status === 0 ? 'Photos need internet.' : e.message)); }
}
function bindPhotoInput() { const i = $('#ph-in'); if (i) i.onchange = () => i.files[0] && uploadPhoto(i.files[0]); }
async function shrink(file) {
  const img = await new Promise((ok, bad) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => bad(new Error('Couldn’t read that photo')); im.src = URL.createObjectURL(file); });
  const max = 1400, k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.84));
}
async function uploadPhoto(file) {
  if (!canLog()) return;
  toast('Uploading…');
  try {
    const blob = await shrink(file);
    const s = await api('photos/sign', { method: 'POST', body: { day: today() } });
    const fd = new FormData(); Object.entries(s.fields).forEach(([k, v]) => fd.append(k, v)); fd.append('file', blob, 'photo.jpg');
    const up = await fetch(s.url, { method: 'POST', body: fd }); if (!up.ok) throw new Error('Upload failed. Try again.');
    await api('photos/confirm', { method: 'POST', body: { id: s.id } });
    await loadPhotos(true); confetti(60); toast('📸 Saved. See you next week!');
  } catch (e) { if (e.status === 402 && e.data && e.data.reason === 'photos') upgradeSheet(e.message); else toast(esc(e.message), 'bad'); }
}
ACT.phview = (el) => { const p = PHOTOS.photos.find((x) => x.id === el.dataset.id); sheet(`<img src="${esc(p.url)}" style="width:100%;border-radius:18px" alt=""><p class="muted c">${nice(p.day, true)}</p><button class="link" id="ph-del" style="display:block;margin:auto">Delete photo</button><p class="tiny muted c">Deleting doesn’t give the week’s photo back.</p>`); $('#ph-del').onclick = async () => { try { await api('photos/delete', { method: 'POST', body: { id: p.id } }); closeSheet(); loadPhotos(true); } catch (e) { toast(esc(e.message), 'bad'); } }; };
ACT.phcmp = () => {
  const ps = PHOTOS.photos, a = ps[ps.length - 1], b = ps[0];
  sheet(`<h2>Before / after</h2><div class="cmp"><img src="${esc(a.url)}" alt=""><img class="b" id="cmp-b" src="${esc(b.url)}" alt=""><input type="range" min="0" max="100" value="50" id="cmp-r"></div><div class="row mt sm muted"><span>${nice(a.day)}</span><span class="sp"></span><span>${nice(b.day)}</span></div>`);
  $('#cmp-r').oninput = (e) => { $('#cmp-b').style.clipPath = `inset(0 0 0 ${e.target.value}%)`; };
};

/* ----- lifetime: the long view ----- */
PROG_TABS.life = function () {
  const x = stats(), t = today();
  let cells = ''; const start = shift(monday(t), -7 * 52);
  for (let i = 0; i < 53 * 7; i++) { const d = shift(start, i); if (d > t) break; const r = dayRow(d), cp = checkpoints(r); cells += `<i class="${r && r.fz ? 'z' : isComplete(r) ? 'c' : cp >= 2 ? 'b' : isLogged(r) ? 'a' : ''}" title="${d}"></i>`; }
  const goals = S.goals.slice().sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));
  return `<div class="card"><h3>🗓 Your year</h3><div class="heat">${cells}</div><div class="row tiny muted mt"><span>Less</span><i style="width:10px;height:10px;border-radius:3px;background:var(--line)"></i><i style="width:10px;height:10px;border-radius:3px;background:color-mix(in srgb,var(--ok) 35%,var(--line))"></i><i style="width:10px;height:10px;border-radius:3px;background:var(--ok)"></i><span>More</span></div></div>
    <div class="grid2"><div class="stat"><b>${x.workouts}</b><small>workouts, all time</small></div><div class="stat"><b>${fmt(x.mins / 60)} h</b><small>moved</small></div><div class="stat"><b>${x.km.toFixed(1)} km</b><small>walked, run, cycled</small></div><div class="stat"><b>${x.best}</b><small>longest streak</small></div></div>
    <div class="card mt"><h3>🎯 Long-term goals<span class="sp"></span><button class="btn sm" data-act="goaladd">+ Goal</button></h3>${goals.length ? goals.map(goalRow).join('') : '<p class="muted sm">Set a goal for the months ahead: a weight, a test score, a number of workouts. We’ll track it for you.</p>'}</div>
    <div class="card"><h3>🏁 Challenges</h3>${S.challenges.length || CH() ? (CH() ? `<div class="li"><span class="e">${PROGRAMS[CH().program].emoji}</span><div class="t"><b>${esc(PROGRAMS[CH().program].name)} · ${CH().length} days</b><small>Now · day ${Math.max(0, chDay())}</small></div></div>` : '') + S.challenges.slice().reverse().map((c) => `<div class="li"><span class="e">${PROGRAMS[c.program].emoji}</span><div class="t"><b>${esc(PROGRAMS[c.program].name)} · ${c.length} days</b><small>${nice(c.start)} – ${nice(c.end)} · ${c.complete} complete days</small></div><span class="pill ${c.status === 'finished' ? 'ok' : ''}">${c.status === 'finished' ? '🎓 Finished' : 'Stopped'}</span></div>`).join('') : '<p class="muted sm">Your finished challenges will show here.</p>'}</div>`;
};
function goalProgress(g) {
  if (g.kind === 'workouts') { const n = S.days.filter((r) => r.w && r.id >= g.start).length; return { now: n, pct: clamp((n / g.target) * 100, 0, 100) }; }
  if (g.kind === 'weight') { const ws = S.days.filter((r) => num(r.weight) > 0 && r.id >= g.start).sort((a, b) => (a.id < b.id ? -1 : 1)); const now = ws.length ? num(ws[ws.length - 1].weight) : g.from; const span = g.target - g.from; return { now, pct: span ? clamp(((now - g.from) / span) * 100, 0, 100) : 0 }; }
  if (g.kind === 'test') { const t = testInfo(g.test), ps = S.prs.filter((p) => p.test === g.test); const now = ps.length ? (t.up ? Math.max(...ps.map((p) => num(p.v))) : Math.min(...ps.map((p) => num(p.v)))) : g.from; const span = g.target - g.from; return { now, pct: span ? clamp(((now - g.from) / span) * 100, 0, 100) : 0 }; }
  return { now: g.now || 0, pct: clamp(((g.now || 0) / (g.target || 1)) * 100, 0, 100) };
}
function goalRow(g) {
  const p = goalProgress(g), daysLeft = g.by ? diff(today(), g.by) : null;
  if (!g.done && p.pct >= 100) { g.done = today(); setTimeout(() => { onChange({ quiet: true }); confetti(200); chime(); toast('🎯 Goal reached: ' + esc(g.title)); }, 300); }
  return `<div class="li"><span class="e">${g.done ? '🏆' : '🎯'}</span><div class="t"><b>${esc(g.title)}</b><small>${g.kind === 'custom' ? '' : 'Now ' + (Math.round(p.now * 10) / 10) + ' · target ' + g.target}${daysLeft != null ? ' · ' + (daysLeft >= 0 ? daysLeft + ' days left' : 'date passed') : ''}</small><div class="bar mt" style="margin-top:6px"><i style="width:${p.pct}%"></i></div></div>${g.kind === 'custom' && !g.done ? `<button class="btn sm ghost" data-act="goalbump" data-id="${g.id}">+1</button>` : ''}<button class="link" data-act="goaldel" data-id="${g.id}">✕</button></div>`;
}
ACT.goaladd = () => {
  const tests = [...new Set(PROGRAM_IDS.flatMap((k) => PROGRAMS[k].tests.map((t) => t.id)))];
  sheet(`<h2>🎯 New goal</h2><label class="f">Kind</label><select id="gl-k"><option value="weight">Reach a weight</option><option value="workouts">Do a number of workouts</option><option value="test">Hit a test score</option><option value="custom">Something else (count it yourself)</option></select>
    <div id="gl-test" hidden><label class="f">Test</label><select id="gl-t">${tests.map((id) => `<option value="${id}">${esc(testInfo(id).name)}</option>`).join('')}</select></div>
    <label class="f">Target</label><input id="gl-v" type="number" step="any" placeholder="e.g. 70"><label class="f">Name it (optional)</label><input id="gl-n" maxlength="60" placeholder="e.g. Fit into my wedding sherwani"><label class="f">By (optional)</label><input id="gl-by" type="date"><button class="btn big mt" id="gl-ok">Add goal</button>`);
  $('#gl-k').onchange = () => { $('#gl-test').hidden = $('#gl-k').value !== 'test'; };
  $('#gl-ok').onclick = () => {
    const k = $('#gl-k').value, v = Number($('#gl-v').value); if (!v) return toast('Type a target', 'bad');
    const g = { id: uid(), kind: k, target: v, start: today(), by: $('#gl-by').value || null };
    if (k === 'weight') g.from = num(lastWeight()) || v; if (k === 'test') { g.test = $('#gl-t').value; const ps = S.prs.filter((p) => p.test === g.test); g.from = ps.length ? num(ps[ps.length - 1].v) : 0; }
    g.title = $('#gl-n').value.trim() || ({ weight: `Reach ${v} kg`, workouts: `${v} workouts`, test: `${testInfo(g.test).name}: ${v}`, custom: `Goal: ${v}` })[k];
    S.goals.push(g); onChange(); closeSheet();
  };
};
ACT.goaldel = (el) => { S.goals = S.goals.filter((g) => g.id !== el.dataset.id); onChange(); };
ACT.goalbump = (el) => { const g = S.goals.find((x) => x.id === el.dataset.id); g.now = (g.now || 0) + 1; onChange(); };
