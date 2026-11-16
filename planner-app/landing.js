/* ---------- landing page: what visitors (and ad clicks) see at /planner before signing in ---------- */
// Settings come from Admin → Wedding planner → Planner landing page (via /api/planner/landing); prices from Planner plans.

let LP_CFG = null;
const lpConfig = () => (LP_CFG = LP_CFG || api('/landing').catch(() => ({ plans: [], testimonials: [] })));

/* Where the visitor came from (first touch, kept 30 days) — saved on their planner so you can see which ads bring trials. */
(function rememberSource() {
  try {
    const q = new URLSearchParams(location.search);
    const parts = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].map(k => q.get(k)).filter(Boolean);
    if (!parts.length && q.get('fbclid')) parts.push('facebook (fbclid)');
    if (!parts.length && q.get('gclid')) parts.push('google (gclid)');
    const old = JSON.parse(store.get('pp_src') || 'null');
    if (parts.length && !(old && Date.now() - old.t < 30 * 864e5)) store.set('pp_src', JSON.stringify({ s: parts.join(' / ').slice(0, 200), t: Date.now() }));
  } catch (e) { /* ignore */ }
})();
function lpSource() { try { const o = JSON.parse(store.get('pp_src') || 'null'); return o && Date.now() - o.t < 30 * 864e5 ? o.s : ''; } catch (e) { return ''; } }

/* Meta Pixel: loaded only when an ID is set in the admin. Events: PageView, Lead, StartTrial, Purchase. */
let PIXEL = null;
function loadPixel(id) {
  if (PIXEL || !id) return PIXEL;
  /* eslint-disable */
  !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s) }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  window.fbq('init', id); window.fbq('track', 'PageView');
  return (PIXEL = id);
}
async function track(ev, params) {
  try { const c = await lpConfig(); if (!c.metaPixelId) return; loadPixel(c.metaPixelId); if (ev !== 'PageView') window.fbq('track', ev, params || {}); } catch (e) { /* tracking must never break the app */ }
}

/* ---------- page ---------- */
function hideLanding() { document.body.classList.remove('lp-on'); const l = $('#lp'); if (l) l.innerHTML = ''; }

function lpPhone(src, alt, eager) {
  return '<div class="lp-phone"><img src="/planner/lp/' + src + '.webp" alt="' + esc(alt) + '" width="300" height="649" ' + (eager ? 'fetchpriority="high"' : 'loading="lazy"') + ' decoding="async"></div>';
}

const LP_FEATURES = [
  ['guests', 'Guests & RSVP', 'Har family, har function, ek list mein.', ['Families grouped by bride’s side and groom’s side', 'RSVP per function: who’s coming to Haldi, who’s only at the Reception', 'Send your invite on WhatsApp in one tap, and see who still hasn’t got it', 'Search by name, family, city or phone']],
  ['functions', 'Every function', 'Roka se Vidaai tak, sab set.', ['Roka, Haldi, Mehndi, Sangeet, Baraat & Milni, Pheras, Reception…', 'Rename, switch off, or add your own functions', 'Date, time and countdown for each', 'Day-of run sheet: who does what, when']],
  ['budget', 'Budget', 'Kitna socha, kitna pakka, kitna diya.', ['Your total budget split into categories, ready to adjust', 'Planned vs committed vs paid, for every line', 'Warns you before a category goes over']],
  ['vendors', 'Vendors & quotes', 'Teen caterers, teen quotes? Compare side by side.', ['Log every quote with contact, rating and notes', 'Compare quotes for the same job and pick one', 'The chosen vendor flows straight into your budget']],
  ['payments', 'Payments', 'Advance kisko diya, baaki kab dena hai.', ['Every advance and instalment with its due date', 'Overdue and due-soon alerts on the dashboard', 'Paid amounts update the budget automatically']],
  ['stay', 'Stay, travel & food', 'Rooms, cars aur plates ka hisaab.', ['Allocate families to hotel rooms; see who still needs one', 'Cars and pickups, with who travels in which', 'Plates to order per function, worked out from your guest list']],
  ['shagun', 'Shagun & len-den', 'Kisne kya diya, sab yaad rahega.', ['Shagun and gifts received and given, per function', 'Thank-yous still to send', 'Returns pending, so nothing gets missed']],
  ['tasks', 'Tasks & timeline', '90+ tasks, already in order.', ['A ready checklist with deadlines worked out from your wedding date', 'Only a few weeks left? Express and emergency timelines squeeze it to fit', 'Assign tasks to family members and track what’s overdue']],
];

function landingScreen() {
  document.body.classList.add('lp-on');
  const root = $('#lp');
  const brand = $('.brand').innerHTML;
  const F = LP_FEATURES;
  root.innerHTML =
    '<header class="lp-nav"><div class="lp-w"><a class="lp-logo" href="/planner" aria-label="Pandora Wedding Planner">' + brand + '</a><span class="sp"></span><button class="lp-link" data-lp-signin>Sign in</button><button class="lp-btn sm" data-lp-start>Start free</button></div></header>' +

    // HERO
    '<section class="lp-hero"><div class="lp-w lp-hero-in"><div class="lp-hero-txt">' +
      '<p class="lp-eyebrow">Online Indian Wedding Planner</p>' +
      '<h1>Shaadi ki poori planning, <em>ek jagah.</em></h1>' +
      '<p class="lp-lead">Guests, functions, budget, vendors, payments and shagun, from Roka to Vidaai. Shared with your family and in sync on every phone.</p>' +
      '<div class="lp-ctas"><button class="lp-btn big" data-lp-start data-hero-cta>Start your <span data-trial-days>14</span>-day free trial</button><button class="lp-btn ghost big" data-lp-demo>See a sample wedding</button></div>' +
      '<p class="lp-micro">✓ No card needed &nbsp; ✓ Sign in with just your email &nbsp; ✓ Up to <span data-trial-guests>30</span> guests free</p>' +
    '</div><div class="lp-hero-vis">' + lpPhone('dash', 'Wedding dashboard: days to go, guests, budget and payments', true) +
      '<div class="lp-float f1"><b>11</b> confirmed for Sangeet</div><div class="lp-float f2"><b>₹5.79 L</b> paid · ₹10.9 L to go</div><div class="lp-float f3">🔔 2 payments due this week</div>' +
    '</div></div></section>' +

    // PROBLEM
    '<section class="lp-sec lp-prob"><div class="lp-w"><h2>Sound familiar?</h2><div class="lp-g3">' +
      '<div class="lp-pcard"><span>📱</span><b>5 WhatsApp groups, 3 Excel sheets, 1 diary</b><p>And the latest guest list is… somewhere.</p></div>' +
      '<div class="lp-pcard"><span>🙋‍♀️</span><b>“Beta, kitne guests final hue?”</b><p>Asked every evening, answered from memory.</p></div>' +
      '<div class="lp-pcard"><span>💸</span><b>“Caterer ko advance kitna diya tha?”</b><p>Receipts in one place, promises in another.</p></div>' +
    '</div><p class="lp-sum">Pandora puts the whole wedding in one planner that the whole family can open.</p></div></section>' +

    // FEATURES (tabs)
    '<section class="lp-sec" id="lp-features"><div class="lp-w"><p class="lp-eyebrow c">Everything inside</p><h2 class="c">Built for Indian weddings, not adapted to them.</h2>' +
      '<div class="lp-tabs" role="tablist">' + F.map((f, i) => '<button role="tab" data-ft="' + i + '"' + (i ? '' : ' aria-selected="true"') + '>' + esc(f[1]) + '</button>').join('') + '</div>' +
      '<div class="lp-feat"><div class="lp-feat-vis">' + lpPhone(F[0][0], F[0][1]) + '</div><div class="lp-feat-txt" aria-live="polite"></div></div>' +
      '<div class="lp-also"><b>Also inside:</b> rituals & puja checklist · milni list · shopping & outfits · printable sheets for vendors and family · import & export to Excel · activity log & restore</div>' +
    '</div></section>' +

    // FAMILY
    '<section class="lp-sec lp-fam"><div class="lp-w lp-split"><div><p class="lp-eyebrow">Plan together</p><h2>Mummy, Papa, Didi… <em>sab ek hi plan pe.</em></h2>' +
      '<p>Invite your family with their email. Each person signs in on their own phone and sees the same planner, live.</p><ul class="lp-ticks">' +
      '<li><b>Can edit</b> or <b>view only</b>: you decide for each person</li><li>Changes show on everyone’s phone within seconds</li><li>Activity log shows who changed what, and you can restore an earlier version</li><li data-fam-count></li></ul></div>' +
      '<div class="lp-famcard" aria-hidden="true"><div class="lp-act"><i style="background:#F2A93B">M</i><div><b>Mummy</b> marked 4 guests as confirmed<small>Sangeet · just now</small></div></div><div class="lp-act"><i style="background:#1F7A74">P</i><div><b>Papa</b> added a payment of ₹50,000<small>Caterer advance · 3 min ago</small></div></div><div class="lp-act"><i style="background:#E0675A">D</i><div><b>Didi</b> finished “Book mehndi artist”<small>Tasks · 10 min ago</small></div></div><div class="lp-act"><i style="background:#552C69">A</i><div><b>You</b> invited Chacha ji as view only<small>Sharing · 1 hr ago</small></div></div></div>' +
    '</div></section>' +

    // HOW IT WORKS
    '<section class="lp-sec"><div class="lp-w"><h2 class="c">Start in two minutes</h2><div class="lp-g3 lp-steps">' +
      '<div><span>1</span><b>Sign in with your email</b><p>We send a 6-digit code. No password to remember.</p></div>' +
      '<div><span>2</span><b>Pick how to start</b><p>A fresh plan with tasks and budget ready, the sample wedding to edit, or your Pandora Excel planner.</p></div>' +
      '<div><span>3</span><b>Invite the family</b><p>Share it and plan together on phone and laptop.</p></div>' +
    '</div></div></section>' +

    // DEVICES + EXCEL
    '<section class="lp-sec lp-dev"><div class="lp-w"><h2 class="c">Laptop pe plan karo, phone pe check karo.</h2><p class="c lp-sub">The same planner on every screen. Phones get a simple card view, with no sideways scrolling.</p>' +
      '<div class="lp-browser"><div class="lp-bbar"><i></i><i></i><i></i><span>pandoratemplates.com/planner</span></div><img src="/planner/lp/desktop.webp" alt="The planner dashboard on a laptop" width="1280" height="800" loading="lazy" decoding="async"></div>' +
      '<div class="lp-excel"><span>📊</span><div><b>Already using the Pandora Excel planner?</b><p>Import your filled-in workbook in one click and carry on online. You can export back to Excel any time.</p></div></div>' +
    '</div></section>' +

    // PRICING
    '<section class="lp-sec lp-price" id="lp-pricing"><div class="lp-w"><p class="lp-eyebrow c">Simple pricing</p><h2 class="c">Try it free. Pay once if you love it.</h2><p class="c lp-sub">One-time payment for the whole wedding. No subscription, no auto-renewal.</p><div class="lp-plans"><div class="lp-empty">Loading plans…</div></div></div></section>' +

    // TESTIMONIALS (filled only when some are ticked in the admin)
    '<section class="lp-sec lp-tst" hidden><div class="lp-w"><h2 class="c">Families planning with Pandora</h2><div class="lp-g3 lp-quotes"></div></div></section>' +

    // FAQ
    '<section class="lp-sec"><div class="lp-w lp-narrow"><h2 class="c">Questions</h2><div class="lp-faq"></div></div></section>' +

    // FINAL CTA
    '<section class="lp-final"><div class="lp-w lp-narrow c"><h2>Shaadi kab hai?</h2><p>Pick the date and see how much time you have.</p>' +
      '<div class="lp-date"><input type="date" class="inp" data-lp-date aria-label="Wedding date"><div class="lp-left" data-lp-left></div></div>' +
      '<button class="lp-btn big" data-lp-start>Start planning free</button><p class="lp-micro">No card needed · <span data-trial-days>14</span> days free</p></div></section>' +

    '<footer class="lp-foot"><div class="lp-w">© ' + new Date().getFullYear() + ' Pandora Templates · <a href="/">pandoratemplates.com</a> · Open the box. Everything’s ready.</div></footer>' +
    '<div class="lp-sticky"><button class="lp-btn" data-lp-start>Start free trial</button></div>' +
    '<a class="lp-wa" hidden target="_blank" rel="noopener" aria-label="Chat with us on WhatsApp"><svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><path fill="#fff" d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm0 23.7a10.7 10.7 0 0 1-5.5-1.5l-.4-.2-3.9 1 1-3.8-.2-.4A10.7 10.7 0 1 1 16 26.7zm5.9-8c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a8.8 8.8 0 0 1-4.4-3.8c-.3-.6.3-.5.9-1.7.1-.2 0-.4 0-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.9.4 3.6 3.6 0 0 0-1.1 2.7 6.3 6.3 0 0 0 1.3 3.3 14.3 14.3 0 0 0 5.5 4.9c2 .9 2.8.9 3.8.8a3.2 3.2 0 0 0 2.1-1.5 2.6 2.6 0 0 0 .2-1.5c-.1-.2-.3-.3-.5-.4z"/></svg></a>';

  // buttons
  $$('[data-lp-start]', root).forEach(b => b.onclick = () => signInScreen('', true));
  $$('[data-lp-signin]', root).forEach(b => b.onclick = () => signInScreen('', true));
  $$('[data-lp-demo]', root).forEach(b => b.onclick = () => startLocal());

  // feature tabs
  const showFeat = i => {
    const f = F[i];
    $$('[data-ft]', root).forEach(b => b.setAttribute('aria-selected', String(+b.dataset.ft === i)));
    const img = $('.lp-feat-vis img', root); img.src = '/planner/lp/' + f[0] + '.webp'; img.alt = f[1];
    $('.lp-feat-txt', root).innerHTML = '<h3>' + esc(f[1]) + '</h3><p class="lp-hing">' + esc(f[2]) + '</p><ul class="lp-ticks">' + f[3].map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
      (i < F.length - 1 ? '<button class="lp-link" data-ft-next>Next: ' + esc(F[i + 1][1]) + ' →</button>' : '');
    const n = $('[data-ft-next]', root); if (n) n.onclick = () => { showFeat(i + 1); $('[data-ft="' + (i + 1) + '"]', root).scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); };
  };
  $$('[data-ft]', root).forEach(b => b.onclick = () => showFeat(+b.dataset.ft));
  showFeat(0);
  F.forEach(f => { const im = new Image(); im.loading = 'lazy'; im.src = '/planner/lp/' + f[0] + '.webp'; }); // warm the cache so tabs switch instantly

  // countdown
  const di = $('[data-lp-date]', root), left = $('[data-lp-left]', root);
  const showLeft = () => {
    const v = di.value; if (!v) { left.textContent = ''; return; }
    const days = Math.ceil((new Date(v + 'T00:00:00') - new Date(new Date().toDateString())) / 864e5);
    left.innerHTML = days < 0 ? 'That date has passed. Pick the wedding date.' : days === 0 ? '<b>It’s today!</b> Shubh vivah 🎉' : '<b>' + days + ' days to go</b> · ' + (days < 60 ? 'tight, but the express timeline was made for this.' : days < 180 ? 'perfect time to get organised.' : 'plenty of time, if you start early.');
    try { store.set('pp_lp_date', v); } catch (e) { /* ignore */ }
  };
  di.min = new Date().toISOString().slice(0, 10); di.value = store.get('pp_lp_date') || ''; di.oninput = showLeft; showLeft();

  // sticky CTA once the hero button scrolls away
  const sticky = $('.lp-sticky', root), hero = $('[data-hero-cta]', root), fin = $('.lp-final', root);
  if ('IntersectionObserver' in window) {
    let heroGone = false, finIn = false; const upd = () => sticky.classList.toggle('on', heroGone && !finIn);
    new IntersectionObserver(es => { heroGone = !es[0].isIntersecting && es[0].boundingClientRect.top < 0; upd(); }).observe(hero);
    new IntersectionObserver(es => { finIn = es[0].isIntersecting; upd(); }).observe(fin);
  }

  lpConfig().then(c => lpFill(root, c));
  track('PageView');
}

function lpFill(root, c) {
  if (!root.isConnected || !document.body.classList.contains('lp-on')) return;
  const plans = c.plans || [], trial = plans.find(p => p.isTrial), paid = plans.filter(p => !p.isTrial && p.active);
  const days = trial ? trial.durationDays : 14, tg = trial && trial.limits ? trial.limits.guests : null;
  $$('[data-trial-days]', root).forEach(e => { e.textContent = days; });
  $$('[data-trial-guests]', root).forEach(e => { e.textContent = tg == null ? 'unlimited' : tg; });
  const maxCol = paid.reduce((m, p) => Math.max(m, p.collaborators || 0), 0);
  const fc = $('[data-fam-count]', root);
  if (fc) { if (maxCol) fc.textContent = 'Paid plans include up to ' + maxCol + ' family members (the free trial is just you)'; else fc.remove(); }
  const valid = p => p.durationDays % 365 === 0 ? (p.durationDays / 365) + ' year' + (p.durationDays > 365 ? 's' : '') : p.durationDays + ' days';
  $('.lp-plans', root).innerHTML = (trial ? '<div class="lp-plan"><h3>' + esc(trial.name) + '</h3><div class="lp-pp">Free</div><div class="lp-pn">for ' + days + ' days</div><ul class="lp-ticks">' + (trial.features || []).map(f => '<li>' + esc(f) + '</li>').join('') + '</ul><button class="lp-btn ghost wide" data-lp-start>Start free</button></div>' : '') +
    paid.map(p => '<div class="lp-plan' + (p.badge ? ' hot' : '') + '">' + (p.badge ? '<span class="lp-badge">' + esc(p.badge) + '</span>' : '') + '<h3>' + esc(p.name) + '</h3><div class="lp-pp">' + inr(p.price) + '</div><div class="lp-pn">one-time · valid ' + valid(p) + (p.tagline ? ' · ' + esc(p.tagline) : '') + '</div><ul class="lp-ticks">' + (p.features || []).map(f => '<li>' + esc(f) + '</li>').join('') + '</ul><button class="lp-btn' + (p.badge ? '' : ' ghost') + ' wide" data-lp-start>Start free, upgrade later</button></div>').join('') ||
    '<div class="lp-empty">Plans will appear here.</div>';
  if (c.offerText) $('.lp-plans', root).insertAdjacentHTML('beforebegin', '<div class="lp-offer">🎉 ' + esc(c.offerText) + '</div>');
  $$('.lp-plans [data-lp-start]', root).forEach(b => b.onclick = () => signInScreen('', true));

  // testimonials: only real ones ticked "Show on page" in the admin
  const t = c.testimonials || [];
  if (t.length) {
    const sec = $('.lp-tst', root); sec.hidden = false;
    $('.lp-quotes', sec).innerHTML = t.slice(0, 6).map(q => '<figure class="lp-q"><blockquote>“' + esc(q.quote) + '”</blockquote><figcaption><b>' + esc(q.name) + '</b>' + (q.detail ? '<small>' + esc(q.detail) + '</small>' : '') + '</figcaption></figure>').join('');
  }

  // FAQ (uses the live trial and plan settings)
  const minPaid = paid.length ? Math.min.apply(null, paid.map(p => p.price)) : null;
  const faq = [
    ['Is the trial really free?', 'Yes. ' + days + ' days, every screen unlocked' + (tg != null ? ', up to ' + tg + ' guests' : '') + '. No card needed, just your email.'],
    ['What happens when the trial ends?', 'Your planner turns read-only. Nothing is deleted: you can still open it and export it to Excel. Upgrade' + (minPaid != null ? ' (from ' + inr(minPaid) + ', one-time)' : '') + ' to keep editing.'],
    ['Is it a subscription?', 'No. You pay once and the plan is valid for the time shown on it. Nothing renews automatically.'],
    ['Can my family use it on their phones?', maxCol ? 'Yes. On a paid plan you can invite up to ' + maxCol + ' family members by email. Each one signs in on their own phone, and you choose who can edit and who can only view.' : 'Yes. On a paid plan you can invite family members by email, with edit or view-only access.'],
    ['Do I need to install an app?', 'No. It runs in the browser on any phone or laptop. On your phone you can “Add to Home screen” to open it like an app.'],
    ['Who can see my wedding details?', 'Only you and the people you invite. Your planner is saved to your account and opens only after signing in with an invited email. If you ask us for help, our support team can view it (read-only) to sort things out.'],
    ['I already have the Pandora Excel planner. Can I use it?', 'Yes. When you start, choose “Import my Pandora Excel” and your guests, budget, vendors and the rest come across. You can export back to Excel any time.'],
    ['How do I pay?', 'Inside the planner, with Razorpay: UPI, cards, netbanking and wallets.'],
  ];
  if (c.whatsapp) faq.push(['Still have a question?', 'Message us on WhatsApp with the green button, and we’ll help.']);
  $('.lp-faq', root).innerHTML = faq.map((f, i) => '<details' + (i ? '' : ' open') + '><summary>' + esc(f[0]) + '</summary><p>' + esc(f[1]) + '</p></details>').join('');

  // WhatsApp
  const wa = $('.lp-wa', root);
  if (c.whatsapp) { wa.href = 'https://wa.me/' + c.whatsapp.number + (c.whatsapp.message ? '?text=' + encodeURIComponent(c.whatsapp.message) : ''); wa.hidden = false; wa.onclick = () => track('Contact'); }
}
