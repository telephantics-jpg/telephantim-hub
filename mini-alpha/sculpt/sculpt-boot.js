/* Sculpt tab bootstrap (classic script): adds the legacy tab + pane, lazy-loads the 3D studio module. */
(function () {
  function mount() {
    var tabs = document.querySelector(".tabs"), main = document.querySelector("main");
    if (!tabs || !main || document.getElementById("pane-sculpt")) return;
    var css = document.createElement("link"); css.rel = "stylesheet"; css.href = "sculpt/sculpt.css?v=1"; document.head.appendChild(css);
    var pane = document.createElement("section"); pane.className = "pane"; pane.id = "pane-sculpt"; main.appendChild(pane);
    var b = document.createElement("button"); b.setAttribute("data-p", "sculpt");
    b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3v18M8 7c4 0 4 4 8 4M8 13c4 0 4 4 8 4M5 6l7-2 7 2"/></svg>Sculpt';
    var started = false;
    b.onclick = function () {
      document.querySelectorAll(".tabs button").forEach(function (x) { x.classList.toggle("on", x === b); });
      document.querySelectorAll(".pane").forEach(function (x) { x.classList.toggle("active", x.id === "pane-sculpt"); });
      if (!started) { started = true; pane.innerHTML = '<p class="sc-msg">Loading the 3D studio...</p>';
        import("./sculpt.js?v=1").then(function (m) { m.init(pane); }).catch(function (e) { console.warn("[sculpt]", e); pane.innerHTML = '<p class="sc-msg">The 3D studio did not load.</p>'; started = false; });
      } else if (window.MiniSculpt) window.MiniSculpt.resize();
    };
    tabs.insertBefore(b, tabs.querySelector('[data-p="saved"]'));
    if (new URLSearchParams(location.search).get("tab") === "sculpt") setTimeout(function () { b.click(); }, 400);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
