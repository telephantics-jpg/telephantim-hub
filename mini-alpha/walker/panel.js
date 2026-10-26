/* Shared pets control panel (site pages + Mini Alpha). PetsPanel.open(anchor) */
(function () { if (window.PetsPanel) return;
  function NS() { return (window.MW_CONF || {}).ns || (window.TPPets ? "tp_" : ""); }
  var P = null, A = null;
  function S() { return window.TPPets || null; }
  function isOn() { var s = S(); if (s) return s.on(); var L = window.MiniWalkers; if (!L) return false; for (var k in L) if (L[k] && L[k].isOn && L[k].isOn()) return true; return false; }
  function who() { try { return localStorage.getItem(NS() + "miniWalkerWho") || "both"; } catch (_) { return "both"; } }
  function mode() { return window.MiniWalkerMode ? window.MiniWalkerMode() : "juke"; }
  function ready(f) { var s = S(); if (s && !s.on()) { s.set(true); } (function w(n) { if (window.MiniWalkerWho || n > 60) { try { f(); } catch (_) {} paint(); } else setTimeout(function () { w(n + 1); }, 100); })(0); }
  function radioEl() { var a = document.getElementById("music-audio"), b2 = document.getElementById("music-audio-b"); return a && b2 && b2.currentSrc && (!b2.paused || a.paused && b2.currentTime > a.currentTime) ? b2 : a; }
  function radioOn() { return [].some.call(document.querySelectorAll("audio,video"), function (v) { return !v.paused && !v.muted && v.id !== "bio-video"; }) || !!(window.TPRadio && !window.TPRadio.audio.paused); }
  /* play/pause the site radio directly; only open the player shell when nothing is loaded yet (clicking the shell button while it is open would hide it) */
  function radio(on) { if (window.TPRadio && !document.getElementById("music-audio")) { if (on) window.TPRadio.audio.src && window.TPRadio.audio.paused ? window.TPRadio.audio.play().catch(function () {}) : window.TPRadio.play(); else window.TPRadio.pause(); return; } var a = radioEl(); if (!on) { [].forEach.call(document.querySelectorAll("audio"), function (v) { v.pause(); }); return; }
    if (a && a.currentSrc) { var p = a.play(); if (p && p.catch) p.catch(function () { var m = music(); if (m) m.click(); }); return; } var m = music(); if (m) m.click(); }
  function music() { return document.getElementById("btn-music") || document.getElementById("tp-radio"); }
  function build() { P = document.createElement("div"); P.id = "pets-panel"; P.setAttribute("role", "dialog"); P.setAttribute("aria-label", "Sprites controls");
    P.innerHTML = '<div class="pp-h"><b>Sprites</b><button class="pp-x" data-k="x" aria-label="Close">×</button></div>' +
      '<div class="pp-r"><button data-k="power"></button><button data-k="summon">Summon</button></div>' +
      '<div class="pp-l">Who</div><div class="pp-r pp-seg"><button data-w="both">Both</button><button data-w="cadu">Cadu</button><button data-w="nir">Nir</button></div>' +
      '<div class="pp-l">Mode</div><div class="pp-r pp-seg"><button data-m="chill" title="Floaty, drifts slowly">Chill</button><button data-m="juke" title="Fast darting">Juke</button><button data-m="follow" title="Stays near the pointer">Follow</button><button data-m="music" title="Dances">Music</button></div><div class="pp-d" aria-live="polite"></div>' +
      '<div class="pp-r"><button data-k="music" class="pp-wide">Play music</button></div>';
    P.addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; e.stopPropagation(); var k = b.dataset.k, s = S();
      if (k === "x") return close();
      if (k === "power") { if (s) s.set(!s.on()); else if (window.MiniWalkerWho) window.MiniWalkerWho(isOn() ? "off" : "both"); setTimeout(paint, 300); }
      if (k === "summon") ready(function () { if (window.MiniWalkerSummon) window.MiniWalkerSummon(); else window.MiniWalkerWho(who() === "off" ? "both" : who()); });
      if (b.dataset.w) { var w = b.dataset.w; ready(function () { window.MiniWalkerWho(w); }); }
      if (b.dataset.m) { if (window.MiniWalkerMode) window.MiniWalkerMode(b.dataset.m); else try { localStorage.setItem(NS() + "miniWalkerMode", b.dataset.m); } catch (_) {} if (s && s.repaint) s.repaint(); }
      if (k === "music") radio(!radioOn());
      if (b.dataset.m === "music" && !radioOn()) radio(true); /* Music mode starts the radio */
      setTimeout(paint, 60); });
    var H = P.querySelector(".pp-h"); H.style.cursor = "move"; H.style.touchAction = "none"; H.title = "Drag to move";
    H.addEventListener("pointerdown", function (e) { if (e.target.closest("button")) return; var r = P.getBoundingClientRect(); pd = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top }; try { H.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); });
    H.addEventListener("pointermove", function (e) { if (!pd || e.pointerId !== pd.id) return; P.style.left = Math.max(4, Math.min(innerWidth - P.offsetWidth - 4, pd.ox + e.clientX - pd.sx)) + "px"; P.style.top = Math.max(4, Math.min(innerHeight - P.offsetHeight - 4, pd.oy + e.clientY - pd.sy)) + "px"; });
    var pe = function () { if (!pd) return; pd = null; var r = P.getBoundingClientRect(); try { localStorage.setItem("sprite_panel_pos", JSON.stringify({ fx: r.left / innerWidth, fy: r.top / innerHeight })); } catch (_) {} };
    H.addEventListener("pointerup", pe); H.addEventListener("pointercancel", pe);
    document.body.appendChild(P); }
  function paint() { if (!P) return; var on = isOn(), w = who(), m = mode(), mu = music();
    var pw = P.querySelector('[data-k="power"]'); pw.textContent = on ? "Sprites off" : "Sprites on"; pw.classList.toggle("on", on);
    [].forEach.call(P.querySelectorAll("[data-w]"), function (b) { b.classList.toggle("on", on && b.dataset.w === w); });
    [].forEach.call(P.querySelectorAll("[data-m]"), function (b) { b.classList.toggle("on", b.dataset.m === m); b.setAttribute("aria-pressed", b.dataset.m === m ? "true" : "false"); }); var D = { chill: "Chill: floaty, drifts slowly", juke: "Juke: fast darting", follow: "Follow: stays near the pointer", music: "Music: dances" }; P.querySelector(".pp-d").textContent = "Mode: " + (D[m] || m);
    var mb = P.querySelector('[data-k="music"]'); mb.style.display = mu ? "" : "none"; if (mu) mb.textContent = (document.getElementById("music-audio") || window.TPRadio) ? (radioOn() ? "Pause music" : "Play music") : ((mu.textContent || "").replace(/[♪\s]+/g, " ").trim() || "Play music"); }
  var pd = null;
  function place() { if (!P) return; if (pd) return; var SP = null; try { SP = JSON.parse(localStorage.getItem("sprite_panel_pos") || "null"); } catch (_) {}
    if (SP && isFinite(SP.fx)) { var w0 = P.offsetWidth, h0 = P.offsetHeight; P.style.left = Math.round(Math.max(8, Math.min(innerWidth - w0 - 8, SP.fx * innerWidth))) + "px"; P.style.top = Math.round(Math.max(8, Math.min(innerHeight - h0 - 8, SP.fy * innerHeight))) + "px"; return; }
    if (!A) return; var r = A.getBoundingClientRect(), w = P.offsetWidth, h = P.offsetHeight, W = innerWidth, H = innerHeight;
    var x = Math.max(8, Math.min(W - w - 8, r.left + r.width / 2 - w / 2)), y = r.top - h - 10; if (y < 8) y = r.bottom + 10; if (y + h > H - 8) y = Math.max(8, H - h - 8);
    P.style.left = Math.round(x) + "px"; P.style.top = Math.round(y) + "px"; }
  function open(a) { if (!P) build(); A = a || A; P.classList.add("open"); paint(); place(); var f = P.querySelector('[data-k="power"]'); try { f.focus({ preventScroll: true }); } catch (_) {} }
  function close() { if (P) P.classList.remove("open"); }
  function isOpen() { return !!(P && P.classList.contains("open")); }
  document.addEventListener("click", function (e) { if (isOpen() && !P.contains(e.target) && !(A && A.contains(e.target))) close(); }, true);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  addEventListener("resize", place); addEventListener("scroll", place, { passive: true });
  if (!document.getElementById("pets-panel-css")) { var st = document.createElement("style"); st.id = "pets-panel-css";
    st.textContent = '#pets-panel{position:fixed;z-index:140;display:none;width:min(280px,calc(100vw - 16px));box-sizing:border-box;padding:10px 12px 12px;border-radius:14px;background:rgba(11,26,51,.96);border:1px solid rgba(212,166,58,.7);box-shadow:0 8px 28px rgba(11,26,51,.6);color:#dfe6f0;font:600 13px/1.3 system-ui,sans-serif}#pets-panel.open{display:block}#pets-panel .pp-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;color:#f4d782;letter-spacing:.06em;text-transform:uppercase}#pets-panel .pp-l{margin:8px 0 4px;font-size:11px;color:#8e9bb0;letter-spacing:.06em;text-transform:uppercase}#pets-panel .pp-r{display:flex;gap:6px}#pets-panel .pp-r+.pp-r{margin-top:8px}#pets-panel button{flex:1;min-height:38px;border-radius:10px;border:1px solid rgba(142,155,176,.55);background:#1b2a45;color:#dfe6f0;font:700 13px system-ui,sans-serif;cursor:pointer}#pets-panel button.on{background:#d4a63a;color:#0b1a33;border-color:#f4d782}#pets-panel .pp-seg button{padding:0 2px;font-size:12px}#pets-panel .pp-d{margin-top:6px;font-size:11px;color:#8e9bb0}#pets-panel .pp-x{flex:0 0 32px;min-height:32px;font-size:18px;line-height:1}#pets-panel button:focus-visible{outline:2px solid #f4d782;outline-offset:2px}';
    document.head.appendChild(st); }
  window.PetsPanel = { open: open, close: close, isOpen: isOpen, toggle: function (a) { isOpen() ? close() : open(a); }, paint: paint };
})();
