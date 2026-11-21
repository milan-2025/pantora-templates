/* LeadFlow CRM: offline status on every screen. The offline worker (sw.js) keeps the screens, the last data and
 * an outbox of changes on this device; this shows what's happening and asks it to sync when the connection returns. */
(function () {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/CRM/sw.js", { scope: "/CRM/" }).catch(function () {});
  var st = { pending: 0, failed: [] }, bar = null, syncedAt = 0;
  function el() {
    if (bar) return bar;
    bar = document.createElement("div");
    bar.setAttribute("role", "status");
    bar.style.cssText = "position:fixed;left:50%;bottom:calc(12px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:9999;max-width:92vw;padding:8px 14px;border-radius:999px;font:13px/1.35 system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.18);display:none;align-items:center;gap:10px;color:#fff";
    document.body.appendChild(bar);
    return bar;
  }
  function draw() {
    if (!document.body) return;
    var b = el(), off = !navigator.onLine, f = st.failed || [], msg = "", bg = "#1f2937", btn = "";
    if (f.length) {
      bg = "#b91c1c";
      msg = "⚠ " + f.length + " offline change" + (f.length > 1 ? "s" : "") + " couldn’t be saved: " + (f[f.length - 1].error || "");
      btn = '<button type="button" style="all:unset;cursor:pointer;font-weight:600;text-decoration:underline">OK</button>';
    } else if (off) {
      msg = "📴 Offline · showing data saved on this phone" + (st.pending ? " · " + st.pending + " change" + (st.pending > 1 ? "s" : "") + " will sync when you’re back online" : "");
    } else if (st.pending) {
      bg = "#2563eb"; msg = "🔄 Syncing " + st.pending + " change" + (st.pending > 1 ? "s" : "") + "…";
    } else if (Date.now() - syncedAt < 3000) {
      bg = "#16a34a"; msg = "✓ Offline changes synced";
    }
    b.style.background = bg;
    b.style.display = msg ? "flex" : "none";
    b.innerHTML = "<span></span>" + btn;
    b.firstChild.textContent = msg;
    var k = b.querySelector("button");
    if (k) k.onclick = function () { post("clear-failed"); };
  }
  function post(type) {
    navigator.serviceWorker.ready.then(function (r) { if (r.active) r.active.postMessage({ type: type }); });
  }
  navigator.serviceWorker.addEventListener("message", function (e) {
    var d = e.data || {};
    if (d.type === "crm-queue") { st.pending = d.pending; st.failed = d.failed || []; draw(); }
    if (d.type === "crm-synced") { syncedAt = Date.now(); draw(); setTimeout(draw, 3100); window.dispatchEvent(new Event("poke")); }
  });
  window.addEventListener("online", function () { draw(); post("flush"); });
  window.addEventListener("offline", draw);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") post(navigator.onLine ? "flush" : "status"); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { draw(); post("status"); });
  else { draw(); post("status"); }
  setInterval(function () { if (navigator.onLine && st.pending) post("flush"); }, 15000);
})();
