/* ---------- start-up ---------- */
// LOGO is defined by the build (the same mark as in the menu).
const INSTALL = { evt: null };
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); INSTALL.evt = e; const b = $('#install'); if (b) b.hidden = false; const m = $('#me-install'); if (m) m.hidden = false; });
async function doInstall() { if (!INSTALL.evt) return; INSTALL.evt.prompt(); try { await INSTALL.evt.userChoice; } catch (e) { /* none */ } INSTALL.evt = null; $('#install').hidden = true; }
$('#install').onclick = doInstall;

function showApp() {
  $('#lp').innerHTML = '';
  document.documentElement.classList.remove('boot-out'); document.documentElement.classList.add('boot-app');
  applyTheme(); setSync(CLOUD.offline ? 'offline' : 'saved'); render(); renderNavBadges();
}
function afterStart() {
  saveAuthForWorker();
  pollInbox();
  if (doHash()) return;
  const join = store.get('wk_join');
  if (join) { joinFlow(join); return; }
  if (!CH() && !S.days.length && !S.challenges.length) setTimeout(() => setupWizard(), 500);
}

/* links people arrive with: ?ref=CODE (a friend's referral), ?join=CODE (a group invite), utm_* (ads) */
(function readLink() {
  const q = new URLSearchParams(location.search);
  if (q.get('ref')) store.set('wk_ref', q.get('ref').toUpperCase().slice(0, 12));
  if (q.get('join')) store.set('wk_join', q.get('join').toLowerCase().slice(0, 12));
  // Ad headline version (?v=…): kept for this visit, because the address is cleaned below before the page draws.
  if (q.get('v')) try { sessionStorage.setItem('wk_v', q.get('v').slice(0, 30)); } catch (e) { /* private mode */ }
  const src = [q.get('utm_source'), q.get('utm_campaign'), q.get('utm_content'), q.get('v') ? 'v=' + q.get('v') : ''].filter(Boolean).join(' / ');
  if (src && !store.get('wk_src')) store.set('wk_src', src.slice(0, 120));
  if (q.toString()) history.replaceState(null, '', location.pathname + location.hash);
})();

/* offline worker: the app opens with no internet once it has been opened online */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/workout-sw.js', { scope: '/workout' }).catch((e) => console.warn('offline worker', e)); });
  navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.type === 'open' && e.data.hash) location.hash = e.data.hash; });
}

S = normalize({});
const email = store.get('wk_email');
if (tok() && email) startApp(email);
else {
  showLanding();
  if (location.pathname.endsWith('/signup') || store.get('wk_join')) setTimeout(() => gate('signup'), 300);
  else if (location.pathname.endsWith('/login')) setTimeout(() => gate('login'), 300);
}
// For support and automated tests: read-only peek at the app from the browser console.
window.WK = { get S() { return S; }, get ME() { return ME; }, PL, loadStep, xpAll, dayRow, today, CLOUD, stats, render };
