/*
 * Pandora Templates: one Meta Pixel for every app page (planner, invites, photos, workout, HostBook, Stays, CRM).
 *
 *   <script src="/pt-track.js" data-id="planner" data-name="Online Wedding Planner" data-category="weddings" defer></script>
 *
 * - The Pixel ID comes from the admin (Settings → Site settings → Tracking), so there is one place to change it.
 * - Every event carries the product (content_ids / content_name / content_category), so each product gets its own
 *   custom conversion in Events Manager, while one Pixel keeps audiences shared across products.
 * - Sent by itself: PageView + ViewContent on load, Contact when a WhatsApp link is tapped, InitiateCheckout when the
 *   Razorpay window opens and Purchase when a payment succeeds (with its value; the order id is the event id).
 * - The apps add the rest with window.ptTrack('CompleteRegistration' | 'StartTrial' | 'Lead', params). Code that may run
 *   before this script has loaded pushes to window.ptq instead: (window.ptq = window.ptq || []).push([event, params]).
 * Tracking never breaks a page: every step is wrapped, and nothing happens when no Pixel ID is set.
 */
(function () {
  if (window.ptTrack) return;
  var me = document.currentScript || document.querySelector('script[src*="pt-track.js"]');
  var d = (me && me.dataset) || {};
  var product = {};
  if (d.id) product.content_ids = [d.id];
  if (d.name) product.content_name = d.name;
  if (d.category) product.content_category = d.category;
  if (d.id) product.content_type = 'product';

  var STANDARD = ['AddPaymentInfo', 'AddToCart', 'AddToWishlist', 'CompleteRegistration', 'Contact', 'CustomizeProduct', 'Donate', 'FindLocation',
    'InitiateCheckout', 'Lead', 'PageView', 'Purchase', 'Schedule', 'Search', 'StartTrial', 'SubmitApplication', 'Subscribe', 'ViewContent'];
  var queue = [];
  var ready = false;
  var off = false;

  function send(ev, params, eventId) {
    try {
      var p = Object.assign({}, product, params || {});
      var opts = eventId ? { eventID: String(eventId) } : undefined;
      window.fbq(STANDARD.indexOf(ev) >= 0 ? 'track' : 'trackCustom', ev, p, opts);
    } catch (e) { /* never break the page */ }
  }

  /** Public: window.ptTrack('StartTrial', { value: 0, currency: 'INR' }, 'optional-event-id') */
  window.ptTrack = function (ev, params, eventId) {
    if (off || !ev) return;
    if (ready) send(ev, params, eventId); else queue.push([ev, params, eventId]);
  };
  window.ptTrack.product = product;
  // Calls made before this script loaded (apps push [event, params, eventId] to window.ptq).
  var early = window.ptq;
  window.ptq = { push: function (a) { window.ptTrack(a[0], a[1], a[2]); } };
  if (Array.isArray(early)) early.forEach(function (a) { window.ptTrack(a[0], a[1], a[2]); });

  function boot(id) {
    if (!id) { off = true; queue = []; return; }
    try {
      if (!window.fbq) {
        /* eslint-disable */
        !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s) }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
        /* eslint-enable */
      }
      window.fbq('init', id);
      window.fbq('track', 'PageView');
      ready = true;
      if (d.view !== 'off') send('ViewContent');
      var q = queue; queue = [];
      q.forEach(function (a) { send(a[0], a[1], a[2]); });
    } catch (e) { off = true; }
  }

  // Pixel ID: remembered for the visit, so moving between screens doesn't ask again.
  var KEY = 'pt_px';
  var cached = null;
  try { cached = sessionStorage.getItem(KEY); } catch (e) { /* private mode */ }
  if (cached !== null) boot(cached);
  else {
    fetch('/api/site/pixel', { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (j) { var id = String((j && j.id) || '').replace(/\D/g, ''); try { sessionStorage.setItem(KEY, id); } catch (e) { /* ignore */ } boot(id); })
      .catch(function () { boot(''); });
  }

  // WhatsApp taps → Contact.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (a && /(^|\/\/)(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com)\//.test(a.getAttribute('href') || '')) window.ptTrack('Contact');
  }, true);

  // Razorpay: InitiateCheckout when the window opens, Purchase when a payment succeeds.
  // A Proxy, so Razorpay's own script keeps reading and adding properties on the real Razorpay object; only
  // `new Razorpay(options)` is intercepted, to add the two events.
  var wrapped = typeof WeakSet === 'function' ? new WeakSet() : null;
  function wrapRazorpay(R) {
    if (typeof R !== 'function' || typeof Proxy !== 'function' || !wrapped || wrapped.has(R)) return R;
    var P = new Proxy(R, {
      construct: function (target, args, newTarget) {
        var opts = args[0];
        if (!opts || typeof opts !== 'object') return Reflect.construct(target, args, newTarget === P ? target : newTarget);
        var o = Object.assign({}, opts);
        var amount = Number(o.amount) > 0 ? Number(o.amount) / 100 : undefined;
        var money = amount !== undefined ? { value: amount, currency: o.currency || 'INR' } : { currency: o.currency || 'INR' };
        var handler = o.handler;
        o.handler = function () {
          try { window.ptTrack('Purchase', money, o.order_id ? 'purchase-' + o.order_id : undefined); } catch (e) { /* ignore */ }
          return typeof handler === 'function' ? handler.apply(this, arguments) : undefined;
        };
        var inst = Reflect.construct(target, [o].concat(Array.prototype.slice.call(args, 1)), newTarget === P ? target : newTarget);
        var open = inst && inst.open;
        if (typeof open === 'function') {
          inst.open = function () {
            try { window.ptTrack('InitiateCheckout', money, o.order_id ? 'checkout-' + o.order_id : undefined); } catch (e) { /* ignore */ }
            return open.apply(inst, arguments);
          };
        }
        return inst;
      },
    });
    wrapped.add(P);
    return P;
  }
  try {
    var current = wrapRazorpay(window.Razorpay);
    Object.defineProperty(window, 'Razorpay', {
      configurable: true,
      get: function () { return current; },
      set: function (v) { current = wrapRazorpay(v); },
    });
  } catch (e) { /* ignore */ }
})();
