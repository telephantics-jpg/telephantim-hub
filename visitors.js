/**
 * Telephantim visitor counter (own system — not Google Analytics).
 * - One pageview per browser tab session
 * - Unique visitor = first time we see localStorage visitorId
 * - Works against same-origin /api/* (local) or TELEPHANTIM_API (live)
 */
(function () {
  var LS_ID = "telephantim_visitor_id";
  var SS_HIT = "telephantim_visit_session";
  var API =
    typeof window.TELEPHANTIM_API === "string" ? window.TELEPHANTIM_API.replace(/\/$/, "") : "";

  function apiUrl(path) {
    return (API || "") + path;
  }

  function uuid() {
    try {
      if (crypto && crypto.randomUUID) return crypto.randomUUID();
    } catch (_) {}
    return "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
  }

  function getVisitorId() {
    try {
      var id = localStorage.getItem(LS_ID);
      if (id && id.length >= 8) return id;
      id = uuid();
      localStorage.setItem(LS_ID, id);
      return id;
    } catch (_) {
      return uuid();
    }
  }

  function siteKey() {
    try {
      var h = (location.hostname || "").toLowerCase();
      if (h.indexOf("telephanti.com") >= 0) return "telephanti";
      if (h.indexOf("telephantim.com") >= 0) return "telephantim";
      if (h.indexOf("telephantix") >= 0) return "telephantix";
      if (h === "localhost" || h === "127.0.0.1") return "local";
    } catch (_) {}
    return "telephantim";
  }

  function fmt(n) {
    n = Number(n) || 0;
    try {
      return n.toLocaleString();
    } catch (_) {
      return String(n);
    }
  }

  function paint(stats) {
    if (!stats || !stats.ok) return;
    var els = document.querySelectorAll("[data-visitor-count]");
    els.forEach(function (el) {
      var mode = el.getAttribute("data-visitor-count") || "unique";
      var n =
        mode === "pageviews"
          ? stats.totalPageviews
          : mode === "today"
            ? (stats.today && stats.today.unique) || 0
            : stats.uniqueVisitors;
      el.textContent = fmt(n);
    });
    var wraps = document.querySelectorAll("[data-visitor-wrap]");
    wraps.forEach(function (w) {
      w.hidden = false;
      var u = stats.uniqueVisitors || 0;
      var p = stats.totalPageviews || 0;
      var t = (stats.today && stats.today.unique) || 0;
      w.title =
        fmt(u) +
        " unique visitors · " +
        fmt(p) +
        " pageviews · " +
        fmt(t) +
        " unique today (UTC)";
    });
    window.TelephantimVisitors = stats;
  }

  function fetchStats() {
    return fetch(apiUrl("/api/visitors"), {
      method: "GET",
      credentials: "omit",
      cache: "no-store",
    })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (j) {
        if (j && j.ok) paint(j);
        return j;
      })
      .catch(function () {
        return null;
      });
  }

  function recordVisit() {
    var already = false;
    try {
      already = sessionStorage.getItem(SS_HIT) === "1";
    } catch (_) {}

    var body = {
      visitorId: getVisitorId(),
      site: siteKey(),
      path: (location.pathname || "/") + (location.hash || ""),
      session: !already,
    };

    return fetch(apiUrl("/api/visit"), {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      keepalive: true,
    })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (j) {
        if (j && j.ok) {
          try {
            sessionStorage.setItem(SS_HIT, "1");
          } catch (_) {}
          paint({
            ok: true,
            totalPageviews: j.totalPageviews,
            uniqueVisitors: j.uniqueVisitors,
            today: j.today,
          });
        }
        return j;
      })
      .catch(function () {
        return null;
      });
  }

  function boot() {
    // Always try to show latest totals, then count this session once
    fetchStats().finally(function () {
      recordVisit();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.TelephantimVisitorCounter = {
    refresh: fetchStats,
    record: recordVisit,
    getId: getVisitorId,
  };
})();
