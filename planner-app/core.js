/* ---------- Pandora Indian Wedding Planner (web app) ---------- */
const SEED = /*SEED*/null;
const KEY = 'pandora_wedding_planner_v1';
const COLLS = ['functions','guests','hotels','vehicles','roomAlloc','transAlloc','budgetCats','budgetLines','vendors','payments','tasks','rituals','runsheet','shagun','milni','shopping','people'];
const MEM = {}; // fallback when storage is blocked
let S = null, D = null, saveT = null;

/* ---------- small helpers ---------- */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const uid = (() => { let n = 0; return () => 'r' + Date.now().toString(36) + (++n).toString(36); })();
const pd = s => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(s || ''); return m ? new Date(+m[1], m[2] - 1, +m[3]) : null; };
const fd = d => d ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') : '';
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const diff = (a, b) => Math.round((Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) - Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / 864e5);
const today = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const dshow = s => { const d = pd(s); return d ? d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() : ''; };
const dlong = s => { const d = pd(s); return d ? DAYN[d.getDay()] + ', ' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() : ''; };
const inr = n => '₹' + Math.round(n || 0).toLocaleString('en-IN');
const short = n => { n = n || 0; const a = Math.abs(n), s = n < 0 ? '-' : ''; if (a >= 1e7) return s + '₹' + (a / 1e7).toFixed(2).replace(/\.?0+$/, '') + ' Cr'; if (a >= 1e5) return s + '₹' + (a / 1e5).toFixed(a >= 1e6 ? 1 : 2).replace(/\.?0+$/, '') + ' L'; return inr(n); };
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const pill = (t, k) => '<span class="pill ' + (k || '') + '">' + esc(t) + '</span>';
const gk = g => g.group || g.name || '(no name)';
const L = k => (S && S.lists && S.lists[k]) || (SEED.lists[k] || []);
const copy = o => JSON.parse(JSON.stringify(o));

/* ---------- state ---------- */
function withIds(st) { COLLS.forEach(c => { st[c] = (st[c] || []).map(r => (r.id ? r : Object.assign({ id: uid() }, r))); }); return st; }

function demoState() {
  const st = copy(SEED);
  st.budgetCats = st.budgetCats.filter(c => c.name !== 'TOTAL');
  st.team = (SEED.lists['Family Members & Team'] || []).slice();
  st.people = teamToPeople(st.team);
  st.lists = copy(SEED.lists); delete st.lists['Language'];
  st.cat = { share: 0.7, childPct: 0.5, buffer: 0.1, perFn: {} };
  const meals = {Roka:['Lunch',900],Engagement:['Dinner',1800],Haldi:['Lunch',700],Mehndi:['High tea',450],Sangeet:['Dinner',1600],'Cocktail Night':['Dinner',2000],'Baraat & Milni':['Snacks only',500],'Wedding Ceremony':['Dinner',1900],Reception:['Dinner',1800],Vidaai:['Breakfast',400]};
  Object.keys(meals).forEach(k => { st.cat.perFn[k] = { meal: meals[k][0], cost: meals[k][1] }; });
  st.msg = defaultMsg();
  st.msgs = defaultMsgs();
  st.demo = true;
  return withIds(st);
}

function defaultMsg() {
  return 'Namaste {name} 🙏\n\nWith the blessings of our families, {bride} & {groom} are getting married on {date} in {city}. We would be honoured to have you with us.\n\nPlease reply to let us know if you can join.\n\nWith love,\n{bride} & {groom}';
}

/** Family & team as contacts (name, role, phone). Ids come from the name, so two devices upgrading the same planner make the same rows. */
function teamToPeople(team) {
  const h = s => { let x = 5381; for (let i = 0; i < s.length; i++) x = (x * 33 + s.charCodeAt(i)) >>> 0; return x.toString(36); };
  return (team || []).filter(Boolean).map((n, i) => ({ id: 'tm' + i + '_' + h(String(n)), name: String(n), role: '', phone: '', side: '', star: 'No' }));
}

/* WhatsApp messages besides the invitation (which stays in S.msg). A line whose {placeholders} are all empty is left out. */
const MSG_KINDS = [
  ['invite', 'Invitation', 'Guest List: the WhatsApp button on guests not invited yet.'],
  ['remind', 'RSVP reminder', 'Guest List: guests who have not replied.'],
  ['stay', 'Stay & pickup details', 'Guest List and Hotels: guests with a room or a pickup.'],
  ['thanks', 'Thank-you', 'Shagun Register: shagun received.'],
  ['pay', 'Vendor payment note', 'Payments: to the vendor being paid.']
];
function defaultMsgs() {
  return {
    remind: 'Namaste {name} 🙏\n\nA gentle reminder about {bride} & {groom}’s wedding on {date} in {city}. Could you let us know if you will be joining us?\n\nWith love,\n{bride} & {groom}',
    stay: 'Namaste {name} 🙏\n\nYour stay for {bride} & {groom}’s wedding is arranged:\n🏨 {hotel}{room}\n📅 Check-in {checkin}, check-out {checkout}\n🚗 {pickup}\n\nCall us if you need anything. See you soon!',
    thanks: 'Dear {name} 🙏\n\nThank you so much for your blessings and your lovely gift. It meant a lot to us to have you with us.\n\nWith love,\n{bride} & {groom}',
    pay: 'Namaste {vendor} 🙏\n\nAbout {bride} & {groom}’s wedding on {date}: {payment}.\n\nPlease confirm. Thank you!'
  };
}
const MSG_HELP = { invite: '{name} {link} {bride} {groom} {date} {city}', remind: '{name} {bride} {groom} {date} {city}', stay: '{name} {hotel} {room} {checkin} {checkout} {pickup} {bride} {groom} {date} {city}', thanks: '{name} {gift} {bride} {groom} {date} {city}', pay: '{vendor} {payment} {amount} {due} {item} {bride} {groom} {date} {city}' };
/** The invitation; with a connected, live wedding invite, a line with the family's invite link is added if the template has no {link}. */
function inviteText() { const t = S.msg || ''; return typeof INV !== 'undefined' && INV && INV.linked && INV.live && t.indexOf('{link}') < 0 ? t + '\n\n💌 Your invitation: {link}' : t; }
const msgText = k => k === 'invite' ? inviteText() : ((S.msgs || {})[k] || defaultMsgs()[k] || '');
function fillMsg(tpl, vals) {
  const s = S.settings, all = Object.assign({ bride: s.bride || '', groom: s.groom || '', date: dlong(s.date), city: s.city || '' }, vals || {});
  return String(tpl || '').split('\n').filter(line => {
    const keys = (line.match(/\{(\w+)\}/g) || []).map(x => x.slice(1, -1)).filter(k => k in all);
    return !keys.length || keys.some(k => all[k]);
  }).join('\n').replace(/\{(\w+)\}/g, (m, k) => (k in all ? all[k] : m)).replace(/\n{3,}/g, '\n\n').trim();
}

/* ---------- features: pages and tools each planner can switch on or off ---------- */
// def = on for a planner that never changed it; simple = part of the "Just the essentials" preset.
const FEATURES = [
  { k: 'tasks', g: 'Plan', icon: '✅', label: 'Tasks & Timeline', desc: 'Ready-made to-do list with deadlines that follow your wedding date.', def: 1, simple: 1 },
  { k: 'functions', g: 'Plan', icon: '🎊', label: 'Functions', desc: 'Roka to Vidaai: dates, venues and guest counts per function.', def: 1, simple: 1 },
  { k: 'runsheet', g: 'Plan', icon: '⏰', label: 'Run Sheet', desc: 'The hour-by-hour plan for each day: who does what, when and where.', def: 1 },
  { k: 'rituals', g: 'Plan', icon: '🪔', label: 'Rituals & Puja', desc: 'Checklist of puja items for each function.', def: 1 },
  { k: 'catering', g: 'Guests', icon: '🍽️', label: 'Catering & Plates', desc: 'Plates to order per function, from RSVPs.', def: 1 },
  { k: 'stay', g: 'Stay & Travel', icon: '🏨', label: 'Hotels & Rooms', desc: 'Hotels, room types and which family stays where.', def: 1 },
  { k: 'transport', g: 'Stay & Travel', icon: '🚐', label: 'Transport', desc: 'Cabs and buses for pickups and drops.', def: 1 },
  { k: 'budget', g: 'Money', icon: '💰', label: 'Budget', desc: 'Your total budget split into categories and lines.', def: 1, simple: 1 },
  { k: 'vendors', g: 'Money', icon: '🧾', label: 'Vendors', desc: 'Quotes, side-by-side comparison and your pick.', def: 1, simple: 1 },
  { k: 'payments', g: 'Money', icon: '💳', label: 'Payments', desc: 'Advances and instalments with due-date alerts.', def: 1, simple: 1 },
  { k: 'shagun', g: 'Customs', icon: '🎁', label: 'Shagun Register', desc: 'Shagun and gifts received and given.', def: 1 },
  { k: 'milni', g: 'Customs', icon: '🤝', label: 'Milni List', desc: 'Who meets whom at the baraat.', def: 1 },
  { k: 'shopping', g: 'Customs', icon: '🛍️', label: 'Shopping & Outfits', desc: 'Outfits, jewellery, gifts and trousseau.', def: 1 },
  { k: 'print', g: 'Share', icon: '🖨️', label: 'Family Handout', desc: 'A one-page summary to print or send as a PDF.', def: 1, simple: 1 },
  { k: 'contacts', g: 'Contacts & messages', icon: '📇', label: 'Contacts', desc: 'One phone book: family, team, vendors, hotels, drivers and guests, with call and WhatsApp buttons.', def: 1, simple: 1 },
  { k: 'templates', g: 'Contacts & messages', icon: '💬', label: 'Message templates', desc: 'Ready WhatsApp messages: RSVP reminders, stay & pickup details, thank-yous and vendor payment notes.', def: 1 },
  { k: 'phonecheck', g: 'Contacts & messages', icon: '☎️', label: 'Phone number checks', desc: 'Tidies numbers as you type, flags ones that look wrong and spots duplicate guests.', def: 1, simple: 1 },
  { k: 'search', g: 'Contacts & messages', icon: '🔍', label: 'Search everything', desc: 'One search box for guests, vendors, tasks, payments and contacts (Ctrl+K).', def: 1, simple: 1 },
  { k: 'daymode', g: 'Wedding-day tools', icon: '☀️', label: 'Wedding-day mode', desc: 'A simple phone screen for the day: what’s on now and next, and one-tap calls to the people and vendors involved.', def: 0 },
  { k: 'checkin', g: 'Wedding-day tools', icon: '🛬', label: 'Guest arrival check-in', desc: 'Tick off families as they arrive, see who is still on the way and call them.', def: 0 },
  { k: 'sharelink', g: 'Wedding-day tools', icon: '🔗', label: 'Share run sheet by link', desc: 'A view-only link for your event coordinator or caterer: run sheet and starred contacts, no sign-in needed.', def: 0 }
];
const FEAT = {}; FEATURES.forEach(f => { FEAT[f.k] = f; });
/** Is this feature switched on for this planner? */
const on = k => { const f = FEAT[k]; if (!f) return true; const v = S && S.features && S.features[k]; return v == null ? !!f.def : !!v; };
// Pages that belong to a feature (pages not listed are always on).
const ROUTE_FEAT = { tasks: 'tasks', functions: 'functions', runsheet: 'runsheet', rituals: 'rituals', catering: 'catering', stay: 'stay', transport: 'transport', budget: 'budget', vendors: 'vendors', payments: 'payments', shagun: 'shagun', milni: 'milni', shopping: 'shopping', print: 'print', contacts: 'contacts', today: 'daymode', checkin: 'checkin' };
const routeOn = r => !ROUTE_FEAT[r] || on(ROUTE_FEAT[r]);

function freshState() {
  const st = demoState();
  st.demo = false;
  const rep = s => (s == null ? s : String(s).replace(/Ananya/g, 'Bride').replace(/Arjun/g, 'Groom'));
  st.settings = { bride: '', groom: '', date: '', city: '', start: fd(today()) };
  st.totalBudget = 0;
  st.functions = st.functions.map(f => ({ id: f.id, name: f.name, active: f.active, time: f.time || '' }));
  ['guests','hotels','vehicles','roomAlloc','transAlloc','vendors','payments','runsheet','shagun','shopping'].forEach(c => { st[c] = []; });
  st.tasks.forEach(t => { t.status = 'Not Started'; t.who = rep(t.who); });
  st.rituals.forEach(r => { r.status = 'To arrange'; r.who = rep(r.who); });
  st.milni.forEach(m => { m.bride = ''; m.groom = ''; m.amount = ''; m.done = 'No'; m.gift = m.gift || ''; });
  st.team = st.team.map(rep);
  st.people = teamToPeople(st.team);
  return st;
}

function normalize(st) {
  const base = demoState();
  st = Object.assign({}, st || {});
  COLLS.forEach(c => { if (!Array.isArray(st[c])) st[c] = []; });
  st.settings = Object.assign({ bride: '', groom: '', date: '', city: '', start: fd(today()) }, st.settings || {});
  st.cat = Object.assign({ share: 0.7, childPct: 0.5, buffer: 0.1, perFn: {} }, st.cat || {});
  st.cat.perFn = st.cat.perFn || {};
  st.lists = Object.assign({}, base.lists, st.lists || {});
  if (!Array.isArray(st.team)) st.team = base.team;
  // Planners from before Contacts: the family & team names become contacts once.
  if (!st.people.length && st.team.length) st.people = teamToPeople(st.team);
  if (!st.features || typeof st.features !== 'object' || Array.isArray(st.features)) st.features = {};
  st.msgs = Object.assign(defaultMsgs(), st.msgs && typeof st.msgs === 'object' ? st.msgs : {});
  if (st.totalBudget == null) st.totalBudget = 0;
  if (!st.msg) st.msg = defaultMsg();
  if (!st.cols || typeof st.cols !== 'object') st.cols = {};
  return withIds(st);
}

function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { raw = MEM[KEY] || null; }
  if (raw) { try { return normalize(JSON.parse(raw)); } catch (e) { /* fall through */ } }
  return demoState();
}
function save() { if (typeof CLOUD !== 'undefined' && CLOUD.on) { saveCache(); return; } const j = JSON.stringify(S); try { localStorage.setItem(KEY, j); } catch (e) { MEM[KEY] = j; } }
function dirty() { if (typeof CLOUD !== 'undefined' && CLOUD.readOnly) return; syncTeam(); D = null; clearTimeout(saveT); saveT = setTimeout(save, 250); if (typeof CLOUD !== 'undefined' && CLOUD.on) schedulePush(); }

/* ---------- derived numbers (the "formulas" of the Excel) ---------- */
const d = () => D || (D = compute());

function fnState(g, fn) {
  const c = (g.fn || {})[fn];
  if (!c) return null;
  if (c === 'N') return 'Declined';
  if (c === 'C') return 'Confirmed';
  if (g.rsvp === 'Confirmed') return 'Confirmed';
  if (g.rsvp === 'Declined') return 'Declined';
  return 'Pending';
}

function taskDeadline(t, o) {
  if (!o.wd) return null;
  const db = t.daysBefore === '' || t.daysBefore == null ? 0 : num(t.daysBefore);
  const comp = o.avail >= 365 ? 1 : Math.max(0, (o.avail - 14) / (365 - 14));
  const dd = db <= 14 ? db : 14 + (db - 14) * comp;
  const base = Date.UTC(o.wd.getFullYear(), o.wd.getMonth(), o.wd.getDate()) / 864e5;
  const dl = new Date(Math.round(base - dd) * 864e5);
  const res = new Date(dl.getUTCFullYear(), dl.getUTCMonth(), dl.getUTCDate());
  return res < o.st ? o.st : res;
}

function compute() {
  const o = {}, set = S.settings;
  o.T = today(); o.wd = pd(set.date); o.st = pd(set.start) || o.T;
  o.daysTo = o.wd ? diff(o.wd, o.T) : null;
  o.avail = o.wd ? diff(o.wd, o.st) : null;
  o.mode = o.avail == null ? '' : o.avail >= 270 ? 'Standard' : o.avail >= 120 ? 'Fast' : o.avail >= 45 ? 'Express' : 'Emergency';
  const G = S.guests.filter(g => g.name || g.group);
  o.G = G;
  /* groups */
  o.groups = new Map();
  G.forEach(g => { const k = gk(g); if (!o.groups.has(k)) o.groups.set(k, []); o.groups.get(k).push(g); });
  o.nGuests = G.length; o.nGroups = o.groups.size;
  o.sent = G.filter(g => g.invited === 'Yes').length;
  o.conf = G.filter(g => g.rsvp === 'Confirmed').length;
  o.decl = G.filter(g => g.rsvp === 'Declined').length;
  o.await = o.nGuests - o.conf - o.decl;
  /* functions */
  const fns = S.functions.filter(f => f.active !== 'No' && f.name);
  o.fns = fns.map(f => {
    const r = { f, inv: 0, conf: 0, pend: 0, decl: 0, a: { Confirmed: 0, Pending: 0 }, k: { Confirmed: 0, Pending: 0 }, diet: {} };
    G.forEach(g => {
      const s = fnState(g, f.name); if (!s) return;
      r.inv++; if (s === 'Confirmed') r.conf++; else if (s === 'Pending') r.pend++; else r.decl++;
      if (s !== 'Declined') {
        const age = g.age || 'Adult';
        if (age === 'Adult') r.a[s]++; else if (age === 'Child') r.k[s]++;
        const dt = g.diet || 'Not specified'; r.diet[dt] = (r.diet[dt] || 0) + (age === 'Infant' ? 0 : 1);
      }
    });
    const c = S.cat, pf = c.perFn[f.name] || { meal: 'Dinner', cost: 0 };
    r.meal = pf.meal; r.costPer = num(pf.cost);
    const raw = (r.a.Confirmed + r.k.Confirmed * c.childPct + (r.a.Pending + r.k.Pending * c.childPct) * c.share) * (1 + num(c.buffer));
    r.plates = r.meal === 'No meal' ? 0 : Math.ceil(raw - 1e-9);
    r.food = r.plates * r.costPer;
    return r;
  });
  /* stay */
  const hk = h => h.hotel + ' - ' + h.type;
  o.hotelKey = hk;
  o.stayNeed = new Map();
  G.forEach(g => { if (g.stay === 'Yes') o.stayNeed.set(gk(g), (o.stayNeed.get(gk(g)) || 0) + 1); });
  o.stayNeedN = Array.from(o.stayNeed.values()).reduce((a, b) => a + b, 0);
  o.roomCalc = {};
  S.roomAlloc.forEach(a => {
    const h = S.hotels.find(x => hk(x) === a.hotelType);
    const nights = a.in && a.out ? Math.max(0, diff(pd(a.out), pd(a.in))) : 0;
    const rooms = num(a.rooms), cap = h ? rooms * num(h.pax) : 0, need = o.stayNeed.get(a.group) || 0;
    const cost = h ? rooms * num(h.rate) * nights : 0;
    const status = !a.group ? 'Pick a group' : !h ? 'Pick a room type' : !a.in || !a.out ? 'Add dates' : need > cap ? 'Needs more beds' : 'OK';
    o.roomCalc[a.id] = { need, cap, nights, cost, status };
  });
  o.roomCost = S.roomAlloc.reduce((s, a) => s + o.roomCalc[a.id].cost, 0);
  const allocG = new Set(S.roomAlloc.map(a => a.group));
  o.stayAwait = Array.from(o.stayNeed.entries()).filter(e => !allocG.has(e[0]));
  o.hotelBooked = {};
  S.roomAlloc.forEach(a => { o.hotelBooked[a.hotelType] = (o.hotelBooked[a.hotelType] || 0) + num(a.rooms); });
  o.roomsTotal = S.hotels.reduce((s, h) => s + num(h.rooms), 0);
  o.roomsBooked = S.roomAlloc.reduce((s, a) => s + num(a.rooms), 0);
  /* transport */
  const vk = v => v.operator + ' - ' + v.type;
  o.vehKey = vk;
  o.trNeed = new Map();
  G.forEach(g => { if (g.transport === 'Yes') o.trNeed.set(gk(g), (o.trNeed.get(gk(g)) || 0) + 1); });
  o.trNeedN = Array.from(o.trNeed.values()).reduce((a, b) => a + b, 0);
  o.trCalc = {};
  S.transAlloc.forEach(a => {
    const v = S.vehicles.find(x => vk(x) === a.vehicle);
    const trips = Math.max(1, (a.arrDate ? 1 : 0) + (a.depDate ? 1 : 0));
    const n = num(a.count), cap = v ? n * num(v.seats) : 0, need = o.trNeed.get(a.group) || 0;
    const cost = v ? n * num(v.rate) * trips : 0;
    const status = !a.group ? 'Pick a group' : !v ? 'Pick a vehicle' : need > cap ? 'Needs more seats' : 'OK';
    o.trCalc[a.id] = { need, cap, trips, cost, status };
  });
  o.trCost = S.transAlloc.reduce((s, a) => s + o.trCalc[a.id].cost, 0);
  const trG = new Set(S.transAlloc.map(a => a.group));
  o.trAwait = Array.from(o.trNeed.entries()).filter(e => !trG.has(e[0]));
  o.vehBooked = {};
  S.transAlloc.forEach(a => { o.vehBooked[a.vehicle] = (o.vehBooked[a.vehicle] || 0) + num(a.count); });
  /* payments */
  o.payCalc = {};
  S.payments.forEach(p => {
    const paid = p.status === 'Paid';
    const dd = p.due ? diff(pd(p.due), o.T) : null;
    const st = paid ? 'Paid' : dd == null ? 'No due date' : dd < 0 ? 'Overdue' : dd <= 7 ? 'Due this week' : dd <= 30 ? 'Due this month' : 'Upcoming';
    o.payCalc[p.id] = { st, dd, paid };
  });
  /* budget */
  const total = num(S.totalBudget);
  o.total = total;
  o.cats = S.budgetCats.map(c => ({ c, planned: total * num(c.pct), committed: 0, paid: 0, lines: 0, sub: 0 }));
  const cmap = {}; o.cats.forEach(x => { cmap[x.c.name] = x; });
  o.lineCalc = {};
  S.budgetLines.forEach(l => {
    const cat = cmap[l.cat];
    const planned = cat ? cat.planned * num(l.pctCat) : 0;
    let committed;
    if (l.source === 'Hotels') committed = o.roomCost;
    else if (l.source === 'Transport') committed = o.trCost;
    else committed = S.vendors.filter(v => v.line === l.line && v.decision === 'Selected').reduce((s, v) => s + (num(v.negotiated) || num(v.quoted)), 0);
    const paid = S.payments.filter(p => p.line === l.line && p.status === 'Paid').reduce((s, p) => s + num(p.amount), 0);
    o.lineCalc[l.id] = { planned, committed, paid };
    if (cat) { cat.committed += committed; cat.paid += paid; cat.lines++; cat.sub += num(l.pctCat); }
  });
  o.pctSum = S.budgetCats.reduce((s, c) => s + num(c.pct), 0);
  o.planned = o.cats.reduce((s, x) => s + x.planned, 0);
  o.committed = o.cats.reduce((s, x) => s + x.committed, 0);
  o.paid = o.cats.reduce((s, x) => s + x.paid, 0);
  o.catStatus = x => !x.planned ? 'No budget' : !x.committed ? 'Not started' : x.committed > x.planned ? 'Over budget' : x.committed / x.planned >= 0.9 ? 'Near limit' : 'On track';
  /* vendors */
  o.vCalc = {};
  const byLine = {};
  S.vendors.forEach(v => { (byLine[v.line] = byLine[v.line] || []).push(v); });
  S.vendors.forEach(v => {
    const eff = num(v.negotiated) || num(v.quoted), arr = byLine[v.line] || [];
    const effs = arr.map(x => num(x.negotiated) || num(x.quoted)).filter(x => x > 0);
    const avg = effs.length ? effs.reduce((a, b) => a + b, 0) / effs.length : 0;
    const rank = effs.filter(x => x < eff).length + 1;
    const lp = S.budgetLines.find(l => l.line === v.line);
    const planned = lp ? o.lineCalc[lp.id].planned : 0;
    const paid = S.payments.filter(p => p.line === v.line && p.payee === v.vendor && p.status === 'Paid').reduce((s, p) => s + num(p.amount), 0);
    const sel = v.decision === 'Selected';
    o.vCalc[v.id] = { eff, rank, vsAvg: avg && eff ? eff / avg - 1 : null, vsPlan: planned && eff ? eff / planned - 1 : null, paid, bal: sel ? eff - paid : null, st: !sel ? '' : paid >= eff && eff > 0 ? 'Fully paid' : paid > 0 ? 'Part-paid' : 'Unpaid', low: effs.length > 1 && eff === Math.min.apply(null, effs) };
  });
  /* tasks */
  o.tCalc = {};
  S.tasks.forEach(t => {
    const dl = taskDeadline(t, o), done = t.status === 'Done';
    const left = dl ? diff(dl, o.T) : null;
    const alert = done ? 'Done' : left == null ? '' : left < 0 ? 'Overdue' : left <= 7 ? 'Due soon' : 'On track';
    o.tCalc[t.id] = { dl, left, alert };
  });
  o.tDone = S.tasks.filter(t => t.status === 'Done').length;
  o.tOver = S.tasks.filter(t => o.tCalc[t.id].alert === 'Overdue').length;
  o.tSoon = S.tasks.filter(t => o.tCalc[t.id].alert === 'Due soon').length;
  /* money life */
  o.payOver = S.payments.filter(p => o.payCalc[p.id].st === 'Overdue');
  o.paySoon = S.payments.filter(p => { const c = o.payCalc[p.id]; return !c.paid && c.dd != null && c.dd >= 0 && c.dd <= 14; });
  o.payPending = S.payments.filter(p => p.status !== 'Paid').reduce((s, p) => s + num(p.amount), 0);
  o.payPaid = S.payments.filter(p => p.status === 'Paid').reduce((s, p) => s + num(p.amount), 0);
  o.shRecv = S.shagun.filter(x => x.dir === 'Received').reduce((s, x) => s + num(x.amount), 0);
  o.shGiven = S.shagun.filter(x => x.dir === 'Given').reduce((s, x) => s + num(x.amount), 0);
  o.thanksPending = S.shagun.filter(x => x.dir === 'Received' && x.thanks !== 'Yes').length;
  o.returnsPending = S.shagun.filter(x => x.ret === 'Yes' && x.retStatus !== 'Done').length;
  o.noVendorLines = S.budgetLines.filter(l => l.source !== 'Hotels' && l.source !== 'Transport' && S.vendors.some(v => v.line === l.line) && !S.vendors.some(v => v.line === l.line && v.decision === 'Selected'));
  return o;
}

/* ---------- team / lists ---------- */
// Contacts are the source of the family & team names; S.team keeps a copy for the Excel export and older devices.
const TEAM = () => { const p = (S.people || []).map(x => x.name).filter(Boolean); return p.length ? p : (S.team || []); };
function syncTeam() { if (!S || !Array.isArray(S.people)) return; const n = S.people.map(x => x.name).filter(Boolean); if (JSON.stringify(n) !== JSON.stringify(S.team || [])) S.team = n; }
const LINES = () => S.budgetLines.map(l => l.line);
const FNS = () => S.functions.filter(f => f.name).map(f => f.name);
const GROUPS = () => Array.from(d().groups.keys()).sort();
