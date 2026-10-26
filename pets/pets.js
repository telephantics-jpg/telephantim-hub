/* Telephantim site pets loader: Cadu + Nir sprite pets, local line bank, no keys, no network beyond own files.
   First appear on Relics; after that they persist on every page until the toggle puts them away. */
(function () {
  "use strict";
  if (window.top !== window || window.__tpPets) return; window.__tpPets = 1; /* never inside iframes (2D/3D/4D tabs), never twice */
  var ROOT = "/pets/", K = "tp_petsOn", V = "29";
  window.MW_CONF = { base: ROOT + "walker/", ns: "tp_", nir: true, who: "both", mode: "chill" };
  function get() { try { var g = localStorage.getItem("pets_who"); if (g) return g === "off" ? "0" : "1"; return localStorage.getItem(K); } catch (_) { return null; } }
  function last() { try { var l = localStorage.getItem("pets_last"); return l && l !== "off" ? l : "both"; } catch (_) { return "both"; } }
  function put(v) { try { var w = v === "1" ? last() : "off"; localStorage.setItem(K, v); localStorage.setItem("pets_who", w); localStorage.setItem("tp_miniWalkerWho", w); localStorage.setItem("miniWalkerWho", w); } catch (_) {} }
  var loaded = false, loading = null, btn = null;
  function css(h) { var l = document.createElement("link"); l.rel = "stylesheet"; l.href = h; document.head.appendChild(l); }
  function js(s) { return new Promise(function (ok, no) { var e = document.createElement("script"); e.src = s; e.onload = ok; e.onerror = no; document.head.appendChild(e); }); }
  function cleanLines(j) { var B = (j._banned || []).map(function (w) { return w.toLowerCase(); });
    function okLine(t) { var lw = t.toLowerCase(); if (t.split(/\s+/).length > 13) return false; return !B.some(function (b) { return b.indexOf(" ") > 0 ? lw.indexOf(b) >= 0 : new RegExp("\\b" + b + "s?\\b").test(lw); }); }
    ["cadu", "nir"].forEach(function (p) { var o = j[p] || {}; Object.keys(o).forEach(function (g) { if (Array.isArray(o[g])) o[g] = o[g].filter(okLine); else if (o[g] && typeof o[g] === "object") Object.keys(o[g]).forEach(function (k) { o[g][k] = (o[g][k] || []).filter(okLine); }); }); }); return j; }
  function load() { if (loading) return loading;
    if (window.__MW_INIT || document.querySelector('script[src*="walker/walker.js"]')) { loaded = true; return (loading = Promise.resolve()); } /* page already runs the shared walker (Mini) */
    css(ROOT + "walker/walker.css?v=" + V); css(ROOT + "dance.css?v=" + V);
    loading = fetch(ROOT + "lines.json?v=" + V).then(function (r) { return r.json(); }).then(function (j) { window.MW_LINES = cleanLines(j); }).catch(function () {})
      .then(function () { return js(ROOT + "walker/walker.js?v=" + V); }).then(function () { return js(ROOT + "dance.js?v=" + V); })
      .then(function () { loaded = true; greet(); spread(); setTimeout(spread, 1500); });
    return loading; }
  function pets() { var L = window.MiniWalkers || {}; return Object.keys(L).map(function (k) { return L[k]; }).filter(function (p) { return p && p.body && p.body().on; }); }
  function spread() { var L = window.MiniWalkers || {}, a = L.cadu, b = L.nir; if (!a || !b || !a.body || !b.body) return; var A = a.body(), B = b.body(); if (!A.on || !B.on) return;
    if (Math.abs(A.x - B.x) < Math.max(A.sz, B.sz) * 2.5) { var W = innerWidth; a.set(W * .12, A.y, 0, 0); b.set(Math.min(W - B.sz - 8, W * .72), B.y, 0, 0); } }
  var greeted = false;
  function greet() { if (greeted) return; greeted = true; setTimeout(function () { var p = pets(); if (!p.length) return; var g = p[Math.floor(Math.random() * p.length)]; g.say("greet");
      try { if (!sessionStorage.getItem("tp_sig") && Math.random() < .2 && window.MiniWalkers.nir) { sessionStorage.setItem("tp_sig", "1"); setTimeout(function () { var n = window.MiniWalkers.nir, s = (MW_LINES.nir.signature || [])[0]; if (n && s && n.body().on) { var b = document.getElementById("mw-say-nir"); if (b) { b.textContent = s; b.classList.add("on"); setTimeout(function () { b.classList.remove("on"); }, 3000); } } }, 6000); } } catch (_) {} }, 1400); }
  /* keep clear of nav, world tabs, download links, real video players, our buttons */
  var AV = "nav,header,.world-tab,.world-tabs,[id*=download],a[download],#btn-music,#btn-studio,#tp-pets-btn,#tp-pets-mode,.music-player:not([hidden]),iframe,video";
  function avoid() { if (document.hidden) return; var els = [].slice.call(document.querySelectorAll(AV)), W = innerWidth, H = innerHeight;
    var R = els.map(function (e) { return e.getBoundingClientRect(); }).filter(function (r) { return r.width > 0 && r.height > 0 && r.width * r.height < W * H * .5 && r.bottom > 0 && r.top < H; });
    pets().forEach(function (p) { var b = p.body(); if (Math.hypot(b.vx, b.vy) > 60) return; var cx = b.x + b.sz / 2, cy = b.y + b.sz / 2;
      for (var i = 0; i < R.length; i++) { var r = R[i]; if (b.x < r.right && b.x + b.sz > r.left && b.y < r.bottom && b.y + b.sz > r.top) {
          var dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2), d = Math.hypot(dx, dy) || 1; p.fling(dx / d * 520, dy / d * 520 - 120); break; } } }); }
  var lastScroll = 0, sy = scrollY;
  addEventListener("scroll", function () { if (true || !loaded || Math.abs(scrollY - sy) < 500) return; sy = scrollY; var t = Date.now(); if (t - lastScroll < 25000) return; lastScroll = t; var p = pets(); if (p.length) p[Math.floor(Math.random() * p.length)].say("scroll"); }, { passive: true });
  /* toggle button, same family as Play music */
  var SVG = '<svg viewBox="0 0 40 24" width="34" height="20" aria-hidden="true"><g fill="none" stroke-linecap="round"><path d="M8 3v19" stroke="#c9d2de" stroke-width="2"/><path d="M4 6c4 0 8 3 4 6s-4 6 4 6M12 6c-4 0-8 3-4 6s4 6-4 6" stroke="#d4a63a" stroke-width="1.6"/><circle cx="8" cy="3" r="1.8" fill="#f4d782" stroke="none"/></g><g><rect x="22" y="3" width="14" height="8" rx="1.5" fill="#8e9bb0" stroke="#d4a63a" stroke-width="1"/><rect x="28" y="11" width="2.6" height="10" rx="1" fill="#d4a63a"/><path d="M29.3 5l-1.6 2.4h2.2l-1.4 2.4" fill="none" stroke="#0b1a33" stroke-width=".9"/></g></svg>';
  function paint() { var on = get() === "1"; btn.classList.toggle("on", on); btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.title = on ? "Put Cadu and Nir away" : "Summon Cadu and Nir"; if (!btn.querySelector(".tp-face")) { btn.innerHTML = '<canvas class="tp-face" width="56" height="56" aria-hidden="true"></canvas><span class="tp-pl"></span>'; FaceStart(btn.querySelector(".tp-face")); }
    btn.querySelector(".tp-pl").textContent = on ? "Sprites on" : "Sprites"; }
  /* live canvas face: follows the pets' mood from walker.js */
  var RMq = matchMedia("(prefers-reduced-motion: reduce)"), FC = null, fctx = null, mood = "sleep", prevMood = "sleep", mix = 1, lastF = 0, fRaf = 0, t0 = performance.now();
  function getMood() { try { if (get() === "1" && window.MiniWalkerMood) return window.MiniWalkerMood(); } catch (_) {} return get() === "1" ? "calm" : "sleep"; }
  var COL = { navy: "11,26,51", steel: "142,155,176", gold: "212,166,58", goldL: "244,215,130", ember: "224,122,31", red: "179,32,32", ice: "140,224,255" };
  function rgba(c, a) { return "rgba(" + COL[c] + "," + a.toFixed(3) + ")"; }
  function drawMood(m, t, a) { var c = fctx, R = 28, cx = 28, cy = 28; if (a <= 0.01) return; c.save(); c.globalAlpha = a;
    if (m === "calm") { for (var i = 0; i < 3; i++) { c.beginPath(); c.strokeStyle = rgba(i ? "steel" : "ice", .55 - i * .12); c.lineWidth = 3 - i * .6; var r0 = 9 + i * 5, s0 = t * (.35 + i * .12) + i * 2; c.arc(cx, cy, r0, s0, s0 + 2.2); c.stroke(); } }
    else if (m === "chatty") { c.beginPath(); c.strokeStyle = rgba("steel", .5); c.lineWidth = 1.5; c.arc(cx, cy, 14, 0, 6.283); c.stroke(); for (var j = 0; j < 3; j++) { var an = t * 2.2 + j * 2.094; c.beginPath(); c.fillStyle = rgba(j ? "gold" : "goldL", .95); c.arc(cx + Math.cos(an) * 14, cy + Math.sin(an) * 14, 3.2, 0, 6.283); c.fill(); }
      var rp = (t * 18) % 18; c.beginPath(); c.strokeStyle = rgba("gold", .5 * (1 - rp / 18)); c.lineWidth = 1.2; c.arc(cx, cy, 4 + rp, 0, 6.283); c.stroke(); }
    else if (m === "duel") { for (var k = 0; k < 9; k++) { var ak = k * .698 + t * .9, ph = (t * 1.6 + k * .37) % 1, r1 = 5 + ph * 19; c.beginPath(); c.strokeStyle = rgba(k % 2 ? "ember" : "red", .9 * (1 - ph)); c.lineWidth = 2.2; c.moveTo(cx + Math.cos(ak) * r1, cy + Math.sin(ak) * r1); c.lineTo(cx + Math.cos(ak) * (r1 + 5), cy + Math.sin(ak) * (r1 + 5)); c.stroke(); }
      c.beginPath(); c.fillStyle = rgba("ember", .8); c.arc(cx, cy, 4, 0, 6.283); c.fill(); }
    else if (m === "music") { var bpm = 112; try { bpm = window.MiniDance.state().bpm || 112; } catch (_) {} var bt = (t * bpm / 60) % 1, pu = Math.pow(1 - bt, 3);
      c.beginPath(); c.fillStyle = rgba("gold", .25 + .5 * pu); c.arc(cx, cy, 8 + pu * 6, 0, 6.283); c.fill(); c.beginPath(); c.strokeStyle = rgba("goldL", .8 * (1 - bt)); c.lineWidth = 2; c.arc(cx, cy, 10 + bt * 16, 0, 6.283); c.stroke(); }
    else if (m === "juke") { for (var q = 0; q < 5; q++) { var ph2 = (t * 2.6 + q * .2) % 1, y = 12 + q * 8, x0 = -10 + ph2 * 76; c.beginPath(); c.strokeStyle = rgba(q % 2 ? "ice" : "gold", .8 * Math.sin(ph2 * 3.14)); c.lineWidth = 2; c.moveTo(x0, y); c.lineTo(x0 + 14, y - 3); c.stroke(); } }
    else { var g = .35 + .2 * Math.sin(t * .8), gr = c.createRadialGradient(cx, cy, 2, cx, cy, 22); gr.addColorStop(0, rgba("steel", g)); gr.addColorStop(1, rgba("navy", 0)); c.fillStyle = gr; c.fillRect(0, 0, 56, 56); }
    c.restore(); }
  function frameF(now) { fRaf = 0; if (!FC || !FC.isConnected) return; if (document.hidden) return; var m = getMood(); if (m !== mood) { prevMood = mood; mood = m; mix = 0; }
    var still = RMq.matches; if (!still && now - lastF < 50) { fRaf = requestAnimationFrame(frameF); return; } lastF = now; var t = still ? 1.3 : (now - t0) / 1000;
    mix = still ? 1 : Math.min(1, mix + .06); var c = fctx; c.clearRect(0, 0, 56, 56);
    c.save(); c.beginPath(); c.arc(28, 28, 27, 0, 6.283); c.clip(); var bg = c.createRadialGradient(28, 24, 4, 28, 28, 30); bg.addColorStop(0, "#1b2a45"); bg.addColorStop(1, "#0b1a33"); c.fillStyle = bg; c.fillRect(0, 0, 56, 56);
    drawMood(prevMood, t, 1 - mix); drawMood(mood, t, mix); c.restore(); c.beginPath(); c.strokeStyle = rgba(get() === "1" ? "gold" : "steel", .9); c.lineWidth = 2; c.arc(28, 28, 26.5, 0, 6.283); c.stroke();
    FC.dataset.mood = mood; if (still) { setTimeout(function () { if (!fRaf) fRaf = requestAnimationFrame(frameF); }, 1000); return; } fRaf = requestAnimationFrame(frameF); }
  function FaceStart(cv) { FC = cv; fctx = cv.getContext("2d"); if (!fRaf) fRaf = requestAnimationFrame(frameF); }
  document.addEventListener("visibilitychange", function () { if (!document.hidden && FC && !fRaf) fRaf = requestAnimationFrame(frameF); });
  var lbl = null;
  function placeLabel() { if (!lbl) { lbl = document.createElement("div"); lbl.id = "tp-pets-press"; lbl.textContent = "Press me"; lbl.setAttribute("aria-hidden", "true"); document.body.appendChild(lbl); }
    var r = btn.getBoundingClientRect(), w = lbl.offsetWidth || 60, h = lbl.offsetHeight || 14, x = r.left + (r.width - w) / 2, y = r.bottom + 3;
    var cl = function (v) { return Math.max(4, Math.min(innerWidth - w - 4, v)); }, my = r.top + (r.height - h) / 2;
    var cr = chip && chip.offsetWidth ? chip.getBoundingClientRect() : null, cs = [[cl(x), y], [cl(x), r.top - h - 3], [r.left - w - 4, my], [r.right + 4, my]], pick = null;
    for (var i = 0; i < cs.length && !pick; i++) { var c0 = cs[i]; if (c0[0] >= 2 && c0[0] + w <= innerWidth - 2 && c0[1] >= 2 && c0[1] + h <= innerHeight - 2 && !hits(c0[0], c0[1], w, h, lbl) && !(cr && c0[0] < cr.right + 3 && c0[0] + w > cr.left - 3 && c0[1] < cr.bottom + 3 && c0[1] + h > cr.top - 3)) pick = c0; }
    lbl.style.display = pick ? "" : "none"; if (!pick) return; lbl.style.left = Math.round(pick[0]) + "px"; lbl.style.top = Math.round(pick[1]) + "px"; }
  function hits(x, y, w, h, self) { var all = document.querySelectorAll("button,a,.btn-chip,[role=button],video[controls],iframe"); for (var i = 0; i < all.length; i++) { var e = all[i]; if (e === btn || btn.contains(e) || e === chip || e === self) continue; var r = e.getBoundingClientRect(); if (!r.width || !r.height || r.width * r.height > innerWidth * innerHeight * .4) continue; if (x < r.right + 4 && x + w > r.left - 4 && y < r.bottom + 4 && y + h > r.top - 4) return true; } return false; }
  var bDrag = null;
  function place() { if (!btn) return; var m = document.getElementById("btn-music"), r = m && m.getBoundingClientRect(), w = btn.offsetWidth || 56, h = btn.offsetHeight || 48, W = innerWidth, H = innerHeight, c = [];
    if (r && r.width) { var my = r.top + (r.height - h) / 2; c.push([r.right + 10, my], [r.left - 10 - w, my], [r.left + (r.width - w) / 2, r.top - h - 10], [r.left + (r.width - w) / 2, r.top - 2 * h - 20]); }
    c.push([W - w - 12, H - h - 14], [W - w - 12, H - 2 * h - 28], [12, H - 2 * h - 28], [W - w - 12, 70]);
    var pick = null; for (var i = 0; i < c.length; i++) { var x = c[i][0], y = c[i][1]; if (x < 8 || y < 8 || x + w > W - 8 || y + h > H - 8) continue; if (!hits(x, y, w, h)) { pick = c[i]; break; } }
    if (!pick) { var cw = (chip && chip.offsetWidth || 80) + 8; for (var yy = H - h - 110; yy > 90 && !pick; yy -= 20) { var xs = [W - w - cw - 10, 10, (W - w - cw) / 2]; for (var k = 0; k < 3; k++) { if (xs[k] >= 8 && !hits(xs[k], yy, w + cw, h + 22)) { pick = [xs[k], yy]; break; } } } } /* scan for a free spot (Mini 390 has a full bottom bar) */
    if (!pick) pick = c[0][0] >= 8 && c[0][0] + w <= W - 8 ? c[0] : [W - w - 12, H - h - 14];
    if (bDrag && bDrag.on) return; var SP = null; try { SP = JSON.parse(localStorage.getItem("sprite_btn_pos") || "null"); } catch (_) {} if (SP && isFinite(SP.fx)) pick = [Math.max(8, Math.min(W - w - 8, SP.fx * W)), Math.max(8, Math.min(H - h - 8, SP.fy * H))];
    btn.style.left = Math.round(pick[0]) + "px"; btn.style.top = Math.round(pick[1]) + "px"; btn.style.right = btn.style.bottom = "auto"; placeChip(); placeLabel(); }
  var chip = null;
  function mode() { try { if (window.MiniWalkerMode) return window.MiniWalkerMode(); return localStorage.getItem("pets_mode") || localStorage.getItem("tp_miniWalkerMode") || "chill"; } catch (_) { return "chill"; } }
  function paintChip() { if (!chip) return; chip.innerHTML = '<span aria-hidden="true">⚙</span> Modes'; chip.title = "Sprite add-ons: who, modes, summon, music, on/off"; chip.setAttribute("aria-label", "Sprite add-ons"); chip.style.display = ""; }
  function flipMode(e) { if (e) { e.preventDefault(); e.stopPropagation(); } var O = ["chill", "juke", "follow", "music"], m = O[(O.indexOf(mode()) + 1) % 4]; try { localStorage.setItem("tp_miniWalkerMode", m); localStorage.setItem("pets_mode", m); } catch (_) {} if (window.MiniWalkerMode) window.MiniWalkerMode(m); paintChip(); }
  function placeChip() { if (!chip || chip.style.display === "none") return; var r = btn.getBoundingClientRect(), w = chip.offsetWidth || 54, h = chip.offsetHeight || 30, c = [[r.right + 6, r.top + (r.height - h) / 2], [r.left + (r.width - w) / 2, r.top - h - 6], [r.left - w - 6, r.top + (r.height - h) / 2], [r.left + (r.width - w) / 2, r.bottom + 6]], pk = null;
    for (var i = 0; i < c.length; i++) { var q = c[i]; if (q[0] < 6 || q[1] < 6 || q[0] + w > innerWidth - 6 || q[1] + h > innerHeight - 6) continue; if (!hits(q[0], q[1], w, h, chip)) { pk = q; break; } }
    if (!pk) { pk = c.filter(function (q) { return q[0] >= 6 && q[1] >= 6 && q[0] + w <= innerWidth - 6 && q[1] + h <= innerHeight - 6; })[0] || c[0]; }
    chip.style.left = Math.round(pk[0]) + "px"; chip.style.top = Math.round(pk[1]) + "px"; }
  function toggle() { var on = get() === "1"; put(on ? "0" : "1"); paint(); paintChip();
    if (!on) { load().then(function () { window.MiniWalkerWho && window.MiniWalkerWho(last()); [].forEach.call(Object.keys(window.MiniWalkers || {}), function (k) { var p = window.MiniWalkers[k]; p.show && p.show(); }); greeted = false; greet(); }); }
    else if (window.MiniWalkerWho) window.MiniWalkerWho("off"); }
  function isRelics() { return document.body && (document.body.dataset.scene === "telephantim" || /[?&]world=relics/.test(location.search)); }
  function boot() { document.documentElement.classList.add("tp-pets"); css(ROOT + "pets.css?v=" + V); var ps = document.createElement("script"); ps.src = ROOT + "panel.js?v=" + V; document.head.appendChild(ps); var rs = document.createElement("script"); rs.src = ROOT + "radio.js?v=" + V; document.head.appendChild(rs); js(ROOT + "close.js?v=" + V).then(function () { window.SpriteClose(function () { if (get() === "1") toggle(); }); }).catch(function () {});
    btn = document.createElement("button"); btn.type = "button"; btn.id = "tp-pets-btn"; btn.className = "btn-chip"; btn.addEventListener("click", function (e) { e.stopPropagation(); if (btn.__skip) { btn.__skip = 0; return; } toggle(); setTimeout(function () { if (window.PetsPanel) window.PetsPanel.paint(); }, 400); }); /* one tap summons / hides Cadu and Nir (as before) */
    btn.addEventListener("contextmenu", flipMode); var lpT; btn.addEventListener("pointerdown", function () { lpT = setTimeout(function () { lpT = "done"; flipMode(); }, 600); }); btn.addEventListener("pointerup", function (e) { if (lpT === "done") { btn.__skip = 1; } clearTimeout(lpT); lpT = null; }); btn.addEventListener("pointercancel", function () { clearTimeout(lpT); lpT = null; });
    btn.style.touchAction = "none";
    btn.addEventListener("pointerdown", function (e) { var r = btn.getBoundingClientRect(); bDrag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, on: false }; });
    btn.addEventListener("pointermove", function (e) { if (!bDrag || e.pointerId !== bDrag.id) return; var dx = e.clientX - bDrag.sx, dy = e.clientY - bDrag.sy;
      if (!bDrag.on && Math.hypot(dx, dy) > 8) { bDrag.on = true; clearTimeout(lpT); lpT = null; try { btn.setPointerCapture(e.pointerId); } catch (_) {} if (window.PetsPanel) window.PetsPanel.close(); }
      if (bDrag.on) { var w = btn.offsetWidth, h = btn.offsetHeight; btn.style.left = Math.max(4, Math.min(innerWidth - w - 4, bDrag.ox + dx)) + "px"; btn.style.top = Math.max(4, Math.min(innerHeight - h - 4, bDrag.oy + dy)) + "px"; btn.style.right = btn.style.bottom = "auto"; placeChip(); placeLabel(); } });
    var bEnd = function (e) { if (!bDrag) return; var d = bDrag; bDrag = null; if (!d.on) return; btn.__skip = 1; setTimeout(function () { btn.__skip = 0; }, 400); var r = btn.getBoundingClientRect(); try { localStorage.setItem("sprite_btn_pos", JSON.stringify({ fx: r.left / innerWidth, fy: r.top / innerHeight })); } catch (_) {} };
    btn.addEventListener("pointerup", bEnd); btn.addEventListener("pointercancel", bEnd);
    chip = document.createElement("button"); chip.type = "button"; chip.id = "tp-pets-mode"; chip.className = "btn-chip"; chip.addEventListener("click", function (e) { e.stopPropagation(); if (chip.__skip) { chip.__skip = 0; return; } if (window.PetsPanel) window.PetsPanel.toggle(chip); });
    chip.style.touchAction = "none"; var cD = null;
    chip.addEventListener("pointerdown", function (e) { var r = btn.getBoundingClientRect(); cD = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, on: false }; });
    chip.addEventListener("pointermove", function (e) { if (!cD || e.pointerId !== cD.id) return; var dx = e.clientX - cD.sx, dy = e.clientY - cD.sy; if (!cD.on && Math.hypot(dx, dy) > 8) { cD.on = true; bDrag = { on: true }; try { chip.setPointerCapture(e.pointerId); } catch (_) {} if (window.PetsPanel) window.PetsPanel.close(); }
      if (cD.on) { var w = btn.offsetWidth, h = btn.offsetHeight; btn.style.left = Math.max(4, Math.min(innerWidth - w - 4, cD.ox + dx)) + "px"; btn.style.top = Math.max(4, Math.min(innerHeight - h - 4, cD.oy + dy)) + "px"; btn.style.right = btn.style.bottom = "auto"; placeChip(); placeLabel(); } });
    var cEnd = function () { if (!cD) return; var d = cD; cD = null; bDrag = null; if (!d.on) return; chip.__skip = 1; setTimeout(function () { chip.__skip = 0; }, 400); var r = btn.getBoundingClientRect(); try { localStorage.setItem("sprite_btn_pos", JSON.stringify({ fx: r.left / innerWidth, fy: r.top / innerHeight })); } catch (_) {} };
    chip.addEventListener("pointerup", cEnd); chip.addEventListener("pointercancel", cEnd); document.body.appendChild(btn); document.body.appendChild(chip); paint(); paintChip(); place(); setInterval(place, 700); addEventListener("resize", place);
    var st = get(); if (st === "1") load();
    else if (st === null) { var chk = function () { if (get() === null && isRelics()) { put("1"); paint(); paintChip(); load(); } }; chk(); new MutationObserver(chk).observe(document.body, { attributes: true, attributeFilter: ["data-scene"] }); } }
  window.TPPets = { on: function () { return get() === "1"; }, set: function (v) { if ((get() === "1") !== !!v) toggle(); }, repaint: function () { try { paintChip(); } catch (_) {} } };
  var booted = 0; function boot1() { if (booted || !document.body) return; booted = 1; boot(); }
  function later() { (window.requestIdleCallback || function (f) { setTimeout(f, 300); })(boot1, { timeout: 2000 }); }
  if (document.readyState === "complete") later(); else { addEventListener("load", later); document.addEventListener("DOMContentLoaded", function () { if (get() === "1") boot1(); }); setTimeout(boot1, 5000); }
})();
