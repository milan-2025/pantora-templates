/* ---------- Rewards: level, gifts, badges, money-back, referrals · and the plans screen ---------- */
ROUTES.rewards = function () {
  const x = stats(), lv = levelOf(x.xp), fr = freezes();
  let h = `<div class="hero"><div class="lvl"><div class="n">${lv.level}</div><div class="sp"><small class="muted">Level ${lv.level}</small><h2 style="margin:0">${esc(lv.name)}</h2><div class="xpbar mt" style="margin-top:8px"><i style="width:${lv.pct}%"></i></div><small class="muted">${fmt(x.xp)} XP · ${fmt(lv.to - x.xp)} XP to ${esc(LEVELS[Math.min(lv.level, LEVELS.length - 1)])}</small></div></div>
    <div class="grid3 mt"><div class="stat"><b>🔥 ${x.cur}</b><small>streak</small></div><div class="stat"><b>🧊 ${fr.left}</b><small>freezes</small></div><div class="stat"><b>🏅 ${BADGES.filter((b) => b.ok(x)).length}</b><small>badges</small></div></div></div>`;
  h += giftRoad();
  h += pledgeCard('rewards');
  h += moneyBackCard();
  h += referralCard();
  const fresh = newBadges().map((b) => b.id);
  h += `<div class="card"><h3>🏅 Badges</h3><div class="badges">${BADGES.map((b) => `<div class="bd ${b.ok(x) ? '' : 'off'} ${fresh.includes(b.id) ? 'new' : ''}"><span class="e">${b.e}</span><b>${esc(b.n)}</b><small>${esc(b.d)}</small></div>`).join('')}</div></div>`;
  h += `<div class="card flat"><h3>How points work</h3><p class="sm muted">Workout +${XP.workout} · each checkpoint +${XP.checkpoint} · complete day +${XP.complete} · streak bonus +${XP.streakPerDay}/day (up to +${XP.streakPerDay * XP.streakMax}) · quest +${XP.quest} · daily chest up to +${XP.chestMax} · meal +${XP.meal} · test +${XP.pr} · body check-in +${XP.body}. Streak freezes: one for every 7 complete days (bank up to 3).</p></div>`;
  if (fresh.length) setTimeout(() => { S.game.seen = [...new Set(S.game.seen.concat(fresh))]; onChange({ quiet: true }); renderNavBadges(); }, 1500);
  return h;
};

function giftRoad() {
  if (!ME) return '';
  const got = new Set(ME.gifts.map((g) => g.key)), on = ME.onTime;
  const list = ME.milestones.slice().sort((a, b) => a.days - b.days || (a.kind === 'streak' ? -1 : 1));
  const nextKey = (list.find((m) => !got.has(m.key)) || {}).key;
  const icon = { days: '📅', freeze: '🧊', coupon: '🎟', badge: '🏅', seat: '👥' };
  return `<div class="card"><h3>🎁 Milestone gifts</h3><p class="sm muted">Unlocked automatically. Days count when you log them on the day (or by the next day). Your on-time streak: <b>🔥 ${on.streak}</b> · complete days: <b>${on.completed}</b></p>
    <div class="road mt">${list.map((m) => { const have = got.has(m.key), g = ME.gifts.find((x) => x.key === m.key); const prog = m.kind === 'streak' ? Math.max(on.streak, on.best) : on.completed; return `<div class="ms ${have ? 'got' : m.key === nextKey ? 'next' : ''}"><span class="dot">${have ? '✓' : icon[m.reward] || '🎁'}</span><b>${esc(m.title)}</b><small>${esc(m.note || '')}${have && g && g.code ? ` · code <b>${esc(g.code)}</b>` : ''}${!have && m.key === nextKey ? ` · ${Math.max(0, m.days - prog)} to go` : ''}</small>${!have && m.key === nextKey ? `<div class="bar mt" style="margin-top:6px"><i style="width:${clamp((prog / m.days) * 100, 0, 100)}%"></i></div>` : ''}</div>`; }).join('')}</div></div>`;
}

function moneyBackCard() {
  const mb = ME && ME.moneyBack; if (!mb) return '';
  const top = mb.tiers.slice().sort((a, b) => b.days - a.days)[0], low = mb.tiers.slice().sort((a, b) => a.days - b.days)[0];
  const rule = mb.rule === 'completed' ? 'complete days' : 'days you log';
  if (!mb.eligible) return `<div class="card"><h3>💸 Money-back promise</h3><p class="muted sm">Buy a yearly plan, show up, and get paid back: log ${low.days} days in your year for ${low.percent}% back${low.months ? ` (or ${low.months} free months)` : ''}, ${top.days} days for ${top.percent}% back${top.months ? ` (or ${top.months} free months)` : ''}.</p>${ME.access.kind === 'member' ? '<p class="tiny muted">The promise is for the person who bought the plan.</p>' : '<button class="btn sm" data-act="upgrade">See plans</button>'}</div>`;
  const target = mb.next ? mb.next.days : top.days, pct = clamp((mb.counted / target) * 100, 0, 100);
  let action = '';
  if (mb.claim && mb.claim.status !== 'rejected') action = `<p class="pill ${mb.claim.status === 'pending' ? 'gold' : 'ok'}">${{ pending: '⏳ Claim under review', approved: '✅ Approved', paid: '✅ Refund paid', done: '✅ Free months added' }[mb.claim.status] || mb.claim.status}</p>`;
  else if (mb.reached) action = `<p><b>You did it! ${mb.counted} days.</b> Choose your reward:</p><div class="row wrap">${mb.reached.percent ? `<button class="btn" data-act="mbclaim" data-c="refund">${mb.reached.percent}% money back</button>` : ''}${mb.reached.months ? `<button class="btn ghost" data-act="mbclaim" data-c="extend">${mb.reached.months} free months</button>` : ''}</div>${mb.next ? `<p class="tiny muted mt">Or keep going: ${mb.next.days} days gets ${mb.next.percent}% back. One claim per year.</p>` : ''}`;
  if (mb.claim && mb.claim.status === 'rejected') action += `<p class="sm" style="color:var(--bad)">Last claim wasn’t approved${mb.claim.note ? ': ' + esc(mb.claim.note) : ''}.</p>`;
  return `<div class="card"><h3>💸 Money-back promise<span class="sp"></span><span class="pill gold">${mb.counted}/${target}</span></h3>
    <div class="row"><div class="ring" style="--p:${pct};--c:var(--gold)"><div><b>${mb.counted}</b><small>days</small></div></div><div class="sp sm muted">Counting ${rule} from ${niceLong(mb.termStart)} to ${niceLong(mb.termEnd)}.<br>${mb.tiers.slice().sort((a, b) => a.days - b.days).map((t) => `<b>${t.days} days</b> → ${t.percent}% back${t.months ? ' or ' + t.months + ' free months' : ''}`).join('<br>')}</div></div>
    ${action ? '<div class="mt">' + action + '</div>' : ''}<details class="mt tiny muted"><summary>Terms</summary>${esc(mb.terms)}</details></div>`;
}
ACT.mbclaim = (el) => {
  const c = el.dataset.c;
  sheet(`<h2>Claim ${c === 'refund' ? 'your money back' : 'your free months'}?</h2><p class="muted">${c === 'refund' ? 'We’ll check your log and refund to your original payment method within 7 working days.' : 'Once approved, the months are added to your plan straight away.'} One claim per paid year.</p><button class="btn big" id="mb-ok">Claim</button>`);
  $('#mb-ok').onclick = async () => { try { await api('moneyback', { method: 'POST', body: { choice: c } }); await refreshMe(); closeSheet(); confetti(200); render(); toast('Claim sent 🏆'); } catch (e) { toast(esc(e.message), 'bad'); } };
};

function referralCard() {
  const r = ME && ME.referral; if (!r) return '';
  const what = r.reward === 'seat' ? `${r.amount || 1} extra friend place` : `${r.amount} free days`;
  const msg = `I’m doing a workout challenge on Pandora Workout 💪 Daily plan, streaks and gifts. Start free, and get ₹${r.friendOff} off a plan with my link: ${r.link}`;
  return `<div class="card"><h3>📣 Invite friends, earn rewards</h3><p class="muted sm">${r.friendOff ? `Friends get ₹${r.friendOff} off. ` : ''}You get <b>${what}</b> each time someone buys a plan with your link${r.max ? ` (up to ${r.max})` : ''}.</p>
    <div class="row"><input readonly value="${esc(r.link)}" id="ref-l"><button class="btn sm ghost" data-act="refcopy">Copy</button></div>
    <div class="row mt"><a class="btn sm" target="_blank" rel="noopener" href="${wa(msg)}">Share on WhatsApp</a>${navigator.share ? '<button class="btn sm ghost" data-act="refshare">More…</button>' : ''}<span class="sp"></span><span class="pill">${r.count} joined</span></div></div>`;
}
ACT.refcopy = () => { try { navigator.clipboard.writeText(ME.referral.link); toast('Link copied'); } catch (e) { $('#ref-l').select(); } };
ACT.refshare = () => { try { navigator.share({ title: 'Pandora Workout', text: 'Join me on Pandora Workout 💪', url: ME.referral.link }); } catch (e) { /* cancelled */ } };

/* ---------- plans & checkout ---------- */
function upgradeSheet(reason) {
  const plans = (ME && ME.plans) || [], a = ME && ME.access;
  const ref = store.get('wk_ref') || (ME && ME.refCodeUsed);
  const mb = ME && ME.moneyBack && ME.moneyBack.tiers.slice().sort((x, y) => x.days - y.days);
  sheet(`<h2>${a && a.kind === 'owner' && !a.isPaid ? 'Renew your plan' : 'Keep going all year'}</h2>${reason ? `<p class="banner warn" style="margin:8px 0 14px">${esc(reason)}</p>` : ''}
    <div class="opts">${plans.map((p) => `<div class="plan ${p.badge ? 'best' : ''}">${p.badge ? `<span class="bdg">${esc(p.badge)}</span>` : ''}<b style="font-family:var(--fh);font-size:18px">${esc(p.name)}</b><div class="pr">₹${fmt(p.price)}<small class="muted" style="font-size:14px"> / year</small></div><div class="muted sm">${esc(p.tagline || '')}</div><ul>${(p.features || []).map((f) => `<li>${esc(f)}</li>`).join('')}</ul><button class="btn big" data-act="buy" data-p="${esc(p.planId)}">Choose ${esc(p.name)}</button></div>`).join('')}</div>
    <details class="mt"><summary class="sm">Have a promo code?</summary><input id="up-c" class="mt" placeholder="Code" style="text-transform:uppercase"></details>
    ${ref ? `<p class="pill ok mt">🎁 Friend’s referral: ₹${(ME && ME.referral && ME.referral.friendOff) || ''} off at checkout</p>` : ''}
    ${mb && mb.length ? `<p class="sm muted mt">💸 <b>Money-back promise:</b> log ${mb[0].days} days in your year and get ${mb[0].percent}% back${mb[1] ? `; ${mb[1].days} days, ${mb[1].percent}%` : ''}.</p>` : ''}
    <p class="tiny muted">One-time payment for a year. No auto-renewal. Secure checkout by Razorpay (UPI, cards, net banking).</p>`);
}
ACT.buy = async (el) => {
  const b = el; b.disabled = true; b.textContent = 'Opening…';
  try {
    const v = await buy(el.dataset.p, ($('#up-c') && $('#up-c').value.trim()) || undefined);
    closeSheet(); confetti(240); chime();
    sheet(`<div class="celebrate"><span class="e">🎉</span><h2>Welcome to ${esc(v.plan)}!</h2><p class="muted">Your plan runs until ${niceLong(v.expiresAt)}. Add friends and family from Together → My plan’s people.</p><a class="btn big mt" href="#together/plan" data-close>Add my people</a></div>`);
    render();
  } catch (e) { toast(esc(e.message), 'bad'); b.disabled = false; b.textContent = 'Try again'; }
};
