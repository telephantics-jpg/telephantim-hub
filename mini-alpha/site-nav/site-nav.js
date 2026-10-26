/* Telephantim tab bar inside Mini Alpha (Mini highlighted). Same-window links, safe in standalone mode. */
(function () {
  "use strict";
  var T = [["Arcane", "/?world=arcane"], ["Bio", "/"], ["2D", "/2d.html"], ["Mini", "/mini-alpha/"], ["3D", "/3d.html"], ["4D", "/?world=4d"], ["Relics", "/?world=relics"]]; // Random tab hidden 2026-10-26 (Mini replaces it); restore by adding ["Random", "/random/"];
  function mount() { if (document.getElementById("tp-tabbar")) return; var n = document.createElement("nav"); n.id = "tp-tabbar"; n.setAttribute("aria-label", "Telephantim pages");
    n.innerHTML = T.map(function (t) { var on = t[0] === "Mini"; return '<a href="' + t[1] + '"' + (on ? ' class="on" aria-current="page"' : "") + ">" + t[0] + "</a>"; }).join("");
    n.addEventListener("click", function (e) { var a = e.target.closest("a"); if (!a || a.classList.contains("on")) { if (a) e.preventDefault(); return; } e.preventDefault(); location.assign(new URL(a.getAttribute("href"), location.origin).href); });
    document.body.insertBefore(n, document.body.firstChild); document.documentElement.classList.add("has-tp-tabbar"); }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount); setInterval(mount, 2000);
})();
