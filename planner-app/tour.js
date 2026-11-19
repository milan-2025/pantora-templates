/* ---------- quick start tour: shown once per person on each device, skippable, can be replayed ---------- */
// Each step points at the first of its selectors that is on screen (desktop sidebar, else the phone's top bar).
const TOUR_STEPS = [
  { t: 'Welcome to your wedding planner 👋', b: 'A one-minute tour of where everything is. Skip it if you like: you can replay it any time from Setup & Data.' },
  { sel: ['#attn'], t: 'Your dashboard', b: 'The countdown, your numbers and “Needs your attention”. It tells you what to do next: tap any item to go straight there.' },
  { nav: 'guests', t: 'Guests & RSVPs', b: 'Add guests, tap Y under each function to invite them, and send the invite on WhatsApp in one tap. Tap a guest’s name (›) to see everything about them: number, functions, stay and pickup.' },
  { nav: 'vendors', t: 'Vendors & payments', b: 'Log quotes, compare them and pick one. Tap a vendor to see the price, what you’ve paid, what’s left, their number and their jobs on the day.' },
  { nav: 'contacts', t: 'Contacts', b: 'One phone book with call and WhatsApp buttons for family, vendors, hotels and drivers. Star (☆) the people you’ll need on the wedding day.' },
  { sel: ['#srch', '#srch-m'], feat: 'search', t: 'Search, and undo', b: 'Find any guest, vendor or task in a second (Ctrl+K on a computer). Made a mistake? An ↶ Undo button appears right here after every change.' },
  { sel: ['#sync', '#sync-m'], t: 'Saved by itself', b: 'Everything saves automatically and shows up on your family’s phones within seconds. No signal at the venue? Keep going: changes sync when you’re back online.' },
  { nav: 'features', t: 'Keep it simple', b: 'Too many pages? Switch off the ones your wedding doesn’t need in Features. Wedding-day mode and guest check-in live there too, for the big day.' },
  { nav: 'setup', t: 'Start here', b: 'Add your names, wedding date and city in Setup & Data. Task deadlines and the countdown follow your date.', done: 'Go to Setup' }
];
const tourKey = () => 'pp_tour_' + (CLOUD.on ? (CLOUD.email || CLOUD.id || 'cloud') : 'local');
function maybeTour() {
  if (store.get(tourKey()) || (CLOUD.meta && CLOUD.meta.role === 'support') || document.body.classList.contains('gated') || $('.mask')) return;
  setTimeout(() => { if (!$('.tour') && !document.body.classList.contains('gated')) startTour(); }, 700);
}
function startTour() {
  const steps = TOUR_STEPS.filter(s => (!s.nav || routeOn(s.nav)) && (!s.feat || on(s.feat)));
  closeProfile(); $$('.mask').forEach(m => m.remove());
  if (route !== 'dash') go('dash');
  const root = el('<div class="tour" role="dialog" aria-live="polite"><div class="tour-hole"></div><div class="tour-card"><div class="tour-n"></div><h3></h3><p></p><div class="tour-b"><button class="btn ghost sm" data-skip>Skip tour</button><span class="sp"></span><button class="btn sm" data-back>Back</button><button class="btn pri sm" data-next>Next</button></div></div></div>');
  document.body.appendChild(root);
  const hole = $('.tour-hole', root), card = $('.tour-card', root);
  let i = 0;
  const visible = e => { if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const target = s => {
    if (s.nav) { // on phones the menu slides in so the page's link can be shown
      if (MOBILE()) $('.side').classList.add('open');
      const a = $('#nav a[data-r="' + s.nav + '"]'); if (a) a.scrollIntoView({ block: 'nearest' }); return a;
    }
    return (s.sel || []).map(q => $(q)).find(visible) || null;
  };
  const place = () => {
    const s = steps[i], t = s.nav || s.sel ? target(s) : null;
    if (!s.nav && MOBILE()) $('.side').classList.remove('open');
    root.classList.toggle('center', !t);
    if (t) {
      if (!s.nav) t.scrollIntoView({ block: 'nearest' });
      const r = t.getBoundingClientRect(), pad = 6;
      Object.assign(hole.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px', display: 'block' });
      if (!MOBILE()) {
        const cw = Math.min(340, innerWidth - 24), ch = card.offsetHeight || 200;
        let left = r.right + 16, top = r.top;
        if (left + cw > innerWidth - 12) { left = Math.max(12, Math.min(r.left, innerWidth - cw - 12)); top = r.bottom + 14; }
        if (top + ch > innerHeight - 12) top = Math.max(12, r.top - ch - 14);
        Object.assign(card.style, { left: left + 'px', top: Math.max(12, top) + 'px', bottom: '' });
      } else Object.assign(card.style, { left: '', top: '', bottom: '' });
    } else { hole.style.display = 'none'; Object.assign(card.style, { left: '', top: '', bottom: '' }); }
  };
  const show = () => {
    const s = steps[i];
    $('.tour-n', card).textContent = i ? 'Step ' + i + ' of ' + (steps.length - 1) : 'Quick start';
    $('h3', card).textContent = s.t; $('p', card).textContent = s.b;
    $('[data-back]', card).hidden = i === 0;
    $('[data-next]', card).textContent = i === 0 ? 'Show me around' : i === steps.length - 1 ? (s.done || 'Finish') : 'Next';
    place(); setTimeout(place, 220); // after the phone menu has slid in
    $('[data-next]', card).focus();
  };
  const end = goSetup => {
    store.set(tourKey(), '1'); root.remove(); removeEventListener('resize', place); removeEventListener('keydown', key, true);
    if (MOBILE()) $('.side').classList.remove('open');
    if (goSetup) go('setup'); else toast('You can replay the tour from Setup & Data.');
  };
  const key = e => { if (e.key === 'Escape') { e.preventDefault(); end(); } else if (e.key === 'ArrowRight') $('[data-next]', card).click(); else if (e.key === 'ArrowLeft' && i) $('[data-back]', card).click(); };
  root.addEventListener('click', e => {
    if (e.target.closest('[data-skip]')) end();
    else if (e.target.closest('[data-back]')) { i = Math.max(0, i - 1); show(); }
    else if (e.target.closest('[data-next]')) { if (i === steps.length - 1) end(steps[i].done ? true : false); else { i++; show(); } }
  });
  addEventListener('resize', place); addEventListener('keydown', key, true);
  show();
}
document.addEventListener('click', e => { if (e.target.closest('[data-tour]')) startTour(); });
