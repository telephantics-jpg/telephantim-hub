/**
 * Google Analytics 4 for telephantim.com
 * Measurement ID: window.TELEPHANTIM_GA_ID (set in api-config.js)
 */
(function () {
  var id = window.TELEPHANTIM_GA_ID;
  if (!id || typeof id !== "string" || id.indexOf("G-") !== 0) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  gtag("js", new Date());
  gtag("config", id, {
    send_page_view: true,
    anonymize_ip: true,
  });

  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
  document.head.appendChild(s);

  function trackScene(scene) {
    if (!scene || typeof gtag !== "function") return;
    gtag("event", "world_view", {
      event_category: "navigation",
      event_label: scene,
      world: scene,
    });
    // Virtual page path so GA shows which world was viewed
    gtag("event", "page_view", {
      page_path: "/" + (scene === "telephantim" ? "" : "#" + scene),
      page_title: "Telephantim · " + scene,
    });
  }

  window.addEventListener("telephantim-scene", function (e) {
    var scene = e.detail && e.detail.scene;
    if (scene) trackScene(scene);
  });

  // Sheet open / music open (optional engagement signals)
  document.addEventListener(
    "click",
    function (e) {
      var t = e.target && e.target.closest && e.target.closest("#btn-music, #btn-music-sheet, #sheet-toggle, .bio-link");
      if (!t || typeof gtag !== "function") return;
      var name = "ui_click";
      if (t.id === "btn-music" || t.id === "btn-music-sheet") name = "music_open";
      else if (t.id === "sheet-toggle") name = "sheet_toggle";
      else if (t.classList && t.classList.contains("bio-link")) name = "bio_link_click";
      gtag("event", name, {
        event_category: "engagement",
        event_label: t.id || t.href || "link",
      });
    },
    true
  );

  window.TelephantimAnalytics = { gtag: gtag, trackScene: trackScene, id: id };
})();
