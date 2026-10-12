/**
 * Guest view counter (Abacus — free, no signup).
 * - Once per browser per calendar day (localStorage date).
 * - Owner: ?me=1 sets tp_owner=1 permanently; ?me=0 clears. Owner never hits.
 * - localhost / 127.0.0.1: read only, never increment.
 * - API fail: hide quietly.
 */
(function () {
  var API = "https://abacus.jasoncameron.dev";
  var NS = "telephantim";
  var KEY = "views";
  var LS_OWNER = "tp_owner";
  var LS_DAY = "tp_guest_view_day";

  function todayKey() {
    var d = new Date();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  function isLocalHost() {
    try {
      var h = (location.hostname || "").toLowerCase();
      return h === "localhost" || h === "127.0.0.1";
    } catch (_) {
      return false;
    }
  }

  function isOwner() {
    try {
      return localStorage.getItem(LS_OWNER) === "1";
    } catch (_) {
      return false;
    }
  }

  function applyOwnerFlag() {
    try {
      var q = new URLSearchParams(location.search || "");
      var me = q.get("me");
      if (me === "1") localStorage.setItem(LS_OWNER, "1");
      if (me === "0") localStorage.removeItem(LS_OWNER);
    } catch (_) {}
  }

  function alreadyCountedToday() {
    try {
      return localStorage.getItem(LS_DAY) === todayKey();
    } catch (_) {
      return false;
    }
  }

  function markCountedToday() {
    try {
      localStorage.setItem(LS_DAY, todayKey());
    } catch (_) {}
  }

  function fmt(n) {
    n = Number(n) || 0;
    try {
      return n.toLocaleString();
    } catch (_) {
      return String(n);
    }
  }

  function el() {
    return document.getElementById("guest-views");
  }

  function hide() {
    var node = el();
    if (node) node.hidden = true;
  }

  function paint(n) {
    var node = el();
    if (!node) return;
    var num = node.querySelector("[data-guest-views]");
    if (num) num.textContent = fmt(n);
    node.hidden = false;
  }

  function boot() {
    applyOwnerFlag();
    var doHit = !isLocalHost() && !isOwner() && !alreadyCountedToday();
    var url = API + (doHit ? "/hit/" : "/get/") + NS + "/" + KEY;
    fetch(url, { credentials: "omit", cache: "no-store" })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (j) {
        if (!j || j.value == null) {
          hide();
          return;
        }
        if (doHit) markCountedToday();
        paint(j.value);
      })
      .catch(function () {
        hide();
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
