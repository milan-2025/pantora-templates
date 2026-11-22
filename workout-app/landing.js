/* ---------- the page people see before signing in (/workout) ---------- */
let LANDING = null;
function showLanding() {
  const lp = $('#lp');
  lp.innerHTML = landingHtml();
  animateFigures(); lpBind(); applyMode();
  api('plans').then((d) => { LANDING = d; lpFill(); }).catch(() => {});
}
function lpBind() {
  $$('#lp [data-go]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); gate(b.dataset.go); }));
  $$('#lp .lp-faq button').forEach((b) => (b.onclick = () => b.parentElement.classList.toggle('open')));
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { threshold: 0.15 }) : null;
  $$('#lp .rv').forEach((el) => (io ? io.observe(el) : el.classList.add('in')));
}
const lpPrice = (n) => '₹' + Number(n).toLocaleString('en-IN');
function lpFill() {
  const d = LANDING; if (!d) return;
  const paid = d.plans.filter((p) => !p.isFree), free = d.plans.find((p) => p.isFree);
  const el = $('#lp-plans');
  if (el) el.innerHTML = `<div class="lp-plan"><b>Free challenge</b><div class="lp-pr">₹0</div><p>${d.freeDays} days, one challenge</p><ul>${((free && free.features) || ['Any challenge, including festival specials', 'Workout player, streaks and gifts', 'Join friends’ groups']).map((f) => `<li>${esc(f)}</li>`).join('')}</ul><button class="btn ghost big" data-go="signup">Start free</button></div>` +
    paid.map((p) => `<div class="lp-plan ${p.badge ? 'best' : ''}">${p.badge ? `<span class="bdg">${esc(p.badge)}</span>` : ''}<b>${esc(p.name)}</b><div class="lp-pr">${lpPrice(p.price)}<small>/year</small></div><p>${esc(p.tagline || '')} · about ${lpPrice(Math.round(p.price / 12))} a month${p.seats ? `, or ${lpPrice(Math.round(p.price / (p.seats + 1) / 12))} a person` : ''}</p><ul>${p.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul><button class="btn big" data-go="signup">Start free, upgrade later</button></div>`).join('');
  const mb = $('#lp-mb'); if (mb && d.moneyBack) mb.innerHTML = d.moneyBack.tiers.slice().sort((a, b) => a.days - b.days).map((t) => `<div class="lp-tier"><b>${t.days}</b><span>days logged</span><em>${t.percent}% back${t.months ? `<br><small>or ${t.months} free months</small>` : ''}</em></div>`).join('');
  const gifts = $('#lp-gifts'); if (gifts && d.milestones.length) gifts.innerHTML = d.milestones.slice(0, 6).map((m) => `<div class="lp-gift"><span>${m.kind === 'streak' ? '🔥' : '✅'} ${m.days}</span><b>${esc(m.title)}</b><small>${esc(m.note || '')}</small></div>`).join('');
  $$('#lp [data-free]').forEach((x) => (x.textContent = d.freeDays));
  if (d.offerText) { const o = $('#lp-offer'); if (o) { o.textContent = d.offerText; o.hidden = false; } }
  if (d.friendOff && store.get('wk_ref')) { const o = $('#lp-offer'); if (o) { o.textContent = `🎁 Your friend’s link: ${lpPrice(d.friendOff)} off any plan`; o.hidden = false; } }
  if (d.whatsapp) { const w = $('#lp-wa'); if (w) { w.href = `https://wa.me/${d.whatsapp.number}?text=${encodeURIComponent(d.whatsapp.message)}`; w.hidden = false; } }
  lpBind();
}
function landingHtml() {
  const prog = PROGRAM_IDS.map((id) => { const p = PROGRAMS[id]; return `<div class="lp-prog rv" style="--pc:${p.color}"><span class="e">${p.emoji}</span><b>${esc(p.name)}</b><small>${esc(p.level)} · ${esc(p.gear)}</small><p>${esc(p.blurb)}</p></div>`; }).join('');
  const heat = Array.from({ length: 26 * 7 }, (_, i) => { const r = Math.sin(i * 12.9898) * 43758.5453 % 1; const v = Math.abs(r); return `<i class="${i > 150 ? (v > 0.2 ? 'c' : 'b') : v > 0.55 ? 'c' : v > 0.35 ? 'b' : v > 0.2 ? 'a' : ''}"></i>`; }).join('');
  return `<header class="lp-nav"><a href="/workout" class="lp-brand"><span class="g-logo">${LOGO}</span><b>Pandora <span>Workout</span></b></a><span class="sp"></span><button class="iconbtn lp-mode" type="button" aria-label="Light or dark"></button><a href="#" class="lp-in" data-go="login">Sign in</a><a href="#" class="btn sm" data-go="signup">Start free</a></header>
  <section class="lp-hero"><div class="lp-hero-t"><p class="lp-eye">14 to 100-day workout challenges · made for India · works offline</p>
    <h1>Roz thoda.<br><span>Saal bhar ka result.</span></h1>
    <p class="lp-sub">A plan for every day, a coach that counts with you, streaks and gifts that make you want to show up, and friends who notice when you don’t.</p>
    <p class="lp-offer" id="lp-offer" hidden></p>
    <div class="lp-cta"><a href="#" class="btn big" data-go="signup"><span>Start your <b data-free>14</b>-day challenge free</span></a><a href="#lp-how" class="btn ghost big">See how it works</a></div>
    <div class="lp-trust"><span>✓ No card needed</span><span>✓ No equipment to start</span><span>✓ Install it like an app</span></div></div>
    <div class="lp-phone rv"><div class="lp-screen">
      <div class="lp-mini-top"><b>Day 12 of 30</b><span class="flame hot"><span class="f">🔥</span>12</span></div>
      <div class="lp-mini-card">${figureSvg('squat')}<div><small>Build phase</small><b>Full body · 18 min</b><div class="lp-mini-bar"><i></i></div></div></div>
      <div class="lp-mini-cps">${['💪', '💧', '😴', '👟', '🧘'].map((e, i) => `<span class="${i < 3 ? 'on' : ''}">${e}</span>`).join('')}</div>
      <div class="lp-mini-q"><span>✓</span> Drink 8 glasses of water <em>+15</em></div><div class="lp-mini-q"><span>✓</span> Log a meal <em>+15</em></div><div class="lp-mini-q off"><span></span> Write one line about today <em>+15</em></div>
      <div class="lp-mini-chest">🎁 <b>1 quest to open today’s chest</b></div>
      <div class="lp-mini-week">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => `<span><small>${d}</small><i class="${i < 4 ? 'c' : i === 4 ? 't' : ''}">${i < 4 ? '✓' : ''}</i></span>`).join('')}</div>
      <div class="lp-toast">🎉 <b>Riya</b> cheered you on</div></div></div></section>

  <section class="lp-sec lp-pain" id="lp-how"><h2 class="rv">Most challenges don’t fail on day 1.<br><span>They fade out by week 2.</span></h2>
    <div class="lp-grid4">${[['🤷', 'You don’t know what to do today, so you skip it', 'The app shows today’s workout, sized for your level and phase.'], ['📉', 'You can’t see progress, so motivation drops', 'Streaks, levels, tests and a year heatmap show every win.'], ['🙈', 'Nobody notices when you stop', 'Your group sees your tick. Your buddy nudges you.'], ['😩', 'One missed day becomes a missed week', 'Streak freezes and comeback mode get you back on track.']].map(([e, a, b]) => `<div class="lp-card rv"><span class="e">${e}</span><b>${a}</b><p>${b}</p></div>`).join('')}</div></section>

  <section class="lp-sec"><p class="lp-eye c">Pick one. Switch any time.</p><h2 class="c rv">Nine challenges, a plan for every single day</h2><p class="lp-lead c">Choose 9 to 100 days, from Couch to 5K to Navratri dance cardio and a Shaadi Fit wedding countdown. The plan grows through four phases (Foundation, Build, Strengthen, Peak) with recovery days and test days built in.</p><div class="lp-progs">${prog}</div></section>

  <section class="lp-sec lp-split"><div class="rv"><p class="lp-eye">Your coach, in your pocket</p><h2>Press play. Just follow along.</h2><p class="lp-lead">Every move is animated, timed and counted. Beeps for the last 3 seconds, a voice that tells you what’s next, rest timers, and “too easy / too hard” that tunes the next workout to you.</p>
    <ul class="lp-ticks"><li>40+ moves with form tips and easier/harder swaps</li><li>Intervals for HIIT and Couch to 5K run/walks</li><li>Screen stays on; works with no internet</li><li>Did the gym instead? Log any activity in a tap</li></ul></div>
    <div class="lp-player rv"><div class="lp-pl-fig">${figureSvg('jacks')}</div><b>Jumping jacks</b><div class="lp-pl-t">0:24</div><small>Next: Squats · 12 reps</small><div class="lp-pl-ctl"><span>⏮</span><span class="m">⏸</span><span>⏭</span></div></div></section>

  <section class="lp-sec lp-game"><p class="lp-eye c">Built to be a little addictive</p><h2 class="c rv">Show up, and the app shows up for you</h2>
    <div class="lp-grid3">${[['🔥', 'Streaks with freezes', 'Complete days stack up. Miss one? Use a freeze you earned and keep your streak.'], ['🆙', '20 levels', 'Every workout, glass of water and good night’s sleep earns XP. From Fresh Start to GOAT.'], ['🎯', 'Daily quests & a chest', 'Three small quests a day. Finish them all to open a chest of bonus XP.'], ['🏅', '26 badges', 'Early bird, perfect week, record breaker, centurion… collect them all.'], ['📈', 'Tests that prove it', 'Test on day 1, retest a third and two-thirds in. See the % you improved.'], ['🎨', 'Themes to unlock', 'Ocean, Rose and Gold themes open up as you level up.']].map(([e, a, b]) => `<div class="lp-card rv"><span class="e">${e}</span><b>${a}</b><p>${b}</p></div>`).join('')}</div></section>

  <section class="lp-sec lp-split rev"><div class="rv"><p class="lp-eye">Better together</p><h2>Ek plan. Poori family. Plus the office gang.</h2><p class="lp-lead">One person buys, and up to 7 friends or family use it free, each with their own challenge and streak.</p>
    <ul class="lp-ticks"><li><b>Groups:</b> do the same challenge from the same day, or just log together. Weekly XP leaderboard, cheers and nudges.</li><li><b>Random buddy:</b> get matched with another member for accountability. First names only; swap WhatsApp after a week if you both want.</li><li><b>Invite on WhatsApp</b> with one link.</li></ul></div>
    <div class="lp-board rv"><b>🏆 Sharma Fit Squad · this week</b>${[['🥇', 'Papa', 12, '✅', 860], ['🥈', 'Riya', 9, '✅', 790], ['🥉', 'You', 12, '💪', 760], ['M', 'Mummy', 5, '⏳', 410]].map(([m, n, s, t, x]) => `<div class="lp-brow"><span>${m}</span><b>${n}</b><small>🔥 ${s} · ${t}</small><em>${x}</em></div>`).join('')}<div class="lp-brow msg">👉 Riya nudged Mummy: “Let’s do it together tomorrow”</div></div></section>

  <section class="lp-sec lp-gifts"><p class="lp-eye c">Rewards that are actually worth something</p><h2 class="c rv">Hit milestones. Unlock gifts.</h2><div class="lp-giftrow" id="lp-gifts"></div>
    <div class="lp-mbox rv"><div><p class="lp-eye">The money-back promise</p><h2>Show up all year, get paid back.</h2><p>On a yearly plan, log your days and claim part of your money back, or free months instead. Only days logged on the day count.</p></div><div class="lp-tiers" id="lp-mb"></div></div></section>

  <section class="lp-sec lp-split"><div class="rv"><p class="lp-eye">For the long run</p><h2>Not just 30 days. Your whole fitness story.</h2><p class="lp-lead">Finish one challenge, start the next. Track weight, measurements, meals (with everyday Indian foods), private progress photos and long-term goals, all in one place, for years.</p>
    <ul class="lp-ticks"><li>Year heatmap and lifetime totals</li><li>Goals like “70 kg by March” or “100 workouts”</li><li>Before/after photo slider, private to you</li><li>Bought our Excel tracker? Import it in a tap</li></ul></div>
    <div class="lp-heat rv"><b>Your year</b><div class="heat">${heat}</div><div class="lp-heat-s"><span><b>214</b> workouts</span><span><b>96 h</b> moved</span><span><b>41</b> best streak</span></div></div></section>

  <section class="lp-sec" id="lp-pricing"><p class="lp-eye c">Simple yearly price. No auto-renew.</p><h2 class="c rv">Start free. Keep going all year.</h2><div class="lp-plans" id="lp-plans"><div class="lp-plan"><b>Loading prices…</b></div></div></section>

  <section class="lp-sec lp-faqs"><h2 class="c">Questions</h2>${[['Do I need a gym or equipment?', 'No. Most challenges need nothing but you. Couch to 5K needs running shoes; yoga, a mat or towel.'], ['I’m a complete beginner. Is this for me?', 'Yes. Start with Walking or Beginner Home Workout. Every move has an easier version, and “too hard” makes the next workouts lighter.'], ['How does sharing with family work?', 'Buy a plan and add people by email from the app: 3 on Basic, 7 on Pro. They sign in with their own email and get everything free for the year.'], ['How does the money-back promise work?', 'On a yearly plan, the days you log on the day (or by the next day) are counted. Reach the target in your year and claim a part of your payment back, or free months instead. We check claims and refund within 7 working days.'], ['Does it work without internet?', 'Yes. After the first visit, install it to your home screen. Workouts and logging work offline and sync when you’re back online.'], ['Is my data private?', 'Your log and photos are private to you. Friends in a group only see your first name, streak, level and today’s tick.'], ['Is this medical advice?', 'No. It’s a planning and tracking app. Check with your doctor before starting a new exercise plan, and stop if anything hurts.']].map(([q, a]) => `<div class="lp-faq"><button>${q}<span>+</span></button><p>${a}</p></div>`).join('')}</section>

  <section class="lp-final"><h2>Your streak starts today.</h2><p>Pick a challenge, press play. We’ll handle the rest.</p><a href="#" class="btn big" data-go="signup"><span>Start <b data-free>14</b> days free</span></a></section>
  <footer class="lp-foot"><span>© Pandora Templates</span><a href="/">pandoratemplates.com</a><a href="/workout_challange">Excel tracker</a><a href="/planner">Wedding planner</a><a id="lp-wa" target="_blank" rel="noopener" hidden>WhatsApp us</a></footer>`;
}
