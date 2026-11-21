/* ---------- Food: meals, calories and protein ---------- */
const SLOTS = [['b', '🌅', 'Breakfast'], ['l', '☀️', 'Lunch'], ['s', '🍎', 'Snacks'], ['d', '🌙', 'Dinner']];
let FOOD_DAY = null;
ROUTES.food = function () {
  const d = FOOD_DAY || today(), meals = S.meals.filter((m) => m.d === d);
  const kcal = meals.reduce((a, m) => a + num(m.kcal), 0), prot = meals.reduce((a, m) => a + num(m.p), 0);
  const tk = num(S.profile.kcal) || 0, tp = num(S.profile.protein) || 0;
  return `<div class="row mb"><button class="iconbtn" data-act="fday" data-v="-1">‹</button><div class="sp c"><b style="font-family:var(--fh)">${d === today() ? 'Today' : nice(d, true)}</b></div><button class="iconbtn" data-act="fday" data-v="1" ${d >= today() ? 'disabled style="opacity:.4"' : ''}>›</button></div>
    <div class="hero"><div class="prog"><div class="ring" style="--p:${tk ? clamp((kcal / tk) * 100, 0, 100) : 0}"><div><b>${fmt(kcal)}</b><small>${tk ? 'of ' + fmt(tk) : 'kcal'}</small></div></div><div class="ring" style="--p:${tp ? clamp((prot / tp) * 100, 0, 100) : 0};--c:var(--ok)"><div><b>${Math.round(prot)}g</b><small>${tp ? 'of ' + tp + 'g' : 'protein'}</small></div></div>
      <div class="sp sm muted">${tk || tp ? '' : 'Set daily targets for calories and protein if you track them.'}<br><button class="link" data-act="ftargets">${tk || tp ? 'Change targets' : 'Set targets'}</button></div></div></div>
    ${SLOTS.map(([k, e, n]) => { const ms = meals.filter((m) => (m.slot || 's') === k); return `<div class="card"><h3>${e} ${n}<span class="sp"></span><span class="muted tiny">${ms.length ? fmt(ms.reduce((a, m) => a + num(m.kcal), 0)) + ' kcal' : ''}</span><button class="btn sm ghost" data-act="fadd" data-slot="${k}">+ Add</button></h3>${ms.map((m) => `<div class="li"><div class="t"><b>${esc(m.n)}</b><small>${esc(m.qty || '')} · ${fmt(num(m.kcal))} kcal · ${Math.round(num(m.p))} g protein</small></div><button class="link" data-act="fdel" data-id="${m.id}">✕</button></div>`).join('')}</div>`; }).join('')}
    <p class="tiny muted c">Numbers are rough home-cooked averages. Good enough to spot patterns, not for medical use.</p>`;
};
ACT.fday = (el) => { FOOD_DAY = shift(FOOD_DAY || today(), Number(el.dataset.v)); if (FOOD_DAY > today()) FOOD_DAY = today(); render(); };
ACT.fdel = (el) => { S.meals = S.meals.filter((m) => m.id !== el.dataset.id); onChange(); };
ACT.ftargets = () => {
  sheet(`<h2>Daily food targets</h2><p class="muted">Optional. A rough guide: protein around 1 g per kg of body weight.</p><div class="grid2"><div><label class="f">Calories (kcal)</label><input id="ft-k" type="number" value="${S.profile.kcal || ''}" placeholder="e.g. 1800"></div><div><label class="f">Protein (g)</label><input id="ft-p" type="number" value="${S.profile.protein || ''}" placeholder="e.g. 70"></div></div><button class="btn big mt" id="ft-ok">Save</button>`);
  $('#ft-ok').onclick = () => { S.profile.kcal = num($('#ft-k').value) || null; S.profile.protein = num($('#ft-p').value) || null; onChange(); closeSheet(); };
};
ACT.fadd = (el) => {
  if (!canLog()) return;
  const slot = el.dataset.slot, d = FOOD_DAY || today();
  const recent = []; S.meals.slice().reverse().forEach((m) => { if (recent.length < 6 && !recent.some((x) => x.n === m.n)) recent.push(m); });
  sheet(`<h2>Add to ${SLOTS.find((x) => x[0] === slot)[2]}</h2><input id="fs-q" placeholder="Search: roti, dal, paneer, egg…" autocomplete="off"><div id="fs-r" class="mt"></div>
    ${recent.length ? `<label class="f">Recent</label>${recent.map((m, i) => `<div class="food-r" data-recent="${i}"><div class="sp"><b>${esc(m.n)}</b><div class="tiny muted">${esc(m.qty || '')} · ${fmt(m.kcal)} kcal · ${Math.round(num(m.p))} g</div></div><span class="pill">+</span></div>`).join('')}` : ''}
    <button class="link mt" id="fs-own">+ Add my own food</button>`);
  const add = (n, qty, kcal, p) => { S.meals.push({ id: uid(), d, slot, n, qty, kcal: Math.round(kcal), p: Math.round(p * 10) / 10 }); onChange(); closeSheet(); toast(`Added ${esc(n)} · ${Math.round(kcal)} kcal`); };
  const pick = (f) => {
    sheet(`<h2>${esc(f[0])}</h2><p class="muted">${esc(f[1])} = ${f[2]} kcal · ${f[3]} g protein</p><label class="f">How many servings?</label><div class="chipsel" id="fq">${[0.5, 1, 1.5, 2, 3].map((q) => `<button data-v="${q}" class="${q === 1 ? 'on' : ''}">${q}</button>`).join('')}</div><button class="btn big mt" id="fq-ok">Add</button>`);
    let q = 1; $$('#fq button').forEach((b) => (b.onclick = () => { q = Number(b.dataset.v); $$('#fq button').forEach((x) => x.classList.toggle('on', x === b)); }));
    $('#fq-ok').onclick = () => add(f[0], (q === 1 ? '' : q + ' × ') + f[1], f[2] * q, f[3] * q);
  };
  $('#fs-q').oninput = (e) => {
    const res = searchFoods(e.target.value);
    $('#fs-r').innerHTML = res.map((f, i) => `<div class="food-r" data-i="${i}"><div class="sp"><b>${esc(f[0])}</b><div class="tiny muted">${esc(f[1])} · ${f[2]} kcal · ${f[3]} g protein</div></div><span class="pill">+</span></div>`).join('') || (e.target.value.trim() ? '<p class="muted sm">Not in the list. Add it as your own food below.</p>' : '');
    $$('#fs-r .food-r').forEach((r) => (r.onclick = () => pick(res[Number(r.dataset.i)])));
  };
  $$('[data-recent]').forEach((r) => (r.onclick = () => { const m = recent[Number(r.dataset.recent)]; add(m.n, m.qty, m.kcal, m.p); }));
  $('#fs-own').onclick = () => {
    sheet(`<h2>My own food</h2><label class="f">Name</label><input id="fo-n" maxlength="60"><div class="grid2"><div><label class="f">Calories</label><input id="fo-k" type="number"></div><div><label class="f">Protein (g)</label><input id="fo-p" type="number"></div></div><label class="f">Amount (optional)</label><input id="fo-q" placeholder="e.g. 1 bowl"><button class="btn big mt" id="fo-ok">Add</button>`);
    $('#fo-ok').onclick = () => { if (!$('#fo-n').value.trim()) return toast('Give it a name', 'bad'); add($('#fo-n').value.trim(), $('#fo-q').value.trim(), num($('#fo-k').value), num($('#fo-p').value)); };
  };
  setTimeout(() => $('#fs-q') && $('#fs-q').focus(), 150);
};
