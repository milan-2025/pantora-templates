/* ---------- landing page: what visitors (and ad clicks) see at /planner before signing in ---------- */
// Settings come from Admin → Wedding planner → Planner landing page (via /api/planner/landing); prices from Planner plans.
// Every "start" button links to /planner/signup; "Sign in" links to /planner/login.

let LP_CFG = null;
const lpConfig = () => (LP_CFG = LP_CFG || api('/landing').catch(() => ({ plans: [], testimonials: [] })));

/* Headline versions for ads: /planner?v=budget shows the budget headline, so the page matches the ad that was tapped.
   Unknown or missing ?v= shows the main one. The version is sent with ViewContent (ad_variant) and saved with the source. */
const LP_HERO = {
  main: { h: 'Your whole wedding, planned <em>in one place.</em>', p: 'Guests, functions, budget, vendors, payments and shagun, from Roka to Vidaai. One planner the whole family can open, live on every phone.' },
  family: { h: 'Plan the wedding together, <em>the whole family on one plan.</em>', p: 'Mummy, Papa, Didi and your planner see the same guest list, budget and to-dos, live on every phone. No more forwarded Excel files.' },
  budget: { h: 'Know where every rupee goes, <em>from Roka to Vidaai.</em>', p: 'Set the budget once. Every advance, balance and vendor payment is tracked, with reminders before each one is due.' },
  guests: { h: 'Every guest, RSVP and room, <em>in one list.</em>', p: 'Families and groups, RSVPs per function, rooms, pickups and dietary notes. Know exactly who is coming and where they stay.' },
  invite: { h: 'Plan the wedding and send the invite, <em>from one app.</em>', p: 'A digital invite your guests open on WhatsApp. Their RSVPs land straight in your guest list, function by function.' },
};
const lpVariant = () => { try { const v = new URLSearchParams(location.search).get('v'); return LP_HERO[v] ? v : 'main'; } catch (e) { return 'main'; } };

/* Where the visitor came from (first touch, kept 30 days) — saved on their planner so you can see which ads bring trials. */
(function rememberSource() {
  try {
    const q = new URLSearchParams(location.search);
    const parts = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].map(k => q.get(k)).filter(Boolean);
    if (parts.length && LP_HERO[q.get('v')]) parts.push('v=' + q.get('v'));
    if (!parts.length && q.get('fbclid')) parts.push('facebook (fbclid)');
    if (!parts.length && q.get('gclid')) parts.push('google (gclid)');
    const old = JSON.parse(store.get('pp_src') || 'null');
    if (parts.length && !(old && Date.now() - old.t < 30 * 864e5)) store.set('pp_src', JSON.stringify({ s: parts.join(' / ').slice(0, 200), t: Date.now() }));
  } catch (e) { /* ignore */ }
})();
function lpSource() { try { const o = JSON.parse(store.get('pp_src') || 'null'); return o && Date.now() - o.t < 30 * 864e5 ? o.s : ''; } catch (e) { return ''; } }

/* Meta Pixel: /pt-track.js (loaded by the page) uses the Pixel ID from Site settings and labels every event
   "Online Wedding Planner". It sends PageView, InitiateCheckout and Purchase (Razorpay) and WhatsApp Contact by itself;
   this adds ViewContent (landing page), Lead (sign-in code requested), StartTrial (planner created). */
function track(ev, params) {
  try { if (ev === 'PageView') return; (window.ptq = window.ptq || []).push([ev, params || {}]); } catch (e) { /* tracking must never break the app */ }
}

/* ---------- page ---------- */
function hideLanding() {
  document.body.classList.remove('lp-on'); document.documentElement.classList.remove('boot-out');
  const l = $('#lp'); if (l) l.innerHTML = '';
  if (SIGN_PAGE()) { try { history.replaceState(null, '', '/planner' + location.hash); } catch (e) { /* ignore */ } }
}

const SIGNUP = '/planner/signup';
const lpCta = (label, cls, extra) => '<a class="lp-btn ' + (cls || '') + '" href="' + SIGNUP + '" data-cta="' + esc(extra || label) + '">' + label + '</a>';
// A full-width "start now" band used between sections.
const lpBand = (title, sub, label) => '<div class="lp-band"><div><b>' + title + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</div>' + lpCta(label || 'Start free trial', '', title) + '</div>';

function lpPhone(src, alt, eager) {
  return '<div class="lp-phone"><img src="/planner/lp/' + src + '.webp" alt="' + esc(alt) + '" width="300" height="649" ' + (eager ? 'fetchpriority="high"' : 'loading="lazy"') + ' decoding="async"></div>';
}

const LP_FEATURES = [
  ['guests', 'Guests & RSVP', 'Every family and every function, in one list.', ['Families grouped by bride’s side and groom’s side', 'RSVP per function: who’s coming to Haldi, who’s only at the Reception', 'Send your invite on WhatsApp in one tap, with each family’s own invite link, and see who still hasn’t got it', 'Ready WhatsApp messages for invites, reminders and thank-yous', 'Duplicate and wrong phone numbers found and fixed for you']],
  ['functions', 'Every function', 'From Roka to Vidaai, all set up.', ['Roka, Haldi, Mehndi, Sangeet, Baraat & Milni, Pheras, Reception…', 'Rename, switch off, or add your own functions', 'Date, time and countdown for each', 'Day-of run sheet: who does what, when']],
  ['budget', 'Budget', 'Planned, committed and paid, side by side.', ['Your total budget split into categories, ready to adjust', 'Planned vs committed vs paid, for every line', 'Warns you before a category goes over']],
  ['vendors', 'Vendors & quotes', 'Three caterers, three quotes? Compare them side by side.', ['Log every quote with contact, rating and notes', 'Compare quotes for the same job and pick one', 'The chosen vendor flows straight into your budget']],
  ['payments', 'Payments', 'Who got an advance, and when the rest is due.', ['Every advance and instalment with its due date', 'Overdue and due-soon alerts on the dashboard', 'Paid amounts update the budget automatically']],
  ['stay', 'Stay, travel & food', 'Rooms, cars and plates, all counted.', ['Allocate families to hotel rooms; see who still needs one', 'Cars and pickups, with who travels in which', 'Plates to order per function, worked out from your guest list']],
  ['shagun', 'Shagun & len-den', 'Who gave what, remembered for you.', ['Shagun and gifts received and given, per function', 'Thank-yous still to send', 'Returns pending, so nothing gets missed']],
  ['tasks', 'Tasks & timeline', '90+ tasks, already in order.', ['A ready checklist with deadlines worked out from your wedding date', 'Only a few weeks left? Express and emergency timelines squeeze it to fit', 'Assign tasks to family members and track what’s overdue']],
];

function landingScreen() {
  document.body.classList.add('lp-on');
  const root = $('#lp');
  const brand = $('.brand').innerHTML;
  const F = LP_FEATURES;
  root.innerHTML =
    '<div class="lp-offerbar" hidden></div>' +
    '<header class="lp-nav"><div class="lp-w"><a class="lp-logo" href="/planner" aria-label="Pandora Wedding Planner">' + brand + '</a><span class="sp"></span><nav class="lp-links"><a href="#lp-features">Features</a><a href="#lp-pricing">Pricing</a><a href="#lp-faq">FAQ</a></nav><a class="lp-link" href="/planner/login">Sign in</a>' + lpCta('Start free', 'sm', 'nav') + '</div></header>' +

    // HERO
    '<section class="lp-hero"><div class="lp-toran" aria-hidden="true"></div><div class="lp-w lp-hero-in"><div class="lp-hero-txt">' +
      '<p class="lp-eyebrow">Online Indian Wedding Planner</p>' +
      '<h1>' + LP_HERO[lpVariant()].h + '</h1>' +
      '<p class="lp-lead">' + LP_HERO[lpVariant()].p + '</p>' +
      '<div class="lp-ctas">' + lpCta('Start your <span data-trial-days>14</span>-day free trial →', 'big', 'hero') + '<button class="lp-btn ghost big" data-lp-demo>See a sample wedding</button></div>' +
      '<p class="lp-micro">✓ No card needed &nbsp; ✓ Ready in 2 minutes &nbsp; ✓ Up to <span data-trial-guests>30</span> guests free</p>' +
    '</div><div class="lp-hero-vis">' + lpPhone('dash', 'Wedding dashboard: days to go, guests, budget and payments', true) +
      '<div class="lp-float f1"><b>11</b> confirmed for Sangeet</div><div class="lp-float f2"><b>₹5.79 L</b> paid · ₹10.9 L to go</div><div class="lp-float f3">🔔 2 payments due this week</div>' +
    '</div></div>' +
    '<div class="lp-w"><div class="lp-stats"><div><b>90+</b><span>tasks with deadlines, ready</span></div><div><b>10</b><span>functions set up, Roka to Vidaai</span></div><div><b>18</b><span>planning screens in one place</span></div><div><b>1</b><span>planner for the whole family</span></div></div></div></section>' +

    // BEFORE / AFTER
    '<section class="lp-sec lp-vs"><div class="lp-w"><p class="lp-eyebrow c">Sound familiar?</p><h2 class="c">Wedding planning, <em>before and after.</em></h2><div class="lp-vsgrid">' +
      '<div class="lp-vscol bad"><h3>Without Pandora</h3><ul>' +
        '<li><b>5 WhatsApp groups, 3 Excel sheets, 1 diary.</b> The latest guest list is… somewhere.</li>' +
        '<li><b>“Beta, kitne guests final hue?”</b> Asked every evening, answered from memory.</li>' +
        '<li><b>“Caterer ko advance kitna diya tha?”</b> Receipts in one place, promises in another.</li>' +
        '<li><b>Rooms and cars on paper.</b> Someone’s Mausi still has no room on the wedding night.</li>' +
      '</ul></div>' +
      '<div class="lp-vscol good"><h3>With Pandora</h3><ul class="lp-ticks">' +
        '<li><b>One guest list</b> with RSVP for every function, always up to date</li>' +
        '<li><b>Live counts</b> everyone in the family can check on their phone</li>' +
        '<li><b>Every payment</b> with its due date, and alerts before it’s due</li>' +
        '<li><b>Rooms and cars allocated</b>, with a list of who still needs one</li>' +
      '</ul></div>' +
    '</div>' + lpBand('Swap the chaos for one planner.', '<span data-trial-days>14</span> days free, no card needed.', 'Try it free') + '</div></section>' +

    // READY IN MINUTES
    '<section class="lp-sec lp-ready"><div class="lp-w"><p class="lp-eyebrow c">Not a blank sheet</p><h2 class="c">Open it and half the thinking is <em>already done.</em></h2><p class="c lp-sub">Start a fresh plan and this is waiting for you, made for Indian weddings.</p><div class="lp-g4">' +
      '<div class="lp-rcard"><span>✅</span><b>90+ tasks</b><p>From booking the venue to the vidaai car, with deadlines worked out from your date.</p></div>' +
      '<div class="lp-rcard"><span>🎊</span><b>10 functions</b><p>Roka to Vidaai already listed. Rename, switch off or add your own.</p></div>' +
      '<div class="lp-rcard"><span>💰</span><b>Budget split</b><p>Type your total and it’s spread across venue, catering, decor, outfits and more.</p></div>' +
      '<div class="lp-rcard"><span>🪔</span><b>Rituals & invite</b><p>A puja and ritual checklist, plus a WhatsApp invite message ready to send.</p></div>' +
    '</div></div></section>' +

    // FEATURES (tabs)
    '<section class="lp-sec lp-featsec" id="lp-features"><div class="lp-w"><p class="lp-eyebrow c">Everything inside</p><h2 class="c">Built for Indian weddings, <em>not adapted to them.</em></h2>' +
      '<div class="lp-tabs" role="tablist">' + F.map((f, i) => '<button role="tab" data-ft="' + i + '"' + (i ? '' : ' aria-selected="true"') + '>' + esc(f[1]) + '</button>').join('') + '</div>' +
      '<div class="lp-feat"><div class="lp-feat-vis">' + lpPhone(F[0][0], F[0][1]) + '</div><div class="lp-feat-txt" aria-live="polite"></div></div>' +
      '<div class="lp-also"><b>Also inside:</b> milni list · shopping & outfits · printable family handout · import & export to Excel · activity log & restore · search everything (Ctrl+K) & undo · switch off the pages you don’t need</div>' +
    '</div></section>' +

    // WEDDING INVITE (connected to the invite maker)
    '<section class="lp-sec lp-inv"><div class="lp-w lp-split"><div><p class="lp-eyebrow">New · Digital wedding invite</p><h2>Send the invite, <em>and the RSVPs come back by themselves.</em></h2>' +
      '<p>Make a beautiful digital invite from your planner in one tap. Names, date, functions and venues are already filled in from your plan.</p><ul class="lp-ticks">' +
      '<li>Every family gets <b>its own invite link</b>, showing only the functions they’re invited to</li>' +
      '<li>Send it from the Guest List on WhatsApp. The planner remembers who got it</li>' +
      '<li>Replies land in your Guest List <b>by themselves</b>: who’s coming to which function, how many, veg or non-veg</li>' +
      '<li>Blessings from guests are saved, with a thank-you message ready to send</li>' +
      '<li>Change a function’s date or venue in the planner, and the invite updates too</li></ul>' +
      '<div class="lp-bundle" data-lp-bundle hidden></div>' +
      '<div class="lp-ctas">' + lpCta('Plan & invite, free', '', 'invite') + '<a class="lp-link" href="/shaadi" target="_blank" rel="noopener">See invite designs →</a></div></div>' +
      '<div class="lp-invmock" aria-hidden="true"><div class="lp-invcard"><small>Together with their families</small><b>Aanya &amp; Rohan</b><span>request the pleasure of your company</span><div class="lp-invfn"><i>Mehendi · 12 Feb</i><i>Wedding · 14 Feb</i></div><em>Dear Sharma family 🙏</em></div>' +
        '<div class="lp-famcard lp-invfeed"><div class="lp-act"><i style="background:#1F7A74">✓</i><div><b>Sharma family</b> replied: 4 coming<small>Mehendi, Wedding · veg · just now</small></div></div><div class="lp-act"><i style="background:#F2A93B">🙏</i><div><b>Verma ji</b> left a blessing<small>“Bahut bahut badhai!” · 5 min ago</small></div></div><div class="lp-act"><i style="background:#552C69">💌</i><div><b>12 families</b> got their invite<small>Sent from the Guest List · today</small></div></div></div></div>' +
    '</div></section>' +

    // SHAADI KE DIN BHI / everyday tools
    '<section class="lp-sec lp-tools"><div class="lp-w"><p class="lp-eyebrow c">Made for the busy days</p><h2 class="c">No signal at the venue? <em>Your planner still works.</em></h2><p class="c lp-sub">Venues and village weddings often have no signal. Your planner still opens, and syncs when the internet is back.</p><div class="lp-g3">' +
      '<div class="lp-rcard"><span>📶</span><b>Works without internet</b><p>Install it on your home screen like an app. It opens and works offline, and your changes sync later.</p></div>' +
      '<div class="lp-rcard"><span>🎉</span><b>Wedding-day mode</b><p>Today’s functions, timings and who’s doing what, in big clear text. Tick off arrivals as guests reach.</p></div>' +
      '<div class="lp-rcard"><span>📇</span><b>Contacts phone book</b><p>Every guest, vendor and helper with a number, in one place. Call or WhatsApp in one tap.</p></div>' +
      '<div class="lp-rcard"><span>💬</span><b>Ready WhatsApp messages</b><p>Invites, reminders, payment follow-ups and thank-yous, filled in with each person’s name. Edit them to suit you.</p></div>' +
      '<div class="lp-rcard"><span>🔗</span><b>Share the run sheet</b><p>Send vendors and helpers a view-only link to the day’s schedule. No sign-in needed for them.</p></div>' +
      '<div class="lp-rcard"><span>🔍</span><b>Find anything, undo anything</b><p>Search every guest, vendor and payment in a second. Made a mistake? Undo it, or restore an earlier version.</p></div>' +
    '</div><div class="lp-ctas c">' + lpCta('Start free trial →', 'big', 'tools') + '</div></div></section>' +

    // WHO IT'S FOR
    '<section class="lp-sec lp-who"><div class="lp-w"><h2 class="c">Made for <em>everyone</em> planning the shaadi</h2><div class="lp-g3">' +
      '<div class="lp-wcard"><span>💑</span><b>For the couple</b><p>Plan around work from your phone. See what’s done, what’s due and what’s over budget at a glance.</p></div>' +
      '<div class="lp-wcard"><span>👨‍👩‍👧</span><b>For Mummy-Papa</b><p>Big clear numbers: guests confirmed, money paid, rooms booked. No more asking around every evening.</p></div>' +
      '<div class="lp-wcard"><span>📋</span><b>For your planner or coordinator</b><p>Run sheet, vendor list and payments in one place, shared with the family who’s paying.</p></div>' +
    '</div></div></section>' +

    // FAMILY
    '<section class="lp-sec lp-fam"><div class="lp-w lp-split"><div><p class="lp-eyebrow">Plan together</p><h2>Mummy, Papa, Didi… <em>everyone on one plan.</em></h2>' +
      '<p>Invite your family with their email. Each person signs in on their own phone and sees the same planner, live.</p><ul class="lp-ticks">' +
      '<li><b>Can edit</b> or <b>view only</b>: you decide for each person</li><li>Changes show on everyone’s phone within seconds</li><li>Activity log shows who changed what, and you can restore an earlier version</li><li data-fam-count></li></ul>' +
      '<div class="lp-ctas">' + lpCta('Start planning together', '', 'family') + '</div></div>' +
      '<div class="lp-famcard" aria-hidden="true"><div class="lp-act"><i style="background:#F2A93B">M</i><div><b>Mummy</b> marked 4 guests as confirmed<small>Sangeet · just now</small></div></div><div class="lp-act"><i style="background:#1F7A74">P</i><div><b>Papa</b> added a payment of ₹50,000<small>Caterer advance · 3 min ago</small></div></div><div class="lp-act"><i style="background:#E0675A">D</i><div><b>Didi</b> finished “Book mehndi artist”<small>Tasks · 10 min ago</small></div></div><div class="lp-act"><i style="background:#552C69">A</i><div><b>You</b> invited Chacha ji as view only<small>Sharing · 1 hr ago</small></div></div></div>' +
    '</div></section>' +

    // HOW IT WORKS
    '<section class="lp-sec"><div class="lp-w"><h2 class="c">Start in <em>two minutes</em></h2><div class="lp-g3 lp-steps">' +
      '<div><span>1</span><b>Sign up with your email</b><p>We send a 6-digit code. No password to remember.</p></div>' +
      '<div><span>2</span><b>Pick how to start</b><p>A fresh plan with tasks and budget ready, the sample wedding to edit, or your Pandora Excel planner.</p></div>' +
      '<div><span>3</span><b>Invite the family</b><p>Share it and plan together on phone and laptop.</p></div>' +
    '</div><div class="lp-ctas c">' + lpCta('Start free trial →', 'big', 'steps') + '</div></div></section>' +

    // DEVICES + EXCEL
    '<section class="lp-sec lp-dev"><div class="lp-w"><h2 class="c">Plan on the laptop, <em>check on the phone.</em></h2><p class="c lp-sub">The same planner on every screen. Phones get a simple card view, with no sideways scrolling, and it works offline once installed.</p>' +
      '<div class="lp-browser"><div class="lp-bbar"><i></i><i></i><i></i><span>pandoratemplates.com/planner</span></div><img src="/planner/lp/desktop.webp" alt="The planner dashboard on a laptop" width="1280" height="800" loading="lazy" decoding="async"></div>' +
      '<div class="lp-excel"><span>📊</span><div><b>Already using the Pandora Excel planner?</b><p>Import your filled-in workbook in one click and carry on online. You can export back to Excel any time.</p></div></div>' +
    '</div></section>' +

    // PRICING
    '<section class="lp-sec lp-price" id="lp-pricing"><div class="lp-w"><p class="lp-eyebrow c">Simple pricing</p><h2 class="c">Try it free. <em>Pay once</em> if you love it.</h2><p class="c lp-sub">One payment covers the whole wedding: a tiny slice of the wedding budget. No subscription, no auto-renewal.</p><div class="lp-plans"><div class="lp-empty">Loading plans…</div></div><p class="c lp-paynote">🔒 Secure payment by Razorpay: UPI, cards, netbanking. Upgrade any time from inside the planner.</p></div></section>' +

    // TESTIMONIALS (filled only when some are ticked in the admin)
    '<section class="lp-sec lp-tst" hidden><div class="lp-w"><h2 class="c">Families planning with Pandora</h2><div class="lp-g3 lp-quotes"></div></div></section>' +

    // FAQ
    '<section class="lp-sec" id="lp-faq"><div class="lp-w lp-narrow"><h2 class="c">Questions</h2><div class="lp-faq"></div>' + lpBand('Still deciding?', 'Try it free for <span data-trial-days>14</span> days. Nothing to pay, nothing to install.', 'Start free trial') + '</div></section>' +

    // FINAL CTA
    '<section class="lp-final"><div class="lp-w lp-narrow c"><h2>When is the shaadi?</h2><p>Pick the date and see how much time you have.</p>' +
      '<div class="lp-date"><input type="date" class="inp" data-lp-date aria-label="Wedding date"><div class="lp-left" data-lp-left></div></div>' +
      lpCta('Start planning free →', 'big', 'final') + '<p class="lp-micro">No card needed · <span data-trial-days>14</span> days free · Your date carries into your planner</p></div></section>' +

    '<footer class="lp-foot"><div class="lp-w">© ' + new Date().getFullYear() + ' Pandora Templates · <a href="/">pandoratemplates.com</a> · <a href="/planner/login">Sign in</a> · Open the box. Everything’s ready.' +
    '<div class="lp-more">More for your wedding: <a href="/shaadi">Wedding invite maker</a> · <a href="/wedding_planner_sheet">Wedding planner spreadsheet</a> · <a href="/stays">Stays for your guests</a> · <a href="/contact">Contact</a></div></div></footer>' +
    '<div class="lp-sticky">' + lpCta('Start free trial', '', 'sticky') + '</div>' +
    '<a class="lp-wa" hidden target="_blank" rel="noopener" aria-label="Chat with us on WhatsApp"><svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><path fill="#fff" d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm0 23.7a10.7 10.7 0 0 1-5.5-1.5l-.4-.2-3.9 1 1-3.8-.2-.4A10.7 10.7 0 1 1 16 26.7zm5.9-8c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a8.8 8.8 0 0 1-4.4-3.8c-.3-.6.3-.5.9-1.7.1-.2 0-.4 0-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.9.4 3.6 3.6 0 0 0-1.1 2.7 6.3 6.3 0 0 0 1.3 3.3 14.3 14.3 0 0 0 5.5 4.9c2 .9 2.8.9 3.8.8a3.2 3.2 0 0 0 2.1-1.5 2.6 2.6 0 0 0 .2-1.5c-.1-.2-.3-.3-.5-.4z"/></svg></a>';

  $$('[data-lp-demo]', root).forEach(b => b.onclick = () => startLocal());
  // Smooth scroll for the in-page links in the header.
  $$('.lp-links a', root).forEach(a => a.onclick = e => { const t = $(a.getAttribute('href'), root); if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); } });

  // feature tabs (auto-advance every 6 s until the visitor taps one)
  let auto = null, cur = 0;
  const showFeat = i => {
    cur = i; const f = F[i];
    $$('[data-ft]', root).forEach(b => b.setAttribute('aria-selected', String(+b.dataset.ft === i)));
    const img = $('.lp-feat-vis img', root); img.src = '/planner/lp/' + f[0] + '.webp'; img.alt = f[1];
    $('.lp-feat-txt', root).innerHTML = '<h3>' + esc(f[1]) + '</h3><p class="lp-hing">' + esc(f[2]) + '</p><ul class="lp-ticks">' + f[3].map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
      '<div class="lp-ctas">' + lpCta('Try ' + esc(f[1]) + ' free', '', 'feature ' + f[0]) + (i < F.length - 1 ? '<button class="lp-link" data-ft-next>Next: ' + esc(F[i + 1][1]) + ' →</button>' : '') + '</div>';
    const n = $('[data-ft-next]', root); if (n) n.onclick = () => { stopAuto(); showFeat(i + 1); };
  };
  const stopAuto = () => { clearInterval(auto); auto = null; };
  $$('[data-ft]', root).forEach(b => b.onclick = () => { stopAuto(); showFeat(+b.dataset.ft); });
  showFeat(0);
  const featSec = $('#lp-features', root);
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let started = false;
    new IntersectionObserver(es => { if (es[0].isIntersecting && !started) { started = true; auto = setInterval(() => { if (!document.body.classList.contains('lp-on')) return stopAuto(); showFeat((cur + 1) % F.length); }, 6000); } }, { threshold: 0.4 }).observe(featSec);
    featSec.addEventListener('pointerdown', stopAuto, { once: true });
  }
  F.forEach(f => { const im = new Image(); im.src = '/planner/lp/' + f[0] + '.webp'; }); // warm the cache so tabs switch instantly

  // countdown (the date is carried into the new planner)
  const di = $('[data-lp-date]', root), left = $('[data-lp-left]', root);
  const showLeft = () => {
    const v = di.value; if (!v) { left.textContent = ''; return; }
    const days = Math.ceil((new Date(v + 'T00:00:00') - new Date(new Date().toDateString())) / 864e5);
    left.innerHTML = days < 0 ? 'That date has passed. Pick the wedding date.' : days === 0 ? '<b>It’s today!</b> Shubh vivah 🎉' : '<b>' + days + ' days to go</b> · ' + (days < 60 ? 'tight, but the express timeline was made for this.' : days < 180 ? 'perfect time to get organised.' : 'plenty of time, if you start early.');
    try { store.set('pp_lp_date', v); } catch (e) { /* ignore */ }
  };
  di.min = new Date().toISOString().slice(0, 10); di.value = store.get('pp_lp_date') || ''; di.oninput = showLeft; showLeft();

  // sticky CTA once the hero button scrolls away
  const sticky = $('.lp-sticky', root), hero = $('.lp-hero .lp-ctas', root), fin = $('.lp-final', root);
  if ('IntersectionObserver' in window) {
    let heroGone = false, finIn = false; const upd = () => sticky.classList.toggle('on', heroGone && !finIn);
    new IntersectionObserver(es => { heroGone = !es[0].isIntersecting && es[0].boundingClientRect.top < 0; upd(); }).observe(hero);
    new IntersectionObserver(es => { finIn = es[0].isIntersecting; upd(); }).observe(fin);
  }

  lpConfig().then(c => lpFill(root, c));
  track('ViewContent', { ad_variant: lpVariant() });
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
  $('.lp-plans', root).innerHTML = (trial ? '<div class="lp-plan"><h3>' + esc(trial.name) + '</h3><div class="lp-pp">Free</div><div class="lp-pn">for ' + days + ' days · no card</div><ul class="lp-ticks">' + (trial.features || []).map(f => '<li>' + esc(f) + '</li>').join('') + '</ul>' + lpCta('Start free', 'ghost wide', 'plan trial') + '</div>' : '') +
    paid.map(p => '<div class="lp-plan' + (p.badge ? ' hot' : '') + '">' + (p.badge ? '<span class="lp-badge">' + esc(p.badge) + '</span>' : '') + '<h3>' + esc(p.name) + '</h3><div class="lp-pp">' + inr(p.price) + '</div><div class="lp-pn">one-time · valid ' + valid(p) + (p.tagline ? ' · ' + esc(p.tagline) : '') + '</div><ul class="lp-ticks">' + (p.features || []).map(f => '<li>' + esc(f) + '</li>').join('') + '</ul>' + lpCta('Start free, upgrade later', (p.badge ? '' : 'ghost ') + 'wide', 'plan ' + p.planId) + '</div>').join('') ||
    '<div class="lp-empty">Plans will appear here.</div>';
  // Planner + Invite bundle (price from the admin)
  const bundle = c.bundle && c.bundle.on ? c.bundle : null;
  const fam = paid.find(p => p.planId === 'family');
  const bb = $('[data-lp-bundle]', root);
  if (bundle && bb) {
    const save = fam && c.bundle.invitePremium ? fam.price + c.bundle.invitePremium - bundle.price : 0;
    bb.innerHTML = '💍 <b>Planner + Invite bundle: ' + inr(bundle.price) + '</b> one-time' + (save > 0 ? ' · save ' + inr(save) : '') + '. Family plan and the invite on Premium, together.';
    bb.hidden = false;
  }
  if (bundle) $('.lp-plans', root).insertAdjacentHTML('beforeend', '<div class="lp-plan hot"><span class="lp-badge">Best value</span><h3>Planner + Invite</h3><div class="lp-pp">' + inr(bundle.price) + '</div><div class="lp-pn">one-time' + (fam ? ' · ' + esc(fam.name) + ' plan' : '') + ' + digital invite Premium</div><ul class="lp-ticks"><li>Everything in ' + esc(fam ? fam.name : 'Family') + '</li><li>Digital wedding invite on Premium</li><li>Each family’s own invite link</li><li>RSVPs and blessings land in your Guest List</li></ul>' + lpCta('Start free, upgrade later', 'wide', 'plan bundle') + '</div>');
  if (c.offerText) {
    $('.lp-plans', root).insertAdjacentHTML('beforebegin', '<div class="lp-offer">🎉 ' + esc(c.offerText) + '</div>');
    const bar = $('.lp-offerbar', root); bar.innerHTML = '🎉 ' + esc(c.offerText) + ' · <a href="#lp-pricing">See plans</a>'; bar.hidden = false;
    $('a', bar).onclick = e => { e.preventDefault(); $('#lp-pricing', root).scrollIntoView({ behavior: 'smooth' }); };
  }

  // testimonials: only real ones ticked "Show on page" in the admin
  const t = c.testimonials || [];
  if (t.length) {
    const sec = $('.lp-tst', root); sec.hidden = false;
    $('.lp-quotes', sec).innerHTML = t.slice(0, 6).map(q => '<figure class="lp-q"><div class="lp-stars" aria-hidden="true">★★★★★</div><blockquote>“' + esc(q.quote) + '”</blockquote><figcaption><b>' + esc(q.name) + '</b>' + (q.detail ? '<small>' + esc(q.detail) + '</small>' : '') + '</figcaption></figure>').join('');
  }

  // FAQ (uses the live trial and plan settings)
  const minPaid = paid.length ? Math.min.apply(null, paid.map(p => p.price)) : null;
  const faq = [
    ['Is the trial really free?', 'Yes. ' + days + ' days, every screen unlocked' + (tg != null ? ', up to ' + tg + ' guests' : '') + '. No card needed, just your email.'],
    ['What happens when the trial ends?', 'Your planner turns read-only. Nothing is deleted: you can still open it and export it to Excel. Upgrade' + (minPaid != null ? ' (from ' + inr(minPaid) + ', one-time)' : '') + ' to keep editing.'],
    ['Is it a subscription?', 'No. You pay once and the plan is valid for the time shown on it. Nothing renews automatically.'],
    ['Can my family use it on their phones?', maxCol ? 'Yes. On a paid plan you can invite up to ' + maxCol + ' family members by email. Each one signs in on their own phone, and you choose who can edit and who can only view.' : 'Yes. On a paid plan you can invite family members by email, with edit or view-only access.'],
    ['Do I need to install an app?', 'No. It runs in the browser on any phone or laptop. On your phone, tap “Add to Home screen” (or “Install app”) and it opens like an app, even without internet.'],
    ['Does it work without internet?', 'Yes. Open it once with internet on your phone and it keeps a copy. After that it opens and works offline, even at a venue with no signal, and your changes sync when you’re back online.'],
    ['Can I send digital invites from it?', 'Yes. Make a wedding invite from the planner in one tap, with your names, date and functions already filled in. Each family gets its own link, and their RSVPs fill in your Guest List automatically.' + (c.bundle && c.bundle.on ? ' The Planner + Invite bundle is ' + inr(c.bundle.price) + ', one-time.' : '')],
    ['Who can see my wedding details?', 'Only you and the people you invite. Your planner is saved to your account and opens only after signing in with an invited email. If you ask us for help, our support team can view it (read-only) to sort things out.'],
    ['I already have the Pandora Excel planner. Can I use it?', 'Yes. When you start, choose “Import my Pandora Excel” and your guests, budget, vendors and the rest come across. You can export back to Excel any time.'],
    ['How do I pay?', 'Inside the planner, with Razorpay: UPI, cards, netbanking and wallets. If you have a promo code, enter it there.'],
  ];
  if (c.whatsapp) faq.push(['Still have a question?', 'Message us on WhatsApp with the green button, and we’ll help.']);
  $('.lp-faq', root).innerHTML = faq.map((f, i) => '<details' + (i ? '' : ' open') + '><summary>' + esc(f[0]) + '</summary><p>' + esc(f[1]) + '</p></details>').join('');

  // WhatsApp
  const wa = $('.lp-wa', root);
  if (c.whatsapp) { wa.href = 'https://wa.me/' + c.whatsapp.number + (c.whatsapp.message ? '?text=' + encodeURIComponent(c.whatsapp.message) : ''); wa.hidden = false; }
}
