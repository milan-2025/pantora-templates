/* ---------- the workout player: timers, reps, rest, voice and beeps ---------- */
const PL = { el: null, steps: [], i: 0, left: 0, run: false, t: null, started: 0, active: 0, lastTick: 0, plan: null, lock: null, half: false };

function startPlayer(plan) {
  if (!plan) return;
  PL.plan = plan; PL.steps = playerSteps(plan.session); PL.i = 0; PL.started = Date.now(); PL.active = 0;
  PL.el = document.createElement('div'); PL.el.className = 'player'; document.body.appendChild(PL.el);
  document.body.style.overflow = 'hidden';
  try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then((l) => { PL.lock = l; }).catch(() => {}); } catch (e) { /* no wake lock */ }
  say(line('start', plan.session.title));
  loadStep(true);
}
function loadStep(autoStart) {
  const s = PL.steps[PL.i];
  if (!s) return endPlayer(true);
  PL.left = s.rest || s.secs || 0; PL.half = false;
  PL.run = !!(autoStart && (s.rest || s.secs));
  drawPlayer();
  const exLeft = PL.steps.slice(PL.i).filter((x) => x.ex).length, exAll = PL.steps.filter((x) => x.ex).length;
  if (s.rest) { const n = PL.steps[PL.i + 1]; if (n) say(line('rest', EX[n.ex].n, n.reps)); }
  else say((exLeft === 1 && exAll > 3 ? line('last') + ' ' : exAll > 6 && exLeft === Math.ceil(exAll / 2) ? line('half') + ' ' : '') + (s.reps ? line('reps', EX[s.ex].n, s.reps) : line('secs', EX[s.ex].n, s.secs)) + (s.fast ? '. ' + line('fast') : ''));
  clearInterval(PL.t); PL.lastTick = Date.now(); PL.t = setInterval(tick, 250);
}
function tick() {
  const now = Date.now(), dt = (now - PL.lastTick) / 1000; PL.lastTick = now;
  if (!PL.run) return;
  PL.active += dt;
  const s = PL.steps[PL.i]; if (!(s.rest || s.secs)) return;
  const before = Math.ceil(PL.left); PL.left -= dt; const after = Math.ceil(PL.left);
  if (after !== before) {
    if (after <= 3 && after > 0) beep(after === 1 ? 990 : 660, 120);
    if (s.ex && EX[s.ex].side && !PL.half && PL.left <= (s.secs || 0) / 2) { PL.half = true; say(line('side')); beep(520, 200); }
    if (s.secs >= 120 && after > 0 && after % 60 === 0) say(line('left', after / 60));
  }
  if (PL.left <= 0) { beep(1320, 280); vibrate(80); PL.i++; loadStep(true); return; }
  updateTimer();
}
function drawPlayer() {
  const s = PL.steps[PL.i], next = PL.steps.slice(PL.i + 1).find((x) => x.ex);
  const pct = Math.round((PL.i / PL.steps.length) * 100);
  PL.el.classList.toggle('resting', !!s.rest);
  const ex = s.ex ? EX[s.ex] : null;
  PL.el.innerHTML = `<div class="pl-top"><button class="iconbtn" id="pl-x" aria-label="End">✕</button><div class="bar"><i style="width:${pct}%"></i></div><span class="tiny muted">${PL.i + 1}/${PL.steps.length}</span></div>
    <div class="pl-main">
      <div class="tiny muted">${esc(s.label || '')}</div>
      ${s.rest ? `<div style="font-size:64px">😮‍💨</div><h2 class="pl-rest">Rest</h2>` : `${figureSvg(s.ex)}<h2>${esc(ex.n)}${s.fast ? ' · fast!' : ''}</h2>`}
      ${s.rest || s.secs ? `<div class="pl-timer" id="pl-t">${clockOf(PL.left)}</div>` : `<div class="pl-reps">${s.reps}<small> reps</small></div>`}
      <div class="pl-cue" id="pl-cue">${ex ? esc(ex.cues[0]) : next ? 'Next: <b>' + esc(EX[next.ex].n) + '</b>' + (next.reps ? ' · ' + next.reps + ' reps' : ' · ' + fmtDur(next.secs)) : 'Last one done!'}</div>
      ${!s.rest && next ? `<div class="pl-next">Next: ${esc(EX[next.ex].n)}</div>` : ''}
    </div>
    <div class="pl-ctl"><button id="pl-prev" aria-label="Back">⏮</button>
      ${s.rest || s.secs ? `<button class="main" id="pl-pp" aria-label="Pause">${PL.run ? '⏸' : '▶'}</button>` : `<button class="main" id="pl-done" aria-label="Done">✓</button>`}
      <button id="pl-next" aria-label="Skip">⏭</button></div>
    <div class="row mt" style="justify-content:center;gap:18px"><button class="link" id="pl-snd">${S.prefs.sound ? '🔊 Sound on' : '🔇 Sound off'}</button><button class="link" id="pl-vc">${S.prefs.voice ? '🗣 Voice on' : '🤐 Voice off'}</button>${S.prefs.voice ? `<button class="link" id="pl-lang">${HI() ? 'हिं → EN' : 'EN → हिं'}</button>` : ''}${s.rest ? '<button class="link" id="pl-add">+20s</button>' : ex ? '<button class="link" id="pl-info">How to</button>' : ''}</div>`;
  $('#pl-x', PL.el).onclick = askEnd;
  $('#pl-prev', PL.el).onclick = () => { PL.i = Math.max(0, PL.i - 1); loadStep(false); };
  $('#pl-next', PL.el).onclick = () => { PL.i++; loadStep(true); };
  const pp = $('#pl-pp', PL.el); if (pp) pp.onclick = () => { PL.run = !PL.run; pp.textContent = PL.run ? '⏸' : '▶'; if (PL.run) beep(880, 80); };
  const dn = $('#pl-done', PL.el); if (dn) dn.onclick = () => { beep(1320, 160); vibrate(40); PL.i++; loadStep(true); };
  const add = $('#pl-add', PL.el); if (add) add.onclick = () => { PL.left += 20; updateTimer(); };
  const info = $('#pl-info', PL.el); if (info) info.onclick = () => { PL.run = false; drawPlayer(); exerciseSheet(s.ex); };
  $('#pl-snd', PL.el).onclick = () => { S.prefs.sound = !S.prefs.sound; onChange({ quiet: true }); drawPlayer(); };
  $('#pl-vc', PL.el).onclick = () => { S.prefs.voice = !S.prefs.voice; if (!S.prefs.voice && window.speechSynthesis) speechSynthesis.cancel(); onChange({ quiet: true }); drawPlayer(); };
  const lg = $('#pl-lang', PL.el); if (lg) lg.onclick = () => { S.prefs.lang = HI() ? 'en' : 'hi'; onChange({ quiet: true }); drawPlayer(); say(HI() ? 'हिंदी में कोच' : 'Coach in English'); };
  if (ex) { let ci = 0; clearInterval(PL.cueT); PL.cueT = setInterval(() => { const c = $('#pl-cue', PL.el); if (!c || !ex.cues.length) return; ci = (ci + 1) % ex.cues.length; c.textContent = ex.cues[ci]; }, 4000); }
  animateFigures();
}
function updateTimer() { const t = $('#pl-t', PL.el); if (t) t.textContent = clockOf(PL.left); }
const clockOf = (sec) => { sec = Math.max(0, Math.ceil(sec)); const m = Math.floor(sec / 60), x = sec % 60; return m + ':' + pad(x); };
function askEnd() {
  PL.run = false; drawPlayer();
  const mins = Math.round(PL.active / 60);
  sheet(`<h2>End the workout?</h2><p class="muted">You’ve done ${PL.i} of ${PL.steps.length} steps (${mins} min).</p><button class="btn big" id="pe-keep">Keep going</button>${PL.i >= PL.steps.length * 0.6 ? '<button class="btn ghost big mt" id="pe-save">Finish and count it</button>' : ''}<button class="link mt" id="pe-quit" style="display:block;margin:12px auto 0">Quit without saving</button>`);
  $('#pe-keep').onclick = () => { closeSheet(); PL.run = true; drawPlayer(); };
  if ($('#pe-save')) $('#pe-save').onclick = () => { closeSheet(); endPlayer(true); };
  $('#pe-quit').onclick = () => { closeSheet(); endPlayer(false); };
}
function endPlayer(done) {
  clearInterval(PL.t); clearInterval(PL.cueT);
  try { PL.lock && PL.lock.release(); } catch (e) { /* none */ }
  if (window.speechSynthesis) speechSynthesis.cancel();
  if (PL.el) PL.el.remove(); PL.el = null; document.body.style.overflow = '';
  if (done) { say(line('done')); finishWorkout({ mins: Math.max(1, Math.round((Date.now() - PL.started) / 60000)), rest: PL.plan && PL.plan.rest }); }
}
