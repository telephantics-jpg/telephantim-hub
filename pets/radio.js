/* Site radio on Mini Alpha: same "Play music" pill and playlist as the Bio tab (suno-catalog.json).
   On the main page it only saves what the site radio is playing, so Mini can resume at the same spot. No microphone. */
(function () { if (window.top !== window || window.__tpRadio) return; window.__tpRadio = 1;
  var KEY = "radio_now";
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (_) {} }
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) { return null; } }
  var site = document.getElementById("music-audio");
  if (site) { /* main page: remember track + time */
    setInterval(function () { var a = [document.getElementById("music-audio"), document.getElementById("music-audio-b")].filter(function (x) { return x && x.currentSrc; }).sort(function (x, y) { return (x.paused ? 1 : 0) - (y.paused ? 1 : 0); })[0];
      if (a) save({ src: a.currentSrc, t: a.currentTime, playing: !a.paused, at: Date.now() }); }, 1500);
    return; }
  if (!/\/mini-alpha\//.test(location.pathname)) return;
  var list = [], idx = -1, au = new Audio(); au.preload = "none";
  function local(u) { var m = /radio-mp3\/([^/?#]+\.mp3)/.exec(u || ""); return m ? "/radio-mp3/" + m[1] : null; }
  function srcOf(tr) { return tr.audio_url; }
  au.addEventListener("error", function () { var tr = list[idx]; if (tr && au.src.indexOf(location.host) >= 0 && tr.audio_url && au.src !== tr.audio_url) { au.src = tr.audio_url; au.play().catch(function () {}); } else next(); });
  au.addEventListener("ended", next);
  function next() { if (!list.length) return; idx = (idx + 1) % list.length; au.src = srcOf(list[idx]); au.play().catch(function () {}); paint(); }
  function title() { var tr = list[idx]; return tr ? tr.title : ""; }
  var b = document.createElement("button"); b.type = "button"; b.id = "tp-radio"; b.className = "btn-chip"; b.title = "Play Telephantix music (drag to move)";
  b.innerHTML = '<span class="tp-r-l">♪ Play music</span>';
  var st = document.createElement("style"); st.textContent = "#tp-radio{position:fixed;z-index:132;min-width:9.5rem;min-height:44px;padding:.6rem 1.2rem;border-radius:999px;border:2px solid rgba(212,166,58,.9);color:#0b1a33;font:900 .9rem/1.1 system-ui,sans-serif;letter-spacing:.02em;background:linear-gradient(135deg,#dfe6f0 0%,#8e9bb0 55%,#5b6b85 100%);box-shadow:0 8px 22px rgba(11,26,51,.55);cursor:grab;touch-action:none;user-select:none;white-space:nowrap;max-width:calc(100vw - 16px);overflow:hidden;text-overflow:ellipsis}#tp-radio.on{border-color:#f4d782;box-shadow:0 0 18px rgba(212,166,58,.5),0 8px 22px rgba(11,26,51,.5)}#tp-radio .tp-r-t{display:block;font-weight:700;font-size:.7rem;opacity:.85;max-width:12rem;overflow:hidden;text-overflow:ellipsis}";
  document.head.appendChild(st);
  function paint() { var on = !au.paused; b.classList.toggle("on", on); b.innerHTML = '<span class="tp-r-l">♪ ' + (on ? "Pause music" : "Play music") + "</span>" + (title() ? '<span class="tp-r-t"></span>' : ""); var t = b.querySelector(".tp-r-t"); if (t) t.textContent = title(); place(); }
  au.addEventListener("play", paint); au.addEventListener("pause", paint);
  setInterval(function () { if (au.src && !au.paused) save({ src: au.currentSrc || au.src, t: au.currentTime, playing: true, at: Date.now() }); else if (au.src && au.paused && au.currentTime) save({ src: au.currentSrc || au.src, t: au.currentTime, playing: false, at: Date.now() }); }, 1500);
  var ready = fetch("/suno-catalog.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (j) { list = (Array.isArray(j) ? j : j.tracks || []).filter(function (t) { return t && t.audio_url; }); }).catch(function () {});
  function resume(auto) { return ready.then(function () { var n = load(); if (n && n.src) { var id = (/([0-9a-f-]{36})\.mp3/.exec(n.src) || [])[1]; idx = Math.max(0, list.findIndex(function (t) { return t.id === id; })); au.src = list[idx] ? srcOf(list[idx]) : n.src; au.currentTime = 0;
        au.addEventListener("loadedmetadata", function once() { au.removeEventListener("loadedmetadata", once); try { au.currentTime = Math.max(0, n.t + (n.playing ? (Date.now() - n.at) / 1000 : 0)); } catch (_) {} });
        if (!auto || n.playing) return au.play().then(function () { paint(); }, function () { paint(); }); paint(); return; }
      if (!auto) { idx = Math.floor(Math.random() * list.length) - 1; next(); } }); }
  var dg = null;
  b.addEventListener("pointerdown", function (e) { var r = b.getBoundingClientRect(); dg = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, on: false }; });
  b.addEventListener("pointermove", function (e) { if (!dg || dg.id !== e.pointerId) return; var dx = e.clientX - dg.sx, dy = e.clientY - dg.sy; if (!dg.on && Math.hypot(dx, dy) > 8) { dg.on = true; try { b.setPointerCapture(e.pointerId); } catch (_) {} }
    if (dg.on) { b.style.left = Math.max(4, Math.min(innerWidth - b.offsetWidth - 4, dg.ox + dx)) + "px"; b.style.top = Math.max(4, Math.min(innerHeight - b.offsetHeight - 4, dg.oy + dy)) + "px"; } });
  function endD() { if (!dg) return; var d = dg; dg = null; if (!d.on) return; b.__skip = 1; var r = b.getBoundingClientRect(); try { localStorage.setItem("radio_btn_pos", JSON.stringify({ fx: r.left / innerWidth, fy: r.top / innerHeight })); } catch (_) {} }
  b.addEventListener("pointerup", endD); b.addEventListener("pointercancel", endD);
  b.addEventListener("click", function (e) { e.stopPropagation(); if (b.__skip) { b.__skip = 0; return; } if (!au.src) resume(false); else if (au.paused) au.play().catch(function () {}); else au.pause(); });
  function busy(x, y, w, h) { var all = document.querySelectorAll("button,a,input,textarea,select,[role=button],nav,header,#tp-pets-btn,#tp-pets-mode,#tp-pets-press"); for (var i = 0; i < all.length; i++) { var e = all[i]; if (e === b || b.contains(e)) continue; var r = e.getBoundingClientRect(); if (!r.width || !r.height || r.width * r.height > innerWidth * innerHeight * .3) continue; if (x < r.right + 4 && x + w > r.left - 4 && y < r.bottom + 4 && y + h > r.top - 4) return true; } return false; }
  function place() { if (dg && dg.on) return; var w = b.offsetWidth || 160, h = b.offsetHeight || 46, W = innerWidth, H = innerHeight, SP = null; if (b.style.left && !place.force) { var r0 = b.getBoundingClientRect(); if (r0.right <= W && r0.bottom <= H && !busy(r0.left, r0.top, r0.width, r0.height)) return; } try { SP = JSON.parse(localStorage.getItem("radio_btn_pos") || "null"); } catch (_) {}
    if (SP && isFinite(SP.fx)) { b.style.left = Math.max(4, Math.min(W - w - 4, SP.fx * W)) + "px"; b.style.top = Math.max(4, Math.min(H - h - 4, SP.fy * H)) + "px"; return; }
    var cx = (W - w) / 2, c = [], y; for (y = H - h - 150; y > 120; y -= 24) { c.push([cx, y]); c.push([W - w - 12, y]); c.push([12, y]); }
    for (var i = 0; i < c.length; i++) if (!busy(c[i][0], c[i][1], w, h)) { b.style.left = Math.round(c[i][0]) + "px"; b.style.top = Math.round(c[i][1]) + "px"; return; }
    b.style.left = Math.round(cx) + "px"; b.style.top = Math.round(H - h - 150) + "px"; }
  function mount() { document.body.appendChild(b); paint(); setInterval(place, 1000); addEventListener("resize", place); var n = load(); if (n && n.playing && Date.now() - n.at < 30000) resume(true); }
  if (document.body) mount(); else addEventListener("DOMContentLoaded", mount);
  window.TPRadio = { audio: au, play: function () { return resume(false); }, pause: function () { au.pause(); } };
})();
